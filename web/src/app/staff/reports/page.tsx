"use client";

import { useState } from "react";
import { ChartCard, DataTable, HBars } from "@/components/charts";
import { Badge, PageHeader, Select } from "@/components/ui";
import { useFetch } from "@/lib/client";

type Grad = { students: { id: number; full_name: string; programme: string; level: number; expected_grad_year: number | null; registered: boolean; status: string }[]; summary: Record<string, number>; programmes: string[] };
const gradTone = { completed: "ok", not_completed: "warn", not_started: "bad" } as const;

/** T7 Reports (FR-R1–R5): view on screen, export CSV (formula-safe). */
export default function ReportsPage() {
  const [tab, setTab] = useState<"pipeline" | "graduation" | "organisations" | "programmes">("pipeline");
  const [filters, setFilters] = useState({ programme: "", level: "", status: "" });
  const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
  const pipeline = useFetch<{ cycle: string; pipeline: Record<string, number> }>(tab === "pipeline" ? "reports/pipeline" : null);
  const grad = useFetch<Grad>(tab === "graduation" ? `reports/graduation${qs ? `?${qs}` : ""}` : null);
  const orgs = useFetch<{ cycle: string; organisations: { name: string; sector: string | null; letters: number; accepted: number; declined: number; acceptance_rate: number | null }[] }>(tab === "organisations" ? "reports/organisations" : null);
  const progs = useFetch<{ cycle: string; programmes: { programme: string; students: number; applied: number; participation: number; accepted: number; placement_rate: number | null }[]; sectors: { sector: string; accepted: number }[] }>(tab === "programmes" ? "reports/programmes" : null);

  const csv = (path: string) => (
    <a href={`/api/proxy/reports/${path}${path.includes("?") ? "&" : "?"}format=csv`} className="inline-flex min-h-9 items-center rounded-lg border border-line px-3 text-sm font-semibold hover:bg-surface">
      Export CSV
    </a>
  );

  return (
    <div className="grid gap-4">
      <PageHeader
        back={{ href: "/staff", label: "Dashboard" }}
        crumbs={[{ label: "Home", href: "/staff" }, { label: "Reports" }]}
        title="Reports" sub="Every figure comes from the records. Exports are safe to open in Excel." />
      <div role="tablist" className="flex flex-wrap gap-2">
        {([["pipeline", "Cycle pipeline"], ["graduation", "Graduation status"], ["organisations", "By organisation"], ["programmes", "By programme & sector"]] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${tab === k ? "border-brand bg-brand text-brand-ink" : "border-line"}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === "pipeline" && pipeline.data ? (
        <ChartCard title={`Pipeline · ${pipeline.data.cycle}`} tools={csv("pipeline")} table={<DataTable head={["Stage", "Count"]} rows={Object.entries(pipeline.data.pipeline)} />}>
          <HBars hue="--s1" items={Object.entries(pipeline.data.pipeline).map(([k, v]) => ({ label: k, value: v, tip: `${k}: ${v}` }))} />
        </ChartCard>
      ) : null}

      {tab === "graduation" && grad.data ? (
        <section className="grid gap-3 rounded-[var(--radius)] border border-line bg-bg p-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge tone="ok">Completed {grad.data.summary.completed ?? 0}</Badge>
              <Badge tone="warn">Not completed {grad.data.summary.not_completed ?? 0}</Badge>
              <Badge tone="bad">Not started {grad.data.summary.not_started ?? 0}</Badge>
            </div>
            {csv(`graduation${qs ? `?${qs}` : ""}`)}
          </div>
          <div className="flex flex-wrap gap-2">
            <Select aria-label="Programme" className="max-w-56" value={filters.programme} onChange={(e) => setFilters({ ...filters, programme: e.target.value })}>
              <option value="">All programmes</option>
              {grad.data.programmes.map((p) => <option key={p}>{p}</option>)}
            </Select>
            <Select aria-label="Level" className="max-w-40" value={filters.level} onChange={(e) => setFilters({ ...filters, level: e.target.value })}>
              <option value="">All levels</option>
              {[100, 200, 300, 400, 500, 600].map((l) => <option key={l} value={l}>Level {l}</option>)}
            </Select>
            <Select aria-label="Status" className="max-w-48" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">Any status</option>
              <option value="completed">Completed</option>
              <option value="not_completed">Not completed</option>
              <option value="not_started">Not started</option>
            </Select>
          </div>
          <div className="max-h-[560px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-bg">
                <tr className="text-left [&>th]:border-b [&>th]:border-line [&>th]:bg-surface/60 [&>th]:text-[12.5px] [&>th]:font-semibold [&>th]:whitespace-nowrap [&>th]:text-muted">
                  <th className="px-2 py-2">Student</th><th className="px-2 py-2">Programme</th><th className="px-2 py-2">Level</th><th className="px-2 py-2">Graduates</th><th className="px-2 py-2">Requirement</th>
                </tr>
              </thead>
              <tbody>
                {grad.data.students.map((s) => (
                  <tr key={s.id} className="border-b border-line last:border-0">
                    <td className="px-2 py-1.5">{s.full_name}</td>
                    <td className="px-2 py-1.5">{s.programme}</td>
                    <td className="px-2 py-1.5 tabular-nums">{s.level}</td>
                    <td className="px-2 py-1.5 tabular-nums">{s.expected_grad_year ?? "—"}</td>
                    <td className="px-2 py-1.5">
                      <Badge tone={gradTone[s.status as keyof typeof gradTone]}>{s.status === "not_started" ? "Not started · not registered" : s.status.replace("_", " ")}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {tab === "organisations" && orgs.data ? (
        <ChartCard title={`Placements by organisation · ${orgs.data.cycle}`} tools={csv("organisations")}
          table={<DataTable head={["Organisation", "Sector", "Letters", "Accepted", "Declined", "Acceptance rate"]} rows={orgs.data.organisations.map((o) => [o.name, o.sector, o.letters, o.accepted, o.declined, o.acceptance_rate === null ? null : `${o.acceptance_rate}%`])} />}>
          <HBars hue="--s3" items={orgs.data.organisations.map((o) => ({ label: o.name, value: o.accepted, tip: `${o.name}: ${o.accepted} accepted, ${o.declined} declined` }))} />
        </ChartCard>
      ) : null}

      {tab === "programmes" && progs.data ? (
        <div className="grid gap-3 xl:grid-cols-2">
          <ChartCard title={`Participation by programme · ${progs.data.cycle}`} tools={csv("programmes")}
            table={<DataTable head={["Programme", "Students", "Applied", "Participation", "Accepted", "Placement rate"]} rows={progs.data.programmes.map((p) => [p.programme, p.students, p.applied, `${p.participation}%`, p.accepted, p.placement_rate === null ? null : `${p.placement_rate}%`])} />}>
            <HBars hue="--s1" format={(v) => `${v}%`} max={Math.max(10, ...progs.data.programmes.map((p) => p.participation))}
              items={[...progs.data.programmes].sort((a, b) => b.participation - a.participation).map((p) => ({ label: p.programme, value: p.participation, tip: `${p.programme}: ${p.applied} of ${p.students} applied` }))} />
          </ChartCard>
          <ChartCard title="Accepted placements by sector" table={<DataTable head={["Sector", "Accepted"]} rows={progs.data.sectors.map((s) => [s.sector, s.accepted])} />}>
            {progs.data.sectors.length ? <HBars hue="--s7" items={progs.data.sectors.map((s) => ({ label: s.sector, value: s.accepted, tip: `${s.sector}: ${s.accepted}` }))} /> : <p className="text-sm text-muted">No accepted placements yet this cycle.</p>}
          </ChartCard>
        </div>
      ) : null}
    </div>
  );
}
