"use client";

/**
 * Small, dependency-free charts following the dataviz method: validated categorical palette (--s1…--s7),
 * one hue per single-series chart, bars ≤24px with 4px rounded data ends, values at bar tips, hover + keyboard
 * tooltips on every mark, a table view for every chart, text in text tokens (never series colours).
 */
import { useState, type ReactNode } from "react";

type Tip = { text: string; x: number; y: number } | null;

function useTip() {
  const [tip, setTip] = useState<Tip>(null);
  const bind = (text: string) => ({
    tabIndex: 0,
    onMouseMove: (e: React.MouseEvent) => setTip({ text, x: e.clientX, y: e.clientY }),
    onMouseLeave: () => setTip(null),
    onFocus: (e: React.FocusEvent) => {
      const r = (e.currentTarget as Element).getBoundingClientRect();
      setTip({ text, x: r.left + Math.min(r.width, 160), y: r.top + r.height / 2 });
    },
    onBlur: () => setTip(null),
    "aria-label": text,
  });
  const node = tip ? (
    <div role="tooltip" className="pointer-events-none fixed z-50 max-w-64 rounded-[6px] bg-ink px-2.5 py-1.5 text-xs text-ink-text shadow-[var(--shadow-lg)]" style={{ left: tip.x + 14, top: tip.y + 14 }}>
      {tip.text}
    </div>
  ) : null;
  return { bind, node, setTip };
}

export function ChartCard({ title, sub, tools, table, children, className = "" }: { title: string; sub?: ReactNode; tools?: ReactNode; table: ReactNode; children: ReactNode; className?: string }) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section className={`flex min-w-0 flex-col rounded-[var(--radius)] border border-line bg-bg shadow-[var(--shadow)] ${className}`} aria-label={title}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4.5 pb-1">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold">{title}</h3>
          {sub ? <p className="mt-0.5 text-[13px] text-muted">{sub}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {tools}
          <button
            type="button"
            aria-pressed={showTable}
            onClick={() => setShowTable(!showTable)}
            className="rounded-[6px] px-2 py-1.5 text-[13px] font-medium text-muted hover:bg-surface hover:text-text"
          >
            {showTable ? "Show chart" : "Show table"}
          </button>
        </div>
      </div>
      <div className="grid flex-1 content-start gap-4 px-5 pt-3 pb-5">{showTable ? <div className="overflow-x-auto">{table}</div> : children}</div>
    </section>
  );
}

export function Insight({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2.5 border-t border-line pt-3.5 text-[13.5px] leading-relaxed text-muted">
      <svg viewBox="0 0 24 24" className="mt-0.5 size-4 flex-none text-brand" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3z" />
      </svg>
      <span>{children}</span>
    </p>
  );
}

/** Horizontal bars, single series, value at the tip (no axis needed when every bar is labelled). */
export function HBars({ items, hue, format = String, max }: { items: { label: string; value: number; tip: string }[]; hue: string; format?: (v: number) => string; max?: number }) {
  const { bind, node } = useTip();
  const top = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="grid gap-1.5">
      {items.map((i) => (
        <div key={i.label} className="grid grid-cols-[minmax(80px,140px)_minmax(0,1fr)] items-center gap-2.5 rounded-md text-sm" {...bind(i.tip)}>
          <span className="truncate text-muted">{i.label}</span>
          <span className="flex h-6 min-w-0 items-center gap-2 border-l border-[var(--axis)]">
            <span className="h-[16px] flex-none rounded-r-[4px]" style={{ width: `${Math.max((i.value / top) * 84, 0.5)}%`, background: `var(${hue})` }} />
            <span className="font-semibold tabular-nums whitespace-nowrap">{format(i.value)}</span>
          </span>
        </div>
      ))}
      {node}
    </div>
  );
}

