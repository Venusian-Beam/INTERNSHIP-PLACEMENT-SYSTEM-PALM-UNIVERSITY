"use client";

import { useState } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { api, ApiError, post } from "@/lib/api";
import type { Organisation } from "@/lib/types";

/** S3: propose an organisation that isn't listed. Search-first with duplicate suggestions (FR-O3, FR-O5). */
export function ProposeOrg({ onCreated }: { onCreated: (org: Organisation) => void }) {
  const [form, setForm] = useState({ name: "", email: "", address: "", contact_person: "", phone: "" });
  const [similar, setSimilar] = useState<{ id: number; name: string; status: string }[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function check() {
    if (form.name.trim().length < 3) return;
    const r = await api<{ similar: { id: number; name: string; status: string }[] }>(`organisations/similar?name=${encodeURIComponent(form.name)}`).catch(() => null);
    setSimilar(r?.similar ?? []);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await post<{ organisation: Organisation }>("student/organisations", form);
      onCreated(r.organisation);
      setForm({ name: "", email: "", address: "", contact_person: "", phone: "" });
      setSimilar(null);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-[var(--radius)] border border-dashed border-line p-3" noValidate>
      <b>Not listed? Propose an organisation</b>
      <p className="text-sm text-muted">Career Services will check it before it can be used. You&apos;ll get an email with the result.</p>
      {error && !Object.keys(error.errors).length ? <Alert tone="bad">{error.message}</Alert> : null}
      <Field id="po-name" label="Organisation name" error={error?.field("name")}>
        <Input id="po-name" value={form.name} onChange={set("name")} onBlur={check} />
      </Field>
      {similar?.length ? (
        <Alert tone="warn">
          Already on our list? {similar.map((s) => s.name).join(", ")}. If one of these is the same organisation, choose it from the list instead.
        </Alert>
      ) : null}
      <Field id="po-email" label="Organisation email" error={error?.field("email")} hint="Needed so Career Services can send your letter.">
        <Input id="po-email" type="email" value={form.email} onChange={set("email")} />
      </Field>
      <Field id="po-address" label="Address (optional)">
        <Input id="po-address" value={form.address} onChange={set("address")} />
      </Field>
      <Field id="po-contact" label="Contact person (optional)">
        <Input id="po-contact" value={form.contact_person} onChange={set("contact_person")} />
      </Field>
      <Button type="submit" variant="secondary" disabled={busy || !form.name}>
        {busy ? "Sending…" : "Submit for check"}
      </Button>
    </form>
  );
}
