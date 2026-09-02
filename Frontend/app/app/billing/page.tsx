"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { ROUTES } from "@/config/routes";
import { formatDate as fmtDate } from "@/lib/date-utils";
import { formatInt } from "@/lib/workspace-charts";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import Link from "next/link";
import { DatePickerField, InlinePageAlert } from "@/components/ui";

type LicensingSummary = {
  planName: string;
  status: string;
  validFrom: string;
  validUntil: string | null;
  licensedModules: string[];
  maxEmployees?: number | null;
};

type AdminModule = {
  id: string;
  code: string;
  displayName: string;
  category: string;
  sortOrder: number;
  isRequired: boolean;
  isActive: boolean;
  isEnabled: boolean;
};

type AdminState = {
  subscription: {
    id: string;
    instanceKey: string;
    status: string;
    planName: string;
    validFrom: string;
    validUntil: string | null;
    notes: string | null;
    maxEmployees: number | null;
  };
  modules: AdminModule[];
};

function formatDate(iso: string) {
  return fmtDate(iso);
}

export default function BillingPage() {
  const { isAdmin, refreshProfile } = useAuth();
  const [summary, setSummary] = useState<LicensingSummary | null>(null);
  const [admin, setAdmin] = useState<AdminState | null>(null);
  const [optionalEnabled, setOptionalEnabled] = useState<Set<string>>(new Set());
  const [planName, setPlanName] = useState("");
  const [status, setStatus] = useState("Active");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    const data = await apiFetch<LicensingSummary>("/api/licensing/summary");
    setSummary(data);
  }, []);

  const loadAdmin = useCallback(async () => {
    const data = await apiFetch<AdminState>("/api/licensing/admin");
    setAdmin(data);
    const opt = new Set(
      data.modules.filter((m) => !m.isRequired && m.isEnabled).map((m) => m.code)
    );
    setOptionalEnabled(opt);
    setPlanName(data.subscription.planName);
    setStatus(data.subscription.status);
    setValidUntil(data.subscription.validUntil ? data.subscription.validUntil.slice(0, 10) : "");
    setNotes(data.subscription.notes ?? "");
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await loadSummary();
        if (!isAdmin) {
          if (!cancelled) setAdmin(null);
          return;
        }
        try {
          await loadAdmin();
        } catch (adminErr) {
          if (!cancelled) {
            setAdmin(null);
            setError(adminErr instanceof Error ? adminErr.message : "Could not load admin licensing data.");
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Load failed.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, loadSummary, loadAdmin]);

  const toggleOptional = (code: string, checked: boolean) => {
    setOptionalEnabled((prev) => {
      const next = new Set(prev);
      if (checked) next.add(code);
      else next.delete(code);
      return next;
    });
  };

  const saveModules = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await apiFetch("/api/licensing/entitlements", {
        method: "PUT",
        body: JSON.stringify({
          enabledOptionalModuleCodes: Array.from(optionalEnabled),
        }),
      });
      setSuccess("Module entitlements updated.");
      await loadSummary();
      await loadAdmin();
      await refreshProfile();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const saveSubscription = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await apiFetch("/api/licensing/subscription", {
        method: "PUT",
        body: JSON.stringify({
          planName: planName || undefined,
          status: status || undefined,
          validUntil: validUntil ? new Date(validUntil).toISOString() : null,
          notes: notes || null,
        }),
      });
      setSuccess("Subscription details updated.");
      await loadSummary();
      await loadAdmin();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const billingKpis = useMemo(() => {
    if (loading && !summary) {
      return [
        { label: "Plan", value: "…", sub: "Loading licensing summary" },
        { label: "Status", value: "—", sub: "—" },
        { label: "Licensed modules", value: "—", sub: "—" },
        { label: "Seat cap", value: "—", sub: admin?.subscription.maxEmployees != null ? "From subscription" : "—" },
      ];
    }
    if (!summary) {
      return [
        { label: "Plan", value: "—", sub: "Summary unavailable" },
        { label: "Status", value: "—", sub: "—" },
        { label: "Licensed modules", value: "—", sub: "—" },
        { label: "Seat cap", value: "—", sub: "—" },
      ];
    }
    const seatCap = summary.maxEmployees ?? admin?.subscription.maxEmployees ?? null;
    const cap = seatCap != null ? formatInt(seatCap) : "Not set";
    return [
      {
        label: "Plan",
        value: summary.planName || "—",
        sub: "Current subscription tier",
      },
      {
        label: "Status",
        value: summary.status,
        sub: "Licensing state",
      },
      {
        label: "Licensed modules",
        value: formatInt(summary.licensedModules.length),
        sub: "Entitled product areas",
      },
      {
        label: "Seat cap",
        value: cap,
        sub: admin ? "Max employees (admin view)" : "Contact admin for limits",
      },
    ];
  }, [summary, loading, admin]);

  return (
    <>
      <AppTopbar title="Billing" subtitle="Plan, licensed modules, and subscription (per instance)." />

      <div className="mt-6 space-y-6">
        <InlinePageAlert
          message={error}
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200 scroll-mt-20"
        />
        <InlinePageAlert
          message={success}
          variant="success"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 scroll-mt-20"
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

        {isAdmin && admin && (
          <>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Subscription details</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="text-slate-500">Plan name</span>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-slate-500">Status</span>
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="Trial">Trial</option>
                    <option value="Active">Active</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="text-slate-500">Valid until (optional)</span>
                  <div className="mt-1 max-w-xs">
                    <DatePickerField
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      value={validUntil}
                      onChange={setValidUntil}
                    />
                  </div>
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="text-slate-500">Notes</span>
                  <textarea
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </label>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveSubscription()}
                className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
              >
                Save subscription
              </button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Module entitlements</h3>
              <ul className="mt-4 max-h-[420px] space-y-2 overflow-y-auto pr-1">
                {admin.modules.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2"
                  >
                    <div>
                      <div className="text-sm font-medium text-slate-900">{m.displayName}</div>
                      <div className="text-xs text-slate-500">
                        {m.code}
                        {m.isRequired ? " · required" : ""} · {m.category}
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-blue-600"
                      disabled={m.isRequired || saving}
                      checked={m.isRequired || optionalEnabled.has(m.code)}
                      onChange={(e) => toggleOptional(m.code, e.target.checked)}
                    />
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveModules()}
                className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
              >
                Save modules
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
