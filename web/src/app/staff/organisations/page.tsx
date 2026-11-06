"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert, Badge, Button, Card, Field, Input, LinkButton, PageHeader, Select } from "@/components/ui";
import { ApiError, post } from "@/lib/api";
import { useFetch } from "@/lib/client";
import type { Organisation } from "@/lib/types";

const tone = { active: "ok", pending_check: "warn", rejected: "bad", merged: "neutral" } as const;

/** T4: organisation list, add (created Active, FR-O2), link to the check queue. */
export default function OrganisationsPage() {
  const [status, setStatus] = useState("active");
  const [search, setSearch] = useState("");
  const qs = new URLSearchParams({ ...(status ? { status } : {}), ...(search ? { search } : {}) }).toString();
  const { data, reload } = useFetch<{ organisations: Organisation[] }>(`organisations?${qs}`);
  const [form, setForm] = useState({ name: "", email: "", contact_person: "", contact_title: "", address: "", phone: "", sector: "" });
  const [err, setErr] = useState<ApiError | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await post("organisations", form);
      setMsg(`${form.name} added.`);
      setForm({ name: "", email: "", contact_person: "", contact_title: "", address: "", phone: "", sector: "" });
      reload();
    } catch (x) {
      setErr(x as ApiError);
    }
  }

  return (
    <div>
      <PageHeader
        back={{ href: "/staff", label: "Dashboard" }}
        crumbs={[{ label: "Home", href: "/staff" }, { label: "Organisations" }]}
        title="Organisations" sub="The shared list students choose from." actions={<LinkButton href="/staff/organisations/check">Check queue</LinkButton>} />
      {msg ? <Alert tone="ok">{msg}</Alert> : null}
      <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            <Input className="max-w-xs" placeholder="Search" aria-label="Search organisations" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Select className="max-w-xs" aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="active">Active</option>
              <option value="pending_check">Pending check</option>
              <option value="rejected">Rejected</option>
              <option value="merged">Merged</option>
              <option value="">All</option>
            </Select>
          </div>
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left [&>th]:border-b [&>th]:border-line [&>th]:bg-surface/60 [&>th]:text-[12.5px] [&>th]:font-semibold [&>th]:whitespace-nowrap [&>th]:text-muted">
                  <th className="px-4 py-3">Organisation</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Sector</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {data?.organisations.map((o) => (
                  <tr key={o.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-2.5">
                      <b>{o.name}</b>
                      <div className="text-muted">{o.address}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      {o.contact_person ?? "—"}
                      <div className="text-muted">{o.email ?? "no email"}</div>
                    </td>
                    <td className="px-4 py-2.5">{o.sector ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <Badge tone={tone[o.status as keyof typeof tone] ?? "neutral"}>{o.status.replace("_", " ")}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
        <Card>
          <form onSubmit={add} className="grid gap-3" noValidate>
            <h2 className="font-bold">Add organisation</h2>
            {(["name", "email", "contact_person", "contact_title", "address", "phone", "sector"] as const).map((k) => (
              <Field key={k} id={`o-${k}`} label={k.replace("_", " ").replace(/^\w/, (c) => c.toUpperCase()) + (k === "name" || k === "email" ? "" : " (optional)")} error={err?.field(k)}>
                <Input id={`o-${k}`} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
              </Field>
            ))}
            <Button type="submit" disabled={!form.name || !form.email}>
              Add as active
            </Button>
          </form>
        </Card>
      </div>
      <p className="mt-4 text-sm text-muted">
        Student proposals appear in the <Link className="font-semibold text-brand" href="/staff/organisations/check">check queue</Link>.
      </p>
    </div>
  );
}
