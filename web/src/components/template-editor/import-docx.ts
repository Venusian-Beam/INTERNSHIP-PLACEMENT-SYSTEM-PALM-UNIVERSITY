/**
 * Word (.docx) → editable HTML, in the browser (FR-T1 upload flow).
 * - mammoth converts the body (paragraphs, bold/italic, headings, lists, tables, inline images as data URIs).
 * - mammoth skips Word's page header, where the university logo and address usually sit, so the default
 *   header part is read from the .docx (a ZIP) with JSZip and its images and text are put at the top.
 * - Text typed as {{organisation.name}} etc. becomes a field chip; {{signature}} becomes the signature block.
 * The server sanitises whatever this produces (TemplateSanitizer); this is a convenience, not a trust boundary.
 */
import JSZip from "jszip";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const REL = "http://schemas.openxmlformats.org/package/2006/relationships";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function docxToHtml(file: File, fields: Record<string, string>): Promise<{ html: string; warnings: string[] }> {
  const buf = await file.arrayBuffer();
  const mammoth = (await import("mammoth")).default;
  const res = await mammoth.convertToHtml(
    { arrayBuffer: buf },
    {
      // mammoth drops paragraph alignment and underline by default; letters need both (right-aligned ref/date).
      transformDocument: keepAlignment,
      styleMap: [
        "p[style-name='align-center'] => p.align-center:fresh",
        "p[style-name='align-right'] => p.align-right:fresh",
        "p[style-name='align-justify'] => p.align-justify:fresh",
        "u => u",
      ],
    },
  );
  res.value = res.value.replace(/<p class="align-(center|right|justify)">/g, '<p style="text-align: $1">');
  const warnings = res.messages.filter((m) => m.type === "warning").map((m) => m.message);
  let header = "";
  try {
    header = await headerHtml(buf);
  } catch {
    warnings.push("The page header (logo) could not be read.");
  }
  return { html: markFields(header + res.value, fields), warnings };
}

type DocElement = { type?: string; styleName?: string; alignment?: string; children?: DocElement[] };

/** Tag aligned body paragraphs with a style name the styleMap turns into a class (then into text-align). */
function keepAlignment(el: DocElement): DocElement {
  const out: DocElement = el.children ? { ...el, children: el.children.map(keepAlignment) } : el;
  if (out.type === "paragraph" && !/^heading/i.test(out.styleName ?? "")) {
    const a = out.alignment === "both" ? "justify" : out.alignment === "end" ? "right" : out.alignment;
    if (a === "center" || a === "right" || a === "justify") return { ...out, styleName: `align-${a}` };
  }
  return out;
}

/** Turn {{key}} text into field chips and {{signature}} into the signature block. Unknown keys stay as text. */
export function markFields(html: string, fields: Record<string, string>): string {
  return html.replace(/\{\{\s*([a-z._]+)\s*\}\}/gi, (whole, key: string) => {
    if (key === "signature") return '<span data-signature="">Signature</span>';
    return fields[key] ? `<span data-field="${key}">${esc(fields[key])}</span>` : whole;
  });
}

/** The default page header of the first section: images (PNG/JPEG) and text paragraphs, with alignment. */
async function headerHtml(buf: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const parse = async (path: string) => {
    const f = zip.file(path);
    return f ? new DOMParser().parseFromString(await f.async("text"), "application/xml") : null;
  };
  const doc = await parse("word/document.xml");
  const rels = await parse("word/_rels/document.xml.rels");
  if (!doc || !rels) return "";

  const refs = Array.from(doc.getElementsByTagNameNS(W, "headerReference"));
  const ref = refs.find((r) => r.getAttributeNS(W, "type") === "default") ?? refs[0];
  const rid = ref?.getAttributeNS(R, "id");
  if (!rid) return "";
  const target = relTarget(rels, rid);
  if (!target) return "";
  const headerPath = `word/${target.replace(/^\.?\//, "")}`;
  const header = await parse(headerPath);
  const headerRels = await parse(headerPath.replace(/word\/(.+)$/, "word/_rels/$1.rels"));
  if (!header) return "";

  const out: string[] = [];
  for (const p of Array.from(header.getElementsByTagNameNS(W, "p"))) {
    const jc = p.getElementsByTagNameNS(W, "jc")[0]?.getAttributeNS(W, "val");
    const align = jc === "center" ? "center" : jc === "right" || jc === "end" ? "right" : null;
    const style = align ? ` style="text-align: ${align}"` : "";
    const parts: string[] = [];
    for (const blip of Array.from(p.getElementsByTagNameNS("http://schemas.openxmlformats.org/drawingml/2006/main", "blip"))) {
      const id = blip.getAttributeNS(R, "embed");
      const media = id && headerRels ? relTarget(headerRels, id) : null;
      const src = media ? await imageDataUri(zip, `word/${media.replace(/^\.\.\//, "").replace(/^\.?\//, "")}`) : null;
      if (src) parts.push(`<img src="${src}" alt="Letterhead">`);
    }
    const text = Array.from(p.getElementsByTagNameNS(W, "t"))
      .map((t) => t.textContent ?? "")
      .join("")
      .trim();
    if (text) parts.push(esc(text));
    if (parts.length) out.push(`<p${style}>${parts.join(" ")}</p>`);
  }
  return out.join("");
}

function relTarget(rels: Document, id: string): string | null {
  const rel = Array.from(rels.getElementsByTagNameNS(REL, "Relationship")).find((r) => r.getAttribute("Id") === id);
  return rel?.getAttribute("Target") ?? null;
}

async function imageDataUri(zip: JSZip, path: string): Promise<string | null> {
  const ext = path.split(".").pop()?.toLowerCase();
  const mime = ext === "png" ? "image/png" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : null;
  const f = zip.file(path);
  if (!mime || !f) return null; // EMF/WMF/SVG logos can't be shown in a browser or PDF safely
  return `data:${mime};base64,${await f.async("base64")}`;
}
