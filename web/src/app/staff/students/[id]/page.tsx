"use client";

import { use, useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import { Alert, Avatar, BackLink, Badge, Button, Card, CardHeader, cx, DescList, Empty, LinkButton, Skeleton } from "@/components/ui";
import { ApiError, post } from "@/lib/api";
import { fmtDate, openFile, STAGES, useFetch } from "@/lib/client";
import type { Application, PlacementSummary } from "@/lib/types";

type Student = {
  id: number; full_name: string; email: string; student_number: string | null; programme: string | null; level: number | null;
  phone: string | null; on_registry: boolean; registered: boolean; expected_grad_year: number | null; cv_file_id: number | null; stage: string;
  applications: (Application & { cycle: string })[];
};

type Tone = "info" | "ok" | "warn" | "bad" | "neutral";
const APP_STATUS: Record<string, { label: string; tone: Tone }> = {
  draft: { label: "Draft (not submitted)", tone: "neutral" },
  submitted: { label: "To interview", tone: "warn" },
  passed: { label: "Passed", tone: "ok" },
  not_recommended: { label: "Not recommended", tone: "bad" },
};
const PLACEMENT_STATUS: Record<string, { label: string; tone: Tone; next?: { label: string; href: string } }> = {
  letter_pending: { label: "Letter not sent yet", tone: "warn", next: { label: "Go to Letters", href: "/staff/letters" } },
  letter_sent: { label: "Letter sent · waiting for reply", tone: "info", next: { label: "Record the reply", href: "/staff/placements" } },
  acceptance_submitted: { label: "Acceptance to confirm", tone: "warn", next: { label: "Confirm in Placements", href: "/staff/placements" } },
  accepted: { label: "Accepted", tone: "ok", next: { label: "View in Placements", href: "/staff/placements" } },
  declined: { label: "Declined by organisation", tone: "bad" },
  completed: { label: "Completed", tone: "ok" },
};

/** The five steps every student goes through (FR-P, FR-L, FR-PL). */
const STEPS: { key: string; label: string; icon: IconName }[] = [
  { key: "applied", label: "Applied", icon: "doc" },
  { key: "interview", label: "Interview", icon: "userCheck" },
  { key: "letter", label: "Letter sent", icon: "send" },
  { key: "accepted", label: "Accepted", icon: "checkCircle" },
  { key: "completed", label: "Completed", icon: "certificate" },
];
/** stage → [steps done, step that stopped or needs attention (if any)] */
const PROGRESS: Record<string, [number, "warn" | "bad" | null]> = {
  not_started: [0, null], draft: [0, null], applied: [1, null], not_recommended: [1, "bad"], matched: [2, null],
  needs_rematch: [2, "bad"], letter_sent: [3, null], acceptance_submitted: [3, "warn"], accepted: [4, null], completed: [5, null],
};

/** T2 detail: who the student is, where they are in the process, and the next thing Career Services has to do. */
export default function StudentDetail({ params }: PageProps<"/staff/students/[id]">) {
  const { id } = use(params);
  const { data, error } = useFetch<{ student: Student }>(`students/${id}`);
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  if (error)
    return (
      <div className="grid gap-4">
        <BackLink href="/staff/students" label="Students" />
        <Alert tone="bad">{error.message}</Alert>
      </div>
    );
  if (!data)
    return (
      <div className="grid gap-4" aria-busy="true" aria-label="Loading student">
        <Skeleton className="h-8 w-40 rounded-full" />
        <Skeleton className="h-32 w-full" />
        <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      </div>
    );

  const s = data.student;
  const st = STAGES[s.stage] ?? STAGES.not_started;

  async function admitLate() {
    try {
      setMsg({ tone: "ok", text: (await post<{ message: string }>("applications/late-admit", { student_profile_id: s.id })).message });
    } catch (e) {
      setMsg({ tone: "bad", text: (e as ApiError).field("student_profile_id") ?? (e as ApiError).message });
    }
  }

  return (
    <div className="grid gap-5">
      <BackLink href="/staff/students" label="Students" />

      {/* Profile header */}
      <Card className="flex flex-wrap items-center gap-5 p-6">
        <Avatar name={s.full_name} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[22px] leading-tight font-semibold tracking-[-0.01em]">{s.full_name}</h1>
            <Badge tone={st.tone}>{st.label}</Badge>
          </div>
          <p className="mt-1 text-[13.5px] text-muted">
            {s.programme ?? "Programme not set"} · Level {s.level ?? "—"}
            {s.student_number ? ` · ${s.student_number}` : ""}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px]">
            <a href={`mailto:${s.email}`} className="inline-flex items-center gap-1.5 text-text hover:text-brand">
              <Icon name="mail" className="size-4 text-faint" />
              {s.email}
            </a>
            {s.phone ? (
              <a href={`tel:${s.phone.replace(/\s+/g, "")}`} className="inline-flex items-center gap-1.5 text-text hover:text-brand">
                <Icon name="message" className="size-4 text-faint" />
                {s.phone}
              </a>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {s.cv_file_id ? (
            <Button variant="secondary" onClick={() => openFile(s.cv_file_id!)}>
              <Icon name="fileDownload" /> Open CV
            </Button>
          ) : null}
          {s.applications[0] ? (
            <LinkButton variant="primary" href={`/staff/applications/${s.applications[0].id}`}>
              Open application <Icon name="arrowRight" />
            </LinkButton>
          ) : null}
        </div>
      </Card>

      {msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}

      {/* Progress */}
      <Card className="p-0">
        <CardHeader title="Progress this cycle" sub={progressHint(s.stage)} />
        <Stepper stage={s.stage} />
      </Card>

      <div className="grid items-start gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* Details */}
        <div className="grid gap-5">
          <Card className="p-0">
            <CardHeader title="Student details" />
            <div className="px-5 py-4">
              <DescList
                items={[
                  ["Student ID", s.student_number ?? "—"],
                  ["Programme", s.programme ?? "—"],
                  ["Level", s.level ?? "—"],
                  ["Expected graduation", s.expected_grad_year ?? "—"],
                  ["Account", s.registered ? <Badge tone="ok">Registered</Badge> : <Badge tone="neutral">Not registered</Badge>],
                  ["Registry list", s.on_registry ? <Badge tone="ok">On the list</Badge> : <Badge tone="warn">Not on the list</Badge>],
                  ["CV", s.cv_file_id ? "Uploaded" : <span className="text-muted">Not uploaded yet</span>],
                ]}
              />
            </div>
          </Card>
          {s.registered ? (
            <Card className="grid gap-2.5">
              <h2 className="text-[14.5px] font-semibold">Late application</h2>
              <p className="text-[13px] text-muted">
                Applications have closed, but Career Services agrees to take this student&apos;s application. Lets them submit one; who allowed it is recorded.
              </p>
              <Button variant="secondary" size="sm" className="justify-self-start" onClick={admitLate}>
                <Icon name="clock" /> Admit late application
              </Button>
            </Card>
          ) : null}
        </div>

        {/* Applications */}
        <div className="grid gap-5">
          {s.applications.length ? (
            s.applications.map((a) => <ApplicationCard key={a.id} a={a} />)
          ) : (
            <Card>
              <Empty icon="doc">
                {s.registered ? "This student hasn't applied yet." : "This student hasn't registered an account yet, so they can't apply."}
              </Empty>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function progressHint(stage: string): string {
  return (
    {
      not_started: "Hasn't started an application.",
      draft: "Started an application but hasn't submitted it.",
      applied: "Waiting for the interview. Record the outcome after it.",
      not_recommended: "Not recommended at the interview. They can apply next cycle.",
      matched: "Passed and matched. The introductory letter is next.",
      needs_rematch: "The organisation declined. Match the student to another organisation in Placements.",
      letter_sent: "Letter sent. Waiting for the organisation's reply.",
      acceptance_submitted: "The student uploaded an acceptance letter. Check and confirm it in Placements.",
      accepted: "Accepted. Completed once the report and the evaluation form are in.",
      completed: "Internship completed.",
    }[stage] ?? ""
  );
}

function Stepper({ stage }: { stage: string }) {
  const [done, flag] = PROGRESS[stage] ?? [0, null];
  return (
    <ol className="grid grid-cols-5 gap-2 px-5 py-5">
      {STEPS.map((step, i) => {
        const isDone = i < done;
        const isFlag = flag && i === done; // the step that stopped (bad) or needs attention (warn)
        const isCurrent = !flag && i === done;
        const color = isFlag ? (flag === "bad" ? "var(--danger)" : "var(--warn)") : isDone ? "var(--brand)" : isCurrent ? "var(--brand)" : "var(--line-strong)";
        return (
          <li key={step.key} className="relative flex flex-col items-center gap-2 text-center" aria-current={isCurrent || isFlag ? "step" : undefined}>
            {i ? (
              <span
                className="absolute top-[18px] right-[calc(50%+22px)] left-[calc(-50%+22px)] h-0.5 rounded-full"
                style={{ background: i <= done ? "var(--brand)" : "var(--line)" }}
                aria-hidden
              />
            ) : null}
            <span
              className={cx("relative grid size-9 place-items-center rounded-full border-2", isDone ? "text-white" : "bg-bg")}
              style={{ borderColor: color, background: isDone ? "var(--brand)" : undefined, color: isDone ? "#fff" : color }}
            >
              <Icon name={isDone ? "check" : isFlag && flag === "bad" ? "alert" : step.icon} className="size-[18px]" />
            </span>
            <span className={cx("text-[12.5px] leading-tight", isDone || isCurrent || isFlag ? "font-semibold text-text" : "text-muted")}>
              {step.label}
              <span className="sr-only">{isDone ? " (done)" : isCurrent ? " (current step)" : isFlag ? " (needs attention)" : ""}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function ApplicationCard({ a }: { a: Application & { cycle: string } }) {
  const status = APP_STATUS[a.status] ?? { label: a.status, tone: "neutral" as Tone };
  return (
    <Card className="p-0">
      <CardHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {a.cycle} <Badge tone={status.tone}>{status.label}</Badge>
            {a.late_admitted ? <Badge tone="neutral">Late admission</Badge> : null}
          </span>
        }
        actions={
          <LinkButton size="sm" variant={a.status === "submitted" ? "primary" : "secondary"} href={`/staff/applications/${a.id}`}>
            {a.status === "submitted" ? "Record outcome" : "Open application"} <Icon name="arrowRight" className="size-3.5" />
          </LinkButton>
        }
      />
      <div className="grid gap-5 px-5 py-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Fact icon="calendar" label="Submitted" value={fmtDate(a.submitted_at)} />
          <Fact icon="userCheck" label="Interview" value={a.interview_date ? fmtDate(a.interview_date) : "Not recorded yet"} />
          <Fact icon="building" label="Matched to" value={a.matched_organisation?.name ?? "—"} />
        </div>

        {a.choices.length ? (
          <div>
            <h3 className="mb-2 text-[12.5px] font-semibold text-muted">Student&apos;s choices</h3>
            <ol className="flex flex-wrap gap-2">
              {a.choices.map((c) => (
                <li
                  key={c.rank}
                  className={cx(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[13px]",
                    a.matched_organisation?.id === c.organisation_id ? "border-brand bg-brand-soft font-semibold text-brand" : "border-line",
                  )}
                >
                  <span className="text-faint tabular-nums">{c.rank}</span>
                  {c.name}
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        {a.placements.length ? (
          <div>
            <h3 className="mb-2 text-[12.5px] font-semibold text-muted">Placement</h3>
            <div className="grid gap-2">
              {a.placements.map((p) => (
                <PlacementRow key={p.id} p={p} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function PlacementRow({ p }: { p: PlacementSummary }) {
  const ps = PLACEMENT_STATUS[p.status] ?? { label: p.status.replace(/_/g, " "), tone: "neutral" as Tone };
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius)] border border-line bg-surface/50 px-4 py-3">
      <span className="grid size-9 flex-none place-items-center rounded-full bg-bg text-muted shadow-[var(--shadow)]">
        <Icon name="briefcase" className="size-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold">{p.organisation}</p>
        <p className="text-[12.5px] text-muted">
          {p.letter ? `Letter ${p.letter.reference_no}${p.letter.sent_at ? ` · sent ${fmtDate(p.letter.sent_at)}` : ""}` : "No letter yet"}
        </p>
      </div>
      <Badge tone={ps.tone}>{ps.label}</Badge>
      {ps.next ? (
        <LinkButton size="sm" variant="ghost" href={ps.next.href} className="text-brand">
          {ps.next.label} <Icon name="arrowRight" className="size-3.5" />
        </LinkButton>
      ) : null}
    </div>
  );
}

function Fact({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-9 flex-none place-items-center rounded-[8px] bg-surface text-muted">
        <Icon name={icon} className="size-[18px]" />
      </span>
      <div className="min-w-0">
        <p className="text-[12px] text-muted">{label}</p>
        <p className="truncate text-[14px] font-semibold">{value}</p>
      </div>
    </div>
  );
}
