"use client";

import { useState } from "react";
import { Alert, Badge, Button, Card, Empty, Input, PageHeader } from "@/components/ui";
import { ApiError, post } from "@/lib/api";
import { useFetch } from "@/lib/client";
import type { Organisation } from "@/lib/types";

type QueueItem = Organisation & { proposed_by: string | null; similar: { id: number; name: string }[] };

/** T4 check queue (W2/UC4): approve, merge into an existing organisation, or reject with a reason the student sees. */
export default function CheckQueuePage() {
  const { data, reload } = useFetch<{ queue: QueueItem[] }>("organisations-queue");
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [rejecting, setRejecting] = useState<number | null>(null);
  const [reason, setReason] = useState("We couldn't verify this organisation's registration or address.");

  async function act(o: QueueItem, action: string, body?: unknown) {
    try {
      await post(`organisations/${o.id}/${action}`, body);
      setMsg({ tone: "ok", text: `${o.name}: ${action === "approve" ? "approved and added to the list" : action === "merge" ? "merged" : "rejected"}. The student has been emailed.` });
      setRejecting(null);
      reload();
    } catch (e) {
      const x = e as ApiError;
      setMsg({ tone: "bad", text: Object.values(x.errors).flat()[0] ?? x.message });
    }
  }

  return (
    <div>
      <PageHeader
        back={{ href: "/staff/organisations", label: "Organisations" }}
        crumbs={[{ label: "Home", href: "/staff" }, { label: "Organisations to check" }]}
        title="Organisations to check" sub="Look up or call each one before approving it (F6). Approved ones join the shared list." />
      {msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}
      <div className="mt-3 grid gap-3">
        {data && !data.queue.length ? <Empty>No proposals waiting.</Empty> : null}
        {data?.queue.map((o) => (
          <Card key={o.id} className="grid gap-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <b>{o.name}</b>
                <p className="text-sm text-muted">
                  {o.address ?? "No address"} · {o.email ?? "no email"} · proposed by {o.proposed_by ?? "—"}
                </p>
                {o.similar.length ? <div className="mt-1"><Badge tone="warn">Possible duplicate of {o.similar[0].name}</Badge></div> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button className="min-h-9 px-3 text-sm" onClick={() => act(o, "approve")}>
                  Approve
                </Button>
                {o.similar.length ? (
                  <Button variant="secondary" className="min-h-9 px-3 text-sm" onClick={() => act(o, "merge", { into_id: o.similar[0].id })}>
                    Merge into {o.similar[0].name}
                  </Button>
                ) : null}
                <Button variant="danger" className="min-h-9 px-3 text-sm" onClick={() => setRejecting(rejecting === o.id ? null : o.id)}>
                  Reject…
                </Button>
              </div>
            </div>
            {rejecting === o.id ? (
              <div className="grid gap-2 rounded-lg bg-surface p-3">
                <label htmlFor={`r-${o.id}`} className="text-sm font-semibold">
                  Reason (the student will see this)
                </label>
                <Input id={`r-${o.id}`} value={reason} onChange={(e) => setReason(e.target.value)} />
                <Button variant="danger" className="justify-self-start" onClick={() => act(o, "reject", { reason })}>
                  Reject and email student
                </Button>
              </div>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
