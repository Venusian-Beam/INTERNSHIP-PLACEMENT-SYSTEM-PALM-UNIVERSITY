// Builds e2e/fixtures/sample-letter.docx: a minimal Word letter with a logo in the page header and a body that
// uses {{reference}} and {{date}} fields plus sample names. Run: node e2e/fixtures/make-sample-docx.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import JSZip from "jszip";

const here = dirname(fileURLToPath(import.meta.url));

/** A small green crest PNG (RGBA), encoded by hand so no image library is needed. */
function crestPng(w = 48, h = 54) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const half = y < h * 0.6 ? w / 2 - 2 : (w / 2 - 2) * (1 - (y - h * 0.6) / (h * 0.4));
      const inside = Math.abs(x - w / 2) < half;
      const band = inside && y > h * 0.35 && y < h * 0.55 && Math.abs(x - w / 2) < w / 4;
      const o = y * (w * 4 + 1) + 1 + x * 4;
      const [r, g, b, a] = band ? [245, 158, 11, 255] : inside ? [21, 128, 61, 255] : [255, 255, 255, 0];
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
const p = (text, { align, bold, underline } = {}) =>
  `<w:p>${align ? `<w:pPr><w:jc w:val="${align}"/></w:pPr>` : ""}<w:r>${bold || underline ? `<w:rPr>${bold ? "<w:b/>" : ""}${underline ? '<w:u w:val="single"/>' : ""}</w:rPr>` : ""}<w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;

const logo = `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline><wp:extent cx="457200" cy="514350"/><wp:docPr id="1" name="Logo"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="logo.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdLogo"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="457200" cy="514350"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;

const zip = new JSZip();
zip.file(
  "[Content_Types].xml",
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/></Types>`,
);
zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
zip.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdHeader" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/></Relationships>`);
zip.file("word/_rels/header1.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.png"/></Relationships>`);
zip.file("word/media/logo.png", crestPng());
zip.file("word/header1.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ${NS}>${logo}${p("UNIVERSITY OF THE SAMPLE COAST · Office of Career Services", { align: "center", bold: true })}</w:hdr>`);
zip.file(
  "word/document.xml",
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>` +
    p("Our ref: {{reference}}", { align: "right" }) +
    p("{{date}}", { align: "right" }) +
    p("The Manager") +
    p("Volta Telecom Ltd") +
    p("Dear Sir/Madam,") +
    p("INTRODUCTION OF STUDENTS FOR INTERNSHIP", { bold: true, underline: true }) +
    p("We write to introduce Ama Mensah, a student of the University who wishes to undertake an internship with your organisation.") +
    p("Yours faithfully,") +
    p("President", { bold: true }) +
    `<w:sectPr><w:headerReference w:type="default" r:id="rIdHeader"/></w:sectPr></w:body></w:document>`,
);

const out = join(here, "sample-letter.docx");
writeFileSync(out, await zip.generateAsync({ type: "nodebuffer" }));
console.log("wrote", out);
