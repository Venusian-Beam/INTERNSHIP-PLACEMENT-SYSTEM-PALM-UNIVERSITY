"use client";

import Link from "next/link";
import { BackLink, Alert, Badge, Card } from "@/components/ui";
import { fmtDate, openFile, STAGES, useFetch } from "@/lib/client";
import type { StudentApplicationResponse } from "@/lib/types";

const orgStatus: Record<string, { label: string; tone: "ok" | "warn" | "bad" | "neutral" }> = {
  active: { label: "Active", tone: "ok" },
  pending_check: { label: "Pending check", tone: "warn" },
  rejected: { label: "Not approved", tone: "bad" },
  merged: { label: "Merged", tone: "neutral" },
};

/** S4: my application in detail (choices with check results, interview outcome, letter copy D8). */
export default function ApplicationDetail() {
  const { data, error } = useFetch<StudentApplicationResponse>("student/application");
  if (error) return <Alert tone="bad">{error.message}</Alert>;
  if (!data) return <p className="text-muted">Loading…</p>;
  const app = data.application;
  if (!app) return <Alert>You haven&apos;t started an application yet.</Alert>;
  const s = STAGES[data.stage] ?? STAGES.not_started;

  return (
    <div className="grid gap-4">
      <BackLink href="/student" label="home" />
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-[20px] leading-tight font-semibold tracking-[-0.01em]">My application</h1>
        <Badge tone={s.tone}>{s.label}</Badge>
      </div>
      <Card className="grid gap-2 text-sm">
        <h2 className="font-bold">Choices</h2>
        {app.choices.map((c) => {
          const st = orgStatus[c.status] ?? orgStatus.active;
          return (
            <div key={c.rank} className="grid gap-1 rounded-lg border border-line p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span>
                  {c.rank}. {c.name}
                </span>
                <Badge tone={st.tone}>{st.label}</Badge>
              </div>
              {c.rejection_reason ? <p className="text-[var(--danger)]">Reason: {c.rejection_reason}</p> : null}
            </div>
          );
        })}
      </Card>
      <Card className="grid gap-1 text-sm">
        <h2 className="font-bold">Interview</h2>
        <p>
          {app.status === "submitted"
            ? "Waiting for your interview."
            : app.status === "passed"
              ? `Passed on ${fmtDate(app.interview_date)}. Matched to ${app.matched_organisation?.name}.`
              : app.status === "not_recommended"
                ? `Not recommended (${fmtDate(app.interview_date)}). You can apply next cycle.`
                : "Submit your application first."}
        </p>
      </Card>
      {app.placements.map((p) => (
        <Card key={p.id} className="grid gap-2 text-sm">
          <h2 className="font-bold">{p.organisation}</h2>
          <Badge tone={p.status === "declined" ? "bad" : "info"}>{p.status.replace("_", " ")}</Badge>
          {p.letter ? (
            <button className="justify-self-start font-semibold text-brand" onClick={() => p.letter?.pdf_file_id && openFile(p.letter.pdf_file_id)}>
              View letter {p.letter.reference_no}
            </button>
          ) : null}
          {p.status === "letter_sent" ? (
            <Link className="font-semibold text-brand hover:underline" href={`/student/applications/${app.id}/reply`}>
              Record the company&apos;s reply →
            </Link>
          ) : null}
        </Card>
      ))}
      {app.status === "draft" ? (
        <Link className="font-semibold text-brand hover:underline" href="/student/apply">
          Continue your application →
        </Link>
      ) : null}
    </div>
  );
}
