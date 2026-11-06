"use client";

import Link from "next/link";
import { use, useState } from "react";
import { Alert, Badge, Button, Card, Field, Input, PageHeader, Select, Skeleton, Textarea } from "@/components/ui";
import { ApiError, post } from "@/lib/api";
import { fmtDate, openFile, useFetch } from "@/lib/client";
import type { Application, Organisation } from "@/lib/types";

type Detail = Application & {
  interview_notes: string | null;
  student: { id: number; full_name: string; programme: string; level: number; email: string; phone: string; cv_file_id: number | null };
};

/** T3 detail + UC5: record the interview outcome; matching is the staff member's decision (D28). */
export default function ApplicationDetail({ params }: PageProps<"/staff/applications/[id]">) {
  const { id } = use(params);
  const { data, error, reload } = useFetch<{ application: Detail }>(`applications/${id}`);
  const orgs = useFetch<{ organisations: Organisation[] }>("organisations?status=active");
  const [form, setForm] = useState({ interview_date: new Date().toISOString().slice(0, 10), result: "pass", matched_organisation_id: "", notes: "" });
  const [err, setErr] = useState<ApiError | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (error) return <Alert tone="bad">{error.message}</Alert>;
  if (!data)
    return (
      <div className="grid gap-4" aria-busy="true" aria-label="Loading application">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-72" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  const a = data.application;
  const activeChoices = a.choices.filter((c) => c.status === "active");
  const others = (orgs.data?.organisations ?? []).filter((o) => !activeChoices.some((c) => c.organisation_id === o.id));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await post(`applications/${a.id}/outcome`, {
        ...form,
        matched_organisation_id: form.result === "pass" ? Number(form.matched_organisation_id) || null : null,
      });
      setMsg(
        form.result === "pass"
          ? "Outcome saved. The student has been emailed, and their introductory letter is now waiting in Letters."
          : "Outcome saved. The student has been emailed.",
      );
      reload();
    } catch (x) {
      setErr(x as ApiError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      <PageHeader
        back={{ href: "/staff/applications", label: "Applications" }}
        crumbs={[{ label: "Home", href: "/staff" }, { label: "Applications", href: "/staff/applications" }, { label: a.student.full_name }]}
        title={a.student.full_name}
        sub={[a.student.programme, `Level ${a.student.level}`, a.student.email, a.student.phone].filter(Boolean).join(" · ")}
      />
      {msg ? (
        <Alert tone="ok">
          {msg}{" "}
          {a.status === "passed" ? (
            <Link href="/staff/letters" className="font-semibold underline">
              Go to Letters
            </Link>
          ) : (
            <Link href="/staff/applications" className="font-semibold underline">
              Back to applications
            </Link>
          )}
        </Alert>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid content-start gap-4">
          <Card className="grid gap-2 text-sm">
            <h2 className="font-bold">Ranked choices</h2>
            {a.choices.map((c) => (
              <div key={c.rank} className="flex items-center justify-between rounded-lg border border-line px-3 py-2">
                <span>
                  {c.rank}. {c.name}
                </span>
                <Badge tone={c.status === "active" ? "ok" : c.status === "pending_check" ? "warn" : "bad"}>{c.status.replace("_", " ")}</Badge>
              </div>
            ))}
          </Card>
          <Card className="grid gap-2 text-sm">
            <h2 className="font-bold">Motivation</h2>
            <p className="whitespace-pre-line text-muted">{a.motivation}</p>
            {a.student.cv_file_id ? (
              <Button variant="secondary" className="justify-self-start" onClick={() => openFile(a.student.cv_file_id!)}>
                Open CV
              </Button>
            ) : null}
          </Card>
        </div>
        <Card>
          {a.status === "submitted" ? (
            <form onSubmit={save} className="grid gap-3" noValidate>
              <h2 className="font-bold">Interview outcome</h2>
              {err && !Object.keys(err.errors).length ? <Alert tone="bad">{err.message}</Alert> : null}
              <Field id="date" label="Interview date" error={err?.field("interview_date")}>
                <Input id="date" type="date" value={form.interview_date} onChange={(e) => setForm({ ...form, interview_date: e.target.value })} />
              </Field>
              <fieldset className="flex flex-wrap gap-2">
                <legend className="mb-1 text-sm font-semibold">Result</legend>
                {[
                  ["pass", "Pass"],
                  ["not_recommended", "Not recommended"],
                ].map(([v, l]) => (
                  <label key={v} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 font-semibold">
                    <input type="radio" name="result" value={v} checked={form.result === v} onChange={() => setForm({ ...form, result: v })} className="accent-[var(--brand)]" />
                    {l}
                  </label>
                ))}
              </fieldset>
              {form.result === "pass" ? (
                <Field id="match" label="Matched organisation" error={err?.field("matched_organisation_id")} hint="Organisations still waiting for a check can't be chosen. The system never suggests a match.">
                  <Select id="match" value={form.matched_organisation_id} onChange={(e) => setForm({ ...form, matched_organisation_id: e.target.value })}>
                    <option value="">Choose…</option>
                    <optgroup label="Student's choices">
                      {activeChoices.map((c) => (
                        <option key={c.organisation_id} value={c.organisation_id}>
                          {c.name}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Other active organisations">
                      {others.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </optgroup>
                  </Select>
                </Field>
              ) : null}
              <Field id="notes" label="Notes (Career Services only)">
                <Textarea id="notes" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </Field>
              <Button type="submit" disabled={busy || (form.result === "pass" && !form.matched_organisation_id)}>
                {busy ? "Saving…" : "Save outcome & email student"}
              </Button>
            </form>
          ) : (
            <div className="grid gap-2 text-sm">
              <h2 className="font-bold">Outcome</h2>
              <p>
                {a.status === "passed" ? `Passed on ${fmtDate(a.interview_date)}. Matched to ${a.matched_organisation?.name}.` : `Not recommended (${fmtDate(a.interview_date)}).`}
              </p>
              {data.application.interview_notes ? <p className="text-muted">Notes: {data.application.interview_notes}</p> : null}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
