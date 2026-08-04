"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { DatePickerField, FormSelect, InlinePageAlert, type FormSelectOption } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { resolveAssetUrl } from "@/config/constants";
import { formatDate } from "@/lib/date-utils";
import { applyFromDateInRange, applyToDateInRange } from "@/lib/datePickerIso";
import { appAlert } from "@/components/ui/appDialogs";

export interface LeaveRequestRow {
  id: string;
  employeeName: string;
  employeeCode: string;
  employeeId: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string | null;
  status: string;
  coveragePerson: string | null;
  approverRemarks: string | null;
  createdAt: string;
  currentApprovalLevel: number;
  level1ApproverId: string | null;
  level1ApproverName: string | null;
  level1Remarks: string | null;
  level1ApprovedAt: string | null;
  level2ApproverId: string | null;
  level2ApproverName: string | null;
  level2Remarks: string | null;
  level2ApprovedAt: string | null;
  approverName: string | null;
  responsibleUserName: string | null;
  responsibleEmployeeId: string | null;
  medicalCertificateUrl?: string | null;
}

interface EmployeeLookup {
  id: string;
  fullName: string;
  employeeCode: string;
  departmentId: string | null;
  departmentName: string | null;
}

interface PagedLeaveResponse {
  items?: LeaveRequestRow[];
  Items?: LeaveRequestRow[];
  totalCount?: number;
  TotalCount?: number;
  page?: number;
  Page?: number;
  pageSize?: number;
  PageSize?: number;
}

/** Match Recruitment & Hiring (`app/app/recruitment/page.tsx`) */
const panelClass = "rounded-2xl border border-slate-200 bg-white shadow-sm";
const inputClassSlate =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-[#2E7BBF] focus:ring-2 focus:ring-[#2E7BBF]/20";

const labelClass = "mb-1 block text-xs font-medium text-slate-500";

import { DashboardPageHeader } from "@/components/dashboard/DashboardUi";
import { OPENSKY_THEME } from "@/lib/opensky-theme";

const T = OPENSKY_THEME;

const QUICK_STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: "", label: "All" },
  { value: "Pending", label: "Pending" },
  { value: "PendingLevel2", label: "Pending L2" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" },
  { value: "Cancelled", label: "Cancelled" },
];

function normalizePaged(raw: PagedLeaveResponse): {
  items: LeaveRequestRow[];
  totalCount: number;
  page: number;
  pageSize: number;
} {
  const items = raw.items ?? raw.Items ?? [];
  const totalCount = raw.totalCount ?? raw.TotalCount ?? 0;
  const page = raw.page ?? raw.Page ?? 1;
  const pageSize = raw.pageSize ?? raw.PageSize ?? 20;
  return { items, totalCount, page, pageSize };
}

function canActOnLeaveStatus(status: string): boolean {
  const s = status.toLowerCase();
  return s === "pending" || s === "pendinglevel2";
}

function canUserActOnLeaveRow(
  row: LeaveRequestRow,
  currentEmployeeId: string | null,
  showApprovalActions: boolean,
): boolean {
  if (!showApprovalActions || !canActOnLeaveStatus(row.status)) return false;
  if (!currentEmployeeId || !row.responsibleEmployeeId) return false;
  return row.responsibleEmployeeId.toLowerCase() === currentEmployeeId.toLowerCase();
}

function leaveStatusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("approved")) return "badge badge-green";
  if (s.includes("reject")) return "badge badge-red";
  if (s.includes("pending")) return "badge badge-yellow";
  if (s.includes("cancel")) return "badge badge-blue";
  return "badge badge-blue";
}

function formatLeaveStatusLabel(status: string): string {
  if (status === "PendingLevel2") return "Pending (L2)";
  return status;
}

function employeeInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

export interface LeaveRequestsPanelProps {
  onApplyLeave?: () => void;
  /** When true, list is scoped to self-service (backend enforces Own). */
  isEmployeeView?: boolean;
  currentEmployeeId?: string | null;
  /** Show Approve / Reject for pending rows (requires Leave Update + approvable state). */
  showApprovalActions?: boolean;
  /** Team / supervisor approval list: exclude your own requests from the query. */
  teamOnly?: boolean;
  sectionTitle?: string;
  sectionSubtitle?: string;
  hideApplyShortcut?: boolean;
}

