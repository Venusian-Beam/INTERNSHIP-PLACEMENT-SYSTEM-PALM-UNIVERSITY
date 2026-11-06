"use client";

import { useRef, useState, type DragEvent } from "react";
import { FileUpload } from "@/components/file-upload";
import { Icon } from "@/components/icons";
import { docxToHtml } from "@/components/template-editor/import-docx";
import { FIELD_LABELS, TemplateEditor, type TemplateInfo } from "@/components/template-editor/template-editor";
import { Alert, Badge, Button, Card, cx, PageHeader, PageLoading } from "@/components/ui";
import { api, ApiError, post } from "@/lib/api";
import { fmtDate, uploadFile, useFetch } from "@/lib/client";

type T = { id: number; version: number; status: string; remarks?: string; body?: string; format?: "text" | "html"; source_name?: string; submitted_at?: string; decided_at?: string };
type Data = { approved: T | null; working: T | null; history: T[]; placeholders: Record<string, string>; has_signature: boolean };

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const tone: Record<string, "ok" | "info" | "warn" | "neutral"> = { approved: "ok", with_president: "info", remarks: "warn", draft: "neutral", superseded: "neutral" };
const label: Record<string, string> = { approved: "Approved", with_president: "With President", remarks: "Rejected with remarks", draft: "Draft", superseded: "Superseded" };

/**
 * H2 (FR-T1–T5, upload flow): the Head uploads the letter Career Services uses (Word/Google Docs .docx, or PDF),
 * edits it in the browser (fields, signature placement, wording), then sends it to the President for approval.
 */
