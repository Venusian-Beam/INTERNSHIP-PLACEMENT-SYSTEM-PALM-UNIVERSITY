"use client";

import { useState } from "react";
import { Alert, Badge, Button, Card, Field, Input, PageHeader } from "@/components/ui";
import { ApiError, post } from "@/lib/api";
import { fmtDate, useFetch } from "@/lib/client";
import type { Cycle } from "@/lib/types";

const empty = { name: "", applications_open_at: "", applications_close_at: "", letter_cutoff_at: "", default_period_start: "", default_period_end: "" };

/** H3: cycles (window, letter cut-off, default internship period). Head only (UI-D8, FR-C1). */
export default function CyclesPage() {
  const { data, reload } = useFetch<{ cycles: Cycle[] }>("cycles");
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<number | null>(null);
  const [err, setErr] = useState<ApiError | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  function edit(c: Cycle) {
    setEditing(c.id);
    setForm({
      name: c.name, applications_open_at: c.applications_open_at.slice(0, 10), applications_close_at: c.applications_close_at.slice(0, 10),
      letter_cutoff_at: c.letter_cutoff_at.slice(0, 10), default_period_start: c.default_period_start, default_period_end: c.default_period_end,
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const body = { ...form, applications_close_at: `${form.applications_close_at} 23:59:59`, letter_cutoff_at: `${form.letter_cutoff_at} 23:59:59` };
      await (editing ? post(`cycles/${editing}`, body, "PATCH") : post("cycles", body));
      setMsg(editing ? "Cycle updated." : "Cycle created.");
      setEditing(null);
      setForm(empty);
      reload();
    } catch (x) {
      setErr(x as ApiError);
    }
  }

  const fields: [keyof typeof empty, string, string][] = [
    ["name", "Name", "text"],
    ["applications_open_at", "Applications open", "date"],
    ["applications_close_at", "Applications close", "date"],
    ["letter_cutoff_at", "Letter cut-off", "date"],
    ["default_period_start", "Internship starts (default)", "date"],
    ["default_period_end", "Internship ends (default)", "date"],
  ];

  return (
    <div>
      <PageHeader
        back={{ href: "/staff", label: "Dashboard" }}
        crumbs={[{ label: "Home", href: "/staff" }, { label: "Settings" }, { label: "Cycles" }]}
        title="Cycles" sub="Applications are accepted only inside the window. No letters after the cut-off." />
      {msg ? <Alert tone="ok">{msg}</Alert> : null}
      <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left [&>th]:border-b [&>th]:border-line [&>th]:bg-surface/60 [&>th]:text-[12.5px] [&>th]:font-semibold [&>th]:whitespace-nowrap [&>th]:text-muted">
                <th className="px-4 py-3">Cycle</th>
                <th className="px-4 py-3">Window</th>
                <th className="px-4 py-3">Cut-off</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {data?.cycles.map((c) => (
                <tr key={c.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5">
                    <b>{c.name}</b> {c.is_open ? <Badge tone="ok">Open</Badge> : null}
                  </td>
                  <td className="px-4 py-2.5">
                    {fmtDate(c.applications_open_at)} – {fmtDate(c.applications_close_at)}
                  </td>
                  <td className="px-4 py-2.5">{fmtDate(c.letter_cutoff_at)}</td>
                  <td className="px-4 py-2.5">
                    {fmtDate(c.default_period_start)} – {fmtDate(c.default_period_end)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Button variant="ghost" className="min-h-8 px-3 text-sm" onClick={() => edit(c)}>
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card>
          <form onSubmit={save} className="grid gap-3" noValidate>
            <h2 className="font-bold">{editing ? "Edit cycle" : "New cycle"}</h2>
            {fields.map(([k, l, t]) => (
              <Field key={k} id={`c-${k}`} label={l} error={err?.field(k)}>
                <Input id={`c-${k}`} type={t} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
              </Field>
            ))}
            <Button type="submit">{editing ? "Save changes" : "Create cycle"}</Button>
            {editing ? (
              <Button type="button" variant="ghost" onClick={() => { setEditing(null); setForm(empty); }}>
                Cancel
              </Button>
            ) : null}
          </form>
        </Card>
      </div>
    </div>
  );
}
