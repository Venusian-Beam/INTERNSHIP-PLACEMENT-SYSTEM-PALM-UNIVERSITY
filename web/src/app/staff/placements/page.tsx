"use client";

import { useState } from "react";
import { FileUpload } from "@/components/file-upload";
import { Alert, Badge, Button, Card, Empty, PageHeader, Select } from "@/components/ui";
import { ApiError, post } from "@/lib/api";
import { fmtDate, openFile, useFetch } from "@/lib/client";
import { useStaffUser } from "../staff-user";
import type { Organisation } from "@/lib/types";

type P = {
  id: number; status: string; application_id: number;
  student: { id: number; full_name: string; programme: string; level: number }; organisation: { id: number; name: string };
  letter: { reference_no: string; sent_at: string } | null;
  acceptance_file_id: number | null; report_file_id: number | null; evaluation_file_id: number | null;
};
type Data = { placements: P[]; needs_rematch: { application_id: number; student: { full_name: string; programme: string; level: number }; declined: string[] }[] };

const TABS = [
  ["confirm", "Acceptances to confirm"],
  ["awaiting", "Awaiting company reply"],
  ["rematch", "Needs re-match"],
  ["completion", "Completion"],
] as const;

/** T6 (FR-PL): confirm acceptances, record replies, re-match after a decline, completion documents, Head sign-off. */
export default function PlacementsPage() {
  const { data, reload } = useFetch<Data>("placements");
  const me = useStaffUser();
  const orgs = useFetch<{ organisations: Organisation[] }>("organisations?status=active");
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("confirm");
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [rematch, setRematch] = useState<Record<number, string>>({});
  const isHead = me.role === "head";

  async function act(fn: () => Promise<unknown>, ok: string) {
    setMsg(null);
    try {
      await fn();
      setMsg({ tone: "ok", text: ok });
      reload();
    } catch (e) {
      const x = e as ApiError;
      setMsg({ tone: "bad", text: Object.values(x.errors ?? {}).flat()[0] ?? x.message });
    }
  }

  if (!data) return <p className="text-muted">Loading…</p>;
  const by = (s: string[]) => data.placements.filter((p) => s.includes(p.status));
  const count = { confirm: by(["acceptance_submitted"]).length, awaiting: by(["letter_sent"]).length, rematch: data.needs_rematch.length, completion: by(["accepted"]).length };

  return (
    <div className="grid gap-4">
      <PageHeader
        back={{ href: "/staff", label: "Dashboard" }}
        crumbs={[{ label: "Home", href: "/staff" }, { label: "Placements" }]}
        title="Placements" sub="Confirm acceptances, collect completion documents; the Head signs off." />
      {msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}
      <div role="tablist" className="flex flex-wrap gap-2">
        {TABS.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${tab === k ? "border-brand bg-brand text-brand-ink" : "border-line"}`}>
            {l} ({count[k]})
          </button>
        ))}
      </div>

      {tab === "confirm" ? (
        <Rows items={by(["acceptance_submitted"])} empty="No acceptance letters waiting.">
          {(p) => (
            <>
              <Button variant="secondary" className="min-h-8 px-3 text-sm" onClick={() => p.acceptance_file_id && openFile(p.acceptance_file_id)}>View letter</Button>
              <Button className="min-h-8 px-3 text-sm" onClick={() => act(() => post(`placements/${p.id}/confirm`), `${p.student.full_name}: placement accepted.`)}>✓ Confirm</Button>
              <Button variant="danger" className="min-h-8 px-3 text-sm" onClick={() => act(() => post(`placements/${p.id}/reject-acceptance`, { reason: "Not a valid acceptance letter" }), "Returned to the student.")}>✕ Not valid</Button>
            </>
          )}
        </Rows>
      ) : null}

      {tab === "awaiting" ? (
        <Rows items={by(["letter_sent"])} empty="No letters waiting for a reply." sub={(p) => `Letter ${p.letter?.reference_no} sent ${fmtDate(p.letter?.sent_at)}`}>
          {(p) => (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted">Company replied to us?</span>
              <FileUpload kind="acceptance" accept="application/pdf" label="Accepted: upload letter" onUploaded={(f) => act(() => post(`placements/${p.id}/reply`, { result: "accepted", acceptance_file_id: f.id }), "Recorded as accepted.")} />
              <Button variant="danger" className="min-h-8 px-3 text-sm" onClick={() => act(() => post(`placements/${p.id}/reply`, { result: "declined" }), "Recorded as declined. The student needs a re-match.")}>Declined</Button>
            </div>
          )}
        </Rows>
      ) : null}

      {tab === "rematch" ? (
        <div className="grid gap-2">
          {data.needs_rematch.length ? (
            data.needs_rematch.map((r) => (
              <Card key={r.application_id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <b>{r.student.full_name}</b> <span className="text-sm text-muted">{r.student.programme} · L{r.student.level}</span>
                  <p className="text-sm text-muted">Declined by: {r.declined.join(", ")}</p>
                </div>
                <div className="flex gap-2">
                  <Select aria-label="New organisation" className="min-w-56" value={rematch[r.application_id] ?? ""} onChange={(e) => setRematch({ ...rematch, [r.application_id]: e.target.value })}>
                    <option value="">Choose an organisation…</option>
                    {orgs.data?.organisations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </Select>
                  <Button disabled={!rematch[r.application_id]} onClick={() => act(() => post("placements/rematch", { application_id: r.application_id, organisation_id: Number(rematch[r.application_id]) }), `${r.student.full_name} re-matched. Generate their letter in Letters.`)}>Re-match</Button>
                </div>
              </Card>
            ))
          ) : (
            <Empty>No students need a re-match.</Empty>
          )}
        </div>
      ) : null}

      {tab === "completion" ? (
        <Rows items={by(["accepted"])} empty="No accepted placements yet.">
          {(p) => (
            <div className="flex flex-wrap items-center gap-2">
              {p.report_file_id ? <Badge tone="ok">Report</Badge> : <Badge tone="bad">Report missing</Badge>}
              {p.evaluation_file_id ? (
                <Badge tone="ok">Evaluation form</Badge>
              ) : (
                <FileUpload kind="evaluation" accept="application/pdf" label="Upload evaluation form" onUploaded={(f) => act(() => post(`placements/${p.id}/evaluation`, { file_id: f.id }), "Evaluation form saved.")} />
              )}
              {isHead ? (
                <Button className="min-h-8 px-3 text-sm" disabled={!p.report_file_id || !p.evaluation_file_id} onClick={() => act(() => post(`placements/${p.id}/complete`), `${p.student.full_name}: marked Completed.`)}>
                  Mark completed
                </Button>
              ) : (
                <span className="text-xs text-muted">The Head marks it completed</span>
              )}
            </div>
          )}
        </Rows>
      ) : null}
    </div>
  );
}

function Rows({ items, empty, sub, children }: { items: P[]; empty: string; sub?: (p: P) => string; children: (p: P) => React.ReactNode }) {
  if (!items.length) return <Empty>{empty}</Empty>;
  return (
    <div className="grid gap-2">
      {items.map((p) => (
        <Card key={p.id} className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <b>{p.student.full_name}</b> <span className="text-sm text-muted">{p.student.programme} · L{p.student.level}</span>
            <p className="text-sm text-muted">{sub ? sub(p) : p.organisation.name}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">{children(p)}</div>
        </Card>
      ))}
    </div>
  );
}
