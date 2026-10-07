"use client";

import { useEffect, useRef, useState } from "react";
import { Card, cx } from "@/components/ui";

/* ---------- palette ---------- */

/** Categorical colours, assigned in fixed order from theme tokens (light/dark automatic). */
export const SERIES = [
  "var(--accent)",
  "var(--ok)",
  "var(--warn)",
  "color-mix(in oklab, var(--ok) 40%, var(--ai))",
  "color-mix(in oklab, var(--accent) 45%, var(--bad))",
  "var(--ink-2)",
];
/** Reserved for "everything else" folded into one segment. */
export const OTHER = "var(--muted)";

export function seriesColor(i: number, total: number, hasOther = false): string {
  if (hasOther && i === total - 1) return OTHER;
  return SERIES[i % SERIES.length];
}

/* ---------- shared pieces ---------- */

export function ChartCard({ title, subtitle, right, className, children }: { title: string; subtitle?: React.ReactNode; right?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <Card className={cx("flex min-w-0 flex-col p-4 sm:p-5", className)}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold tracking-tight">{title}</h2>
          {subtitle ? <div className="mt-0.5 text-xs text-muted">{subtitle}</div> : null}
        </div>
        {right}
      </div>
      {children}
    </Card>
  );
}

export function NoData({ children = "No sales in this period yet." }: { children?: React.ReactNode }) {
  return <div className="grid min-h-32 flex-1 place-items-center rounded-xl bg-surface-2 px-4 py-8 text-center text-sm text-muted">{children}</div>;
}

/** Track an element's pixel width so SVG text stays readable at every size. */
function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/** Round the axis maximum so there are 3 even gridline steps. */
function niceMax(max: number): number {
  if (max <= 0) return 3;
  const raw = max / 3;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  return step * 3;
}

