"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/Button";

interface OutboundEmailLogRow {
  id: string;
  createdAt: string;
  category: string;
  recipientEmail: string;
  recipientName: string | null;
  subject: string;
  status: string;
  provider: string;
  httpStatusCode: number | null;
  fromEmail: string | null;
  errorDetail: string | null;
}

interface Paged {
  items: OutboundEmailLogRow[];
  totalCount: number;
  page: number;
  pageSize: number;
}

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "Sent", label: "Sent" },
  { value: "Failed", label: "Failed" },
  { value: "SkippedNotConfigured", label: "Skipped (no provider)" },
];

function statusBadgeClass(status: string) {
  if (status === "Sent") return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  if (status === "Failed") return "bg-red-50 text-red-800 ring-red-200";
  if (status === "SkippedNotConfigured") return "bg-amber-50 text-amber-900 ring-amber-200";
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

export function EmailDeliveryLogContent() {
  const [data, setData] = useState<Paged | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const pageSize = 25;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const q = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (statusFilter) q.set("status", statusFilter);
      const res = await apiFetch<Paged>(`/api/email-delivery-logs?${q.toString()}`);
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load email log");
      setData(null);
    }
    setLoading(false);
  }, [page, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = data ? Math.max(1, Math.ceil(data.totalCount / pageSize)) : 1;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <span>Status</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value);
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <Button type="button" variant="secondary" onClick={() => load()} disabled={loading}>
          Refresh
        </Button>
        {data != null && (
          <span className="text-sm text-slate-500">
            {data.totalCount} record{data.totalCount === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-3">Time (UTC)</th>
              <th className="px-3 py-3">Category</th>
              <th className="px-3 py-3">Recipient</th>
              <th className="px-3 py-3">Subject</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Provider</th>
              <th className="px-3 py-3">HTTP</th>
              <th className="px-3 py-3">From</th>
              <th className="px-3 py-3">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && data?.items.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-slate-500">
                  No email log entries yet. Entries appear when offer or leave emails are sent.
                </td>
              </tr>
            )}
            {!loading &&
              data?.items.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/80">
                  <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-slate-600">
                    {new Date(row.createdAt).toISOString().replace("T", " ").slice(0, 19)}
                  </td>
                  <td className="px-3 py-2.5 text-slate-800">{row.category}</td>
                  <td className="max-w-[200px] px-3 py-2.5">
                    <div className="truncate font-medium text-slate-800" title={row.recipientEmail}>
                      {row.recipientEmail}
                    </div>
                    {row.recipientName && (
                      <div className="truncate text-xs text-slate-500" title={row.recipientName ?? undefined}>
                        {row.recipientName}
                      </div>
                    )}
                  </td>
                  <td className="max-w-[220px] px-3 py-2.5 text-slate-700" title={row.subject}>
                    <span className="line-clamp-2">{row.subject}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${statusBadgeClass(row.status)}`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-700">{row.provider}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-slate-600">
                    {row.httpStatusCode ?? "—"}
                  </td>
                  <td className="max-w-[160px] truncate px-3 py-2.5 text-xs text-slate-600" title={row.fromEmail ?? undefined}>
                    {row.fromEmail ?? "—"}
                  </td>
                  <td className="max-w-[280px] px-3 py-2.5 text-xs text-slate-600" title={row.errorDetail ?? undefined}>
                    {row.errorDetail ? <span className="line-clamp-3 whitespace-pre-wrap break-words">{row.errorDetail}</span> : "—"}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {data && data.totalCount > pageSize && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
          <span>
            Page {data.page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
