"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import { Alert, Badge, Card, Skeleton } from "@/components/ui";
import { fmtDate, openFile, STAGES, useFetch } from "@/lib/client";
import type { StudentApplicationResponse } from "@/lib/types";

/** S1 Home: simple list (UI-D2): status panel with the one next step, then application and documents. */
export default function StudentHome() {
  const { data, error, loading } = useFetch<StudentApplicationResponse>("student/application");
  const me = useFetch<{ user: { name: string } }>("auth/me");
  if (loading && !data) {
    return (
      <div className="grid gap-4" role="status" aria-label="Loading">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-44" />
        <Skeleton className="h-40" />
      </div>
    );
  }
  if (error) return <Alert tone="bad">{error.message}</Alert>;
  if (!data) return null;

  const { cycle, application: app, stage } = data;
  const s = STAGES[stage] ?? STAGES.not_started;
  const placement = app?.placements[0];
  const org = placement?.organisation ?? app?.matched_organisation?.name;
  const first = me.data?.user.name.split(" ")[0];

  const next: { text: ReactNode; action?: { href: string; label: string } } = (() => {
    if (!cycle) return { text: "No application cycle is open yet. Career Services will announce it by email." };
    if (!app || app.status === "draft") {
      return cycle.is_open || app?.late_admitted
        ? { text: `Applications close ${fmtDate(cycle.applications_close_at)}.`, action: { href: "/student/apply", label: app ? "Finish your application" : "Start your application" } }
        : { text: `Applications for ${cycle.name} are closed. Contact Career Services if you need help.` };
    }
    switch (stage) {
      case "applied":
        return { text: "Application submitted. Career Services will contact you to book your interview." };
      case "not_recommended":
        return { text: "You were not recommended this cycle. You can apply again next cycle." };
      case "matched":
        return { text: `You passed your interview. Career Services will send your introductory letter to ${org}.` };
      case "letter_sent":
        return { text: "Your introductory letter has been emailed. Did they accept you?", action: { href: `/student/applications/${app.id}/reply`, label: `Record ${org}'s reply` } };
      case "acceptance_submitted":
        return { text: "Career Services is checking your acceptance letter. We will email you when it's confirmed." };
      case "accepted":
        return { text: "After your internship ends, upload your report.", action: { href: "/student/documents", label: "Upload your internship report" } };
      case "needs_rematch":
        return { text: "Career Services will match you to another organisation. You can also propose one." };
      case "completed":
        return { text: "Your internship requirement is complete. Congratulations!" };
      default:
        return { text: "" };
    }
  })();

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-[13px] font-medium text-muted">{cycle ? cycle.name : "Career Services"}</p>
        <h1 className="text-[22px] leading-tight font-semibold tracking-[-0.01em]">{first ? `Hello, ${first}` : "Home"}</h1>
      </div>

      <section aria-label="Where you are" className="relative overflow-hidden rounded-[14px] bg-gradient-to-br from-[#15803d] via-[#13703a] to-[#0b4a27] p-5 text-white shadow-[var(--shadow-md)]">
        <div className="pointer-events-none absolute -top-16 -right-12 size-48 rounded-full bg-white/10" aria-hidden />
        <div className="pointer-events-none absolute -bottom-20 -left-10 size-44 rounded-full bg-[#22c55e]/25" aria-hidden />
        <div className="relative">
          <p className="text-[12.5px] text-white/75">Current stage</p>
          <p className="mt-0.5 text-[24px] leading-tight font-semibold">{s.label}</p>
          {org ? (
            <p className="mt-1 flex items-center gap-1.5 text-[13px] text-white/80">
              <Icon name="building" className="size-4" />
              {org}
            </p>
          ) : null}
          {next.text ? <p className="mt-4 border-t border-white/15 pt-4 text-[13.5px] leading-relaxed text-white/90">{next.text}</p> : null}
          {next.action ? (
            <Link href={next.action.href} className="mt-4 flex min-h-11 items-center justify-between gap-3 rounded-[10px] bg-[var(--c-amber)] px-4 text-[13.5px] font-semibold text-ink hover:brightness-105">
              {next.action.label}
              <Icon name="arrowRight" className="size-5" />
            </Link>
          ) : null}
        </div>
      </section>

      <section>
        <h2 className="mb-2.5 text-[13px] font-semibold text-muted">My application</h2>
        <Card className="p-0">
          <Row icon="checkCircle" label="Status">
            <Badge tone={s.tone}>{s.label}</Badge>
          </Row>
          <Row icon="building" label="Organisation">
            <span className="font-medium">{org ?? "—"}</span>
          </Row>
          <Row icon="clock" label="Interview">
            <span className="font-medium">{app?.interview_date ? fmtDate(app.interview_date) : "—"}</span>
          </Row>
          {app ? (
            <Link href={`/student/applications/${app.id}`} className="flex items-center justify-between px-4 py-3.5 text-sm font-semibold text-brand hover:bg-surface">
              View details
              <Icon name="chevronRight" />
            </Link>
          ) : null}
        </Card>
      </section>

      <section>
        <h2 className="mb-2.5 text-[13px] font-semibold text-muted">My documents</h2>
        <Card className="p-0">
          <Row icon="doc" label="CV">
            <Link href="/student/documents" className="text-sm font-semibold text-brand hover:underline">
              Manage
            </Link>
          </Row>
          {placement?.letter?.pdf_file_id ? (
            <Row icon="mail" label={`Letter ${placement.letter.reference_no}`}>
              <button className="text-sm font-semibold text-brand hover:underline" onClick={() => openFile(placement.letter!.pdf_file_id!)}>
                View
              </button>
            </Row>
          ) : null}
          <Row icon="checkCircle" label="Acceptance letter">
            <span className="text-sm text-muted">{placement?.acceptance_file_id ? "Uploaded" : "Not yet"}</span>
          </Row>
          <Row icon="folder" label="Internship report">
            <span className="text-sm text-muted">{placement?.report_file_id ? "Uploaded" : "After the internship"}</span>
          </Row>
        </Card>
      </section>
    </div>
  );
}

function Row({ icon, label, children }: { icon: IconName; label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[52px] items-center justify-between gap-3 border-b border-line px-4 py-2.5 last:border-0">
      <span className="flex min-w-0 items-center gap-3 text-sm">
        <Icon name={icon} className="size-[18px] text-faint" />
        <span className="truncate text-muted">{label}</span>
      </span>
      {children}
    </div>
  );
}
