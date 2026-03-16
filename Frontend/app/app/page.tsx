import { AppTopbar } from "@/components/navigation/AppTopbar";

/** /app shows dashboard content */
export default function AppIndexPage() {
  return (
    <>
      <AppTopbar
        title="Dashboard"
        subtitle="Unified command center for HR and managers."
      />
      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Active Users", value: "—", sub: "Placeholder" },
          { label: "Pending Items", value: "—", sub: "Placeholder" },
          { label: "Alerts", value: "—", sub: "Placeholder" },
          { label: "Health", value: "—", sub: "Placeholder" },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-[22px] border border-[var(--border)] bg-[var(--panel)] p-5 shadow-[var(--shadow)]"
          >
            <div className="text-sm text-[var(--muted)]">{kpi.label}</div>
            <div className="mt-2 text-3xl font-extrabold text-[var(--text)]">
              {kpi.value}
            </div>
            <div className="mt-1 text-xs text-[var(--success)]">{kpi.sub}</div>
          </div>
        ))}
      </div>
    </>
  );
}
