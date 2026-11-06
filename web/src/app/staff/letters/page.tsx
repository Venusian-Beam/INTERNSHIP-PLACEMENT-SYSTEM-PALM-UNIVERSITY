"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import { Alert, Avatar, Badge, Button, Card, CardHeader, cx, Empty, Input, PageHeader, Skeleton } from "@/components/ui";
import { ApiError, post } from "@/lib/api";
import { fmtDate, useFetch } from "@/lib/client";

type Letter = {
  id: number; reference_no: string; status: "generated" | "sent" | "failed"; send_mode: string | null;
  organisation: { id: number; name: string; email: string | null }; period_start: string; period_end: string;
  sent_at: string | null; failure_reason: string | null; attachment_bytes: number;
  students: { placement_id: number; name: string; programme: string; level: number; has_cv: boolean }[];
};
type Workspace = {
  cycle: { name: string; past_cutoff: boolean } | null;
  approved_template: number | null;
  pool: { organisation: string; students: string[] }[];
  letters: Letter[];
  mail: { sent_today: number; daily_limit: number };
  max_attachment_bytes: number;
};
type Tab = "generated" | "failed" | "sent";

const mb = (b: number) => `${(b / 1048576).toFixed(1)} MB`;
const TAB_LABEL: Record<Tab, string> = { generated: "Ready", failed: "Failed", sent: "Sent" };
const btnLink =
  "inline-flex min-h-8 items-center justify-center gap-2 rounded-[8px] border border-line-strong bg-bg px-3 text-[13px] font-medium whitespace-nowrap shadow-[var(--shadow)] transition-colors hover:bg-surface";

/**
 * T5 Letters (UI-D6, FR-L). Three steps on one page:
 *  1. matched students waiting → Generate (one letter per organisation)
 *  2. check each letter (details + exact preview), fix students/dates if needed
 *  3. send (one request per letter, AD7: a failure affects only that letter and can be retried)
 */
