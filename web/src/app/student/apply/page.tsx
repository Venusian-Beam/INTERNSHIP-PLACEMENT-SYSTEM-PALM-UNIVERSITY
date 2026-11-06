"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FileUpload } from "@/components/file-upload";
import { ProposeOrg } from "@/components/propose-org";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";
import { api, ApiError, post } from "@/lib/api";
import { fmtDate, openFile, useFetch } from "@/lib/client";
import type { Organisation, StudentApplicationResponse } from "@/lib/types";

type Me = { user: { profile: { full_name: string; student_number: string | null; programme: string | null; level: number | null; phone: string | null; has_cv: boolean } } };

const STEPS = ["Your details", "Choose organisations", "Motivation", "Your CV", "Review & submit"];

/** S2: 4-step wizard + review, with autosaved drafts (UI-D5, FR-P1). */
export default function ApplyPage() {
  const router = useRouter();
  const app = useFetch<StudentApplicationResponse>("student/application");
  const me = useFetch<Me>("auth/me");
  const orgs = useFetch<{ organisations: Organisation[] }>("organisations");
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState({ full_name: "", student_number: "", programme: "", level: "", phone: "" });
  const [choices, setChoices] = useState<number[]>([]);
  const [motivation, setMotivation] = useState("");
  const [hasCv, setHasCv] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadedFor, setLoadedFor] = useState<number | null>(null);

  // Initialise the form once from the server state (render-time sync, no effect needed).
  const ready = app.data && me.data && orgs.data;
  if (ready && loadedFor !== 1) {
    const p = me.data!.user.profile;
    setProfile({ full_name: p.full_name ?? "", student_number: p.student_number ?? "", programme: p.programme ?? "", level: p.level ? String(p.level) : "", phone: p.phone ?? "" });
    setHasCv(p.has_cv);
    const a = app.data!.application;
    if (a) {
      setChoices(a.choices.map((c) => c.organisation_id));
      setMotivation(a.motivation ?? "");
    }
    setLoadedFor(1);
  }

  const options = useMemo(() => orgs.data?.organisations.filter((o) => o.status === "active" || o.status === "pending_check") ?? [], [orgs.data]);
  useEffect(() => {
    if (app.data?.application && app.data.application.status !== "draft") router.replace(`/student/applications/${app.data.application.id}`);
  }, [app.data, router]);

  if (!ready) return <p className="text-muted">Loading…</p>;
  const cycle = app.data!.cycle;
  if (!cycle || (!cycle.is_open && !app.data!.application?.late_admitted)) {
    return <Alert>{cycle ? `Applications for ${cycle.name} are closed.` : "No application cycle is open yet."}</Alert>;
  }

  async function saveStep(next: number) {
    setBusy(true);
    setError(null);
    try {
      if (step === 0) {
        await post("student/profile", { ...profile, level: profile.level ? Number(profile.level) : undefined }, "PATCH");
      } else if (step === 1 || step === 2) {
        await api("student/application", { method: "PUT", body: JSON.stringify({ motivation, choices }) });
      }
      setSaved("Draft saved");
      setStep(next);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api("student/application", { method: "PUT", body: JSON.stringify({ motivation, choices }) });
      const r = await post<{ application: { id: number } }>("student/application/submit");
      router.replace(`/student/applications/${r.application.id}`);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setBusy(false);
    }
  }

  const nameOf = (id: number) => options.find((o) => o.id === id)?.name ?? orgs.data!.organisations.find((o) => o.id === id)?.name ?? `#${id}`;
  const fieldErrors = error ? Object.values(error.errors).flat() : [];

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5" aria-label={`Step ${Math.min(step + 1, 5)} of 5`}>
          {STEPS.map((s, i) => (
            <span key={s} className={`size-2.5 rounded-full ${i <= step ? "bg-brand" : "bg-[var(--line)]"}`} />
          ))}
        </div>
        {saved ? <span className="text-xs font-semibold text-brand">{saved}</span> : null}
      </div>
      <h1 className="text-[20px] leading-tight font-semibold tracking-[-0.01em]">{STEPS[step]}</h1>
      {error ? (
        <Alert tone="bad">
          {fieldErrors.length ? (
            <ul className="list-inside list-disc">
              {fieldErrors.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          ) : (
            error.message
          )}
        </Alert>
      ) : null}

      {step === 0 ? (
        <div className="grid gap-3">
          <Field id="full_name" label="Full name">
            <Input id="full_name" value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} />
          </Field>
          <Field id="student_number" label="Student ID" hint="Used by Career Services only. Never printed on your letter.">
            <Input id="student_number" value={profile.student_number} onChange={(e) => setProfile({ ...profile, student_number: e.target.value })} />
          </Field>
          <Field id="programme" label="Programme">
            <Input id="programme" value={profile.programme} onChange={(e) => setProfile({ ...profile, programme: e.target.value })} />
          </Field>
          <Field id="level" label="Level">
            <Select id="level" value={profile.level} onChange={(e) => setProfile({ ...profile, level: e.target.value })}>
              <option value="">Choose…</option>
              {[100, 200, 300, 400, 500, 600].map((l) => (
                <option key={l} value={l}>
                  Level {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="phone" label="Phone">
            <Input id="phone" inputMode="tel" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
          </Field>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="grid gap-3">
          <p className="text-sm text-muted">Up to 3, in order of preference. Search the list first.</p>
          {[0, 1, 2].map((i) => (
            <div key={i} className="grid grid-cols-[28px_minmax(0,1fr)] items-center gap-2">
              <span className="grid size-7 place-items-center rounded-full bg-[var(--surface-2)] text-sm font-bold">{i + 1}</span>
              <Select
                aria-label={`Choice ${i + 1}`}
                value={choices[i] ?? ""}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  const next = [...choices];
                  if (v) next[i] = v;
                  else next.splice(i, 1);
                  setChoices(next.filter((x, idx) => x && next.indexOf(x) === idx).slice(0, 3));
                }}
              >
                <option value="">{i < choices.length + 1 ? "Choose an organisation…" : "—"}</option>
                {options.map((o) => (
                  <option key={o.id} value={o.id} disabled={choices.includes(o.id) && choices[i] !== o.id}>
                    {o.name}
                    {o.status === "pending_check" ? " (pending check)" : ""}
                  </option>
                ))}
              </Select>
            </div>
          ))}
          <ProposeOrg
            onCreated={async (o) => {
              await orgs.reload();
              if (choices.length < 3) setChoices([...choices, o.id]);
            }}
          />
        </div>
      ) : null}

      {step === 2 ? (
        <Field id="motivation" label="Why do you want this internship?" hint={`${motivation.length}/1200 characters`}>
          <Textarea id="motivation" maxLength={1200} rows={8} value={motivation} onChange={(e) => setMotivation(e.target.value)} />
        </Field>
      ) : null}

      {step === 3 ? (
        <div className="grid gap-3">
          {hasCv ? <Alert tone="ok">Your CV is on file. Upload a new one to replace it.</Alert> : null}
          <FileUpload
            kind="cv"
            accept="application/pdf"
            label={hasCv ? "Replace CV (PDF)" : "Choose your CV (PDF)"}
            hint="PDF only, up to 4 MB. It goes straight to secure storage."
            onUploaded={async (f) => {
              await post("student/profile", { cv_file_id: f.id }, "PATCH");
              setHasCv(true);
            }}
          />
        </div>
      ) : null}

      {step === 4 ? (
        <div className="grid gap-3 rounded-[var(--radius)] border border-line p-3 text-sm">
          <Row k="Name" v={profile.full_name} />
          <Row k="Programme" v={`${profile.programme || "—"} · L${profile.level || "—"}`} />
          <Row k="Choices" v={choices.length ? choices.map((c, i) => `${i + 1}. ${nameOf(c)}`).join("\n") : "None yet"} />
          <Row k="Motivation" v={motivation ? `${motivation.slice(0, 140)}${motivation.length > 140 ? "…" : ""}` : "Missing"} />
          <Row k="CV" v={hasCv ? "On file" : "Missing: go back to step 4"} />
          <p className="text-muted">You can submit one application this cycle. Applications close {fmtDate(cycle.applications_close_at)}.</p>
        </div>
      ) : null}

      <div className="sticky bottom-0 flex gap-3 border-t border-line bg-bg py-3">
        <Button variant="secondary" className="flex-1" onClick={() => (step ? setStep(step - 1) : router.push("/student"))} disabled={busy}>
          {step ? "Back" : "Cancel"}
        </Button>
        {step < 4 ? (
          <Button className="flex-1" onClick={() => saveStep(step + 1)} disabled={busy}>
            {busy ? "Saving…" : step === 3 ? "Review" : "Next"}
          </Button>
        ) : (
          <Button className="flex-1" onClick={submit} disabled={busy || !hasCv}>
            {busy ? "Submitting…" : "Submit application"}
          </Button>
        )}
      </div>
      {step === 3 && hasCv ? (
        <button
          className="text-sm font-semibold text-brand"
          onClick={async () => {
            const m = await api<{ user: { profile: { cv_file_id: number | null } } }>("auth/me");
            if (m.user.profile.cv_file_id) await openFile(m.user.profile.cv_file_id);
          }}
        >
          View my CV
        </button>
      ) : null}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-2">
      <span className="text-muted">{k}</span>
      <span className="font-semibold whitespace-pre-line">{v}</span>
    </div>
  );
}
