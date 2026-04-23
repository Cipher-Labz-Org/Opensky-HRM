"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import {
  EmailDeliveryLogContent,
  type EmailDeliveryLogUiSnapshot,
} from "@/components/compliance/EmailDeliveryLogContent";
import { ROUTES } from "@/config/routes";
import { DonutMixChart, formatInt, HorizontalCompareBars } from "@/lib/workspace-charts";

const STATUS_LABEL: Record<string, string> = {
  Sent: "Sent",
  Failed: "Failed",
  SkippedNotConfigured: "Skipped (no provider)",
};

export default function EmailDeliveryLogPage() {
  const [snap, setSnap] = useState<EmailDeliveryLogUiSnapshot>({
    data: null,
    statusFilter: "",
    loading: true,
    error: "",
  });

  const onSnapshotChange = useCallback((s: EmailDeliveryLogUiSnapshot) => {
    setSnap(s);
  }, []);

  const { data, statusFilter, loading, error } = snap;
  const items = data?.items ?? [];

  const pageSent = useMemo(() => items.filter((r) => r.status === "Sent").length, [items]);
  const pageFailed = useMemo(() => items.filter((r) => r.status === "Failed").length, [items]);
  const pageSkipped = useMemo(
    () => items.filter((r) => r.status === "SkippedNotConfigured").length,
    [items]
  );

  const deliveryKpis = useMemo(() => {
    const filterLabel = statusFilter
      ? STATUS_LABEL[statusFilter] ?? statusFilter
      : "All statuses";
    if (loading && !data) {
      return [
        { label: "Matching rows", value: "…", sub: "Loading delivery log" },
        { label: "This page", value: "—", sub: "—" },
        { label: "Sent (page)", value: "—", sub: "—" },
        { label: "Failed (page)", value: "—", sub: "—" },
      ];
    }
    if (!data) {
      return [
        { label: "Matching rows", value: error ? "—" : "0", sub: error || "No data" },
        { label: "This page", value: "—", sub: "—" },
        { label: "Sent (page)", value: "—", sub: "—" },
        { label: "Failed (page)", value: "—", sub: "—" },
      ];
    }
    const pageLabel = `Page ${data.page} · ${formatInt(data.pageSize)} / page`;
    return [
      {
        label: "Matching rows",
        value: formatInt(data.totalCount),
        sub: `Filter: ${filterLabel}`,
      },
      {
        label: "Rows on this page",
        value: formatInt(items.length),
        sub: pageLabel,
      },
      {
        label: "Sent (this page)",
        value: formatInt(pageSent),
        sub: "Successful provider handoff",
      },
      {
        label: "Failed (this page)",
        value: formatInt(pageFailed),
        sub: `${formatInt(pageSkipped)} skipped on page`,
      },
    ];
  }, [data, loading, error, statusFilter, items.length, pageSent, pageFailed, pageSkipped]);

  const statusDonut = useMemo(() => {
    const palette: Record<string, string> = {
      Sent: "#22c55e",
      Failed: "#ef4444",
      SkippedNotConfigured: "#f59e0b",
    };
    const tally = new Map<string, number>();
    for (const r of items) {
      tally.set(r.status, (tally.get(r.status) ?? 0) + 1);
    }
    return Array.from(tally.entries())
      .filter(([, v]) => v > 0)
      .map(([status, value]) => ({
        label: STATUS_LABEL[status] ?? status,
        value,
        color: palette[status] ?? "#64748b",
      }));
  }, [items]);

  const categoryBars = useMemo(() => {
    const colors = ["#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#64748b", "#eab308"];
    const tally = new Map<string, number>();
    for (const r of items) {
      const key = r.category || "Other";
      tally.set(key, (tally.get(key) ?? 0) + 1);
    }
    return Array.from(tally.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, value], i) => ({
        label: label.length > 22 ? `${label.slice(0, 20)}…` : label,
        value,
        color: colors[i % colors.length],
      }));
  }, [items]);

  return (
    <>
      <AppTopbar
        title="Email delivery log"
        subtitle="Outbound transactional email attempts: recipient, subject, delivery status, provider, and errors."
      />

      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 px-7 py-8 text-slate-900 shadow-sm">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-sky-100/50 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 h-72 w-72 rounded-full bg-indigo-100/40 blur-3xl" />
        <div className="relative z-10">
          <p className="mb-2 inline-flex rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
            Compliance workspace
          </p>
          <h2 className="text-2xl font-semibold leading-tight text-slate-900 lg:text-3xl">Outbound delivery intelligence</h2>
          <p className="mt-3 max-w-2xl text-sm text-slate-600">
            Audit transactional sends, filter by outcome, and drill into provider responses. Charts summarize the{" "}
            <strong className="font-medium text-slate-800">currently loaded page</strong>; totals reflect your active
            filter across the whole log.
          </p>
        </div>
      </section>

      <div className="mt-6 space-y-6">
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {deliveryKpis.map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="text-xs font-medium uppercase tracking-wider text-slate-500">{kpi.label}</div>
              <div className="mt-2 text-2xl font-semibold leading-tight text-slate-900">{kpi.value}</div>
              <div className="mt-2 text-xs text-slate-600">{kpi.sub}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-800">By category (this page)</h3>
              <span className="text-xs text-slate-500">Top 8</span>
            </div>
            {categoryBars.length > 0 ? (
              <HorizontalCompareBars items={categoryBars} />
            ) : (
              <p className="py-10 text-center text-sm text-slate-500">
                {loading ? "Loading…" : "No rows on this page to chart."}
              </p>
            )}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-800">Status mix (this page)</h3>
              <span className="text-xs text-slate-500">Sent / failed / skipped</span>
            </div>
            {statusDonut.length > 0 ? (
              <DonutMixChart values={statusDonut} />
            ) : (
              <p className="py-10 text-center text-sm text-slate-500">
                {loading ? "Loading…" : "No status breakdown for this page."}
              </p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-900">Quick links</h3>
            <p className="text-xs text-slate-500">Templates, policy, and related modules</p>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href={ROUTES.emailTemplates}
              className="group rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-800">Email &amp; letter templates</div>
                  <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">Edit emails and employee letters</div>
                </div>
                <span className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700">
                  →
                </span>
              </div>
            </Link>
            <Link
              href={ROUTES.settings}
              className="group rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-800">Policy &amp; Settings</div>
                  <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">Branding &amp; system keys</div>
                </div>
                <span className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700">
                  →
                </span>
              </div>
            </Link>
            <Link
              href={ROUTES.dashboard}
              className="group rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-800">Command Center</div>
                  <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">Home dashboard</div>
                </div>
                <span className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700">
                  →
                </span>
              </div>
            </Link>
            <Link
              href={ROUTES.recruitment}
              className="group rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-800">Recruitment</div>
                  <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">Offer &amp; candidate mail</div>
                </div>
                <span className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700">
                  →
                </span>
              </div>
            </Link>
          </div>
        </div>

        <EmailDeliveryLogContent onSnapshotChange={onSnapshotChange} />

        <p className="footer-note">
          Bar and donut charts count only the rows on the current result page. The first KPI uses{" "}
          <code className="rounded bg-slate-100 px-1 text-[11px] text-slate-700">totalCount</code> from the API for the
          active status filter. Paginate to sample other windows.
        </p>
      </div>
    </>
  );
}
