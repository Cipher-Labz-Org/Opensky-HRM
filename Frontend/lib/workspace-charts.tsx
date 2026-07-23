/** Shared KPI / chart blocks used by Command Center and module dashboards. */

import { useId } from "react";

export function formatInt(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString();
}

export type CompareBarItem = { label: string; value: number; color: string; colorTo?: string };

export function HorizontalCompareBars({ items }: { items: CompareBarItem[] }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  if (items.every((i) => i.value === 0)) {
    return <div className="py-8 text-center text-sm text-slate-400">No data for this view.</div>;
  }
  return (
    <div className="space-y-2.5">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="truncate text-slate-600">{item.label}</span>
            <span className="shrink-0 font-semibold tabular-nums text-slate-800">{formatInt(item.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-gradient-to-r from-[var(--soft)] to-[var(--action-soft)] ring-1 ring-inset ring-[var(--border)]">
            <div
              className="h-2 rounded-full transition-all duration-300"
              style={{
                width: `${Math.max(6, Math.round((item.value / max) * 100))}%`,
                background:
                  item.colorTo != null ? `linear-gradient(90deg, ${item.color}, ${item.colorTo})` : item.color,
                boxShadow:
                  item.value > 0 ? "0 1px 8px rgba(15, 23, 42, 0.12), 0 0 12px rgba(46, 123, 191, 0.18)" : undefined,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function WeeklyActivityBars({
  data,
  barGradients,
}: {
  data: { label: string; count: number }[];
  /** When set, each day cycles through these vertical gradients (OpenSky-style dashboards). */
  barGradients?: readonly [string, string][];
}) {
  const max = Math.max(...data.map((d) => d.count), 1);
  const barMaxPx = 88;
  return (
    <div className="flex h-[118px] items-end justify-between gap-1 px-0.5 sm:gap-1.5">
      {data.map((d, i) => {
        const px = Math.round((d.count / max) * barMaxPx);
        const h = d.count > 0 ? Math.max(6, px) : 2;
        const pair = barGradients?.[i % barGradients.length];
        const useCustom = Boolean(pair && d.count > 0);
        return (
          <div key={d.label} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <div
              className={
                useCustom
                  ? "w-full max-w-[26px] rounded-t-md transition-all duration-200 group-hover:brightness-110 group-hover:shadow-[0_0_0_2px_rgba(46,123,191,0.35)]"
                  : d.count === 0
                    ? "w-full max-w-[26px] rounded-t-md bg-slate-300/60 transition-all"
                    : "w-full max-w-[26px] rounded-t-md bg-gradient-to-t from-[#2E7BBF] to-[#7eb8e8] transition-all hover:from-[#256aa3] hover:to-[#5ba3d4] hover:shadow-[0_0_0_2px_rgba(237,28,36,0.35)]"
              }
              style={
                useCustom
                  ? {
                      height: `${h}px`,
                      backgroundImage: `linear-gradient(to top, ${pair![0]}, ${pair![1]})`,
                      boxShadow: "0 6px 14px -6px rgba(46, 123, 191, 0.45)",
                    }
                  : { height: `${h}px` }
              }
              title={`${d.count} event${d.count === 1 ? "" : "s"}`}
            />
            <span className="w-full truncate text-center text-[9px] font-medium leading-tight text-slate-500 sm:text-[10px]">
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export type DonutSlice = { label: string; value: number; color: string; colorTo?: string };

export function DonutMixChart({ values }: { values: DonutSlice[] }) {
  const gradId = useId().replace(/:/g, "");
  const total = values.reduce((s, v) => s + v.value, 0);
  if (total <= 0) {
    return <div className="py-10 text-center text-sm text-slate-400">No distribution data.</div>;
  }
  let cumulative = 0;
  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 42 42" className="h-36 w-36 -rotate-90">
        <defs>
          {values.map((item, idx) =>
            item.colorTo ? (
              <linearGradient key={`${item.label}-def`} id={`${gradId}-d-${idx}`} x1="0" y1="1" x2="1" y2="0">
                <stop offset="0%" stopColor={item.color} />
                <stop offset="100%" stopColor={item.colorTo} />
              </linearGradient>
            ) : null
          )}
        </defs>
        <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#e5e7eb" strokeWidth="6" />
        {values.map((item, idx) => {
          const pct = (item.value / total) * 100;
          const dashArray = `${pct} ${100 - pct}`;
          const dashOffset = -cumulative;
          cumulative += pct;
          const stroke = item.colorTo ? `url(#${gradId}-d-${idx})` : item.color;
          return (
            <circle
              key={item.label}
              cx="21"
              cy="21"
              r="15.915"
              fill="transparent"
              stroke={stroke}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={dashArray}
              strokeDashoffset={dashOffset}
            />
          );
        })}
      </svg>
      <div className="space-y-1.5 text-sm">
        {values.map((v) => (
          <div key={v.label} className="flex items-center gap-2 text-slate-600">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/5"
              style={
                v.colorTo
                  ? { background: `linear-gradient(135deg, ${v.color}, ${v.colorTo})` }
                  : { backgroundColor: v.color }
              }
            />
            <span className="min-w-28">{v.label}</span>
            <strong className="text-slate-800">{formatInt(v.value)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
