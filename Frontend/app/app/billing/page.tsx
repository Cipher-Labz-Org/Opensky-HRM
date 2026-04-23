"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { API_BASE_URL } from "@/config/constants";
import { ROUTES } from "@/config/routes";
import { formatDate as fmtDate } from "@/lib/date-utils";
import { DonutMixChart, formatInt, HorizontalCompareBars } from "@/lib/workspace-charts";
import { useAuth } from "@/contexts/auth-context";
import Link from "next/link";
import { DatePickerField } from "@/components/ui";

type LicensingSummary = {
  planName: string;
  status: string;
  validFrom: string;
  validUntil: string | null;
  licensedModules: string[];
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
  const { token, isAdmin, refreshProfile } = useAuth();
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

  const authHeaders = useCallback(() => {
    const t = token ?? (typeof window !== "undefined" ? localStorage.getItem("auth_token") : null);
    return {
      Authorization: `Bearer ${t}`,
      "Content-Type": "application/json",
    } as Record<string, string>;
  }, [token]);

  const loadSummary = useCallback(async () => {
    const res = await fetch(`${API_BASE_URL}/api/licensing/summary`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Could not load licensing summary.");
    const data: LicensingSummary = await res.json();
    setSummary(data);
  }, [authHeaders]);

  const loadAdmin = useCallback(async () => {
    const res = await fetch(`${API_BASE_URL}/api/licensing/admin`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Could not load admin licensing data.");
    const data: AdminState = await res.json();
    setAdmin(data);
    const opt = new Set(
      data.modules.filter((m) => !m.isRequired && m.isEnabled).map((m) => m.code)
    );
    setOptionalEnabled(opt);
    setPlanName(data.subscription.planName);
    setStatus(data.subscription.status);
    setValidUntil(data.subscription.validUntil ? data.subscription.validUntil.slice(0, 10) : "");
    setNotes(data.subscription.notes ?? "");
  }, [authHeaders]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await loadSummary();
        if (isAdmin) await loadAdmin();
        else setAdmin(null);
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
      const res = await fetch(`${API_BASE_URL}/api/licensing/entitlements`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({
          enabledOptionalModuleCodes: Array.from(optionalEnabled),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Save failed.");
      }
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
      const res = await fetch(`${API_BASE_URL}/api/licensing/subscription`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({
          planName: planName || undefined,
          status: status || undefined,
          validUntil: validUntil ? new Date(validUntil).toISOString() : null,
          notes: notes || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Save failed.");
      }
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
    const cap =
      admin?.subscription.maxEmployees != null ? formatInt(admin.subscription.maxEmployees) : "Not set";
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

  const modulesByCategoryBars = useMemo(() => {
    if (!admin?.modules.length) return [];
    const colors = ["#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#64748b", "#eab308"];
    const tally = new Map<string, number>();
    for (const m of admin.modules) {
      tally.set(m.category, (tally.get(m.category) ?? 0) + 1);
    }
    return Array.from(tally.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], i) => ({
        label,
        value,
        color: colors[i % colors.length],
      }));
  }, [admin]);

  const entitlementMixDonut = useMemo(() => {
    if (!admin?.modules.length) return [];
    const req = admin.modules.filter((m) => m.isRequired).length;
    const optOn = admin.modules.filter((m) => !m.isRequired && optionalEnabled.has(m.code)).length;
    const optOff = admin.modules.filter((m) => !m.isRequired && !optionalEnabled.has(m.code)).length;
    return [
      { label: "Required (on)", value: req, color: "#3b82f6" },
      { label: "Optional enabled", value: optOn, color: "#22c55e" },
      { label: "Optional off", value: optOff, color: "#94a3b8" },
    ].filter((x) => x.value > 0);
  }, [admin, optionalEnabled]);

  const licensedModuleBars = useMemo(() => {
    if (!summary?.licensedModules.length) return [];
    const colors = ["#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#64748b", "#eab308"];
    return summary.licensedModules.slice(0, 12).map((name, i) => ({
      label: name.length > 26 ? `${name.slice(0, 24)}…` : name,
      value: 1,
      color: colors[i % colors.length],
    }));
  }, [summary]);

  const licensedModuleDonut = useMemo(() => {
    if (!summary?.licensedModules.length) return [];
    const palette = ["#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6"];
    return summary.licensedModules.slice(0, 6).map((name, i) => ({
      label: name.length > 18 ? `${name.slice(0, 16)}…` : name,
      value: 1,
      color: palette[i % palette.length],
    }));
  }, [summary]);

  return (
    <>
      <AppTopbar title="Billing" subtitle="Plan, licensed modules, and subscription (per instance)." />

      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 px-7 py-8 text-slate-900 shadow-sm">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-sky-100/50 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 h-72 w-72 rounded-full bg-indigo-100/40 blur-3xl" />
        <div className="relative z-10">
          <p className="mb-2 inline-flex rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
            Commercial workspace
          </p>
          <h2 className="text-2xl font-semibold leading-tight text-slate-900 lg:text-3xl">Subscription &amp; entitlements</h2>
          <p className="mt-3 max-w-2xl text-sm text-slate-600">
            Review your plan, licensed modules, and renewal window. Administrators can edit subscription metadata, toggle
            optional modules, and run customer onboarding reset — styled like your Command Center dashboard.
          </p>
        </div>
      </section>

      <div className="mt-6 space-y-6">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
            {success}
          </div>
        )}

        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {billingKpis.map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="text-xs font-medium uppercase tracking-wider text-slate-500">{kpi.label}</div>
              <div className="mt-2 break-words text-xl font-semibold leading-tight text-slate-900">{kpi.value}</div>
              <div className="mt-2 text-xs text-slate-600">{kpi.sub}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-800">
                {admin ? "Modules by category" : "Licensed modules"}
              </h3>
              <span className="text-xs text-slate-500">{admin ? "Definitions" : "Up to 12"}</span>
            </div>
            {admin && modulesByCategoryBars.length > 0 ? (
              <HorizontalCompareBars items={modulesByCategoryBars} />
            ) : !admin && licensedModuleBars.length > 0 ? (
              <HorizontalCompareBars items={licensedModuleBars} />
            ) : (
              <p className="py-10 text-center text-sm text-slate-500">
                {loading ? "Loading chart data…" : "No module data to chart yet."}
              </p>
            )}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-800">
                {admin ? "Entitlement mix" : "Module mix"}
              </h3>
              <span className="text-xs text-slate-500">{admin ? "Required vs optional" : "Top 6"}</span>
            </div>
            {admin && entitlementMixDonut.length > 0 ? (
              <DonutMixChart values={entitlementMixDonut} />
            ) : !admin && licensedModuleDonut.some((d) => d.value > 0) ? (
              <DonutMixChart values={licensedModuleDonut} />
            ) : (
              <p className="py-10 text-center text-sm text-slate-500">
                {loading ? "Loading…" : admin ? "No entitlement breakdown." : "No licensed modules listed."}
              </p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-900">Quick links</h3>
            <p className="text-xs text-slate-500">Dashboard, policy, and usage</p>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
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
              href={ROUTES.settings}
              className="group rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-800">Policy &amp; settings</div>
                  <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">Tenant configuration</div>
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
                  <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">Operational reporting</div>
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
                  <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">Workforce intelligence</div>
                </div>
                <span className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700">
                  →
                </span>
              </div>
            </Link>
          </div>
        </div>

        {isAdmin && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Customer onboarding reset</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Dry-run preview and secure execution to clear transactional data for a new customer.
                </p>
              </div>
              <Link
                href="/app/billing/customer-reset"
                className="inline-flex shrink-0 items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
              >
                Open reset
              </Link>
            </div>
          </div>
        )}

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
              <p className="mt-1 text-sm text-slate-600">
                Manual billing metadata (no payment gateway in this version).
              </p>
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
              <p className="mt-1 text-sm text-slate-600">
                Required modules stay on for every plan. Optional modules can be toggled; unlisted optional modules are
                turned off when you save.
              </p>
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

        <p className="footer-note">
          Charts use licensing summary and admin module definitions. Saving entitlements or subscription metadata updates the
          backend for this instance; payment capture is not wired in this build.
        </p>
      </div>
    </>
  );
}