export default function TemplatePage() {
  const { data, reload } = useFetch<Data>("letter-template");
  const [msg, setMsg] = useState<{ tone: "ok" | "bad" | "info"; text: string } | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [info, setInfo] = useState<TemplateInfo>({ fields: new Set(), signature: false });
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [replacing, setReplacing] = useState(false);
  const [preview, setPreview] = useState(0);
  const [editorKey, setEditorKey] = useState(0);
  if (!data) return <PageLoading label="Loading the template" />;

  const working = data.working;
  const uploaded = working?.format === "html" ? working : null;
  const locked = working?.status === "with_president";
  const showUpload = !uploaded || replacing;

  const checks = [
    { ok: info.fields.has("reference"), text: "Reference number" },
    { ok: info.fields.has("organisation.name"), text: "Organisation name" },
    { ok: info.fields.has("students.table") || info.fields.has("students.names"), text: "Students (table or names)" },
    { ok: info.signature, text: "Signature" },
  ];
  const ready = checks.every((c) => c.ok);

  function fail(e: unknown) {
    const x = e as ApiError;
    setMsg({ tone: "bad", text: Object.values(x.errors ?? {}).flat()[0] ?? x.message });
  }

  async function onFile(f: File) {
    setMsg(null);
    const name = f.name.toLowerCase();
    if (name.endsWith(".doc")) {
      setMsg({ tone: "bad", text: "This is an older Word file (.doc). Open it in Word, choose File → Save As → Word Document (.docx), then upload that file." });
      return;
    }
    const isDocx = name.endsWith(".docx");
    if (!isDocx && !name.endsWith(".pdf")) {
      setMsg({ tone: "bad", text: "Upload a Word (.docx) or PDF file. From Google Docs: File → Download → Microsoft Word (.docx)." });
      return;
    }
    try {
      setBusy("Uploading the file…");
      const up = await uploadFile(new File([f], f.name, { type: isDocx ? DOCX : "application/pdf" }), "template_source");
      setBusy("Turning it into an editable document…");
      let body: string;
      let warns: string[] = [];
      if (isDocx) {
        ({ html: body, warnings: warns } = await docxToHtml(f, FIELD_LABELS));
      } else {
        body = (await post<{ html: string }>("letter-template/import", { file_id: up.id })).html;
        warns = ["From a PDF only the text comes across: check the wording, and add the letterhead by uploading the Word version if you have it."];
      }
      setBusy("Saving the draft…");
      await api("letter-template/draft", { method: "PUT", body: JSON.stringify({ format: "html", body, source_file_id: up.id }) });
      setWarnings(warns);
      setReplacing(false);
      setDirty(false);
      setPreview(0);
      await reload();
      setEditorKey((k) => k + 1);
      setMsg({ tone: "ok", text: `${f.name} is ready to edit. Replace the sample names with fields, place the signature, then send it to the President.` });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (html === null) return;
    setBusy("Saving…");
    setMsg(null);
    try {
      await api("letter-template/draft", { method: "PUT", body: JSON.stringify({ format: "html", body: html }) });
      setDirty(false);
      await reload();
      // Reload the editor from what the server stored (after sanitising), so "unsaved" compares against it.
      setEditorKey((k) => k + 1);
      setMsg({ tone: "ok", text: "Draft saved." });
      if (preview) setPreview((p) => p + 1);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  }

  async function send() {
    if (!uploaded) return;
    setBusy("Sending…");
    setMsg(null);
    try {
      await post(`letter-template/${uploaded.id}/submit`);
      await reload();
      setMsg({ tone: "ok", text: `Version ${uploaded.version} sent to the President for approval.` });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-5">
      <PageHeader
        back={{ href: "/staff", label: "Dashboard" }}
        crumbs={[{ label: "Home", href: "/staff" }, { label: "Settings" }, { label: "Letter template" }]}
        title="Letter template"
        sub="Upload the introductory letter you use, edit it here, then send it to the President. Every new letter uses the version the President approved."
        actions={
          data.approved ? (
            <span className="inline-flex items-center gap-2 rounded-[8px] border border-line bg-bg px-3 py-2 text-[12.5px]">
              <Icon name="checkCircle" className="size-4 text-brand" />
              Letters use version {data.approved.version}
            </span>
          ) : null
        }
      />

      <Steps current={!uploaded ? 1 : locked ? 3 : 2} />

      {msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}
      {working?.status === "remarks" ? (
        <Alert tone="warn">
          The President rejected version {working.version}: &ldquo;{working.remarks}&rdquo;. Edit and save to start version {working.version + 1}, or upload a revised file.
        </Alert>
      ) : null}
      {locked ? <Alert>Version {working!.version} is with the President. You can edit again after a decision.</Alert> : null}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid min-w-0 gap-4">
          {showUpload ? (
            <UploadCard busy={busy} onFile={onFile} hasDraft={!!uploaded} onCancel={replacing ? () => setReplacing(false) : undefined} disabled={locked} />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-[13px] text-muted">
                  <Icon name="doc" className="size-4" />
                  Version {uploaded!.version}
                  {uploaded!.source_name ? <> · from <b className="font-medium text-text">{uploaded!.source_name}</b></> : null}
                  <Badge tone={tone[uploaded!.status]}>{label[uploaded!.status]}</Badge>
                  {dirty ? <span className="text-[12px] text-[var(--warn)]">Unsaved changes</span> : null}
                </p>
                {!locked ? (
                  <Button size="sm" variant="ghost" onClick={() => setReplacing(true)} disabled={!!busy}>
                    <Icon name="upload" /> Upload a different file
                  </Button>
                ) : null}
              </div>
              {warnings.length ? (
                <Alert tone="warn">
                  <ul className="list-disc pl-4">
                    {warnings.slice(0, 4).map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </Alert>
              ) : null}
              <TemplateEditor
                key={`${uploaded!.id}-${editorKey}`}
                content={uploaded!.body ?? ""}
                editable={!locked}
                fields={data.placeholders}
                onChange={(h, i, d) => {
                  setHtml(h);
                  setInfo(i);
                  setDirty(d);
                }}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" onClick={save} disabled={locked || !dirty || !!busy}>
                  <Icon name="checkCircle" /> {busy === "Saving…" ? "Saving…" : "Save draft"}
                </Button>
                <Button variant="ghost" onClick={() => setPreview((p) => p + 1)} disabled={!!busy}>
                  <Icon name="eye" /> Preview with sample data
                </Button>
                <span className="flex-1" />
                {uploaded!.status === "draft" ? (
                  <Button onClick={send} disabled={!ready || dirty || !!busy} title={!ready ? "Complete the checklist first" : dirty ? "Save the draft first" : undefined}>
                    <Icon name="send" /> Send version {uploaded!.version} to the President
                  </Button>
                ) : null}
              </div>
              {uploaded!.status === "draft" && (!ready || dirty) ? (
                <p className="text-right text-[12px] text-muted">{dirty ? "Save the draft before sending." : "Complete the checklist on the right before sending."}</p>
              ) : null}
              {preview ? (
                <div className="rounded-[var(--radius)] border border-line bg-surface-2 p-3 sm:p-6">
                  <p className="mb-3 text-center text-xs text-muted">Last saved version, filled with sample names. Real letters use each group&apos;s students and organisation.</p>
                  <iframe
                    key={preview}
                    title="Template preview with sample data"
                    src={`/api/proxy/letter-template/${uploaded!.id}/preview`}
                    sandbox=""
                    className="mx-auto block h-[760px] w-full max-w-[794px] bg-white shadow-[var(--shadow-lg)]"
                  />
                </div>
              ) : null}
            </>
          )}
        </div>

        <aside className="grid content-start gap-4">
          {uploaded && !showUpload ? (
            <Card className="grid gap-3">
              <h2 className="text-[14px] font-semibold">Ready to send</h2>
              <ul className="grid gap-2 text-[13px]" aria-label="Checklist">
                {checks.map((c) => (
                  <li key={c.text} className="flex items-center gap-2">
                    <span className={cx("grid size-5 place-items-center rounded-full", c.ok ? "bg-brand text-white" : "border-[1.5px] border-dashed border-line-strong text-faint")}>
                      {c.ok ? <Icon name="check" className="size-3.5" /> : null}
                    </span>
                    <span className={c.ok ? "" : "text-muted"}>{c.text}</span>
                  </li>
                ))}
              </ul>
              <p className="rounded-[8px] bg-[color-mix(in_srgb,var(--c-amber)_10%,white)] px-3 py-2 text-[12px] leading-relaxed text-muted">
                Select a sample name or company in the letter, then use <b className="text-text">Insert field</b> so each letter fills it in. Put the <b className="text-text">Signature</b> where the President signs.
              </p>
            </Card>
          ) : null}
          <Card className="grid gap-2 text-[13px]">
            <h2 className="text-[14px] font-semibold">Signature on file</h2>
            <p className="text-muted">
              {data.has_signature ? "A signature image is stored. It is only placed inside letters, never shown or downloaded." : "No signature yet. Letters show [Signature on file]."}
            </p>
            <FileUpload
              kind="signature"
              accept="image/png"
              label={data.has_signature ? "Replace signature (PNG)" : "Upload signature (PNG)"}
              onUploaded={async (f) => {
                try {
                  await post("letter-template/signature", { file_id: f.id });
                  await reload();
                  setMsg({ tone: "ok", text: "Signature saved." });
                } catch (e) {
                  fail(e);
                }
              }}
            />
          </Card>
          <Card className="grid gap-2.5 text-[13px]">
            <h2 className="text-[14px] font-semibold">Versions</h2>
            {data.history.map((t) => (
              <div key={t.id} className="flex items-start justify-between gap-2">
                <span className="min-w-0">
                  <span className="block font-medium">Version {t.version}</span>
                  <span className="block truncate text-[11.5px] text-muted">
                    {t.source_name ?? (t.format === "html" ? "Uploaded" : "Typed text")}
                    {t.decided_at ? ` · ${fmtDate(t.decided_at)}` : ""}
                  </span>
                </span>
                <Badge tone={tone[t.status]}>{label[t.status]}</Badge>
              </div>
            ))}
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Steps({ current }: { current: 1 | 2 | 3 }) {
  const steps = ["Upload your letter", "Edit and place fields", "President approves"];
  return (
    <ol className="grid gap-2 sm:grid-cols-3" aria-label="Steps">
      {steps.map((s, i) => {
        const n = i + 1;
        const state = n < current ? "done" : n === current ? "now" : "next";
        return (
          <li
            key={s}
            aria-current={state === "now" ? "step" : undefined}
            className={cx(
              "flex items-center gap-3 rounded-[var(--radius)] border px-4 py-3 text-[13px]",
              state === "now" ? "border-brand bg-brand-soft font-semibold text-brand" : state === "done" ? "border-line bg-bg text-text" : "border-line bg-bg text-muted",
            )}
          >
            <span className={cx("grid size-6 place-items-center rounded-full text-[12px] font-semibold", state === "next" ? "bg-surface-2 text-muted" : "bg-brand text-white")}>
              {state === "done" ? <Icon name="check" className="size-3.5" /> : n}
            </span>
            {s}
          </li>
        );
      })}
    </ol>
  );
}

function UploadCard({ busy, onFile, hasDraft, onCancel, disabled }: { busy: string | null; onFile: (f: File) => void; hasDraft: boolean; onCancel?: () => void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f && !busy && !disabled) onFile(f);
  };
  return (
    <section
      aria-label="Upload the letter template"
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={drop}
      className={cx(
        "grid place-items-center gap-4 rounded-[var(--radius)] border-2 border-dashed bg-bg px-6 py-14 text-center transition-colors",
        over ? "border-brand bg-brand-soft/60" : "border-line-strong",
      )}
    >
      <span className="grid size-14 place-items-center rounded-full bg-brand-soft text-brand">
        <Icon name={busy ? "refresh" : "fileUpload"} className={cx("size-7", busy && "animate-spin")} />
      </span>
      <div>
        <h2 className="text-[16px] font-semibold">{busy ?? (hasDraft ? "Upload a different file" : "Upload the letter you use")}</h2>
        <p className="mt-1 text-[13px] text-muted">Drag the file here, or choose it. The logo and letterhead in the file appear on every letter.</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={() => input.current?.click()} disabled={!!busy || disabled}>
          <Icon name="upload" /> Choose a file
        </Button>
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel} disabled={!!busy}>
            Keep the current draft
          </Button>
        ) : null}
      </div>
      <input
        ref={input}
        type="file"
        className="sr-only"
        aria-label="Letter template file"
        accept=".docx,.pdf,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onFile(f);
        }}
      />
      <div className="flex flex-wrap justify-center gap-2 text-[12px] text-muted">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--c-blue)_10%,white)] px-3 py-1 text-[#1d4ed8]">
          <Icon name="doc" className="size-3.5" /> Word .docx (best)
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--c-teal)_12%,white)] px-3 py-1 text-[#0f766e]">
          <Icon name="doc" className="size-3.5" /> Google Docs → Download as .docx
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--c-red)_10%,white)] px-3 py-1 text-[#b91c1c]">
          <Icon name="doc" className="size-3.5" /> PDF (text only)
        </span>
      </div>
    </section>
  );
}
