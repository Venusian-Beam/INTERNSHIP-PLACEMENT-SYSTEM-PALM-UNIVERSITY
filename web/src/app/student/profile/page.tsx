"use client";

import { useState } from "react";
import { BackLink, Alert, Button, Field, Input, Select } from "@/components/ui";
import { ApiError, post } from "@/lib/api";
import { useFetch } from "@/lib/client";

type Me = { user: { email: string; profile: { full_name: string; student_number: string | null; programme: string | null; level: number | null; phone: string | null } } };

/** S7: my details (FR-S1). */
export default function ProfilePage() {
  const { data } = useFetch<Me>("auth/me");
  const [form, setForm] = useState<Record<string, string> | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  if (!data) return <p className="text-muted">Loading…</p>;
  const p = data.user.profile;
  const f = form ?? { full_name: p.full_name ?? "", student_number: p.student_number ?? "", programme: p.programme ?? "", level: p.level ? String(p.level) : "", phone: p.phone ?? "" };
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...f, [k]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setError(null);
    try {
      await post("student/profile", { ...f, level: f.level ? Number(f.level) : undefined }, "PATCH");
      setMsg("Saved.");
    } catch (err) {
      setError(err as ApiError);
    }
  }

  return (
    <form onSubmit={save} className="grid gap-3" noValidate>
      <BackLink href="/student" label="home" />
      <h1 className="text-[20px] leading-tight font-semibold tracking-[-0.01em]">Profile</h1>
      {msg ? <Alert tone="ok">{msg}</Alert> : null}
      <Field id="email" label="University email">
        <Input id="email" value={data.user.email} readOnly />
      </Field>
      <Field id="full_name" label="Full name" error={error?.field("full_name")}>
        <Input id="full_name" value={f.full_name} onChange={set("full_name")} />
      </Field>
      <Field id="student_number" label="Student ID" error={error?.field("student_number")}>
        <Input id="student_number" value={f.student_number} onChange={set("student_number")} />
      </Field>
      <Field id="programme" label="Programme" error={error?.field("programme")}>
        <Input id="programme" value={f.programme} onChange={set("programme")} />
      </Field>
      <Field id="level" label="Level" error={error?.field("level")}>
        <Select id="level" value={f.level} onChange={set("level")}>
          <option value="">Choose…</option>
          {[100, 200, 300, 400, 500, 600].map((l) => (
            <option key={l} value={l}>
              Level {l}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="phone" label="Phone" error={error?.field("phone")}>
        <Input id="phone" inputMode="tel" value={f.phone} onChange={set("phone")} />
      </Field>
      <Button type="submit">Save</Button>
    </form>
  );
}
