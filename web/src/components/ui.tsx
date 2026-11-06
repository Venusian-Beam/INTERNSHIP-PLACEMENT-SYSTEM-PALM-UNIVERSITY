/**
 * Shared UI kit on the brand tokens (theme/tokens.css). One visual language for every screen:
 * white panels with hairline borders on the paper canvas, 8px radii, green reserved for actions,
 * quiet tinted status labels. Accessible defaults: visible focus, labelled fields, errors announced
 * next to the field (NFR-U2), 40px+ touch targets.
 */
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { twMerge } from "tailwind-merge";
import { Icon, type IconName } from "./icons";

/** Joins classes; later utilities win over earlier ones (so `className="p-0"` overrides a default `p-5`). */
export const cx = (...c: (string | false | null | undefined)[]) => twMerge(c.filter(Boolean).join(" "));

type Variant = "primary" | "secondary" | "danger" | "ghost" | "dark";
const variants: Record<Variant, string> = {
  primary: "bg-brand text-brand-ink border-brand hover:bg-brand-strong hover:border-brand-strong shadow-[var(--shadow)]",
  secondary: "bg-bg text-text border-line-strong hover:bg-surface shadow-[var(--shadow)]",
  danger: "bg-bg text-[var(--danger)] border-[color-mix(in_srgb,var(--danger)_45%,var(--line))] hover:bg-[var(--danger-soft)]",
  ghost: "bg-transparent text-muted border-transparent hover:bg-surface hover:text-text",
  dark: "bg-ink text-ink-text border-ink hover:bg-ink-2",
};
type Size = "sm" | "md";
const sizes: Record<Size, string> = {
  sm: "min-h-8 px-3 text-[13px]",
  md: "min-h-10 px-4 text-sm",
};
const btn =
  "inline-flex items-center justify-center gap-2 rounded-[8px] border font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-45";

export function Button({ variant = "primary", size = "md", className, ...p }: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={cx(btn, sizes[size], variants[variant], className)} {...p} />;
}

export function LinkButton({ variant = "secondary", size = "md", className, ...p }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={cx(btn, sizes[size], variants[variant], className)} {...p} />;
}

const input =
  "w-full min-h-10 rounded-[8px] border border-line-strong bg-bg px-3 py-2 text-[14px] text-text placeholder:text-faint transition-colors hover:border-[var(--muted)] focus:border-brand focus:outline-none focus:ring-3 focus:ring-[color-mix(in_srgb,var(--brand)_18%,transparent)] aria-invalid:border-[var(--danger)]";

export function Input({ className, ...p }: ComponentProps<"input">) {
  return <input className={cx(input, className)} {...p} />;
}

export function Textarea({ className, ...p }: ComponentProps<"textarea">) {
  return <textarea className={cx(input, "min-h-28", className)} {...p} />;
}

export function Select({ className, ...p }: ComponentProps<"select">) {
  return <select className={cx(input, "cursor-pointer", className)} {...p} />;
}

export function SearchInput({ className, ...p }: ComponentProps<"input">) {
  return (
    <span className={cx("relative block", className)}>
      <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
      <input type="search" className={cx(input, "pl-9")} {...p} />
    </span>
  );
}

export function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold text-text">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="flex items-center gap-1.5 text-[13px] text-[var(--danger)]" role="alert">
          <Icon name="alert" className="size-3.5" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-[13px] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

type Tone = "info" | "ok" | "warn" | "bad";
const toneText: Record<Tone, string> = {
  info: "text-[var(--info)]",
  ok: "text-brand",
  warn: "text-[var(--warn)]",
  bad: "text-[var(--danger)]",
};
const toneSoft: Record<Tone, string> = {
  info: "bg-[var(--info-soft)]",
  ok: "bg-brand-soft",
  warn: "bg-[var(--warn-soft)]",
  bad: "bg-[var(--danger-soft)]",
};
const toneVar: Record<Tone, string> = { info: "--info", ok: "--brand", warn: "--warn", bad: "--danger" };
const toneIcon: Record<Tone, IconName> = { info: "info", ok: "checkCircle", warn: "alert", bad: "alert" };

/** Inline notice: tinted strip with an icon; text stays readable ink, the icon carries the tone. */
export function Alert({ tone = "info", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <div
      className={cx("flex items-start gap-2.5 rounded-[var(--radius)] border px-3.5 py-3 text-sm text-text", toneSoft[tone])}
      style={{ borderColor: `color-mix(in srgb, var(${toneVar[tone]}) 20%, transparent)` }}
      role={tone === "bad" ? "alert" : "status"}
    >
      <Icon name={toneIcon[tone]} className={cx("mt-px size-[18px]", toneText[tone])} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** Status label: small tinted rectangle with a dot, readable in both themes. */
export function Badge({ tone = "info", children }: { tone?: Tone | "neutral"; children: ReactNode }) {
  const t = tone === "neutral" ? "bg-surface text-muted" : cx(toneSoft[tone], toneText[tone]);
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] leading-none font-medium whitespace-nowrap", t)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {children}
    </span>
  );
}

/** Panel: the standard white container. */
export function Card({ className, ...p }: ComponentProps<"section">) {
  return <section className={cx("rounded-[var(--radius)] border border-line bg-bg p-5 shadow-[var(--shadow)]", className)} {...p} />;
}

