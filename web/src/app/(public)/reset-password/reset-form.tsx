"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { ApiError, post } from "@/lib/api";

export function ResetForm({ token, email: initialEmail }: { token?: string; email: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = token
        ? await post<{ message: string }>("auth/reset-password", { token, email, password, password_confirmation: confirm })
        : await post<{ message: string }>("auth/forgot-password", { email });
      setMsg(res.message);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <h1 className="text-[22px] leading-tight font-semibold tracking-[-0.01em]">{token ? "Choose a new password" : "Reset your password"}</h1>
      {msg ? <Alert tone="ok">{msg}</Alert> : null}
      {error && !Object.keys(error.errors).length ? <Alert tone="bad">{error.message}</Alert> : null}
      <Field id="email" label="Email" error={error?.field("email")}>
        <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required readOnly={!!token} />
      </Field>
      {token ? (
        <>
          <Field id="password" label="New password" error={error?.field("password")} hint="At least 10 characters, with letters and numbers.">
            <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          <Field id="confirm" label="Confirm new password">
            <Input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </Field>
        </>
      ) : null}
      <Button type="submit" disabled={busy || !!msg}>
        {busy ? "Please wait…" : token ? "Change password" : "Email me a reset link"}
      </Button>
      <Link className="text-sm font-semibold text-brand hover:underline" href="/sign-in">
        Back to sign in
      </Link>
    </form>
  );
}
