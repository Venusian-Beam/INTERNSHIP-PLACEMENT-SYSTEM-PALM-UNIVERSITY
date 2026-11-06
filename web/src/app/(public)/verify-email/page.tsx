"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { post } from "@/lib/api";

/** P3: the confirmation link itself is handled by the API, which redirects to /sign-in?verified=…; this page resends it. */
export default function VerifyEmailPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <form
      className="grid gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        await post("auth/email/resend", { email }).catch(() => null);
        setSent(true);
      }}
    >
      <h1 className="text-[22px] leading-tight font-semibold tracking-[-0.01em]">Confirm your email</h1>
      <p className="text-muted">Open the link we emailed you. If it expired or never arrived, send a new one.</p>
      {sent ? <Alert tone="ok">If that account needs confirming, a new link is on its way.</Alert> : null}
      <Field id="email" label="University email">
        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      <Button type="submit" disabled={!email}>
        Resend confirmation link
      </Button>
      <Link className="text-sm font-semibold text-brand hover:underline" href="/sign-in">
        Back to sign in
      </Link>
    </form>
  );
}
