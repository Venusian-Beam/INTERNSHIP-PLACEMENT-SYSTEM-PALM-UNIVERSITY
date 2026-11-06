"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar, Badge, Card, Empty, PageHeader, Pagination, SearchInput, Select, Skeleton, Table, Td, Th, Tr } from "@/components/ui";
import { Icon } from "@/components/icons";
import { fmtDate, useFetch } from "@/lib/client";

type Row = { id: number; status: string; submitted_at: string | null; student: { full_name: string; programme: string; level: number }; matched: string | null };
const tone = { submitted: "warn", passed: "ok", not_recommended: "bad" } as const;
const label = { submitted: "To interview", passed: "Passed · matched", not_recommended: "Not recommended" } as const;

const PER_PAGE = 25;

/**
 * T3: submitted applications in the current cycle. Click a row to open it and record the interview outcome (UC5).
 * The list is loaded once (max 500 per cycle) and searched in the browser, so typing is instant.
 */
export default function ApplicationsPage() {
  const router = useRouter();
  const [status, setStatus] = useState("submitted");
  const [search, setSearch] = useState("");
  const [order, setOrder] = useState<"newest" | "oldest">("newest");
  const [page, setPage] = useState(1);
  const { data, loading } = useFetch<{ applications: Row[] }>(`applications${status ? `?status=${status}` : ""}`);

  const term = search.trim().toLowerCase();
  const rows = (data?.applications ?? [])
    .filter((a) => !term || `${a.student.full_name} ${a.student.programme} ${a.matched ?? ""}`.toLowerCase().includes(term))
    .sort((x, y) => {
      const d = (x.submitted_at ?? "").localeCompare(y.submitted_at ?? "");
      return order === "newest" ? -d : d;
    });
  const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const current = Math.min(page, pages);
  const slice = rows.slice((current - 1) * PER_PAGE, current * PER_PAGE);
  const reset = () => setPage(1);

  return (
    <div>
      <PageHeader
        back={{ href: "/staff", label: "Dashboard" }}
        crumbs={[{ label: "Home", href: "/staff" }, { label: "Applications" }]}
        title="Applications"
        sub="Interviews are booked outside the system. After the interview, open the student's application and record the outcome."
      />
      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
          <SearchInput
            className="w-full max-w-sm"
            placeholder="Search by student name or programme"
            aria-label="Search applications"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              reset();
            }}
          />
          <Select
            className="w-auto min-w-44"
            aria-label="Filter by status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              reset();
            }}
          >
            <option value="submitted">To interview</option>
            <option value="passed">Passed · matched</option>
            <option value="not_recommended">Not recommended</option>
            <option value="">All statuses</option>
          </Select>
          <Select className="w-auto min-w-40" aria-label="Sort" value={order} onChange={(e) => setOrder(e.target.value as "newest" | "oldest")}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </Select>
          <span className="ml-auto text-[13px] text-muted tabular-nums">
            {data ? `${rows.length} application${rows.length === 1 ? "" : "s"}` : ""}
          </span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <thead>
              <tr>
                <Th>Student</Th>
                <Th>Programme</Th>
                <Th>Submitted</Th>
                <Th>Status</Th>
                <Th>Matched to</Th>
                <Th className="text-right">
                  <span className="sr-only">Action</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {loading && !data
                ? Array.from({ length: 8 }, (_, i) => (
                    <tr key={i}>
                      {[0, 1, 2, 3, 4, 5].map((j) => (
                        <Td key={j}>
                          <Skeleton className="h-4 w-3/4" />
                        </Td>
                      ))}
                    </tr>
                  ))
                : slice.map((a) => {
                    const href = `/staff/applications/${a.id}`;
                    return (
                      // The whole row opens the application; the name link keeps it reachable by keyboard.
                      <Tr key={a.id} className="cursor-pointer" onClick={() => router.push(href)}>
                        <Td>
                          <Link href={href} className="flex items-center gap-3 font-medium text-text hover:text-brand" onClick={(e) => e.stopPropagation()}>
                            <Avatar name={a.student.full_name} size="sm" />
                            {a.student.full_name}
                          </Link>
                        </Td>
                        <Td className="text-muted">
                          {a.student.programme} · L{a.student.level}
                        </Td>
                        <Td className="text-muted tabular-nums">{fmtDate(a.submitted_at)}</Td>
                        <Td>
                          <Badge tone={tone[a.status as keyof typeof tone] ?? "neutral"}>{label[a.status as keyof typeof label] ?? a.status}</Badge>
                        </Td>
                        <Td className="text-muted">{a.matched ?? "—"}</Td>
                        <Td className="text-right">
                          <span
                            className={
                              a.status === "submitted"
                                ? "inline-flex items-center gap-1 rounded-full bg-brand px-3 py-1 text-[12.5px] font-semibold text-white"
                                : "inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand"
                            }
                            aria-hidden
                          >
                            {a.status === "submitted" ? "Record outcome" : "View"}
                            <Icon name="arrowRight" className="size-3.5" />
                          </span>
                        </Td>
                      </Tr>
                    );
                  })}
            </tbody>
          </Table>
        </div>
        {data && !rows.length ? (
          <Empty icon="search">{term ? `No application matches “${search.trim()}”.` : "No applications here."}</Empty>
        ) : null}
        {data && rows.length > PER_PAGE ? (
          <Pagination page={current} pages={pages} total={rows.length} from={(current - 1) * PER_PAGE + 1} to={Math.min(current * PER_PAGE, rows.length)} onPage={setPage} />
        ) : null}
      </Card>
    </div>
  );
}
