"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { Alert, Button, Card, Empty, Field, PageLoading, Textarea } from "@/components/ui";
import { ApiError, post } from "@/lib/api";
import { fmtDate, useFetch } from "@/lib/client";

type T = { id: number; version: number; status: string; remarks?: string; decided_at?: string; submitted_at?: string };
type Data = { pending: T | null; approved_version: number | null; history: T[] };

/** PR1 (D3, D4, D6): the President reviews the template once per version: approve, or reject with remarks. */
export default function PresidentPage() {
  const { data, reload } = useFetch<Data>("president/template");
  const [remarks, setRemarks] = useState("");
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  if (!data) return <PageLoading />;
  const p = data.pending;

  async function decide(path: string, body: unknown, ok: string) {
    setBusy(true);
    setMsg(null);
    try {
      await post(path, body);
      setMsg({ tone: "ok", text: ok });
      setRemarks("");
      reload();
    } catch (e) {
      const x = e as ApiError;
      setMsg({ tone: "bad", text: Object.values(x.errors ?? {}).flat()[0] ?? x.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="grid min-w-0 gap-4">
        <div>
          <p className="mb-1 text-[13px] font-medium text-muted">Introductory letter template</p>
          <h1 className="text-[22px] leading-tight font-semibold tracking-[-0.01em]">Letter template review</h1>
          <p className="mt-1.5 text-[15px] text-muted">
            {p ? `Version ${p.version} was sent by the Head of Career Services on ${fmtDate(p.submitted_at)}.` : "Nothing is waiting for your approval."}{" "}
            {data.approved_version ? `Letters currently use version ${data.approved_version}.` : ""}
          </p>
        </div>
        {msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}
        {p ? (
          <div className="rounded-[var(--radius)] border border-line bg-surface-2 p-3 sm:p-8">
            <p className="mb-3 text-center text-xs text-muted">Preview with sample names. Real letters use each group&apos;s students and organisation.</p>
            <iframe
              title={`Template version ${p.version} with sample data`}
              src={`/api/proxy/letter-template/${p.id}/preview`}
              sandbox=""
              className="mx-auto block h-[760px] w-full max-w-[794px] bg-white shadow-[var(--shadow-lg)]"
            />
          </div>
        ) : (
          <Card className="p-0">
            <Empty icon="checkCircle">You&apos;re up to date. You will see the next version here when the Head sends it.</Empty>
          </Card>
        )}
      </section>
      <aside className="grid gap-4 lg:sticky lg:top-6">
        <Card className="grid gap-4">
          <div>
            <h2 className="text-[15px] font-semibold">Your decision</h2>
            {p ? <p className="mt-0.5 text-[13px] text-muted">Version {p.version}</p> : null}
          </div>
          {p ? (
            <>
              <div className="flex items-start gap-2.5 rounded-[var(--radius)] bg-surface px-3 py-2.5 text-[13px] text-muted">
                <Icon name="info" className="mt-px size-4 text-[var(--info)]" />
                Once you approve, every new letter uses this wording with your signature on file. You won&apos;t need to review individual letters.
              </div>
              <Button disabled={busy} onClick={() => decide(`president/template/${p.id}/approve`, undefined, `Version ${p.version} approved.`)}>
                <Icon name="check" /> Approve version {p.version}
              </Button>
              <div className="flex items-center gap-3 text-xs text-faint">
                <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
              </div>
              <Field id="remarks" label="Reason for rejecting (required)">
                <Textarea id="remarks" rows={4} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="For example: shorten paragraph 2" />
              </Field>
              <Button variant="danger" disabled={busy || remarks.trim().length < 3} onClick={() => decide(`president/template/${p.id}/remarks`, { remarks }, "Remarks sent to Career Services.")}>
                Reject with remarks
              </Button>
              <p className="text-xs text-muted">If you reject, Career Services revises the template. Letters keep using the current approved version meanwhile.</p>
            </>
          ) : (
            <p className="text-sm text-muted">No version is waiting for a decision.</p>
          )}
        </Card>
        <Card className="grid gap-3">
          <h2 className="text-[15px] font-semibold">History</h2>
          {data.history.length ? (
            <ol className="grid gap-3 border-l border-line pl-4">
              {data.history.map((t) => (
                <li key={t.id} className="relative text-sm">
                  <span className={`absolute top-1.5 -left-[21px] size-2.5 rounded-full ring-4 ring-[var(--bg)] ${t.status === "approved" ? "bg-brand" : "bg-[var(--danger)]"}`} aria-hidden />
                  <p className="font-medium">
                    Version {t.version} · {t.status === "approved" ? "Approved" : t.status === "remarks" ? "Rejected" : t.status}
                  </p>
                  {t.status === "remarks" && t.remarks ? <p className="text-muted">&ldquo;{t.remarks}&rdquo;</p> : null}
                  <p className="text-xs text-faint">{fmtDate(t.decided_at)}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted">No decisions yet.</p>
          )}
        </Card>
      </aside>
    </div>
  );
}
