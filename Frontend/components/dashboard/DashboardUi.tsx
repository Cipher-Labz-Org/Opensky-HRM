import type { ReactNode } from "react";

export function DashboardPageHeader({
  eyebrow = "Command center",
  title,
  badge,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <div className="osky-phead">
      <div>
        <span className="osky-eyebrow">
          <i aria-hidden />
          {eyebrow}
        </span>
        <h1>{title}</h1>
      </div>
      {badge}
    </div>
  );
}

export function DashboardKpiGrid({
  items,
  loading,
}: {
  items: Array<{ label: string; value: string; sub: string; loading?: boolean }>;
  loading?: boolean;
}) {
  return (
    <div className="osky-strip">
      {items.map((kpi) => (
        <section key={kpi.label} className="osky-stat">
          <span className="osky-sl">{kpi.label}</span>
          <span className="osky-sv">{(kpi.loading ?? loading) && kpi.value === "—" ? "..." : kpi.value}</span>
          <span className="osky-ssub">{kpi.sub}</span>
        </section>
      ))}
    </div>
  );
}

export function DashboardCardHeader({
  title,
  subtitle,
  icon,
  trailing,
  compact = false,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  iconColor?: string;
  iconBg?: string;
  trailing?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`mb-4 flex items-start gap-3 ${compact ? "mb-2" : ""}`}>
      {icon ? (
        <div
          className={`grid shrink-0 place-items-center rounded-xl text-white ${compact ? "h-8 w-8" : "h-9 w-9"}`}
          style={{ background: "var(--ramp-3, #1468b4)" }}
        >
          {icon}
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <h3 className={`font-bold leading-snug ${compact ? "text-[13px]" : "text-[15.5px]"}`} style={{ color: "var(--ink, #07182f)" }}>
          {title}
        </h3>
        {subtitle ? (
          <p className={`mt-0.5 leading-snug break-words ${compact ? "text-[11px]" : "text-xs"}`} style={{ color: "var(--ink-3, #7c92b2)" }}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
}

export function DashboardBrandBadge() {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
      style={{
        borderColor: "var(--glass-line, rgba(255,255,255,0.85))",
        background: "var(--glass, rgba(255,255,255,0.84))",
        color: "var(--ink, #07182f)",
        boxShadow: "var(--glass-shadow)",
      }}
    >
      <span style={{ color: "var(--lime, #7bbf3c)" }} aria-hidden>
        ★
      </span>
      OpenSky HRM
    </span>
  );
}
