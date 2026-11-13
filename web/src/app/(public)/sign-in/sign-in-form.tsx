"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { Alert, Button, Field, Input } from "@/components/ui";
import { ApiError, post, session } from "@/lib/api";

type LoginResult = { otp_required?: boolean; challenge?: string; dev_code?: string; user?: { role: string } };

const home = (role: string) => (role === "student" ? "/student" : role === "president" ? "/president" : "/staff");

/** P1 + P5: password, then (staff, Head, President) the emailed 6-digit code (AD15). */
export function SignInForm({ devTools = false }: { devTools?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = challenge
        ? await session<LoginResult>("otp", { challenge, code })
        : await session<LoginResult>("login", { email, password });
      if (res.otp_required && res.challenge) {
        // Temporary testing aid: present only while the API has EXPOSE_LOGIN_CODES=true.
        if (res.dev_code) console.info(`%c[IPS test] Sign-in code for ${email}: ${res.dev_code}`, "font-weight:bold;font-size:14px");
        setChallenge(res.challenge);
        return;
      }
      if (res.user) {
        router.replace(home(res.user.role));
        router.refresh();
      }
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setBusy(false);
    }
  }

  async function resendVerification() {
    await post("auth/email/resend", { email }).catch(() => null);
    setResent(true);
  }

  if (challenge) {
    return (
      <form onSubmit={submit} className="grid gap-4" noValidate>
        <div className="flex items-start gap-3 rounded-[var(--radius)] border border-line bg-surface px-4 py-3.5 text-sm">
          <Icon name="mail" className="mt-0.5 size-[18px] text-brand" />
          <p>
            We emailed a 6-digit sign-in code to <b className="font-semibold">{email}</b>. It expires in 10 minutes.
          </p>
        </div>
        {devTools ? <DevCode email={email} onUse={setCode} /> : null}
        <Field id="code" label="Sign-in code" error={error?.field("code") ?? (error && !error.field("code") ? error.message : undefined)}>
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="h-14 text-center font-mono text-[26px] tracking-[0.5em] tabular-nums"
            aria-invalid={!!error}
            autoFocus
            required
          />
        </Field>
        <Button type="submit" disabled={busy || code.length !== 6}>
          {busy ? "Checking…" : "Verify code"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => { setChallenge(null); setCode(""); setError(null); }}>
          Use a different account
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
      <div className="text-center mb-1">
        <h1 className="text-[28px] font-bold tracking-tight text-ink">Welcome Back!</h1>
        <p className="mt-1 text-[13px] text-muted">Enter Your Details Below</p>
      </div>

      {error && !error.field("email") ? (
        <Alert tone="bad">
          {error.message}
          {error.code === "unverified" ? (
            <>
              {" "}
              <button type="button" className="font-semibold underline" onClick={resendVerification}>
                Resend the link
              </button>
              {resent ? " · Sent." : null}
            </>
          ) : null}
        </Alert>
      ) : null}

      <div className="grid gap-1">
        <label htmlFor="email" className="text-[13px] font-medium text-muted">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          placeholder="hello.alex@gmail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full bg-transparent border-0 border-b border-line-strong pb-2 pt-1 text-[14px] text-text placeholder:text-faint focus:outline-none focus:border-ink transition-colors"
        />
        {error?.field("email") ? <p className="text-[12px] text-[var(--danger)]">{error.field("email")}</p> : null}
      </div>

      <div className="grid gap-1">
        <label htmlFor="password" className="text-[13px] font-medium text-muted">
          Password
        </label>
        <div className="relative flex items-center border-b border-line-strong focus-within:border-ink transition-colors">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full bg-transparent border-0 pb-2 pt-1 pr-9 text-[14px] text-text placeholder:text-faint focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-0 text-muted hover:text-text p-1 transition-colors"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            <Icon name={showPassword ? "eyeOff" : "eye"} className="size-4" />
          </button>
        </div>
        {error?.field("password") ? <p className="text-[12px] text-[var(--danger)]">{error.field("password")}</p> : null}
      </div>

      <div className="flex items-center justify-between text-[13px] pt-0.5">
        <label className="inline-flex items-center gap-2 text-muted cursor-pointer hover:text-text select-none">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="size-4 rounded border-line-strong accent-ink cursor-pointer"
          />
          <span>Remember me</span>
        </label>
        <Link className="text-muted underline-offset-4 hover:text-text hover:underline transition-colors" href="/reset-password">
          Forgot password?
        </Link>
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={busy || !email || !password}
          className="w-full min-h-12 rounded-full bg-[#181a20] text-white font-medium text-[14px] shadow-sm hover:bg-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {busy ? "Signing in…" : "Log in"}
        </button>
      </div>

      <p className="mt-4 text-center text-[13px] text-muted">
        Don&apos;t have an account?{" "}
        <Link className="font-semibold text-ink underline-offset-4 hover:underline" href="/register">
          Sign Up
        </Link>
      </p>
    </form>
  );
}

/** Local development only: shows the newest code from the local inbox (lib/server/dev.ts gates the API). */
function DevCode({ email, onUse }: { email: string; onUse: (c: string) => void }) {
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => {
    let stop = false;
    const since = Date.now() - 15_000;
    (async () => {
      for (let i = 0; i < 20 && !stop; i++) {
        const r = await fetch(`/api/dev/mail?code_for=${encodeURIComponent(email)}`, { cache: "no-store" }).catch(() => null);
        const j = r?.ok ? ((await r.json()) as { code: string | null; at: string | null }) : null;
        if (j?.code && j.at && new Date(j.at).getTime() >= since) {
          if (!stop) setCode(j.code);
          return;
        }
        await new Promise((res) => setTimeout(res, 600));
      }
    })();
    return () => {
      stop = true;
    };
  }, [email]);
  return (
    <div className="flex items-center justify-between gap-3 rounded-[var(--radius)] border border-dashed border-[var(--warn)]/50 bg-[var(--warn-soft)] px-3.5 py-2.5 text-[13px]">
      <span className="flex items-center gap-2">
        <Icon name="terminal" className="size-4 text-[var(--warn)]" />
        <span>
          <b className="font-semibold">Dev only:</b> {code ? <>latest code <span className="font-mono font-semibold tracking-wider">{code}</span></> : "waiting for the email…"}
        </span>
      </span>
      {code ? (
        <button type="button" className="font-semibold text-brand hover:underline" onClick={() => onUse(code)}>
          Fill in
        </button>
      ) : null}
    </div>
  );
}
