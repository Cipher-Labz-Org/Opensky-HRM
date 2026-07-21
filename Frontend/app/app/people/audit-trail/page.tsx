"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { InlinePageAlert } from "@/components/ui";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/date-utils";
import { ROUTES } from "@/config/routes";
import { sanitizeSearchInput } from "@/lib/input-validation";
import { useApplyFilter } from "@/lib/use-apply-filter";

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

export default function PeopleAuditTrailPage() {
  const { hasPermission, isAdmin } = useAuth();
  const canView = isAdmin || hasPermission("People", "Read");

  const [data, setData] = useState<PagedAudit | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const employeeFilter = useApplyFilter();

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
      const filter = employeeFilter.applied.trim();
      if (filter) {
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(filter)) {
          q.set("employeeId", filter);
        } else {
          q.set("search", filter);
        }
      }
      const res = await apiFetch<PagedAudit>(`/api/employees/audit-trail?${q.toString()}`);
      setData(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load audit trail");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [canView, page, employeeFilter.applied]);

  useEffect(() => {
    void load();
  }, [load]);

  function applyEmployeeFilter() {
    const next = sanitizeSearchInput(employeeFilter.input).trim();
    employeeFilter.setApplied(next);
    employeeFilter.setInput(next);
    setPage(1);
  }

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
            Filter by employee
          </label>
          <input
            className="w-72 rounded-lg border border-slate-200 px-3 py-2 text-[13px] shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            placeholder="Name, employee code, or ID"
            value={employeeFilter.input}
            onChange={(e) => employeeFilter.setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyEmployeeFilter();
            }}
          />
        </div>
        <button
          type="button"
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-700 shadow-sm hover:border-blue-300 hover:text-blue-700"
          onClick={applyEmployeeFilter}
        >
          Apply
        </button>
        <button
          type="button"
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-700 shadow-sm hover:border-blue-300 hover:text-blue-700"
          onClick={() => {
            employeeFilter.clear();
            setPage(1);
          }}
        >
          Cancel
        </button>
        <Link
          href={ROUTES.people}
          className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-700 shadow-sm transition hover:border-blue-300 hover:text-blue-700"
        >
          Back to People Hub
        </Link>
      </div>

      {employeeFilter.hasApplied && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium text-slate-500">Showing results for:</span>
          <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-800">
            {employeeFilter.applied}
          </span>
        </div>
      )}

      <InlinePageAlert message={error} className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 scroll-mt-20" />

      {loading ? (
        <div className="flex justify-center py-16 text-slate-500">Loading…</div>
      ) : !data || data.items.length === 0 ? (
        <div className="hris-card p-8 text-center text-sm text-slate-500">
          {employeeFilter.hasApplied
            ? `No audit entries found for "${employeeFilter.applied}".`
            : "No People Hub audit entries yet. Changes to profiles and related records appear here after the next save."}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="hris-table w-full table-fixed text-[13px]">
              <colgroup>
                <col style={{ width: "20%" }} />
                <col style={{ width: "20%" }} />
                <col style={{ width: "20%" }} />
                <col style={{ width: "20%" }} />
                <col style={{ width: "20%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="!pl-6">When (office)</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th className="!pr-16">Employee</th>
                  <th className="!pl-10">By</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => (
                  <tr key={row.id}>
                    <td className="!pl-6 text-slate-600">
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
                    <td className="truncate">
                      <span className="font-medium text-slate-800">{row.entityName}</span>
                      <span className="ml-1 text-[11px] text-slate-400">{row.entityId.slice(0, 8)}…</span>
                    </td>
                    <td className="truncate !pr-16 text-[12px] text-slate-700">
                      {row.subjectEmployeeId ? (
                        <Link className="text-blue-600 hover:underline" href={`/app/people/${row.subjectEmployeeId}`}>
                          {row.subjectEmployeeLabel ?? `${row.subjectEmployeeId.slice(0, 8)}…`}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="truncate !pl-10 text-slate-600">{row.userName ?? row.userId ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-[13px] text-slate-600">
            <span>
              Page {data.page} of {data.totalPages} ({data.totalCount} events
              {employeeFilter.hasApplied ? ` matching "${employeeFilter.applied}"` : ""})
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
