"use client";

import { useState } from "react";
import { FileUpload } from "@/components/file-upload";
import { Alert, Button, Card, PageHeader } from "@/components/ui";
import { ApiError, post } from "@/lib/api";

type Preview = { total: number; valid: number; new: number; updates: number; error_count: number; errors: { row: number; error: string }[]; sample: Record<string, string>[] };

/** H4: registry CSV import with a preview before committing (FR-S2, D30). Head only. */
export default function RegistryImportPage() {
  const [fileId, setFileId] = useState<number | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run<T>(fn: () => Promise<T>) {
    setBusy(true);
    setErr(null);
    try {
      return await fn();
    } catch (e) {
      const x = e as ApiError;
      setErr(Object.values(x.errors).flat()[0] ?? x.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      <PageHeader
        back={{ href: "/staff", label: "Dashboard" }}
        crumbs={[{ label: "Home", href: "/staff" }, { label: "Settings" }, { label: "Registry import" }]}
        title="Registry import"
        sub="Upload the registry's student list as CSV. Columns: email, full_name, student_number, programme, level (optional: expected_grad_year). Rows are matched by university email."
      />
      {err ? <Alert tone="bad">{err}</Alert> : null}
      {result ? <Alert tone="ok">{result}</Alert> : null}
      <Card className="grid gap-3">
        <FileUpload
          kind="registry_csv"
          accept=".csv,text/csv"
          label="Choose CSV file"
          hint="Up to 20,000 rows. Nothing changes until you confirm the import."
          onUploaded={async (f) => {
            setFileId(f.id);
            setResult(null);
            setPreview((await run(() => post<Preview>("registry/preview", { file_id: f.id }))) ?? null);
          }}
        />
      </Card>
      {preview ? (
        <Card className="grid gap-3 text-sm">
          <h2 className="font-bold">Preview</h2>
          <p>
            {preview.total} rows · <b>{preview.new}</b> new · <b>{preview.updates}</b> updated · <b className="text-[var(--danger)]">{preview.error_count}</b> with errors (skipped)
          </p>
          {preview.errors.length ? (
            <ul className="max-h-48 list-inside list-disc overflow-y-auto text-[var(--danger)]">
              {preview.errors.map((e) => (
                <li key={e.row}>
                  Row {e.row}: {e.error}
                </li>
              ))}
            </ul>
          ) : null}
          <Button
            disabled={busy || !fileId || !preview.valid}
            onClick={async () => {
              const r = await run(() => post<{ created: number; updated: number; failed: number }>("registry/import", { file_id: fileId }));
              if (r) {
                setResult(`Imported: ${r.created} created, ${r.updated} updated, ${r.failed} skipped.`);
                setPreview(null);
              }
            }}
          >
            {busy ? "Importing…" : `Import ${preview.valid} rows`}
          </Button>
        </Card>
      ) : null}
    </div>
  );
}
