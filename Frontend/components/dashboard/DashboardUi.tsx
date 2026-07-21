import type { ReactNode } from "react";
import { OPENSKY_THEME, softCardShadow } from "@/lib/opensky-theme";

const T = OPENSKY_THEME;

const KPI_TONES = [
  { bg: T.accentSoft, value: T.accent },
  { bg: T.actionSoft, value: T.action },
  { bg: T.primaryLight, value: T.navyMid },
  { bg: T.soft, value: T.navy },
] as const;

export function DashboardPageHeader({
  eyebrow = "Command center",
  title,
  subtitle,
  badge,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: T.accent }} aria-hidden />
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: T.muted }}>
            {eyebrow}
          </span>
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: T.navy }}>
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 max-w-2xl text-sm" style={{ color: T.muted }}>
            {subtitle}
          </p>
        ) : null}
        <div
          className="mt-3 h-1 w-14 rounded-full"
          style={{ background: `linear-gradient(90deg, ${T.accent}, ${T.action})` }}
          aria-hidden
        />
      </div>
      {badge}
    </div>
  );
}

export function DashboardKpiGrid({
  items,
  loading,
}: {
  items: Array<{ label: string; value: string; sub: string }>;
  loading?: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((kpi, index) => {
        const tone = KPI_TONES[index % KPI_TONES.length];
        return (
          <div
            key={kpi.label}
            className="rounded-[20px] border px-4 py-4 transition hover:-translate-y-0.5"
            style={{ borderColor: T.border, backgroundColor: tone.bg, boxShadow: softCardShadow }}
          >
            <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: T.muted }}>
              {kpi.label}
            </div>
            <div className="mt-2 text-3xl font-bold leading-none" style={{ color: tone.value }}>
              {loading && kpi.value === "—" ? "..." : kpi.value}
            </div>
            <p className="mt-2 text-[11px] leading-snug" style={{ color: T.muted }}>
              {kpi.sub}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function DashboardCardHeader({
  title,
  subtitle,
  icon,
  iconColor = T.action,
  iconBg = T.actionSoft,
  trailing,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  iconColor?: string;
  iconBg?: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="opensky-dashboard-card-header">
      <div className="flex min-w-0 items-center gap-3">
        {icon ? (
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: iconBg, color: iconColor }}
          >
            {icon}
          </div>
        ) : null}
        <div className="min-w-0">
          <h3 className="text-sm font-bold" style={{ color: T.navy }}>
            {title}
          </h3>
          {subtitle ? (
            <p className="text-xs" style={{ color: T.muted }}>
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      {trailing}
    </div>
  );
}

export function DashboardBrandBadge() {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium"
      style={{ borderColor: T.border, backgroundColor: T.actionSoft, color: T.navy, boxShadow: softCardShadow }}
    >
      <span style={{ color: T.accent }} aria-hidden>
        ★
      </span>
      OpenSky HRM
    </span>
  );
}