export function LeaveRequestsPanel({
  onApplyLeave,
  isEmployeeView = false,
  currentEmployeeId = null,
  showApprovalActions = false,
  teamOnly = false,
  sectionTitle = "Leave requests",
  sectionSubtitle,
  hideApplyShortcut = false,
}: LeaveRequestsPanelProps) {
  const [items, setItems] = useState<LeaveRequestRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [deptFilter, setDeptFilter] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [employees, setEmployees] = useState<EmployeeLookup[]>([]);

  function onFromDateChange(next: string) {
    const { from, to } = applyFromDateInRange(next, toDate);
    setFromDate(from);
    setToDate(to);
  }

  function onToDateChange(next: string) {
    const { from, to } = applyToDateInRange(fromDate, next);
    setFromDate(from);
    setToDate(to);
  }

  const [actionRow, setActionRow] = useState<LeaveRequestRow | null>(null);
  const [actionKind, setActionKind] = useState<"approve" | "reject" | null>(null);
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const empDeptById = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const e of employees) m.set(e.id, e.departmentId);
    return m;
  }, [employees]);

  const departments = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of employees) {
      if (e.departmentId && e.departmentName) map.set(e.departmentId, e.departmentName);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [employees]);

  const departmentSelectOptions = useMemo<FormSelectOption[]>(
    () => [
      { value: "", label: "All departments" },
      ...departments.map(([id, name]) => ({ value: id, label: name })),
    ],
    [departments],
  );

  const defaultSubtitle = useMemo(() => {
    if (sectionSubtitle != null && sectionSubtitle !== "") return sectionSubtitle;
    if (teamOnly && showApprovalActions)
      return "Leave from your team that needs a decision. Use filters to narrow the list.";
    if (isEmployeeView) return "Your submissions and their status.";
    return "All employees' leave requests. Filter by department, status, and dates as needed.";
  }, [sectionSubtitle, teamOnly, showApprovalActions, isEmployeeView]);

  useEffect(() => {
    apiFetch<{ items: EmployeeLookup[] }>("/api/employees?pageSize=500&excludeTerminated=true")
      .then((r) => setEmployees(r.items ?? []))
      .catch(() => setEmployees([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set("page", String(deptFilter ? 1 : page));
    params.set("pageSize", String(deptFilter ? 500 : pageSize));
    if (statusFilter) params.set("status", statusFilter);
    if (fromDate) params.set("fromDate", fromDate);
    if (toDate) params.set("toDate", toDate);
    if (teamOnly) params.set("excludeSelf", "true");
    try {
      const raw = await apiFetch<PagedLeaveResponse>(`/api/leave/requests?${params}`);
      const norm = normalizePaged(raw);
      let rows = norm.items;
      if (deptFilter) {
        rows = rows.filter((r) => empDeptById.get(r.employeeId) === deptFilter);
      }
      setItems(rows);
      setTotalCount(deptFilter ? rows.length : norm.totalCount);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load leave requests");
      setItems([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, fromDate, toDate, teamOnly, deptFilter, empDeptById]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [deptFilter, statusFilter, fromDate, toDate, teamOnly]);

  async function submitLeaveAction() {
    if (!actionRow || !actionKind) return;
    setSubmitting(true);
    try {
      const path =
        actionKind === "approve"
          ? `/api/leave/requests/${actionRow.id}/approve`
          : `/api/leave/requests/${actionRow.id}/reject`;
      await apiFetch(path, {
        method: "POST",
        body: JSON.stringify({ remarks: remarks.trim() || null }),
      });
      setActionRow(null);
      setActionKind(null);
      setRemarks("");
      await load();
    } catch (e) {
      await appAlert(e instanceof Error ? e.message : "Request failed", actionKind === "approve" ? "Approve" : "Reject");
    } finally {
      setSubmitting(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const showPager = !deptFilter && totalCount > pageSize;
  const hasActiveFilters = Boolean(deptFilter || statusFilter || fromDate || toDate);

  function clearFilters() {
    setDeptFilter("");
    setStatusFilter("");
    setFromDate("");
    setToDate("");
  }

  return (
    <div className="w-full min-w-0 max-w-full space-y-5">
      <DashboardPageHeader
        eyebrow="Leave workspace"
        title={sectionTitle}
        subtitle={defaultSubtitle}
        badge={
          !hideApplyShortcut && onApplyLeave ? (
            <Button type="button" onClick={onApplyLeave} className="shrink-0">
              + Apply for leave
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap gap-2">
        {QUICK_STATUS_FILTERS.map((filter) => {
          const active = statusFilter === filter.value;
          return (
            <button
              key={filter.value || "all"}
              type="button"
              onClick={() => setStatusFilter(filter.value)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                active
                  ? "bg-blue-600 text-white shadow-sm"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50/60"
              }`}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Filters</p>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-medium text-slate-500 transition hover:text-slate-800"
            >
              Clear all
            </button>
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className={labelClass}>Department</label>
            <FormSelect
              value={deptFilter}
              onValueChange={setDeptFilter}
              options={departmentSelectOptions}
              placeholder="All departments"
            />
          </div>
          <div>
            <label className={labelClass}>From date</label>
            <DatePickerField
              value={fromDate}
              onChange={onFromDateChange}
              max={toDate || undefined}
              className={inputClassSlate}
            />
          </div>
          <div>
            <label className={labelClass}>To date</label>
            <DatePickerField
              value={toDate}
              onChange={onToDateChange}
              min={fromDate || undefined}
              className={inputClassSlate}
            />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={() => void load()}
              disabled={loading}
            >
              {loading ? "Loading…" : "Refresh"}
            </Button>
          </div>
        </div>
      </div>

      <InlinePageAlert message={error} className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-center text-sm text-red-700 shadow-sm scroll-mt-20" />

      <div className={`${panelClass} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="hris-table min-w-[920px]">
            <thead className="bg-slate-50/90">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Employee</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Leave type</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Period</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Days</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Approver</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={`sk-${i}`} className="animate-pulse">
                    <td colSpan={7} className="px-4 py-4">
                      <div className="h-10 rounded-lg bg-slate-100" />
                    </td>
                  </tr>
                ))}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-0">
                    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                      <div
                        className="mb-4 flex h-14 w-14 items-center justify-center rounded-full"
                        style={{ backgroundColor: T.actionSoft, color: T.action }}
                      >
                        <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                          />
                        </svg>
                      </div>
                      <h3 className="text-base font-semibold text-slate-800">No leave requests found</h3>
                      <p className="mt-2 max-w-md text-sm text-slate-500">
                        {hasActiveFilters
                          ? "Try clearing filters or widening the date range."
                          : "When leave is submitted it will appear here for tracking and approval."}
                      </p>
                      {!hideApplyShortcut && onApplyLeave && (
                        <Button type="button" className="mt-5" onClick={onApplyLeave}>
                          + Apply for leave
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
              {!loading &&
                items.map((r) => (
                  <tr key={r.id} className="transition hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-[11px] font-bold text-white">
                          {employeeInitials(r.employeeName)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-800">{r.employeeName}</p>
                          {r.employeeCode ? (
                            <p className="truncate text-xs text-slate-500">{r.employeeCode}</p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {r.leaveTypeName}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      <span>{formatDate(r.startDate)}</span>
                      <span className="mx-1.5 text-slate-300">→</span>
                      <span>{formatDate(r.endDate)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex min-w-[2.25rem] justify-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold tabular-nums text-blue-700">
                        {Number(r.totalDays).toFixed(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={leaveStatusBadgeClass(r.status)}>{formatLeaveStatusLabel(r.status)}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{r.responsibleUserName ?? "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {r.medicalCertificateUrl ? (
                          <a
                            href={resolveAssetUrl(r.medicalCertificateUrl) ?? "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-50"
                          >
                            PDF
                          </a>
                        ) : null}
                        {canUserActOnLeaveRow(r, currentEmployeeId, showApprovalActions) ? (
                          <>
                            <button
                              type="button"
                              className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                              onClick={() => {
                                setActionRow(r);
                                setActionKind("approve");
                                setRemarks("");
                              }}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="inline-flex items-center rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                              onClick={() => {
                                setActionRow(r);
                                setActionKind("reject");
                                setRemarks("");
                              }}
                            >
                              Reject
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {showPager && (
        <div className={`${panelClass} flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm text-slate-600`}>
          <span>
            Showing page {page} of {totalPages} · {totalCount} request{totalCount === 1 ? "" : "s"} total
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button type="button" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      <Modal
        open={!!actionRow && !!actionKind}
        onClose={() => {
          if (submitting) return;
          setActionRow(null);
          setActionKind(null);
          setRemarks("");
        }}
        title={actionKind === "approve" ? "Approve leave" : "Reject leave"}
      >
        {actionRow && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              <span className="font-medium text-slate-800">{actionRow.employeeName}</span> — {actionRow.leaveTypeName}{" "}
              ({formatDate(actionRow.startDate)} → {formatDate(actionRow.endDate)})
            </p>
            <div>
              <label className={labelClass}>Remarks (optional)</label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
                className={inputClassSlate}
                placeholder={actionKind === "reject" ? "Reason for rejection…" : "Optional note to the employee…"}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                disabled={submitting}
                onClick={() => {
                  setActionRow(null);
                  setActionKind(null);
                  setRemarks("");
                }}
              >
                Cancel
              </Button>
              <Button type="button" disabled={submitting} onClick={() => void submitLeaveAction()}>
                {submitting ? "Saving…" : actionKind === "approve" ? "Confirm approve" : "Confirm reject"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
