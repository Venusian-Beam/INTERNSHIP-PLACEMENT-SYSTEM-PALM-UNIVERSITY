"use client";

import Link from "next/link";
import { useState } from "react";
import { Bar, ColumnChart, DashCard, DonutChart, Gauge, KpiCard, MiniTable, shortDate, Sparkline, TrendChart } from "@/components/dash";
import { Icon, type IconName } from "@/components/icons";
import { Alert, Avatar, Button, cx, Empty, PageHeader, PageLoading, Segmented } from "@/components/ui";
import { fmtDate, openFile, useFetch } from "@/lib/client";
import { useStaffUser } from "./staff-user";

type Prog = { programme: string; students: number; applied: number; accepted: number; participation: number; placement_rate: number | null };
type Dash = {
  cycle: { name: string; opens: string; closes: string } | null;
  previous_cycle: string | null;
  kpis: {
    applications: { value: number; previous: number | null };
    interviewed: { value: number; previous: number | null };
    letters_sent: { value: number; organisations: number; previous: number | null };
    final_years_not_completed: { value: number; of: number };
  };
  outcomes: { accepted: number; awaiting: number; declined: number };
  queues: Record<"to_interview" | "orgs_to_check" | "letters_ready" | "acceptances_to_confirm" | "missing_completion" | "ready_to_complete", number>;
  spark: { weeks: string[]; applications: number[]; interviewed: number[]; letters_sent: number[]; accepted: number[] };
  stages: Record<"not_started" | "to_interview" | "not_recommended" | "matched" | "awaiting_reply" | "accepted" | "needs_rematch" | "completed", number>;
  by_programme: Prog[];
  by_level: { level: number; n: number }[];
  by_week: { week: string; n: number }[];
  top_organisations: { name: string; n: number }[];
  lists: {
    acceptances: { id: number; full_name: string; organisation: string; acceptance_file_id: number; reply_recorded_at: string }[];
    orgs_to_check: { id: number; name: string; proposed_by: string | null }[];
    awaiting_reply: { id: number; full_name: string; organisation: string; sent_at: string; days: number }[];
  };
};

type Measure = "applied" | "participation" | "placement_rate";
const pct = (v: number) => `${v % 1 ? v.toFixed(1) : v}%`;
const HUES = ["--c-indigo", "--c-pink", "--c-amber", "--c-teal", "--c-blue", "--c-violet", "--c-orange", "--c-green"];

/** Change against the previous cycle, as a KPI chip. */
function delta(now: number, prev: number | null): { text: string; tone: "up" | "down" | "flat" } {
  if (prev === null) return { text: "First cycle", tone: "flat" };
  if (prev === 0) return now ? { text: "New", tone: "up" } : { text: "0%", tone: "flat" };
  const d = Math.round(((now - prev) / prev) * 1000) / 10;
  return { text: `${d > 0 ? "+" : ""}${d}%`, tone: d > 0 ? "up" : d < 0 ? "down" : "flat" };
}