export default function LetterWorkspace() {
  const { data, reload, error } = useFetch<Workspace>("letters/workspace");
  const [tab, setTab] = useState<Tab>("generated");
  const [sel, setSel] = useState<number | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState(false);
  const [period, setPeriod] = useState<{ start: string; end: string } | null>(null);
  const [progress, setProgress] = useState<{ done: number; failed: number; total: number } | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "bad" | "warn"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);

  const header = (
    <PageHeader
      back={{ href: "/staff", label: "Dashboard" }}
      crumbs={[{ label: "Home", href: "/staff" }, { label: "Letters" }]}
      title="Letters"
      sub="Introductory letters to organisations: one letter per organisation, naming its matched students, with their CVs attached. Student IDs never appear."
      actions={
        data ? (
          <>
            <Pill icon={data.approved_template ? "fileCertificate" : "alert"} tone={data.approved_template ? "ok" : "warn"}>
              {data.approved_template ? `Template v${data.approved_template} · approved` : "No approved template"}
            </Pill>
            <Pill icon="mail" tone="neutral">
              {data.mail.sent_today} of {data.mail.daily_limit} emails today
            </Pill>
          </>
        ) : null
      }
    />
  );

  if (error)
    return (
      <div>
        {header}
        <Alert tone="bad">{error.message}</Alert>
      </div>
    );
  if (!data)
    return (
      <div aria-busy="true" aria-label="Loading letters">
        {header}
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[88px] w-full" />
            ))}
          </div>
          <Skeleton className="h-40 w-full" />
          <div className="grid gap-4 lg:grid-cols-[400px_minmax(0,1fr)]">
            <Skeleton className="h-96 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </div>
    );

  const count = (t: Tab) => data.letters.filter((l) => l.status === t).length;
  const list = data.letters.filter((l) => l.status === tab);
  const current = data.letters.find((l) => l.id === sel) ?? list[0] ?? null;
  const poolCount = data.pool.reduce((n, g) => n + g.students.length, 0);
  const sendable = (l: Letter) => l.status !== "sent" && !!l.organisation.email && l.attachment_bytes <= data.max_attachment_bytes;
  const toSend = data.letters.filter((l) => checked.has(l.id) && sendable(l));
  const selectableInTab = list.filter(sendable);
  const allChecked = selectableInTab.length > 0 && selectableInTab.every((l) => checked.has(l.id));
  const canGenerate = !!data.approved_template && !data.cycle?.past_cutoff;

  const err = (e: unknown) => {
    const x = e as ApiError;
    setMsg({ tone: "bad", text: Object.values(x.errors ?? {}).flat()[0] ?? x.message });
  };

  async function generate() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await post<{ created: number }>("letters/generate");
      setMsg({ tone: "ok", text: r.created ? `${r.created} new letter(s) generated. Check each one, then send.` : "Matched students were added to existing letters." });
      setTab("generated");
      setSel(null);
      await reload();
    } catch (e) {
      err(e);
    } finally {
      setBusy(false);
    }
  }

  /** One request per letter (AD7): a failure affects only that letter, never shown as sent. */
  async function send(queue: number[]) {
    setProgress({ done: 0, failed: 0, total: queue.length });
    setBusy(true);
    setMsg(null);
    let done = 0;
    let failed = 0;
    for (const id of queue) {
      try {
        await post(`letters/${id}/send`);
        done++;
      } catch (e) {
        failed++;
        const x = e as ApiError;
        if (x.status === 422) {
          setMsg({ tone: "warn", text: Object.values(x.errors ?? {}).flat()[0] ?? x.message });
          break;
        }
      }
      setProgress({ done, failed, total: queue.length });
    }
    setChecked(new Set());
    setBusy(false);
    setMsg((m) => m ?? (failed ? { tone: "bad", text: `${done} sent · ${failed} failed. See the Failed tab to retry.` } : { tone: "ok", text: `${done} letter(s) sent.` }));
    await reload();
  }

  async function act(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ tone: "ok", text: ok });
      setEditing(false);
      setPreviewKey((k) => k + 1);
      await reload();
    } catch (e) {
      err(e);
    } finally {
      setBusy(false);
    }
  }

  const toggle = (id: number) =>
    setChecked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleAll = () =>
    setChecked((s) => {
      const n = new Set(s);
      selectableInTab.forEach((l) => (allChecked ? n.delete(l.id) : n.add(l.id)));
      return n;
    });
  const openTab = (t: Tab) => {
    setTab(t);
    setSel(null);
    setEditing(false);
  };

  return (
    <div className="grid gap-5">
      <div className="-mb-5">{header}</div>

      {!data.approved_template ? (
        <Alert tone="warn">
          There is no approved letter template yet, so letters can&apos;t be generated. The Head uploads the template and sends it to the President in{" "}
          <Link href="/staff/settings/template" className="font-semibold underline">
            Settings → Letter template
          </Link>
          .
        </Alert>
      ) : null}
      {data.cycle?.past_cutoff ? <Alert tone="warn">{data.cycle.name} is past its letter cut-off. No new letters can be generated or sent.</Alert> : null}
      {msg ? <Alert tone={msg.tone}>{msg.text}</Alert> : null}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat icon="people" color="--c-amber" label="Waiting for a letter" value={poolCount} hint="Matched students" />
        <Stat icon="mail" color="--c-blue" label="Ready to send" value={count("generated")} hint="Letters to check" active={tab === "generated"} onClick={() => openTab("generated")} />
        <Stat icon="alertCircle" color="--c-red" label="Failed" value={count("failed")} hint="Need a retry" active={tab === "failed"} onClick={() => openTab("failed")} />
        <Stat icon="checkCircle" color="--c-green" label="Sent" value={count("sent")} hint="This cycle" active={tab === "sent"} onClick={() => openTab("sent")} />
      </div>

      {/* Step 1: matched students waiting */}
      {poolCount ? (
        <Card className="p-0">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <StepNo n={1} /> Matched students waiting for a letter
              </span>
            }
            sub="Generating creates one letter per organisation from the approved template. Nothing is sent until you check the letter and press Send."
            actions={
              <Button onClick={generate} disabled={busy || !canGenerate}>
                <Icon name="fileCertificate" /> Generate letters
              </Button>
            }
          />
          <ul className="divide-y divide-line">
            {data.pool.map((g) => (
              <li key={g.organisation} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                <span className="flex min-w-[220px] flex-1 items-center gap-3">
                  <span className="grid size-9 flex-none place-items-center rounded-[8px] bg-surface text-muted">
                    <Icon name="building" className="size-[18px]" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-semibold">{g.organisation}</span>
                    <span className="text-[12.5px] text-muted">
                      {g.students.length} student{g.students.length === 1 ? "" : "s"}
                    </span>
                  </span>
                </span>
                <span className="flex flex-wrap gap-1.5">
                  {g.students.map((n) => (
                    <span key={n} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-bg py-0.5 pr-2.5 pl-0.5 text-[12.5px]">
                      <Avatar name={n} size="sm" />
                      {n}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {/* Steps 2 & 3: check and send */}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(320px,400px)_minmax(0,1fr)]">
        <Card className="overflow-hidden p-0 lg:sticky lg:top-[124px]">
          <div className="border-b border-line px-5 pt-4">
            <h2 className="flex items-center gap-2 text-[14.5px] font-semibold">
              <StepNo n={poolCount ? 2 : 1} /> Letters
            </h2>
            <div role="tablist" aria-label="Letters by status" className="mt-2 flex gap-1">
              {(["generated", "failed", "sent"] as const).map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => openTab(t)}
                  className={cx(
                    "-mb-px flex items-center gap-1.5 border-b-2 px-2.5 py-2.5 text-[13.5px] font-medium transition-colors",
                    tab === t ? "border-brand text-text" : "border-transparent text-muted hover:text-text",
                  )}
                >
                  {TAB_LABEL[t]}{" "}
                  <span className={cx("min-w-5 rounded-full px-1.5 py-px text-center text-[11.5px] tabular-nums", tab === t ? "bg-brand-soft text-brand" : "bg-surface text-muted")}>
                    {count(t)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {tab !== "sent" && selectableInTab.length ? (
            <label className="flex items-center gap-3 border-b border-line bg-surface/60 px-5 py-2.5 text-[12.5px] font-medium text-muted">
              <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={allChecked} onChange={toggleAll} disabled={busy} />
              Select all ready to send ({selectableInTab.length})
            </label>
          ) : null}

          <div className="max-h-[520px] overflow-y-auto">
            {list.length ? (
              list.map((l) => {
                const active = current?.id === l.id;
                return (
                  <div
                    key={l.id}
                    className={cx(
                      "grid cursor-pointer grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-3 border-b border-l-[3px] border-b-line px-5 py-3.5 transition-colors last:border-b-0",
                      active ? "border-l-brand bg-brand-soft/60" : "border-l-transparent hover:bg-surface",
                    )}
                    onClick={() => {
                      setSel(l.id);
                      setEditing(false);
                    }}
                  >
                    {l.status === "sent" ? (
                      <Icon name="checkCircle" className="size-5 text-brand" />
                    ) : (
                      <input
                        type="checkbox"
                        className="size-4 accent-[var(--brand)]"
                        aria-label={`Select ${l.organisation.name}`}
                        checked={checked.has(l.id)}
                        disabled={!sendable(l) || busy}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => toggle(l.id)}
                      />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-semibold">{l.organisation.name}</span>
                      <span className="block truncate text-[12.5px] text-muted">
                        {l.students.map((s) => s.name).join(", ")}
                      </span>
                      <span className="font-mono text-[11px] text-faint">{l.reference_no}</span>
                    </span>
                    <LetterBadge l={l} tooBig={l.attachment_bytes > data.max_attachment_bytes} />
                  </div>
                );
              })
            ) : (
              <Empty icon={tab === "failed" ? "checkCircle" : "mail"}>
                {tab === "generated"
                  ? poolCount
                    ? "No letters yet. Generate letters for the matched students above."
                    : "No letters waiting. When students pass their interview, they appear here to be sent."
                  : tab === "failed"
                    ? "No failed letters."
                    : "Nothing sent yet this cycle."}
              </Empty>
            )}
          </div>

          {tab !== "sent" ? (
            <div className="grid gap-2.5 border-t border-line bg-surface px-5 py-4">
              <Button onClick={() => send(toSend.map((l) => l.id))} disabled={busy || !toSend.length} className="w-full">
                <Icon name="send" />
                {busy && progress ? "Sending…" : `Send selected (${toSend.length})`}
              </Button>
              {progress ? (
                <div className="grid gap-1">
                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]"
                    role="progressbar"
                    aria-label="Sending progress"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(((progress.done + progress.failed) / progress.total) * 100)}
                  >
                    <div className="h-full bg-brand transition-[width]" style={{ width: `${((progress.done + progress.failed) / progress.total) * 100}%` }} />
                  </div>
                  <span className="text-[12px] text-muted tabular-nums">
                    {progress.done} of {progress.total} sent{progress.failed ? ` · ${progress.failed} failed` : ""}
                  </span>
                </div>
              ) : (
                <p className="text-[12px] text-muted">Tick the letters you have checked. Each one is emailed to its organisation with the CVs attached.</p>
              )}
            </div>
          ) : null}
        </Card>

        {current ? (
          <LetterDetail
            key={current.id}
            l={current}
            max={data.max_attachment_bytes}
            busy={busy}
            canSend={sendable(current)}
            editing={editing}
            period={period}
            previewKey={previewKey}
            onSend={() => send([current.id])}
            onEdit={() => {
              setEditing(!editing);
              setPeriod({ start: current.period_start, end: current.period_end });
            }}
            setPeriod={setPeriod}
            onMarkSent={() => act(() => post(`letters/${current.id}/mark-sent`), "Marked as sent (delivered outside the system).")}
            onRemove={(s) => act(() => post(`letters/${current.id}/remove-student`, { placement_id: s.placement_id }), `${s.name} was taken off this letter and is waiting for a letter again.`)}
            onSavePeriod={() =>
              period && act(() => post(`letters/${current.id}`, { period_start: period.start, period_end: period.end }, "PATCH"), "Internship dates updated.")
            }
          />
        ) : (
          <Card className="p-0">
            <Empty icon="doc">Select a letter on the left to check it here, exactly as the organisation will receive it.</Empty>
          </Card>
        )}
      </div>
    </div>
  );
}

function LetterDetail({
  l, max, busy, canSend, editing, period, previewKey, onSend, onEdit, setPeriod, onMarkSent, onRemove, onSavePeriod,
}: {
  l: Letter; max: number; busy: boolean; canSend: boolean; editing: boolean; period: { start: string; end: string } | null; previewKey: number;
  onSend: () => void; onEdit: () => void; setPeriod: (p: { start: string; end: string }) => void; onMarkSent: () => void;
  onRemove: (s: Letter["students"][number]) => void; onSavePeriod: () => void;
}) {
  const sent = l.status === "sent";
  const pct = Math.min(100, (l.attachment_bytes / max) * 100);
  const tooBig = l.attachment_bytes > max;
  const cvs = l.students.filter((s) => s.has_cv).length;

  return (
    <div className="grid min-w-0 gap-5">
      <Card className="p-0">
        <CardHeader
          title={
            <span className="flex flex-wrap items-center gap-2">
              {l.organisation.name} <LetterBadge l={l} tooBig={tooBig} />
            </span>
          }
          sub={
            l.organisation.email ? (
              <span className="inline-flex items-center gap-1.5">
                <Icon name="mail" className="size-3.5" /> To {l.organisation.email}
              </span>
            ) : (
              <span className="text-[var(--danger)]">No email address for this organisation</span>
            )
          }
          actions={
            <>
              <a className={btnLink} href={`/api/proxy/letters/${l.id}/pdf`}>
                <Icon name="download" /> Download PDF
              </a>
              {!sent ? (
                <Button size="sm" onClick={onSend} disabled={busy || !canSend}>
                  <Icon name="send" /> {l.status === "failed" ? "Retry sending" : "Send this letter"}
                </Button>
              ) : null}
            </>
          }
        />
        <div className="grid gap-5 px-5 py-4">
          {sent ? (
            <Alert tone="ok">
              Sent {fmtDate(l.sent_at)}
              {l.send_mode === "manual" ? " (delivered outside the system)" : " by email"}. A sent letter can&apos;t be changed.
            </Alert>
          ) : null}
          {l.failure_reason ? <Alert tone="bad">The last attempt failed: {l.failure_reason}</Alert> : null}
          {!l.organisation.email && !sent ? (
            <Alert tone="warn">
              Add an email address under{" "}
              <Link href="/staff/organisations" className="font-semibold underline">
                Organisations
              </Link>
              , or download the PDF, deliver it yourself and press &ldquo;Mark as sent&rdquo;.
            </Alert>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-3">
            <Fact icon="fileCertificate" label="Reference">
              <span className="font-mono text-[13px]">{l.reference_no}</span>
            </Fact>
            <Fact icon="calendar" label="Internship dates">
              {fmtDate(l.period_start)} – {fmtDate(l.period_end)}
            </Fact>
            <Fact icon="folder" label="Attachments">
              <span className={tooBig ? "text-[var(--danger)]" : undefined}>
                Letter + {cvs} CV{cvs === 1 ? "" : "s"} · {mb(l.attachment_bytes)}
              </span>
              <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-[var(--surface-2)]" aria-hidden>
                <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: tooBig ? "var(--danger)" : "var(--brand)" }} />
              </span>
              <span className="mt-1 block text-[11.5px] font-normal text-muted">Limit {mb(max)}</span>
            </Fact>
          </div>

          <div>
            <h3 className="mb-2 text-[12.5px] font-semibold text-muted">Students on this letter</h3>
            <ul className="divide-y divide-line rounded-[var(--radius)] border border-line">
              {l.students.map((s) => (
                <li key={s.placement_id} className="flex flex-wrap items-center gap-3 px-3.5 py-2.5">
                  <Avatar name={s.name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-semibold">{s.name}</span>
                    <span className="text-[12px] text-muted">
                      {s.programme} · Level {s.level}
                    </span>
                  </span>
                  {s.has_cv ? <Badge tone="ok">CV attached</Badge> : <Badge tone="warn">No CV</Badge>}
                  {editing ? (
                    <Button variant="ghost" size="sm" disabled={busy || l.students.length < 2} title={l.students.length < 2 ? "A letter needs at least one student" : undefined} onClick={() => onRemove(s)}>
                      Remove
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>

          {editing && period ? (
            <div className="grid gap-3 rounded-[var(--radius)] border border-line bg-surface/60 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <label className="grid gap-1 text-[13px]">
                <span className="font-semibold">Internship starts</span>
                <Input type="date" value={period.start} onChange={(e) => setPeriod({ ...period, start: e.target.value })} />
              </label>
              <label className="grid gap-1 text-[13px]">
                <span className="font-semibold">Internship ends</span>
                <Input type="date" value={period.end} onChange={(e) => setPeriod({ ...period, end: e.target.value })} />
              </label>
              <Button disabled={busy} onClick={onSavePeriod}>
                Save dates
              </Button>
            </div>
          ) : null}

          {!sent ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
              <Button variant="secondary" size="sm" onClick={onEdit}>
                <Icon name={editing ? "check" : "settings"} /> {editing ? "Done editing" : "Edit students & dates"}
              </Button>
              <Button variant="ghost" size="sm" disabled={busy} onClick={onMarkSent} title="Use this only if you delivered the letter yourself (e.g. printed or emailed it from your own mailbox).">
                <Icon name="checkCircle" /> Mark as sent (delivered yourself)
              </Button>
            </div>
          ) : null}
        </div>
      </Card>

      <Card className="p-0">
        <CardHeader title="Preview" sub="Exactly what the organisation receives." />
        <div className="bg-surface-2 p-3 sm:p-6">
          <iframe
            key={`${l.id}-${previewKey}`}
            title={`Preview of letter ${l.reference_no}`}
            src={`/api/proxy/letters/${l.id}/preview`}
            sandbox=""
            className="mx-auto block h-[760px] w-full max-w-[794px] rounded-[4px] bg-white shadow-[var(--shadow-lg)]"
          />
        </div>
      </Card>
    </div>
  );
}

function LetterBadge({ l, tooBig }: { l: Letter; tooBig: boolean }) {
  if (l.status === "sent") return <Badge tone="ok">{l.send_mode === "manual" ? "Sent (manual)" : "Sent"}</Badge>;
  if (l.status === "failed") return <Badge tone="bad">Failed</Badge>;
  if (!l.organisation.email) return <Badge tone="bad">No email</Badge>;
  if (tooBig) return <Badge tone="bad">Too large</Badge>;
  return <Badge tone="info">Ready</Badge>;
}

function Stat({ icon, color, label, value, hint, active, onClick }: { icon: IconName; color: string; label: string; value: number; hint: string; active?: boolean; onClick?: () => void }) {
  const body = (
    <>
      <span className="grid size-11 flex-none place-items-center rounded-[10px]" style={{ background: `color-mix(in srgb, var(${color}) 14%, white)`, color: `var(${color})` }}>
        <Icon name={icon} className="size-[22px]" />
      </span>
      <span className="min-w-0 text-left">
        <span className="block text-[12.5px] text-muted">{label}</span>
        <span className="block text-[24px] leading-tight font-semibold tabular-nums">{value}</span>
        <span className="block text-[11.5px] text-faint">{hint}</span>
      </span>
    </>
  );
  const cls = cx(
    "flex items-center gap-3.5 rounded-[var(--radius)] border bg-bg p-4 shadow-[var(--shadow)] transition-colors",
    active ? "border-brand ring-2 ring-[color-mix(in_srgb,var(--brand)_18%,transparent)]" : "border-line",
  );
  return onClick ? (
    <button type="button" onClick={onClick} aria-pressed={active} className={cx(cls, "hover:border-line-strong")}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function Pill({ icon, tone, children }: { icon: IconName; tone: "ok" | "warn" | "neutral"; children: ReactNode }) {
  const c = tone === "ok" ? "border-[color-mix(in_srgb,var(--brand)_30%,var(--line))] bg-brand-soft text-brand" : tone === "warn" ? "border-line bg-[var(--warn-soft)] text-[var(--warn)]" : "border-line bg-bg text-muted";
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold", c)}>
      <Icon name={icon} className="size-4" />
      {children}
    </span>
  );
}

function StepNo({ n }: { n: number }) {
  return <span className="grid size-5 place-items-center rounded-full bg-ink text-[11px] font-semibold text-ink-text">{n}</span>;
}

function Fact({ icon, label, children }: { icon: IconName; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-9 flex-none place-items-center rounded-[8px] bg-surface text-muted">
        <Icon name={icon} className="size-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] text-muted">{label}</p>
        <div className="text-[13.5px] font-semibold">{children}</div>
      </div>
    </div>
  );
}
