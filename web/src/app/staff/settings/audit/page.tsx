"use client";

import { useState } from "react";
import { Card, PageHeader, Select } from "@/components/ui";
import { useFetch } from "@/lib/client";

type Entry = { id: number; action: string; subject_type: string | null; subject_id: number | null; metadata: Record<string, unknown> | null; ip: string | null; created_at: string; actor: string | null; actor_role: string | null };

/** H5 (proposed, Head only): the insert-only audit trail of sensitive actions (AD16). */
export default function AuditPage() {
  const [action, setAction] = useState("");
  const { data } = useFetch<{ entries: Entry[]; actions: string[] }>(`audit${action ? `?action=${encodeURIComponent(action)}` : ""}`);
  return (
    <div className="grid gap-4">
      <PageHeader
        back={{ href: "/staff", label: "Dashboard" }}
        crumbs={[{ label: "Home", href: "/staff" }, { label: "Settings" }, { label: "Audit trail" }]}
        title="Audit trail" sub="Sensitive actions, recorded permanently. Entries cannot be edited or deleted." />
      <Select aria-label="Filter by action" className="max-w-72" value={action} onChange={(e) => setAction(e.target.value)}>
        <option value="">All actions</option>
        {data?.actions.map((a) => <option key={a}>{a}</option>)}
      </Select>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left [&>th]:border-b [&>th]:border-line [&>th]:bg-surface/60 [&>th]:text-[12.5px] [&>th]:font-semibold [&>th]:whitespace-nowrap [&>th]:text-muted">
              <th className="px-4 py-3">When</th><th className="px-4 py-3">Who</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Subject</th><th className="px-4 py-3">Details</th>
            </tr>
          </thead>
          <tbody>
            {data?.entries.map((e) => (
              <tr key={e.id} className="border-b border-line align-top last:border-0">
                <td className="px-4 py-2 whitespace-nowrap tabular-nums">{new Date(e.created_at).toLocaleString("en-GB")}</td>
                <td className="px-4 py-2">{e.actor ?? "—"} <span className="text-muted">{e.actor_role}</span></td>
                <td className="px-4 py-2 font-mono text-xs">{e.action}</td>
                <td className="px-4 py-2">{e.subject_type ? `${e.subject_type} #${e.subject_id}` : "—"}</td>
                <td className="px-4 py-2 font-mono text-xs text-muted">{e.metadata ? JSON.stringify(e.metadata) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && !data.entries.length ? <p className="p-4 text-muted">No entries.</p> : null}
      </Card>
    </div>
  );
}