function roundedTop(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

export interface Point {
  key: string;
  label: string;
  value: number;
  /** Tooltip heading, defaults to label. */
  title?: string;
  /** Tooltip detail, e.g. "12 orders". */
  detail?: string;
}

/** Visually hidden data table so screen-reader users get every value. */
function DataTable({ caption, rows, format }: { caption: string; rows: Point[]; format: (n: number) => string }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key}>
            <th scope="row">{r.title ?? r.label}</th>
            <td>{format(r.value)}</td>
            {r.detail ? <td>{r.detail}</td> : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Tooltip({ x, y, width, title, value, detail }: { x: number; y: number; width: number; title: string; value: string; detail?: string }) {
  const w = 132;
  const left = Math.max(0, Math.min(width - w, x - w / 2));
  return (
    <div className="pointer-events-none absolute z-10 animate-fade rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-card" style={{ left, top: Math.max(0, y - 58), width: w }}>
      <div className="text-muted">{title}</div>
      <div className="text-sm font-bold tabular">{value}</div>
      {detail ? <div className="text-muted">{detail}</div> : null}
    </div>
  );
}

const M = { l: 44, r: 6, t: 8, b: 24 };

function YAxis({ ticks, max, height, width, fmt }: { ticks: number; max: number; height: number; width: number; fmt: (n: number) => string }) {
  const ih = height - M.t - M.b;
  return (
    <g aria-hidden>
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const v = (max / ticks) * i;
        const y = M.t + ih - (v / max) * ih;
        return (
          <g key={i}>
            <line x1={M.l} x2={width - M.r} y1={y} y2={y} stroke="var(--line)" strokeWidth={1} strokeDasharray={i === 0 ? undefined : "3 4"} />
            <text x={M.l - 8} y={y + 4} textAnchor="end" fontSize={11} fill="var(--muted)" className="tabular">
              {fmt(v)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/* ---------- column chart (sales by hour) ---------- */

export function ColumnChart({ data, format, fmtAxis, ariaLabel, height = 220, color = "var(--accent)" }: { data: Point[]; format: (n: number) => string; fmtAxis: (n: number) => string; ariaLabel: string; height?: number; color?: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const ih = height - M.t - M.b;
  const iw = Math.max(0, width - M.l - M.r);
  const step = data.length ? iw / data.length : 0;
  const barW = Math.max(3, Math.min(step * 0.62, 30));
  const every = step > 0 ? Math.ceil(34 / step) : 1;
  const peak = data.reduce((best, d, i) => (d.value > (data[best]?.value ?? 0) ? i : best), 0);

  return (
    <div ref={ref} className="relative" onPointerLeave={() => setActive(null)}>
      {width > 0 ? (
        <svg width={width} height={height} role="img" aria-label={ariaLabel} className="block touch-pan-y select-none">
          <YAxis ticks={3} max={max} height={height} width={width} fmt={fmtAxis} />
          {data.map((d, i) => {
            const h = (d.value / max) * ih;
            const x = M.l + step * i + (step - barW) / 2;
            const dim = active !== null && active !== i;
            return (
              <g key={d.key}>
                {d.value > 0 ? <path d={roundedTop(x, M.t + ih - h, barW, h, 4)} fill={color} opacity={dim ? 0.35 : 1} className="transition-opacity" /> : null}
                {i % every === 0 ? (
                  <text x={x + barW / 2} y={height - 6} textAnchor="middle" fontSize={11} fill="var(--muted)">
                    {d.label}
                  </text>
                ) : null}
                <rect x={M.l + step * i} y={M.t} width={step} height={ih + M.b} fill="transparent" onPointerEnter={() => setActive(i)} onPointerDown={() => setActive(i)}>
                  <title>{`${d.title ?? d.label}: ${format(d.value)}`}</title>
                </rect>
              </g>
            );
          })}
        </svg>
      ) : (
        <div style={{ height }} />
      )}
      {active !== null && data[active] ? <Tooltip x={M.l + step * active + step / 2} y={M.t + ih - (data[active].value / max) * ih} width={width} title={data[active].title ?? data[active].label} value={format(data[active].value)} detail={data[active].detail} /> : null}
      {data.length > 0 && data[peak].value > 0 ? <p className="mt-1 text-xs text-muted">Peak: {data[peak].title ?? data[peak].label} · {format(data[peak].value)}</p> : null}
      <DataTable caption={ariaLabel} rows={data} format={format} />
    </div>
  );
}

/* ---------- area chart (sales by day) ---------- */

export function AreaChart({ data, format, fmtAxis, ariaLabel, height = 220 }: { data: Point[]; format: (n: number) => string; fmtAxis: (n: number) => string; ariaLabel: string; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const gradId = useRef(`area-${Math.random().toString(36).slice(2, 8)}`).current;
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const ih = height - M.t - M.b;
  const iw = Math.max(0, width - M.l - M.r - 8);
  const n = data.length;
  const xAt = (i: number) => M.l + 4 + (n > 1 ? (iw / (n - 1)) * i : iw / 2);
  const yAt = (v: number) => M.t + ih - (v / max) * ih;
  const line = data.map((d, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yAt(d.value).toFixed(1)}`).join(" ");
  const area = n ? `${line} L${xAt(n - 1).toFixed(1)},${M.t + ih} L${xAt(0).toFixed(1)},${M.t + ih} Z` : "";
  const every = n > 1 && iw > 0 ? Math.ceil(44 / (iw / (n - 1))) : 1;
  const showDots = n <= 14;

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - box.left) / Math.max(1, box.width);
    setActive(Math.max(0, Math.min(n - 1, Math.round(rel * (n - 1)))));
  };

  return (
    <div ref={ref} className="relative" onPointerLeave={() => setActive(null)}>
      {width > 0 ? (
        <svg width={width} height={height} role="img" aria-label={ariaLabel} className="block touch-pan-y select-none">
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: "var(--accent)", stopOpacity: 0.28 }} />
              <stop offset="100%" style={{ stopColor: "var(--accent)", stopOpacity: 0.02 }} />
            </linearGradient>
          </defs>
          <YAxis ticks={3} max={max} height={height} width={width} fmt={fmtAxis} />
          {n > 0 ? (
            <>
              <path d={area} fill={`url(#${gradId})`} />
              <path d={line} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            </>
          ) : null}
          {data.map((d, i) => (
            <g key={d.key}>
              {(n - 1 - i) % every === 0 ? (
                <text x={xAt(i)} y={height - 6} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} fontSize={11} fill="var(--muted)">
                  {d.label}
                </text>
              ) : null}
              {showDots || i === active || i === n - 1 ? <circle cx={xAt(i)} cy={yAt(d.value)} r={active === i ? 5 : 4} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} /> : null}
            </g>
          ))}
          {active !== null && data[active] ? <line x1={xAt(active)} x2={xAt(active)} y1={M.t} y2={M.t + ih} stroke="var(--muted)" strokeWidth={1} strokeDasharray="3 3" /> : null}
          <rect x={M.l} y={M.t} width={Math.max(0, width - M.l - M.r)} height={ih + M.b} fill="transparent" onPointerMove={onMove} onPointerDown={onMove} />
        </svg>
      ) : (
        <div style={{ height }} />
      )}
      {active !== null && data[active] ? <Tooltip x={xAt(active)} y={yAt(data[active].value)} width={width} title={data[active].title ?? data[active].label} value={format(data[active].value)} detail={data[active].detail} /> : null}
      <DataTable caption={ariaLabel} rows={data} format={format} />
    </div>
  );
}

/* ---------- horizontal bars (top items, staff) ---------- */

export interface BarRow {
  key: string;
  label: React.ReactNode;
  value: number;
  valueLabel: string;
  sub?: string;
  color?: string;
}

export function HBars({ rows, color = "var(--accent)", ariaLabel }: { rows: BarRow[]; color?: string; ariaLabel: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ol className="space-y-3" aria-label={ariaLabel}>
      {rows.map((r, i) => (
        <li key={r.key}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="w-4 shrink-0 text-xs font-semibold text-muted tabular">{i + 1}</span>
              <span className="truncate font-medium">{r.label}</span>
            </span>
            <span className="shrink-0 font-bold tabular">{r.valueLabel}</span>
          </div>
          <div className="mt-1 flex items-center gap-2 pl-6">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: r.color ?? color }} />
            </div>
            {r.sub ? <span className="shrink-0 text-xs text-muted tabular">{r.sub}</span> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ---------- composition: stacked bar + donut ---------- */

export interface Segment {
  key: string;
  label: string;
  value: number;
  color: string;
  detail?: string;
}

function Legend({ segments, total, format }: { segments: Segment[]; total: number; format: (n: number) => string }) {
  return (
    <ul className="space-y-1.5">
      {segments.map((s) => (
        <li key={s.key} className="flex items-center gap-2 text-sm">
          <span className="size-3 shrink-0 rounded-[4px]" style={{ background: s.color }} aria-hidden />
          <span className="min-w-0 flex-1 truncate capitalize">
            {s.label}
            {s.detail ? <span className="ml-1 text-xs normal-case text-muted">{s.detail}</span> : null}
          </span>
          <span className="shrink-0 font-semibold tabular">{format(s.value)}</span>
          <span className="w-10 shrink-0 text-right text-xs text-muted tabular">{total ? Math.round((s.value / total) * 100) : 0}%</span>
        </li>
      ))}
    </ul>
  );
}

/** One horizontal bar split into segments, with a legend underneath. */
export function StackedBar({ segments, format, ariaLabel }: { segments: Segment[]; format: (n: number) => string; ariaLabel: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const total = segments.reduce((s, x) => s + x.value, 0);
  const live = segments.filter((s) => s.value > 0);
  const gap = 2;
  const usable = Math.max(0, width - gap * Math.max(0, live.length - 1));
  let x = 0;
  const summary = `${ariaLabel}: ${segments.map((s) => `${s.label} ${format(s.value)} (${total ? Math.round((s.value / total) * 100) : 0}%)`).join(", ")}`;
  return (
    <div>
      <div ref={ref}>
        {width > 0 ? (
          <svg width={width} height={16} role="img" aria-label={summary} className="block">
            {live.map((s) => {
              const w = (s.value / total) * usable;
              const el = (
                <rect key={s.key} x={x} y={0} width={Math.max(2, w)} height={16} rx={4} fill={s.color}>
                  <title>{`${s.label}: ${format(s.value)}`}</title>
                </rect>
              );
              x += w + gap;
              return el;
            })}
          </svg>
        ) : (
          <div className="h-4" />
        )}
      </div>
      <div className="mt-3">
        <Legend segments={segments} total={total} format={format} />
      </div>
    </div>
  );
}

export function Donut({ segments, format, ariaLabel, center }: { segments: Segment[]; format: (n: number) => string; ariaLabel: string; center: { label: string; value: string } }) {
  const [hover, setHover] = useState<string | null>(null);
  const total = segments.reduce((s, x) => s + x.value, 0);
  const size = 160;
  const r = 62;
  const sw = 22;
  const c = 2 * Math.PI * r;
  const live = segments.filter((s) => s.value > 0);
  const gap = live.length > 1 ? 3 : 0;
  let offset = 0;
  const summary = `${ariaLabel}: ${segments.map((s) => `${s.label} ${format(s.value)} (${total ? Math.round((s.value / total) * 100) : 0}%)`).join(", ")}`;
  const focus = segments.find((s) => s.key === hover);
  return (
    <div className="flex flex-col items-center gap-4" onPointerLeave={() => setHover(null)}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={summary} className="shrink-0">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={sw} />
        {live.map((s) => {
          const len = (s.value / total) * c;
          const dash = Math.max(1, len - gap);
          const el = (
            <circle
              key={s.key}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={hover === s.key ? sw + 4 : sw}
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              opacity={hover && hover !== s.key ? 0.4 : 1}
              className="transition-all"
              onPointerEnter={() => setHover(s.key)}
              onPointerDown={() => setHover(s.key)}
            >
              <title>{`${s.label}: ${format(s.value)}`}</title>
            </circle>
          );
          offset += len;
          return el;
        })}
        <text x="50%" y={size / 2 - 2} textAnchor="middle" fontSize={11} fill="var(--muted)">
          {focus ? focus.label : center.label}
        </text>
        <text x="50%" y={size / 2 + 18} textAnchor="middle" fontSize={17} fontWeight={700} fill="var(--ink)" className="tabular">
          {focus ? format(focus.value) : center.value}
        </text>
      </svg>
      <div className="w-full min-w-0 flex-1">
        <Legend segments={segments} total={total} format={format} />
      </div>
    </div>
  );
}
