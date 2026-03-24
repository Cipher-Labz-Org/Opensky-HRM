"use client";

import { useCallback, useEffect, useState } from "react";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { API_BASE_URL } from "@/config/constants";
import { useAuth } from "@/contexts/auth-context";

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
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
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

  return (
    <>
      <AppTopbar title="Billing" subtitle="Plan, licensed modules, and subscription (per instance)." />
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

        <div className="rounded-[22px] border border-[var(--border)] bg-[var(--panel)] p-6 shadow-[var(--shadow)]">
          <h3 className="text-lg font-semibold text-[var(--text)]">Your plan</h3>
          {loading && (
            <p className="mt-2 text-sm text-[var(--muted)]">Loading…</p>
          )}
          {!loading && summary && (
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[var(--muted)]">Plan</dt>
                <dd className="font-medium text-[var(--text)]">{summary.planName || "—"}</dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Status</dt>
                <dd className="font-medium text-[var(--text)]">{summary.status}</dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Valid from</dt>
                <dd className="text-[var(--text)]">{formatDate(summary.validFrom)}</dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Valid until</dt>
                <dd className="text-[var(--text)]">
                  {summary.validUntil ? formatDate(summary.validUntil) : "—"}
                </dd>
              </div>
            </dl>
          )}
          {!loading && summary && (
            <div className="mt-6">
              <h4 className="text-sm font-semibold text-[var(--text)]">Licensed modules</h4>
              <ul className="mt-2 flex flex-wrap gap-2">
                {summary.licensedModules.map((m) => (
                  <li
                    key={m}
                    className="rounded-lg bg-[var(--muted)]/10 px-2.5 py-1 text-xs font-medium text-[var(--text)]"
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
            <div className="rounded-[22px] border border-[var(--border)] bg-[var(--panel)] p-6 shadow-[var(--shadow)]">
              <h3 className="text-lg font-semibold text-[var(--text)]">Subscription details</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Manual billing metadata (no payment gateway in this version).
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="text-[var(--muted)]">Plan name</span>
                  <input
                    className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--text)]"
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-[var(--muted)]">Status</span>
                  <select
                    className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--text)]"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="Trial">Trial</option>
                    <option value="Active">Active</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="text-[var(--muted)]">Valid until (optional)</span>
                  <input
                    type="date"
                    className="mt-1 w-full max-w-xs rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--text)]"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                  />
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="text-[var(--muted)]">Notes</span>
                  <textarea
                    className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--text)]"
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
                className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Save subscription
              </button>
            </div>

            <div className="rounded-[22px] border border-[var(--border)] bg-[var(--panel)] p-6 shadow-[var(--shadow)]">
              <h3 className="text-lg font-semibold text-[var(--text)]">Module entitlements</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Required modules stay on for every plan. Optional modules can be toggled; unlisted optional
                modules are turned off when you save.
              </p>
              <ul className="mt-4 max-h-[420px] space-y-2 overflow-y-auto pr-1">
                {admin.modules.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-3 py-2"
                  >
                    <div>
                      <div className="text-sm font-medium text-[var(--text)]">{m.displayName}</div>
                      <div className="text-xs text-[var(--muted)]">
                        {m.code}
                        {m.isRequired ? " · required" : ""} · {m.category}
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      className="h-4 w-4"
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
                className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
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
