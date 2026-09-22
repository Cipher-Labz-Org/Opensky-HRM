"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { ROUTES } from "@/config/routes";
import { formatDate as fmtDate } from "@/lib/date-utils";
import { formatInt } from "@/lib/workspace-charts";
import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { InlinePageAlert } from "@/components/ui";

type LicensingSummary = {
  planName: string;
  status: string;
  validFrom: string;
  validUntil: string | null;
  licensedModules: string[];
  maxEmployees?: number | null;
};

function formatDate(iso: string) {
  return fmtDate(iso);
}

export default function BillingPage() {
  const [summary, setSummary] = useState<LicensingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    const data = await apiFetch<LicensingSummary>("/api/licensing/summary");
    setSummary(data);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await loadSummary();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Load failed.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadSummary]);

  const billingKpis = useMemo(() => {
    if (loading && !summary) {
      return [
        { label: "Plan", value: "…" },
        { label: "Status", value: "—" },
        { label: "Licensed modules", value: "—" },
        { label: "Seat cap", value: "—" },
      ];
    }
    if (!summary) {
      return [
        { label: "Plan", value: "—" },
        { label: "Status", value: "—" },
        { label: "Licensed modules", value: "—" },
        { label: "Seat cap", value: "—" },
      ];
    }
    const seatCap = summary.maxEmployees ?? null;
    const cap = seatCap != null ? formatInt(seatCap) : "Not set";
    return [
      { label: "Plan", value: summary.planName || "—" },
      { label: "Status", value: summary.status },
      { label: "Licensed modules", value: formatInt(summary.licensedModules.length) },
      { label: "Seat cap", value: cap },
    ];
  }, [summary, loading]);

  return (
    <>
      <AppTopbar title="Billing" subtitle="Plan, licensed modules, and subscription (per instance)." />

      <div className="mt-6 space-y-6">
        <InlinePageAlert
          message={error}
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200 scroll-mt-20"
        />

        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {billingKpis.map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="text-xs font-medium uppercase tracking-wider text-slate-500">{kpi.label}</div>
              <div className="mt-2 break-words text-xl font-semibold leading-tight text-slate-900">{kpi.value}</div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-900">Quick links</h3>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href={ROUTES.dashboard}
              className="group rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-800">Command Center</div>
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
                  <div className="truncate text-sm font-semibold text-slate-800">Policy &amp; settings</div>
                </div>
                <span className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700">
                  →
                </span>
              </div>
            </Link>
            <Link
              href={ROUTES.reports}
              className="group rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-800">Reports</div>
                </div>
                <span className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700">
                  →
                </span>
              </div>
            </Link>
            <Link
              href={ROUTES.analytics}
              className="group rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-800">Analytics</div>
                </div>
                <span className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700">
                  →
                </span>
              </div>
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Your plan</h3>
          {loading && <p className="mt-2 text-sm text-slate-500">Loading…</p>}
          {!loading && summary && (
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Plan</dt>
                <dd className="font-medium text-slate-900">{summary.planName || "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Status</dt>
                <dd className="font-medium text-slate-900">{summary.status}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Valid from</dt>
                <dd className="text-slate-800">{formatDate(summary.validFrom)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Valid until</dt>
                <dd className="text-slate-800">{summary.validUntil ? formatDate(summary.validUntil) : "—"}</dd>
              </div>
            </dl>
          )}
          {!loading && summary && (
            <div className="mt-6">
              <h4 className="text-sm font-semibold text-slate-900">Licensed modules</h4>
              <ul className="mt-2 flex flex-wrap gap-2">
                {summary.licensedModules.map((m) => (
                  <li
                    key={m}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-800"
                  >
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
