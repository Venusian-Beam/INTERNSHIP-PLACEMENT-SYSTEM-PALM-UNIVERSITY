"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Avatar, Badge, Card, Empty, PageHeader, Pagination, SearchInput, Select, Skeleton, Table, Td, Th, Tr } from "@/components/ui";
import { STAGES, useFetch } from "@/lib/client";

type Row = { id: number; full_name: string; programme: string | null; level: number | null; registered: boolean; on_registry: boolean; stage: string };

const PER_PAGE = 25;

/** T2: all known students (registered or imported) with their current stage (FR-S4, F24-3). */
export default function StudentsPage() {
  // The header search sends ?search=...; remount the list when it changes so the box shows the new term.
  const initial = useSearchParams().get("search") ?? "";
  return <StudentsList key={initial} initialSearch={initial} />;
}

function StudentsList({ initialSearch }: { initialSearch: string }) {
  const [search, setSearch] = useState(initialSearch);
  const [stage, setStage] = useState("");
  const [page, setPage] = useState(1);
  const qs = new URLSearchParams({ ...(search ? { search } : {}), ...(stage ? { stage } : {}) }).toString();
  const { data, loading } = useFetch<{ students: Row[] }>(`students${qs ? `?${qs}` : ""}`);

  const rows = data?.students ?? [];
  const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const current = Math.min(page, pages);
  const slice = rows.slice((current - 1) * PER_PAGE, current * PER_PAGE);

  return (
    <div>
      <PageHeader
        back={{ href: "/staff", label: "Dashboard" }}
        crumbs={[{ label: "Home", href: "/staff" }, { label: "Students" }]}
        title="Students" sub="Registered and registry-imported students, with their current stage." />
      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
          <SearchInput
            className="w-full max-w-sm"
            placeholder="Search name, programme or email"
            aria-label="Search students"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <Select
            className="w-auto min-w-48"
            aria-label="Filter by stage"
            value={stage}
            onChange={(e) => {
              setStage(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All stages</option>
            {Object.entries(STAGES).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </Select>
          <span className="ml-auto text-[13px] text-muted tabular-nums">{data ? `${rows.length} student${rows.length === 1 ? "" : "s"}` : ""}</span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Programme</Th>
                <Th>Level</Th>
                <Th>Stage</Th>
                <Th>Account</Th>
              </tr>
            </thead>
            <tbody>
              {loading && !data
                ? Array.from({ length: 8 }, (_, i) => (
                    <tr key={i}>
                      {[0, 1, 2, 3, 4].map((j) => (
                        <Td key={j}>
                          <Skeleton className="h-4 w-3/4" />
                        </Td>
                      ))}
                    </tr>
                  ))
                : slice.map((s) => {
                    const st = STAGES[s.stage] ?? STAGES.not_started;
                    return (
                      <Tr key={s.id}>
                        <Td>
                          <Link href={`/staff/students/${s.id}`} className="flex items-center gap-3 font-medium hover:text-brand">
                            <Avatar name={s.full_name} size="sm" />
                            {s.full_name}
                          </Link>
                        </Td>
                        <Td className="text-muted">{s.programme ?? "—"}</Td>
                        <Td className="text-muted tabular-nums">{s.level ?? "—"}</Td>
                        <Td>
                          <Badge tone={st.tone}>{st.label}</Badge>
                        </Td>
                        <Td>
                          <span className="flex flex-wrap items-center gap-1.5 text-[13px]">
                            {s.registered ? <span className="text-text">Registered</span> : <span className="text-muted">Not registered</span>}
                            {!s.on_registry ? <Badge tone="warn">Not on registry list</Badge> : null}
                          </span>
                        </Td>
                      </Tr>
                    );
                  })}
            </tbody>
          </Table>
        </div>
        {data && !rows.length ? <Empty icon="search">No students match these filters.</Empty> : null}
        {data && rows.length > PER_PAGE ? (
          <Pagination page={current} pages={pages} total={rows.length} from={(current - 1) * PER_PAGE + 1} to={Math.min(current * PER_PAGE, rows.length)} onPage={setPage} />
        ) : null}
      </Card>
    </div>
  );
}
