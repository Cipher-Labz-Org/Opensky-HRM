"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import Link from "next/link";
import { InlinePageAlert } from "@/components/ui";

type ConfirmPhraseResponse = { phrase: string };

type CustomerResetDryRunTableCount = { table: string; count: number };

type CustomerResetDryRunPreview = {
  tables: CustomerResetDryRunTableCount[];
  includeHangfire: boolean;
};

export default function CustomerResetPage() {
  const { token, hasPermission, isLoading } = useAuth();
  const canExecute = hasPermission("Administration", "Delete");

  const [phrase, setPhrase] = useState<string>("");
  const [typedPhrase, setTypedPhrase] = useState<string>("");

  const [includeHangfire, setIncludeHangfire] = useState<boolean>(true);
  const [allowInProduction, setAllowInProduction] = useState<boolean>(false);

  const [preview, setPreview] = useState<CustomerResetDryRunPreview | null>(null);
  const [loadingPhrase, setLoadingPhrase] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [executeLoading, setExecuteLoading] = useState(false);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadPhrase = useCallback(async () => {
    setLoadingPhrase(true);
    setError(null);
    try {
      const res = await apiFetch<ConfirmPhraseResponse>("/api/admin/customer-reset/confirm-phrase");
      setPhrase(res.phrase ?? "ERASE CUSTOMER DATA");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load confirmation phrase.");
    } finally {
      setLoadingPhrase(false);
    }
  }, []);

  useEffect(() => {
    loadPhrase();
  }, [loadPhrase]);

  const typedOk = useMemo(() => typedPhrase.trim() === phrase.trim(), [typedPhrase, phrase]);
  const totalRows = useMemo(
    () => (preview?.tables ? preview.tables.reduce((s, t) => s + (t.count ?? 0), 0) : 0),
    [preview]
  );
  const sortedPreviewTables = useMemo(
    () => (preview?.tables ? preview.tables.slice().sort((a, b) => (b.count ?? 0) - (a.count ?? 0)) : []),
    [preview]
  );
  const allSelected = sortedPreviewTables.length > 0 && selectedTables.length === sortedPreviewTables.length;

  const runDry = useCallback(async () => {
    setPreviewLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await apiFetch<{ dryRun: true; preview: CustomerResetDryRunPreview }>(
        "/api/admin/customer-reset",
        {
          method: "POST",
          body: JSON.stringify({
            dryRun: true,
            allowInProduction: allowInProduction,
            includeHangfire: includeHangfire,
            // confirmPhrase intentionally omitted for dry-run
          }),
        }
      );
      setPreview(res.preview);
      setSelectedTables((res.preview.tables ?? []).map((t) => t.table));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Dry-run failed.");
      setPreview(null);
      setSelectedTables([]);
    } finally {
      setPreviewLoading(false);
    }
  }, [allowInProduction, includeHangfire]);

  const execute = useCallback(async () => {
    setExecuteLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await apiFetch<{ dryRun: false; result: unknown }>("/api/admin/customer-reset", {
        method: "POST",
        body: JSON.stringify({
          dryRun: false,
          allowInProduction: allowInProduction,
          includeHangfire: includeHangfire,
          confirmPhrase: typedPhrase,
          selectedTables,
        }),
      });

      setSuccess("Customer transaction data reset completed.");
      setPreview(null);
      setSelectedTables([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset failed.");
    } finally {
      setExecuteLoading(false);
    }
  }, [allowInProduction, includeHangfire, typedPhrase, selectedTables]);

  if (isLoading) {
    return (
      <>
        <AppTopbar title="Customer Reset" subtitle="Secured onboarding reset flow" />
        <div className="mx-auto max-w-5xl p-6 text-sm text-slate-500">Loading…</div>
      </>
    );
  }

  return (
    <>
      <AppTopbar
        title="Customer Reset"
        subtitle="Securely clear transactional data for new-customer onboarding."
      />

      <div className="mx-auto max-w-5xl space-y-6 pt-2">
        {!canExecute && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            You don’t have permission to run this reset. Requires `Administration:Delete`.
          </div>
        )}

        <InlinePageAlert
          message={success}
          variant="success"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 scroll-mt-20"
        />
        <InlinePageAlert
          message={error}
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 scroll-mt-20"
        />

        <div className="rounded-[22px] border border-[var(--border)] bg-[var(--panel)] p-6 shadow-[var(--shadow)]">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-[var(--text)]">Reset confirmation</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                This clears transactional/customer operational data (employees, leave, recruitment, payroll, analytics,
                learning, etc.). Master/reference configuration and licensing remain intact.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/app/administration"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Back to Administration
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h4 className="text-sm font-semibold text-slate-800">Step 1: Dry-run preview</h4>
              <p className="mt-1 text-xs text-slate-500">
                Shows counts for what would be deleted. No destructive action occurs.
              </p>

              <div className="mt-3 flex items-center justify-between">
                <label className="text-sm text-slate-700">Include Hangfire data</label>
                <input
                  type="checkbox"
                  checked={includeHangfire}
                  onChange={(e) => setIncludeHangfire(e.target.checked)}
                  className="h-4 w-4"
                />
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  disabled={!canExecute || previewLoading}
                  onClick={runDry}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {previewLoading ? "Preparing preview..." : "Run dry-run"}
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h4 className="text-sm font-semibold text-slate-800">Step 2: Execute reset</h4>
              <p className="mt-1 text-xs text-slate-500">
                Destructive. Backend rejects execution in production unless you confirm.
              </p>

              <div className="mt-3 flex items-center justify-between">
                <label className="text-sm text-slate-700">Allow execution in production</label>
                <input
                  type="checkbox"
                  checked={allowInProduction}
                  onChange={(e) => setAllowInProduction(e.target.checked)}
                  className="h-4 w-4"
                />
              </div>

              <div className="mt-4">
                <label className="text-xs font-medium text-slate-600">
                  Type this phrase to confirm
                </label>
                <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                  {loadingPhrase ? "Loading..." : phrase || "ERASE CUSTOMER DATA"}
                </div>
                <input
                  value={typedPhrase}
                  onChange={(e) => setTypedPhrase(e.target.value)}
                  placeholder="Type the phrase exactly"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-200"
                  disabled={!canExecute || executeLoading}
                />
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  disabled={!canExecute || executeLoading || !typedOk || !preview || selectedTables.length === 0}
                  onClick={execute}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50"
                  title={
                    !preview
                      ? "Run dry-run first"
                      : selectedTables.length === 0
                        ? "Select at least one table"
                        : typedOk
                          ? "Execute reset"
                          : "Type the confirmation phrase exactly"
                  }
                >
                  {executeLoading ? "Resetting..." : "Execute reset"}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
            <h4 className="text-sm font-semibold text-slate-800">Dry-run preview</h4>
            <p className="mt-1 text-xs text-slate-500">
              {preview ? `Total rows across tables: ${totalRows.toLocaleString()}` : "No preview yet. Run dry-run to see counts."}
            </p>

            {preview && (
              <div className="mt-3 max-h-[360px] overflow-auto rounded-lg border border-slate-100">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr className="border-b border-slate-200">
                      <th className="w-10 px-3 py-2 text-center text-xs font-semibold text-slate-600">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTables(sortedPreviewTables.map((t) => t.table));
                            } else {
                              setSelectedTables([]);
                            }
                          }}
                          className="h-4 w-4"
                          aria-label="Select all tables"
                        />
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Table</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPreviewTables.map((t) => (
                        <tr key={t.table} className="border-b border-slate-100">
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={selectedTables.includes(t.table)}
                              onChange={(e) => {
                                setSelectedTables((prev) =>
                                  e.target.checked ? [...prev, t.table] : prev.filter((x) => x !== t.table)
                                );
                              }}
                              className="h-4 w-4"
                              aria-label={`Select table ${t.table}`}
                            />
                          </td>
                          <td className="max-w-[360px] truncate px-3 py-2 font-medium text-slate-700">
                            {t.table}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-slate-900">
                            {t.count.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