/** T1 dashboard (UI-D12): overview, performance, programme statistics, pipeline, follow-ups. All figures from the API. */
export default function Dashboard() {
  const { data, error, reload } = useFetch<Dash>("dashboard");
  const me = useStaffUser();
  const [measure, setMeasure] = useState<Measure>("applied");
  const [follow, setFollow] = useState<"replies" | "orgs">("replies");
  const [updated, setUpdated] = useState(() => new Date());
  if (error) return <Alert tone="bad">{error.message}</Alert>;
  if (!data) return <PageLoading label="Loading the dashboard" />;
  if (!data.cycle) return <Alert>No cycle yet. The Head creates one in Settings → Cycles.</Alert>;

  const { kpis, queues, outcomes, spark, stages } = data;
  const first = me.name.split(" ")[0];
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const withLetters = outcomes.accepted + outcomes.awaiting + outcomes.declined;
  const acceptRate = withLetters ? Math.round((outcomes.accepted / withLetters) * 100) : 0;
  const rateWord = !withLetters ? "No letters yet" : acceptRate >= 60 ? "On track" : acceptRate >= 30 ? "Watch" : "Low";
  const rateHue = !withLetters ? "--faint" : acceptRate >= 60 ? "--c-green" : acceptRate >= 30 ? "--c-amber" : "--c-red";

  // Programme statistics
  const progs = data.by_programme.filter((p) => p.students > 0);
  const val = (p: Prog) => (measure === "applied" ? p.applied : measure === "participation" ? p.participation : p.placement_rate ?? 0);
  const sorted = [...progs].sort((a, b) => val(b) - val(a));
  const totalApplied = progs.reduce((s, p) => s + p.applied, 0);
  const totalStudents = progs.reduce((s, p) => s + p.students, 0);
  const overall = totalStudents ? Math.round((totalApplied / totalStudents) * 1000) / 10 : 0;
  const top = sorted[0];
  const low = sorted[sorted.length - 1];
  const progInsight = !top ? null : measure === "applied" ? (
    <>
      <b className="text-text">{top.programme}</b> sent the most applications ({top.applied}); <b className="text-text">{low.programme}</b> the fewest ({low.applied}). Switch to participation rate to account for programme size.
    </>
  ) : measure === "participation" ? (
    <>
      <b className="text-text">{low.programme}</b> has the lowest participation: {low.applied} of {low.students} students applied ({pct(low.participation)}), against {pct(overall)} overall. A good target for outreach.
    </>
  ) : top.placement_rate !== null ? (
    <>
      <b className="text-text">{top.programme}</b> converts best ({pct(top.placement_rate)} of applicants accepted).
    </>
  ) : (
    "No placements accepted yet this cycle."
  );

  const weeks = data.by_week.map((w) => ({ x: w.week, y: w.n }));
  const levelTotal = data.by_level.reduce((s, l) => s + l.n, 0);
  const queueRows: { label: string; n: number; href: string; hue: string; icon: IconName }[] = [
    { label: "Applications to interview", n: queues.to_interview, href: "/staff/applications", hue: "--c-blue", icon: "clipboard" },
    { label: "Organisations to check", n: queues.orgs_to_check, href: "/staff/organisations/check", hue: "--c-orange", icon: "buildings" },
    { label: "Letters ready to send", n: queues.letters_ready, href: "/staff/letters", hue: "--c-teal", icon: "mail" },
    { label: "Acceptances to confirm", n: queues.acceptances_to_confirm, href: "/staff/placements", hue: "--c-indigo", icon: "userCheck" },
    { label: "Missing completion documents", n: queues.missing_completion, href: "/staff/placements", hue: "--c-pink", icon: "docs" },
    ...(me.role === "head" ? [{ label: "Ready to mark completed", n: queues.ready_to_complete, href: "/staff/placements", hue: "--c-green", icon: "certificate" as IconName }] : []),
  ];
  const openItems = queueRows.reduce((s, q) => s + q.n, 0);
  const maxQueue = Math.max(1, ...queueRows.map((q) => q.n));

  const stageParts = [
    { label: "Not started", value: stages.not_started, hue: "--line-strong" },
    { label: "To interview", value: stages.to_interview, hue: "--c-blue" },
    { label: "Matched", value: stages.matched, hue: "--c-violet" },
    { label: "Awaiting reply", value: stages.awaiting_reply, hue: "--c-amber" },
    { label: "Accepted", value: stages.accepted, hue: "--c-teal" },
    { label: "Completed", value: stages.completed, hue: "--c-green" },
    { label: "Needs re-match", value: stages.needs_rematch, hue: "--c-orange" },
    { label: "Not recommended", value: stages.not_recommended, hue: "--c-red" },
  ];
  const inPipeline = stageParts.reduce((s, p) => s + p.value, 0) - stages.not_started;

  const appDelta = delta(kpis.applications.value, kpis.applications.previous);
  const finalDone = kpis.final_years_not_completed.of - kpis.final_years_not_completed.value;

  return (
    <div className="grid gap-6">
      <PageHeader
        crumbs={[{ label: "Home", href: "/staff" }, { label: "Dashboard" }]}
        title={`${greet}, ${first}`}
        sub={`Placement overview for ${data.cycle.name} · applications ${fmtDate(data.cycle.opens)} – ${fmtDate(data.cycle.closes)}`}
        actions={
          <>
            <span className="inline-flex items-center gap-2 rounded-[8px] border border-line bg-bg px-3 py-2 text-[12.5px] font-medium">
              <Icon name="calendar" className="size-4 text-muted" />
              {data.cycle.name}
            </span>
            <Link href="/staff/reports" className="inline-flex items-center gap-2 rounded-[8px] bg-[color-mix(in_srgb,var(--c-indigo)_10%,white)] px-3 py-2 text-[12.5px] font-medium text-[var(--c-indigo)] hover:bg-[color-mix(in_srgb,var(--c-indigo)_16%,white)]">
              <Icon name="report" className="size-4" /> Reports
            </Link>
          </>
        }
      />

      {/* Overview: hero + KPI cards */}
      <section aria-label="Overview" className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))]">
        <div className="relative isolate flex min-h-[176px] overflow-hidden rounded-[var(--radius)] bg-gradient-to-br from-[#15803d] via-[#13703a] to-[#0b4a27] p-6 text-white shadow-[var(--shadow-md)] md:col-span-2 xl:col-span-1">
          <div className="pointer-events-none absolute -top-16 -left-10 size-48 rounded-full bg-white/8" aria-hidden />
          <div className="pointer-events-none absolute -right-8 -bottom-20 size-56 rounded-full bg-[#22c55e]/25" aria-hidden />
          <div className="relative z-10 flex max-w-[56%] flex-col justify-center gap-2">
            <h2 className="text-[19px] leading-snug font-semibold">Send introductory letters</h2>
            <p className="text-[12.5px] leading-relaxed text-white/80">
              {queues.letters_ready
                ? `${queues.letters_ready} organisation group${queues.letters_ready === 1 ? "" : "s"} ready. Generate, preview and email them in minutes.`
                : "Generate, preview and email signed letters in minutes."}
            </p>
            <Link href="/staff/letters" className="mt-2 inline-flex w-fit items-center gap-2 rounded-[8px] bg-[var(--c-amber)] px-3.5 py-2 text-[12.5px] font-semibold text-ink shadow-[var(--shadow)] hover:brightness-105">
              Open letters <Icon name="arrowRight" className="size-4" />
            </Link>
          </div>
          <HeroArt />
        </div>

        <KpiCard label="Applications" value={kpis.applications.value} hue="--c-blue" icon="clipboard" chip={{ ...appDelta, text: `${appDelta.text}` }} footer={kpis.applications.previous !== null ? `${data.previous_cycle}: ${kpis.applications.previous}` : "This cycle"}>
          <Sparkline values={spark.applications} hue="--c-blue" label="Applications per week" />
        </KpiCard>
        <KpiCard
          label="Interviewed"
          value={kpis.interviewed.value}
          hue="--c-green"
          icon="userCheck"
          chip={delta(kpis.interviewed.value, kpis.interviewed.previous)}
          footer={kpis.applications.value ? `${Math.round((kpis.interviewed.value / kpis.applications.value) * 100)}% of applicants` : "—"}
        >
          <Sparkline values={spark.interviewed} hue="--c-green" label="Interview outcomes per week" />
        </KpiCard>
        <KpiCard
          label="Letters sent"
          value={kpis.letters_sent.value}
          hue="--c-pink"
          icon="mailForward"
          chip={delta(kpis.letters_sent.value, kpis.letters_sent.previous)}
          footer={`To ${kpis.letters_sent.organisations} organisation${kpis.letters_sent.organisations === 1 ? "" : "s"}`}
        >
          <Sparkline values={spark.letters_sent} hue="--c-pink" label="Letters sent per week" />
        </KpiCard>
        <KpiCard
          label="Final years not completed"
          value={kpis.final_years_not_completed.value}
          hue="--c-red"
          icon="cap"
          chip={kpis.final_years_not_completed.value ? { text: "Needs action", tone: "risk" } : { text: "All done", tone: "up" }}
          footer={`${finalDone} of ${kpis.final_years_not_completed.of} Level 400+ students done`}
        >
          <div className="w-20 pb-1.5">
            <Bar value={finalDone} max={kpis.final_years_not_completed.of} hue="--c-red" label="Final-year students who completed" />
          </div>
        </KpiCard>
      </section>

      {/* Performance */}
      <section aria-labelledby="perf-h" className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="perf-h" className="flex items-center gap-2 text-[14px] font-semibold">
            <Icon name="heartbeat" className="size-[18px] text-[var(--c-indigo)]" />
            Placement performance &amp; work queues
          </h2>
          <span className="flex items-center gap-2 text-[11.5px] text-muted">
            <Icon name="clock" className="size-3.5" />
            Updated {updated.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            <button
              type="button"
              aria-label="Refresh"
              title="Refresh"
              onClick={() => {
                reload();
                setUpdated(new Date());
              }}
              className="grid size-7 place-items-center rounded-[6px] border border-line bg-bg text-[var(--c-red)] hover:bg-surface"
            >
              <Icon name="refresh" className="size-3.5" />
            </button>
          </span>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <DashCard
            title="Letter outcome score"
            table={<MiniTable head={["Outcome", "Students"]} rows={[["Accepted", outcomes.accepted], ["Awaiting reply", outcomes.awaiting], ["Declined", outcomes.declined]]} />}
          >
            <div className="grid gap-4 pt-2">
              <Gauge value={acceptRate} hue={rateHue} centre={withLetters ? `${acceptRate}%` : "—"} centreSub="accepted" label={`${acceptRate}% of students with letters were accepted`} />
              <p className="text-center text-[12.5px] font-semibold" style={{ color: `var(${rateHue})` }}>
                {rateWord}
              </p>
              <div className="grid grid-cols-3 text-center">
                {(
                  [
                    ["Accepted", outcomes.accepted, "--c-green"],
                    ["Awaiting", outcomes.awaiting, "--c-amber"],
                    ["Declined", outcomes.declined, "--c-red"],
                  ] as const
                ).map(([l, v, h]) => (
                  <div key={l}>
                    <p className="text-[18px] font-semibold tabular-nums" style={{ color: `var(${h})` }}>
                      {v}
                    </p>
                    <p className="text-[10.5px] tracking-wide text-muted uppercase">{l}</p>
                  </div>
                ))}
              </div>
            </div>
          </DashCard>

          <DashCard title="Work queues" table={<MiniTable head={["Queue", "Items"]} rows={queueRows.map((q) => [q.label, q.n])} />}>
            <p className="flex items-baseline gap-2">
              <span className="text-[30px] leading-none font-semibold tabular-nums">{openItems}</span>
              <span className="text-[11px] tracking-wide text-muted uppercase">open items</span>
            </p>
            <ul className="mt-4 grid gap-3">
              {queueRows.map((q) => (
                <li key={q.label}>
                  <Link href={q.href} className="group grid gap-1.5">
                    <span className="flex items-center justify-between gap-2 text-[12.5px]">
                      <span className="flex items-center gap-2 font-medium group-hover:text-brand">
                        <Icon name={q.icon} className="size-4" />
                        {q.label}
                      </span>
                      <span className="font-semibold tabular-nums" style={{ color: q.n ? `var(${q.hue})` : "var(--faint)" }}>
                        {q.n}
                      </span>
                    </span>
                    <Bar value={q.n} max={maxQueue} hue={q.hue} height={6} label={q.label} />
                  </Link>
                </li>
              ))}
            </ul>
          </DashCard>

          <DashCard title="Applications per week" table={<MiniTable head={["Week of", "Applications"]} rows={weeks.map((w) => [fmtDate(w.x), w.y])} />}>
            <p className="flex items-baseline gap-2">
              <span className="text-[30px] leading-none font-semibold text-[var(--c-red)] tabular-nums">{kpis.applications.value}</span>
              <span className="text-[11px] tracking-wide text-muted uppercase">applications this cycle</span>
            </p>
            <div className="mt-3">
              <TrendChart points={weeks} hue="--c-red" unit="applications" label={`Applications per week, ${weeks.length} weeks`} />
            </div>
          </DashCard>
        </div>
      </section>

      {/* Programme statistics */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <DashCard
          title="Applications by programme"
          actions={
            <Segmented<Measure>
              label="Measure"
              value={measure}
              onChange={setMeasure}
              options={[
                ["applied", "Applications"],
                ["participation", "Participation rate"],
                ["placement_rate", "Placement rate"],
              ]}
            />
          }
          table={
            <MiniTable
              head={["Programme", "Students", "Applied", "Participation", "Accepted", "Placement rate"]}
              rows={sorted.map((p) => [p.programme, p.students, p.applied, pct(p.participation), p.accepted, p.placement_rate === null ? null : pct(p.placement_rate)])}
            />
          }
        >
          <div className="mb-5 grid gap-3 rounded-[8px] bg-surface/80 p-4 sm:grid-cols-2">
            <SummaryStat icon="stack" hue="--c-indigo" label="Total applications" value={totalApplied} chip={appDelta} />
            <SummaryStat icon="people" hue="--c-pink" label="Overall participation" value={pct(overall)} sub={`${totalApplied} of ${totalStudents} students`} />
          </div>
          {progs.length ? (
            <>
              <ColumnChart
                hue={measure === "applied" ? "--c-indigo" : measure === "participation" ? "--c-pink" : "--c-teal"}
                format={measure === "applied" ? String : pct}
                label={`Programmes by ${measure === "applied" ? "applications" : measure === "participation" ? "participation rate" : "placement rate"}`}
                items={sorted.map((p) => ({ label: p.programme, value: val(p), tip: `${p.programme}: ${p.applied} applications from ${p.students} students (${pct(p.participation)}) · ${p.accepted} accepted` }))}
              />
              {progInsight ? (
                <p className="mt-4 flex items-start gap-2 rounded-[8px] bg-[color-mix(in_srgb,var(--c-amber)_10%,white)] px-3 py-2.5 text-[12.5px] leading-relaxed text-muted">
                  <Icon name="bolt" className="mt-0.5 size-4 text-[var(--c-amber)]" />
                  <span>{progInsight}</span>
                </p>
              ) : null}
            </>
          ) : (
            <Empty>No students yet. Import the registry list in Settings.</Empty>
          )}
        </DashCard>

        <DashCard
          title="Applications by level"
          table={<MiniTable head={["Level", "Applications", "Share"]} rows={data.by_level.map((l) => [`Level ${l.level}`, l.n, levelTotal ? `${Math.round((l.n / levelTotal) * 100)}%` : null])} />}
        >
          <ul className="grid gap-4 pt-2">
            {data.by_level.map((l, i) => (
              <li key={l.level} className="grid gap-1.5">
                <span className="flex items-center justify-between text-[12.5px]">
                  <span className="flex items-center gap-2 font-medium">
                    <span className="grid h-7 min-w-7 place-items-center rounded-[8px] px-1 text-[11px] font-semibold text-white" style={{ background: `var(${HUES[i % HUES.length]})` }}>
                      {l.level}
                    </span>
                    Level {l.level}
                  </span>
                  <span className="text-muted tabular-nums">
                    <b className="font-semibold text-text">{l.n}</b> · {levelTotal ? Math.round((l.n / levelTotal) * 100) : 0}%
                  </span>
                </span>
                <Bar value={l.n} max={Math.max(1, ...data.by_level.map((x) => x.n))} hue={HUES[i % HUES.length]} label={`Level ${l.level}`} />
              </li>
            ))}
          </ul>
        </DashCard>
      </div>

      {/* Pipeline */}
      <div className="grid gap-4 lg:grid-cols-3">
        <DashCard
          title="Programme participation"
          actions={
            <Link href="/staff/reports" className="rounded-[6px] bg-[color-mix(in_srgb,var(--c-indigo)_10%,white)] px-2.5 py-1 text-[11.5px] font-medium text-[var(--c-indigo)]">
              View all
            </Link>
          }
        >
          <ul className="grid gap-4">
            {[...progs]
              .sort((a, b) => b.students - a.students)
              .slice(0, 4)
              .map((p, i) => {
                const hue = HUES[i % HUES.length];
                return (
                  <li key={p.programme} className="grid gap-1.5">
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-semibold">{p.programme}</span>
                        <span className="block text-[11.5px] text-muted">
                          {p.applied} of {p.students} students applied · {p.accepted} accepted
                        </span>
                      </span>
                      <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `color-mix(in srgb, var(${hue}) 12%, white)`, color: `color-mix(in srgb, var(${hue}) 80%, var(--text))` }}>
                        {pct(p.participation)}
                      </span>
                    </span>
                    <Bar value={p.applied} max={p.students} hue={hue} label={`${p.programme} participation`} />
                  </li>
                );
              })}
          </ul>
        </DashCard>

        <DashCard title="Students by stage" table={<MiniTable head={["Stage", "Students"]} rows={stageParts.map((p) => [p.label, p.value])} />}>
          <DonutChart parts={stageParts} centre={inPipeline} centreSub="in the pipeline" label="Students by stage this cycle" />
        </DashCard>

        <DashCard title="Top host organisations" table={<MiniTable head={["Organisation", "Accepted"]} rows={data.top_organisations.map((o) => [o.name, o.n])} />}>
          {data.top_organisations.length ? (
            <div className="grid grid-cols-2 gap-3">
              {data.top_organisations.slice(0, 4).map((o, i) => {
                const hue = HUES[(i * 2 + 1) % HUES.length];
                return (
                  <div key={o.name} className="grid place-items-center gap-1 rounded-[var(--radius)] border border-line px-2 py-4 text-center">
                    <span style={{ color: `var(${hue})` }}>
                      <Icon name="building" className="size-5" />
                    </span>
                    <span className="text-[26px] leading-none font-semibold tabular-nums" style={{ color: `var(${hue})` }}>
                      {o.n}
                    </span>
                    <span className="line-clamp-2 text-[12px] font-medium" style={{ color: `color-mix(in srgb, var(${hue}) 75%, var(--text))` }}>
                      {o.name}
                    </span>
                    <span className="text-[10.5px] text-muted">accepted</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty icon="building">No accepted placements yet this cycle.</Empty>
          )}
        </DashCard>
      </div>

      {/* Follow-ups */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <DashCard
          title="Acceptances to confirm"
          bodyClassName="px-0 pb-0"
          actions={
            <Link href="/staff/placements" className="rounded-[6px] border border-line px-2.5 py-1 text-[11.5px] font-medium hover:bg-surface">
              View all
            </Link>
          }
        >
          {data.lists.acceptances.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-y border-line text-left text-[12px] text-muted">
                    <th className="px-5 py-2.5 font-medium">Student</th>
                    <th className="px-3 py-2.5 font-medium">Organisation</th>
                    <th className="px-3 py-2.5 font-medium">Uploaded</th>
                    <th className="px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {data.lists.acceptances.map((a, i) => (
                    <tr key={a.id} className="border-b border-line last:border-0 hover:bg-surface/60">
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-2.5">
                          <Avatar name={a.full_name} tone={i} size="sm" />
                          <span className="font-medium">{a.full_name}</span>
                        </span>
                      </td>
                      <td className="px-3 py-3 text-[var(--c-indigo)]">{a.organisation}</td>
                      <td className="px-3 py-3 text-muted">{fmtDate(a.reply_recorded_at)}</td>
                      <td className="px-5 py-3 text-right">
                        <Button size="sm" variant="secondary" onClick={() => openFile(a.acceptance_file_id)}>
                          <Icon name="eye" /> View letter
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty icon="checkCircle">Nothing to confirm. Uploaded acceptance letters appear here.</Empty>
          )}
        </DashCard>

        <DashCard
          title="Follow-ups"
          actions={
            <div className="flex rounded-[8px] bg-surface p-0.5 text-[11.5px] font-medium" role="group" aria-label="Follow-up type">
              <button type="button" aria-pressed={follow === "replies"} onClick={() => setFollow("replies")} className={cx("rounded-[6px] px-2.5 py-1", follow === "replies" ? "bg-[var(--c-amber)] text-ink" : "text-muted")}>
                Overdue replies ({data.lists.awaiting_reply.length})
              </button>
              <button type="button" aria-pressed={follow === "orgs"} onClick={() => setFollow("orgs")} className={cx("rounded-[6px] px-2.5 py-1", follow === "orgs" ? "bg-[var(--c-amber)] text-ink" : "text-muted")}>
                To check ({data.lists.orgs_to_check.length})
              </button>
            </div>
          }
        >
          <div className="grid gap-3">
            {follow === "replies" ? (
              data.lists.awaiting_reply.length ? (
                data.lists.awaiting_reply.map((a) => (
                  <FollowCard key={a.id} name={a.full_name} chip={a.organisation} line={`Letter sent ${shortDate(a.sent_at)} · no reply yet`} meta={`${a.days} days waiting`} action="Record the reply" href="/staff/placements" />
                ))
              ) : (
                <Empty icon="checkCircle">No overdue replies. Letters older than 14 days without a reply appear here.</Empty>
              )
            ) : data.lists.orgs_to_check.length ? (
              data.lists.orgs_to_check.map((o) => (
                <FollowCard key={o.id} name={o.name} chip="Pending check" line={`Proposed by ${o.proposed_by ?? "a student"}`} meta="Waiting for a decision" action="Review organisation" href="/staff/organisations/check" />
              ))
            ) : (
              <Empty icon="checkCircle">No organisations waiting for a check.</Empty>
            )}
          </div>
        </DashCard>
      </div>
    </div>
  );
}

function SummaryStat({ icon, hue, label, value, chip, sub }: { icon: IconName; hue: string; label: string; value: React.ReactNode; chip?: { text: string; tone: string }; sub?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-11 flex-none place-items-center rounded-full border-2" style={{ borderColor: `color-mix(in srgb, var(${hue}) 35%, white)`, color: `var(${hue})` }}>
        <Icon name={icon} className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-[11.5px] text-muted">{label}</p>
        <p className="flex flex-wrap items-center gap-2">
          <span className="text-[20px] leading-tight font-semibold tabular-nums">{value}</span>
          {chip ? (
            <span className={cx("rounded-full px-2 py-0.5 text-[10.5px] font-semibold", chip.tone === "up" ? "bg-[#ecfdf3] text-[#067647]" : chip.tone === "down" ? "bg-[#fef3f2] text-[#b42318]" : "bg-bg text-muted")}>
              {chip.text}
            </span>
          ) : null}
          {sub ? <span className="text-[11.5px] text-muted">{sub}</span> : null}
        </p>
      </div>
    </div>
  );
}

function FollowCard({ name, chip, line, meta, action, href }: { name: string; chip: string; line: string; meta: string; action: string; href: string }) {
  return (
    <div className="grid gap-2 rounded-[var(--radius)] border border-line p-3.5">
      <p className="flex flex-wrap items-center gap-2 text-[13px]">
        <span className="font-semibold">{name}</span>
        <span className="rounded-full bg-[color-mix(in_srgb,var(--c-amber)_14%,white)] px-2 py-0.5 text-[11px] font-medium text-[#b54708]">{chip}</span>
      </p>
      <p className="text-[12px] text-muted">{line}</p>
      <p className="flex items-center gap-1.5 text-[11.5px] text-[#b54708]">
        <Icon name="hourglass" className="size-3.5" />
        {meta}
      </p>
      <Link href={href} className="mt-1 block rounded-[6px] bg-[var(--c-amber)] py-2 text-center text-[12.5px] font-semibold text-ink hover:brightness-105">
        {action}
      </Link>
    </div>
  );
}

/** Hero illustration: a signed letter in an envelope beside a graduation cap (decorative). */
function HeroArt() {
  return (
    <svg viewBox="0 0 200 160" className="pointer-events-none absolute -right-3 bottom-0 z-0 h-[74%] max-h-[150px] w-auto" aria-hidden>
      <ellipse cx="108" cy="150" rx="78" ry="7" fill="#000" opacity=".15" />
      <rect x="40" y="70" width="128" height="78" rx="8" fill="#fef3c7" />
      <path d="M40 78 104 118l64-40" fill="none" stroke="#f59e0b" strokeWidth="3" strokeLinejoin="round" />
      <g transform="rotate(-8 100 60)">
        <rect x="62" y="14" width="84" height="104" rx="6" fill="#fff" />
        <rect x="72" y="26" width="40" height="6" rx="3" fill="#15803d" />
        <rect x="72" y="40" width="62" height="4" rx="2" fill="#d0d5dd" />
        <rect x="72" y="50" width="56" height="4" rx="2" fill="#d0d5dd" />
        <rect x="72" y="60" width="60" height="4" rx="2" fill="#d0d5dd" />
        <rect x="72" y="70" width="38" height="4" rx="2" fill="#d0d5dd" />
        <path d="M74 96c6-8 10 4 16-3s9 5 15-2" fill="none" stroke="#6366f1" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="128" cy="98" r="9" fill="#ec4899" />
        <path d="m124 98 3 3 5-6" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g transform="translate(150 22)">
        <path d="M0 14 24 4l24 10-24 10z" fill="#101828" />
        <path d="M10 18v9c0 3 6 6 14 6s14-3 14-6v-9l-14 6z" fill="#1d2939" />
        <path d="M44 15v13" stroke="#f59e0b" strokeWidth="2" />
        <circle cx="44" cy="30" r="2.5" fill="#f59e0b" />
      </g>
      <circle cx="30" cy="40" r="3" fill="#fde68a" />
      <circle cx="186" cy="80" r="2.5" fill="#bbf7d0" />
      <circle cx="22" cy="104" r="2" fill="#fbcfe8" />
    </svg>
  );
}