/** Vertical columns, single series, value on the cap. */
export function Columns({ items, hue }: { items: { label: string; value: number; tip: string }[]; hue: string }) {
  const { bind, node } = useTip();
  const top = Math.max(1, ...items.map((i) => i.value)) * 1.15;
  return (
    <div>
      <div className="flex h-44 items-end gap-4 border-b border-[var(--axis)] px-2">
        {items.map((i) => (
          <div key={i.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1 rounded-md" {...bind(i.tip)}>
            <span className="text-sm font-semibold tabular-nums">{i.value}</span>
            <span className="w-7 rounded-t-[4px]" style={{ height: `${(i.value / top) * 100}%`, background: `var(${hue})` }} />
          </div>
        ))}
      </div>
      <div className="flex gap-4 px-2 pt-1 text-xs text-muted">
        {items.map((i) => (
          <span key={i.label} className="flex-1 text-center">
            {i.label}
          </span>
        ))}
      </div>
      {node}
    </div>
  );
}

/** Line + area wash with a crosshair tooltip; end value labelled. */
export function LineChart({ points, hue, label }: { points: { x: string; y: number }[]; hue: string; label: string }) {
  const { node, setTip } = useTip();
  const [hover, setHover] = useState<number | null>(null);
  const W = 560, H = 210, pl = 30, pr = 34, pt = 16, pb = 28;
  const max = Math.max(5, ...points.map((p) => p.y));
  const nice = Math.ceil(max / 5) * 5;
  const n = Math.max(points.length - 1, 1);
  const x = (i: number) => pl + (i * (W - pl - pr)) / n;
  const y = (v: number) => pt + (1 - v / nice) * (H - pt - pb);
  const pts = points.map((p, i) => `${x(i).toFixed(1)},${y(p.y).toFixed(1)}`);
  const last = points.length - 1;
  if (!points.length) return <p className="text-sm text-muted">No data yet.</p>;
  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={label}
        className="block h-auto w-full touch-pan-y"
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const i = Math.max(0, Math.min(last, Math.round((((e.clientX - r.left) / r.width) * W - pl) / ((W - pl - pr) / n))));
          setHover(i);
          setTip({ text: `Week of ${points[i].x}: ${points[i].y} applications`, x: e.clientX, y: e.clientY });
        }}
        onMouseLeave={() => { setHover(null); setTip(null); }}
      >
        {[0, nice / 2, nice].map((v) => (
          <g key={v}>
            <line x1={pl} x2={W - pr} y1={y(v)} y2={y(v)} stroke={`var(${v === 0 ? "--axis" : "--grid"})`} strokeWidth="1" />
            <text x={pl - 6} y={y(v) + 4} textAnchor="end" className="fill-[var(--muted)] text-[11px]">
              {v}
            </text>
          </g>
        ))}
        <path d={`M${pts.join(" L")} L${x(last)},${y(0)} L${x(0)},${y(0)} Z`} fill={`var(${hue})`} fillOpacity="0.12" />
        <polyline points={pts.join(" ")} fill="none" stroke={`var(${hue})`} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {hover !== null ? <line x1={x(hover)} x2={x(hover)} y1={pt} y2={y(0)} stroke="var(--axis)" strokeWidth="1" /> : null}
        {hover !== null ? <circle cx={x(hover)} cy={y(points[hover].y)} r="4.5" fill={`var(${hue})`} stroke="var(--bg)" strokeWidth="2" /> : null}
        <circle cx={x(last)} cy={y(points[last].y)} r="4.5" fill={`var(${hue})`} stroke="var(--bg)" strokeWidth="2" />
        <text x={x(last) + 8} y={y(points[last].y) + 4} className="fill-[var(--text)] text-[12px] font-semibold">
          {points[last].y}
        </text>
        {points.map((p, i) =>
          points.length <= 10 || i % Math.ceil(points.length / 8) === 0 ? (
            <text key={p.x} x={x(i)} y={H - 8} textAnchor="middle" className="fill-[var(--muted)] text-[11px]">
              {new Date(p.x).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </text>
          ) : null,
        )}
      </svg>
      {node}
    </div>
  );
}

/** Donut with a 2px surface gap between segments; legend always present (≥2 series). */
export function Donut({ parts, centre, centreLabel }: { parts: { label: string; value: number; hue: string }[]; centre: number; centreLabel: string }) {
  const { bind, node } = useTip();
  const total = parts.reduce((s, p) => s + p.value, 0);
  const r = 52, C = 2 * Math.PI * r, gap = total ? 3 : 0;
  let off = 0;
  return (
    <div className="flex flex-wrap items-center gap-4">
      <svg viewBox="0 0 140 140" width="112" height="112" className="flex-none" role="img" aria-label={parts.map((p) => `${p.label} ${p.value}`).join(", ")}>
        <circle r={r} cx="70" cy="70" fill="none" stroke="var(--surface-2)" strokeWidth="16" />
        {total
          ? parts.map((p) => {
              const len = (p.value / total) * C;
              const el = p.value ? (
                <circle
                  key={p.label}
                  r={r}
                  cx="70"
                  cy="70"
                  fill="none"
                  stroke={`var(${p.hue})`}
                  strokeWidth="16"
                  strokeDasharray={`${Math.max(len - gap, 0)} ${C - Math.max(len - gap, 0)}`}
                  strokeDashoffset={-off}
                  transform="rotate(-90 70 70)"
                  {...bind(`${p.label}: ${p.value} of ${total} (${Math.round((p.value / total) * 100)}%)`)}
                />
              ) : null;
              off += len;
              return el;
            })
          : null}
        <text x="70" y="70" textAnchor="middle" className="fill-[var(--text)] text-[28px] font-bold">
          {centre}
        </text>
        <text x="70" y="88" textAnchor="middle" className="fill-[var(--muted)] text-[10.5px]">
          {centreLabel}
        </text>
      </svg>
      <div className="grid min-w-32 flex-1 gap-2 text-[13px]">
        {parts.map((p) => (
          <div key={p.label} className="grid grid-cols-[10px_minmax(0,1fr)_auto] items-center gap-2">
            <span className="size-2.5 rounded-sm" style={{ background: `var(${p.hue})` }} />
            <span>{p.label}</span>
            <b className="tabular-nums">
              {p.value}
              {total ? ` · ${Math.round((p.value / total) * 100)}%` : ""}
            </b>
          </div>
        ))}
      </div>
      {node}
    </div>
  );
}

export function DataTable({ head, rows }: { head: string[]; rows: (string | number | null)[][] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left [&>th]:border-b [&>th]:border-line [&>th]:bg-surface/60 [&>th]:text-[12.5px] [&>th]:font-semibold [&>th]:whitespace-nowrap [&>th]:text-muted">
          {head.map((h) => (
            <th key={h} className="px-2 py-2 font-semibold">
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
