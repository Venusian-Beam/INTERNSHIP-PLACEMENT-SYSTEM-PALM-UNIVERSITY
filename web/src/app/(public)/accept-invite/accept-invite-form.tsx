"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { ApiError, post } from "@/lib/api";

export function AcceptInviteForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await post("auth/accept-invite", { token, password, password_confirmation: confirm });
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
        <Alert tone="ok">Your account is ready.</Alert>
        <Link className="font-semibold text-brand hover:underline" href="/sign-in">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <h1 className="text-[22px] leading-tight font-semibold tracking-[-0.01em]">Set your password</h1>
      {!token ? <Alert tone="bad">This invitation link is incomplete. Open the link from your email again.</Alert> : null}
      {error?.field("token") ? <Alert tone="bad">{error.field("token")}</Alert> : null}
      <Field id="password" label="Password" error={error?.field("password")} hint="At least 10 characters, with letters and numbers.">
        <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </Field>
      <Field id="confirm" label="Confirm password">
        <Input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      </Field>
      <Button type="submit" disabled={busy || !token}>
        {busy ? "Saving…" : "Create my account"}
      </Button>
    </form>
  );
}
