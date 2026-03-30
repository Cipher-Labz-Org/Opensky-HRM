"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/date-utils";
import { ROUTES } from "@/config/routes";

interface PeopleAuditChange {
  field: string;
  previous: string | null;
  current: string | null;
}

interface PeopleAuditEntry {
  id: string;
  entityName: string;
  entityId: string;
  action: string;
  subjectEmployeeId: string | null;
  subjectEmployeeLabel: string | null;
  userId: string | null;
  userName: string | null;
  timestamp: string;
  oldValues: string | null;
  newValues: string | null;
  changes: PeopleAuditChange[] | null;
}

interface PagedAudit {
  items: PeopleAuditEntry[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
}

function formatJson(s: string | null): string {
  if (!s?.trim()) return "—";
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}

export default function PeopleAuditTrailPage() {
  const { hasPermission, isAdmin } = useAuth();
  const canView = isAdmin || hasPermission("People", "Read");

  const [data, setData] = useState<PagedAudit | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [employeeIdInput, setEmployeeIdInput] = useState("");
  const [appliedEmployeeId, setAppliedEmployeeId] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const pageSize = 25;

  const load = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const q = new URLSearchParams();
      q.set("page", String(page));
      q.set("pageSize", String(pageSize));
      const id = appliedEmployeeId.trim();
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
        q.set("employeeId", id);
      }
      const res = await apiFetch<PagedAudit>(`/api/employees/audit-trail?${q.toString()}`);
      setData(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load audit trail");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [canView, page, appliedEmployeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!canView) {
    return (
      <>
        <AppTopbar title="People audit trail" subtitle="You do not have access to this area." />
        <div className="hris-card p-6 text-sm text-slate-600">Required permission: People · Read</div>
      </>
    );
  }

  return (
    <>
      <AppTopbar
        title="People Hub — audit trail"
        subtitle="Create, update, and delete events for employee profiles, related records, and People-scoped compensation."
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Filter by employee ID
          </label>
          <input
            className="w-72 rounded-lg border border-slate-200 px-3 py-2 text-[13px] shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            placeholder="Optional GUID"
            value={employeeIdInput}
            onChange={(e) => setEmployeeIdInput(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-700 shadow-sm hover:border-blue-300 hover:text-blue-700"
          onClick={() => {
            setAppliedEmployeeId(employeeIdInput.trim());
            setPage(1);
          }}
        >
          Apply
        </button>
        <Link
          href={ROUTES.people}
          className="text-[13px] font-medium text-blue-600 hover:underline"
        >
          ← Back to People Hub
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-16 text-slate-500">Loading…</div>
      ) : !data || data.items.length === 0 ? (
        <div className="hris-card p-8 text-center text-sm text-slate-500">
          No People Hub audit entries yet. Changes to profiles and related records appear here after the next save.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="hris-table text-[13px]">
              <thead>
                <tr>
                  <th>When (office)</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Employee</th>
                  <th>By</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap text-slate-600">
                      {formatDateTime(row.timestamp)}
                    </td>
                    <td>
                      <span
                        className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                          row.action === "Delete"
                            ? "bg-red-50 text-red-700"
                            : row.action === "Create"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-blue-50 text-blue-700"
                        }`}
                      >
                        {row.action}
                      </span>
                    </td>
                    <td>
                      <span className="font-medium text-slate-800">{row.entityName}</span>
                      <span className="ml-1 text-[11px] text-slate-400">{row.entityId.slice(0, 8)}…</span>
                    </td>
                    <td className="text-[12px] text-slate-700">
                      {row.subjectEmployeeId ? (
                        <Link className="text-blue-600 hover:underline" href={`/app/people/${row.subjectEmployeeId}`}>
                          {row.subjectEmployeeLabel ?? `${row.subjectEmployeeId.slice(0, 8)}…`}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="text-slate-600">{row.userName ?? row.userId ?? "—"}</td>
                    <td className="text-right">
                      <button
                        type="button"
                        className="text-[12px] font-medium text-blue-600 hover:underline"
                        onClick={() => setExpanded((id) => (id === row.id ? null : row.id))}
                      >
                        {expanded === row.id ? "Hide" : "Details"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {expanded && (
            <div className="mt-4 md:col-span-2">
              {data.items
                .filter((r) => r.id === expanded)
                .map((row) => (
                  <div key={`d-${row.id}`} className="space-y-4">
                    {row.changes && row.changes.length > 0 ? (
                      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                        <table className="hris-table text-[12px]">
                          <thead>
                            <tr>
                              <th>Field</th>
                              <th>Previous</th>
                              <th>Current</th>
                            </tr>
                          </thead>
                          <tbody>
                            {row.changes.map((c, idx) => (
                              <tr key={`${row.id}-${idx}`}>
                                <td className="whitespace-nowrap font-medium text-slate-800">{c.field}</td>
                                <td className="max-w-[min(40vw,22rem)] whitespace-pre-wrap text-slate-600">
                                  {c.previous ?? "—"}
                                </td>
                                <td className="max-w-[min(40vw,22rem)] whitespace-pre-wrap text-slate-800">
                                  {c.current ?? "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">No parsed change rows (legacy audit entry).</p>
                    )}
                    {(row.oldValues || row.newValues) && (
                      <details className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-[11px] text-slate-600">
                        <summary className="cursor-pointer font-medium text-slate-700">Raw JSON (technical)</summary>
                        <div className="mt-2 grid gap-2 md:grid-cols-2">
                          {row.oldValues && (
                            <pre className="max-h-48 overflow-auto rounded border border-slate-200 bg-white p-2 leading-relaxed">
                              {row.oldValues}
                            </pre>
                          )}
                          {row.newValues && (
                            <pre className="max-h-48 overflow-auto rounded border border-slate-200 bg-white p-2 leading-relaxed">
                              {row.newValues}
                            </pre>
                          )}
                        </div>
                      </details>
                    )}
                  </div>
                ))}
            </div>
          )}

          <div className="mt-4 flex items-center justify-between text-[13px] text-slate-600">
            <span>
              Page {data.page} of {data.totalPages} ({data.totalCount} events)
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={data.page <= 1}
                className="rounded border border-slate-200 bg-white px-3 py-1 disabled:opacity-40"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                disabled={data.hasNextPage === false || data.page >= data.totalPages}
                className="rounded border border-slate-200 bg-white px-3 py-1 disabled:opacity-40"
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
