"use client";

/**
 * Dashboard building blocks (colourful, light theme): card shell with a table view, sparkline, gauge ring,
 * dotted trend chart, donut with legend grid, progress bar. Dependency-free SVG; every chart has hover
 * tooltips and a table alternative, and text always uses text colours (colour only marks the data).
 */
import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { Icon, type IconName } from "./icons";
import { cx } from "./ui";

/* ---------- helpers ---------- */

/** Smooth path through points (Catmull-Rom → cubic Bézier), clamped so curves never dip below the baseline. */
function smooth(pts: [number, number][], floor: number): string {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : "";
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1y = Math.min(floor, p1[1] + (p2[1] - p0[1]) / 6);
    const c2y = Math.min(floor, p2[1] - (p3[1] - p1[1]) / 6);
    d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)},${c1y.toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

export const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/* ---------- card shell ---------- */

export function DashCard({
  title,
  icon,
  hue = "--c-indigo",
  actions,
  table,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  icon?: IconName;
  hue?: string;
  actions?: ReactNode;
  table?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section className={cx("flex min-w-0 flex-col rounded-[var(--radius)] border border-line bg-bg shadow-[var(--shadow)]", className)} aria-label={title}>
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
        <h3 className="flex min-w-0 items-center gap-2 text-[13.5px] font-semibold">
          {icon ? (
            <span className="grid size-7 flex-none place-items-center rounded-[8px]" style={{ background: `color-mix(in srgb, var(${hue}) 12%, white)`, color: `var(${hue})` }}>
              <Icon name={icon} className="size-4" />
            </span>
          ) : null}
          <span className="truncate">{title}</span>
        </h3>
        <div className="flex flex-none items-center gap-1.5">
          {actions}
          {table ? (
            <button
              type="button"
              aria-pressed={showTable}
              title={showTable ? "Show chart" : "Show as table"}
              aria-label={showTable ? "Show chart" : "Show as table"}
              onClick={() => setShowTable(!showTable)}
              className={cx("grid size-7 place-items-center rounded-[6px] border border-line text-muted hover:bg-surface hover:text-text", showTable && "border-brand bg-brand-soft text-brand")}
            >
              <Icon name={showTable ? "chart" : "table"} className="size-3.5" />
            </button>
          ) : null}
        </div>
      </div>
      <div className={cx("flex-1 px-5 pt-1 pb-5", bodyClassName)}>{showTable && table ? <div className="overflow-x-auto">{table}</div> : children}</div>
    </section>
  );
}

export function MiniTable({ head, rows }: { head: string[]; rows: (ReactNode | null)[][] }) {
  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr className="border-b border-line text-left text-[12px] text-muted">
          {head.map((h) => (
            <th key={h} className="px-2 py-2 font-medium">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-line last:border-0">
            {r.map((c, j) => (
              <td key={j} className="px-2 py-1.5 tabular-nums">
                {c ?? "—"}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ---------- tooltip ---------- */

function useTip() {
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);
  const node = tip ? (
    <div role="tooltip" className="pointer-events-none fixed z-50 max-w-64 rounded-[8px] bg-ink px-2.5 py-1.5 text-[12px] text-white shadow-[var(--shadow-lg)]" style={{ left: tip.x + 12, top: tip.y + 12 }}>
      {tip.text}
    </div>
  ) : null;
  return { tip, setTip, node };
}

/* ---------- sparkline ---------- */

export function Sparkline({ values, hue, label }: { values: number[]; hue: string; label: string }) {
  const id = useId();
  const W = 84, H = 32, pad = 3;
  const max = Math.max(1, ...values);
  const pts: [number, number][] = values.map((v, i) => [pad + (i * (W - 2 * pad)) / Math.max(values.length - 1, 1), H - pad - (v / max) * (H - 2 * pad)]);
  const line = smooth(pts, H - pad);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={label} className="flex-none overflow-visible">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={`var(${hue})`} stopOpacity="0.25" />
          <stop offset="1" stopColor={`var(${hue})`} stopOpacity="0" />
        </linearGradient>
      </defs>
      {pts.length > 1 ? <path d={`${line} L${pts[pts.length - 1][0]},${H} L${pts[0][0]},${H} Z`} fill={`url(#${id})`} /> : null}
      <path d={line} fill="none" stroke={`var(${hue})`} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------- KPI card ---------- */

export function KpiCard({
  label,
  value,
  hue,
  icon,
  chip,
  footer,
  children,
}: {
  label: string;
  value: ReactNode;
  hue: string;
  icon: IconName;
  chip?: { text: string; tone: "up" | "down" | "flat" | "risk" };
  footer?: ReactNode;
  children?: ReactNode;
}) {
  const chipStyle: Record<string, string> = {
    up: "bg-[#ecfdf3] text-[#067647]",
    down: "bg-[#fef3f2] text-[#b42318]",
    flat: "bg-surface text-muted",
    risk: "bg-[#fef3f2] text-[#b42318]",
  };
  return (
    <div className="flex min-w-0 flex-col gap-4 rounded-[var(--radius)] border border-line bg-bg p-4 shadow-[var(--shadow)]">
      <div className="flex items-start justify-between gap-2">
        <span className="grid size-8 place-items-center rounded-[8px] text-white shadow-[var(--shadow)]" style={{ background: `var(${hue})` }}>
          <Icon name={icon} className="size-[18px]" />
        </span>
        {chip ? (
          <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", chipStyle[chip.tone])}>
            {chip.tone === "up" ? <Icon name="trendUp" className="size-3" /> : chip.tone === "down" ? <Icon name="trendDown" className="size-3" /> : null}
            {chip.text}
          </span>
        ) : null}
      </div>
      <div className="mt-auto grid gap-1">
        <p className="text-[12px] leading-snug font-medium" style={{ color: `color-mix(in srgb, var(${hue}) 70%, var(--text))` }}>
          {label}
        </p>
        <div className="flex items-end justify-between gap-2">
          <p className="text-[24px] leading-none font-semibold tabular-nums">{value}</p>
          {children}
        </div>
        {footer ? <p className="mt-1 text-[11.5px] leading-snug text-muted">{footer}</p> : null}
      </div>
    </div>
  );
}

/* ---------- gauge ring ---------- */

export function Gauge({ value, hue, centre, centreSub, label }: { value: number; hue: string; centre: ReactNode; centreSub: string; label: string }) {
  const r = 58, C = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="relative mx-auto grid size-[168px] place-items-center">
      <svg viewBox="0 0 150 150" className="absolute inset-0 size-full -rotate-90" role="img" aria-label={label}>
        <circle cx="75" cy="75" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="13" />
        {pct > 0 ? (
          <circle cx="75" cy="75" r={r} fill="none" stroke={`var(${hue})`} strokeWidth="13" strokeLinecap="round" strokeDasharray={`${(pct / 100) * C} ${C}`} style={{ transition: "stroke-dasharray .6s ease" }} />
        ) : null}
      </svg>
      <div className="text-center">
        <div className="text-[30px] leading-none font-semibold tabular-nums">{centre}</div>
        <div className="mt-1 text-[11.5px] text-muted">{centreSub}</div>
      </div>
    </div>
  );
}

/* ---------- progress bar ---------- */

export function Bar({ value, max, hue, height = 8, label }: { value: number; max: number; hue: string; height?: number; label?: string }) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div
      className="w-full overflow-hidden rounded-full"
      style={{ height, background: `color-mix(in srgb, var(${hue}) 12%, white)` } as CSSProperties}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      <div className="h-full rounded-full" style={{ width: `${Math.max(pct, value ? 2 : 0)}%`, background: `var(${hue})`, transition: "width .5s ease" }} />
    </div>
  );
}

/* ---------- dotted trend chart ---------- */

export function TrendChart({ points, hue, label, unit }: { points: { x: string; y: number }[]; hue: string; label: string; unit: string }) {
  const id = useId();
  const { setTip, node } = useTip();
  const [hover, setHover] = useState<number | null>(null);
  const W = 520, H = 200, pl = 28, pr = 10, pt = 12, pb = 26;
  if (!points.length) return <p className="py-10 text-center text-[13px] text-muted">No data yet.</p>;
  const max = Math.max(4, ...points.map((p) => p.y));
  const nice = Math.ceil(max / 4) * 4;
  const n = Math.max(points.length - 1, 1);
  const x = (i: number) => pl + (i * (W - pl - pr)) / n;
  const y = (v: number) => pt + (1 - v / nice) * (H - pt - pb);
  const pts: [number, number][] = points.map((p, i) => [x(i), y(p.y)]);
  const line = smooth(pts, y(0));
  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full"
        role="img"
        aria-label={label}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const i = Math.max(0, Math.min(points.length - 1, Math.round((((e.clientX - r.left) / r.width) * W - pl) / ((W - pl - pr) / n))));
          setHover(i);
          setTip({ text: `Week of ${shortDate(points[i].x)}: ${points[i].y} ${unit}`, x: e.clientX, y: e.clientY });
        }}
        onMouseLeave={() => {
          setHover(null);
          setTip(null);
        }}
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={`var(${hue})`} stopOpacity="0.18" />
            <stop offset="1" stopColor={`var(${hue})`} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3, 4].map((k) => {
          const v = (nice / 4) * k;
          return (
            <g key={k}>
              <line x1={pl} x2={W - pr} y1={y(v)} y2={y(v)} stroke="var(--grid)" strokeWidth="1" />
              <text x={pl - 6} y={y(v) + 3.5} textAnchor="end" className="fill-[var(--faint)] text-[10px]">
                {v}
              </text>
            </g>
          );
        })}
        <path d={`${line} L${x(points.length - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill={`url(#${id})`} />
        <path d={line} fill="none" stroke={`var(${hue})`} strokeWidth="1.6" strokeDasharray="3 3" strokeLinecap="round" />
        {pts.map(([px, py], i) => (
          <circle key={i} cx={px} cy={py} r={hover === i ? 4.5 : 2.4} fill={hover === i ? `var(${hue})` : "white"} stroke={`var(${hue})`} strokeWidth="1.6" />
        ))}
        {hover !== null ? <line x1={x(hover)} x2={x(hover)} y1={pt} y2={y(0)} stroke="var(--axis)" strokeDasharray="2 3" /> : null}
        {points.map((p, i) =>
          points.length <= 8 || i % Math.ceil(points.length / 7) === 0 || i === points.length - 1 ? (
            <text key={p.x} x={x(i)} y={H - 7} textAnchor="middle" className="fill-[var(--faint)] text-[10px]">
              {shortDate(p.x)}
            </text>
          ) : null,
        )}
      </svg>
      {node}
    </div>
  );
}

/* ---------- vertical bars ---------- */

export function ColumnChart({ items, hue, format = String, label }: { items: { label: string; value: number; tip: string }[]; hue: string; format?: (v: number) => string; label: string }) {
  const { setTip, node } = useTip();
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div role="img" aria-label={label}>
      <div className="relative flex h-56 items-end gap-3 border-b border-line px-1 pt-6">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <span key={f} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-[var(--grid)]" style={{ bottom: `${f * 85}%` }} aria-hidden />
        ))}
        {items.map((i) => (
          <div
            key={i.label}
            className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
            tabIndex={0}
            aria-label={i.tip}
            onMouseMove={(e) => setTip({ text: i.tip, x: e.clientX, y: e.clientY })}
            onMouseLeave={() => setTip(null)}
            onFocus={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setTip({ text: i.tip, x: r.left + r.width / 2, y: r.top });
            }}
            onBlur={() => setTip(null)}
          >
            <span className="text-[11.5px] font-semibold tabular-nums">{format(i.value)}</span>
            <span
              className="w-full max-w-[38px] rounded-t-[6px] transition-opacity group-hover:opacity-85"
              style={{ height: `${Math.max((i.value / max) * 85, i.value ? 2 : 0.5)}%`, background: `linear-gradient(180deg, var(${hue}), color-mix(in srgb, var(${hue}) 70%, white))` }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-3 px-1 pt-2">
        {items.map((i) => (
          <span key={i.label} className="min-w-0 flex-1 truncate text-center text-[11px] text-muted" title={i.label}>
            {i.label}
          </span>
        ))}
      </div>
      {node}
    </div>
  );
}

/* ---------- donut with legend grid ---------- */

export function DonutChart({ parts, label, centre, centreSub }: { parts: { label: string; value: number; hue: string }[]; label: string; centre?: ReactNode; centreSub?: string }) {
  const { setTip, node } = useTip();
  const total = parts.reduce((s, p) => s + p.value, 0);
  const r = 62, C = 2 * Math.PI * r, gap = 2.5;
  let off = 0;
  return (
    <div className="grid gap-4">
      <div className="relative mx-auto size-[190px]">
        <svg viewBox="0 0 160 160" className="size-full -rotate-90" role="img" aria-label={label}>
          <circle cx="80" cy="80" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="26" />
          {total
            ? parts.map((p) => {
                const len = (p.value / total) * C;
                const seg = p.value ? (
                  <circle
                    key={p.label}
                    cx="80"
                    cy="80"
                    r={r}
                    fill="none"
                    stroke={`var(${p.hue})`}
                    strokeWidth="26"
                    strokeDasharray={`${Math.max(len - gap, 0.5)} ${C}`}
                    strokeDashoffset={-off}
                    tabIndex={0}
                    aria-label={`${p.label}: ${p.value}`}
                    onMouseMove={(e) => setTip({ text: `${p.label}: ${p.value} of ${total} (${Math.round((p.value / total) * 100)}%)`, x: e.clientX, y: e.clientY })}
                    onMouseLeave={() => setTip(null)}
                  />
                ) : null;
                off += len;
                return seg;
              })
            : null}
        </svg>
        {centre !== undefined ? (
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            <div>
              <div className="text-[24px] leading-none font-semibold tabular-nums">{centre}</div>
              {centreSub ? <div className="mt-1 text-[11px] text-muted">{centreSub}</div> : null}
            </div>
          </div>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 rounded-[8px] bg-surface/80 p-3 sm:grid-cols-4">
        {parts.map((p) => (
          <div key={p.label} className="min-w-0">
            <span className="flex items-center gap-1.5 text-[11px] text-muted">
              <span className="size-2 flex-none rounded-full" style={{ background: `var(${p.hue})` }} />
              <span className="truncate">{p.label}</span>
            </span>
            <span className="block pl-3.5 text-[13px] font-semibold tabular-nums">{p.value}</span>
          </div>
        ))}
      </div>
      {node}
    </div>
  );
}
