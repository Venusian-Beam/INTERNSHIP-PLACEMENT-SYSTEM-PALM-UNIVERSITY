"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { ApiError, post } from "@/lib/api";

/** P2: student self-registration with university email + privacy notice (FR-A1, FR-A2, NFR-P1). */
export default function RegisterPage() {
  const [form, setForm] = useState({ name: "", email: "", password: "", password_confirmation: "", privacy_accepted: false });
  const [error, setError] = useState<ApiError | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await post("auth/register", form);
      setDone(true);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="grid gap-4">
        <h1 className="text-[22px] leading-tight font-semibold tracking-[-0.01em]">Check your inbox</h1>
        <Alert tone="ok">We sent a confirmation link to {form.email}. Open it within 60 minutes to activate your account.</Alert>
        <Link className="font-semibold text-brand hover:underline" href="/sign-in">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <h1 className="text-[22px] leading-tight font-semibold tracking-[-0.01em]">Create your student account</h1>
      {error && !Object.keys(error.errors).length ? <Alert tone="bad">{error.message}</Alert> : null}
      <Field id="name" label="Full name" error={error?.field("name")}>
        <Input id="name" autoComplete="name" value={form.name} onChange={set("name")} required />
      </Field>
      <Field id="email" label="University email" error={error?.field("email")} hint="Use your student email address.">
        <Input id="email" type="email" autoComplete="email" value={form.email} onChange={set("email")} required />
      </Field>
      <Field id="password" label="Password" error={error?.field("password")} hint="At least 10 characters, with letters and numbers.">
        <Input id="password" type="password" autoComplete="new-password" value={form.password} onChange={set("password")} required />
      </Field>
      <Field id="password_confirmation" label="Confirm password">
        <Input id="password_confirmation" type="password" autoComplete="new-password" value={form.password_confirmation} onChange={set("password_confirmation")} required />
      </Field>

      <details className="rounded-lg border border-line bg-surface p-3 text-sm">
        <summary className="cursor-pointer font-semibold">Privacy notice</summary>
        <div className="mt-2 grid gap-2 text-muted">
          <p>
            The University&apos;s Career Services holds the details you give here (name, contact details, programme, CV and placement
            documents) to manage your internship placement, including sending introductory letters to organisations.
          </p>
          <p>
            Your documents are kept until two years after you graduate, then deleted; a minimal placement record is kept. You can ask
            Career Services for a copy of your data at any time. (Ghana Data Protection Act, 2012, Act 843.)
          </p>
        </div>
      </details>
      <div className="grid gap-1">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1 size-4 accent-[var(--brand)]" checked={form.privacy_accepted} onChange={set("privacy_accepted")} />
          <span>I have read the privacy notice and agree to Career Services using my data for placement.</span>
        </label>
        {error?.field("privacy_accepted") ? <p className="text-sm text-[var(--danger)]">You need to accept the privacy notice.</p> : null}
      </div>

      <Button type="submit" disabled={busy}>
        {busy ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-sm text-muted">
        Already registered?{" "}
        <Link className="font-semibold text-brand hover:underline" href="/sign-in">
          Sign in
        </Link>
      </p>
    </form>
  );
}