/** Panel header row: title (+ optional description) left, actions right, hairline below. */
export function CardHeader({ title, sub, actions, className }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cx("flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4", className)}>
      <div className="min-w-0">
        <h2 className="text-[14.5px] font-semibold">{title}</h2>
        {sub ? <p className="mt-0.5 text-[13px] text-muted">{sub}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export type Crumb = { label: string; href?: string };

/** Breadcrumb trail: "Home → Students → Ama Mensah". */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[12.5px]">
      {items.map((c, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i ? <Icon name="arrowRight" className="size-3 text-faint" /> : null}
          {c.href ? (
            <Link href={c.href} className="text-[var(--c-indigo)] hover:underline">
              {c.label}
            </Link>
          ) : (
            <span className="text-text" aria-current="page">
              {c.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

/** "← Back to Students": a visible way back to the parent page (always a fixed link, never browser history). */
export function BackLink({ href, label, className }: { href: string; label: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cx(
        "inline-flex w-fit items-center gap-1.5 rounded-full border border-line bg-bg px-3 py-1.5 text-[12.5px] font-semibold text-muted shadow-[var(--shadow)] transition-colors hover:border-line-strong hover:text-text",
        className,
      )}
    >
      <Icon name="arrowLeft" className="size-3.5" />
      Back to {label}
    </Link>
  );
}

export function PageHeader({
  title,
  sub,
  actions,
  eyebrow,
  crumbs,
  back,
}: {
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  crumbs?: Crumb[];
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {back ? <BackLink href={back.href} label={back.label} className="mb-3" /> : null}
        {crumbs ? <Breadcrumbs items={crumbs} /> : eyebrow ? <p className="mb-1 text-[12.5px] font-medium text-muted">{eyebrow}</p> : null}
        <h1 className="text-[22px] leading-tight font-semibold tracking-[-0.01em] text-balance">{title}</h1>
        {sub ? <p className="mt-1 max-w-3xl text-[13px] text-muted">{sub}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Empty({ children, icon = "inbox" }: { children: ReactNode; icon?: IconName }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted">
      <span className="grid size-10 place-items-center rounded-full bg-surface text-faint">
        <Icon name={icon} className="size-5" />
      </span>
      <div className="max-w-sm">{children}</div>
    </div>
  );
}

/** Data table primitives: quiet sentence-case headers, 44px rows, hover tint. */
export function Table({ className, ...p }: ComponentProps<"table">) {
  return <table className={cx("w-full border-collapse text-sm", className)} {...p} />;
}
export function Th({ className, ...p }: ComponentProps<"th">) {
  return <th className={cx("border-b border-line bg-surface/60 px-4 py-2.5 text-left text-[12.5px] font-semibold whitespace-nowrap text-muted", className)} {...p} />;
}
export function Td({ className, ...p }: ComponentProps<"td">) {
  return <td className={cx("border-b border-line px-4 py-3 align-middle", className)} {...p} />;
}
export function Tr({ className, ...p }: ComponentProps<"tr">) {
  return <tr className={cx("transition-colors last:[&>td]:border-0 hover:bg-surface/70", className)} {...p} />;
}

export function Pagination({ page, pages, total, from, to, onPage }: { page: number; pages: number; total: number; from: number; to: number; onPage: (p: number) => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-[13px] text-muted">
      <span className="tabular-nums">
        {total ? `${from}–${to} of ${total}` : "0 results"}
      </span>
      <span className="flex items-center gap-1">
        <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <Icon name="chevronLeft" />
        </Button>
        <span className="px-2 tabular-nums">
          Page {page} of {Math.max(pages, 1)}
        </span>
        <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">
          <Icon name="chevronRight" />
        </Button>
      </span>
    </div>
  );
}

/** Segmented tabs (buttons or links share one look). */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: readonly (readonly [T, ReactNode])[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="inline-flex flex-wrap gap-0.5 rounded-[var(--radius)] border border-line bg-surface p-0.5" role="group" aria-label={label}>
      {options.map(([k, l]) => (
        <button
          key={k}
          type="button"
          aria-pressed={value === k}
          onClick={() => onChange(k)}
          className={cx(
            "rounded-[6px] px-3 py-1.5 text-[13px] font-semibold transition-colors",
            value === k ? "bg-bg text-text shadow-[var(--shadow)]" : "text-muted hover:text-text",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

const avatarHues = ["--s1", "--s7", "--s2", "--s3", "--s5"];
export function Avatar({ name, size = "md", tone }: { name: string; size?: "sm" | "md" | "lg"; tone?: number }) {
  const initials = name
    .replace(/^(Dr|Mr|Mrs|Ms|Miss|Prof)\.?\s+/i, "")
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const hue = avatarHues[(tone ?? [...name].reduce((s, c) => s + c.charCodeAt(0), 0)) % avatarHues.length];
  return (
    <span
      className={cx("grid flex-none place-items-center rounded-full font-semibold", size === "sm" ? "size-7 text-[11px]" : size === "lg" ? "size-14 text-[18px]" : "size-8 text-xs")}
      style={{ background: `color-mix(in srgb, var(${hue}) 16%, var(--bg))`, color: `color-mix(in srgb, var(${hue}) 80%, var(--text))` }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

/** Label/value rows for detail panels. */
export function DescList({ items }: { items: [ReactNode, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(0,140px)_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm">
      {items.map(([k, v], i) => (
        <div key={i} className="contents">
          <dt className="text-muted">{k}</dt>
          <dd className="min-w-0 font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted" role="status">
      <span className="size-4 animate-spin rounded-full border-2 border-line-strong border-t-brand" aria-hidden />
      {label}
    </span>
  );
}

/** Placeholder blocks while data loads, shaped like the content. */
export function Skeleton({ className }: { className?: string }) {
  return <span className={cx("block animate-pulse rounded-[6px] bg-surface-2", className)} aria-hidden />;
}

export function PageLoading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="grid gap-4" role="status" aria-label={label}>
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}
