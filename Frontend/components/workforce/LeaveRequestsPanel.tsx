"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { DatePickerField, FormSelect, type FormSelectOption } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { API_BASE_URL } from "@/config/constants";
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

const LEAVE_STATUS_OPTIONS: FormSelectOption[] = [
  { value: "", label: "All" },
  { value: "Pending", label: "Pending" },
  { value: "PendingLevel2", label: "Pending (level 2)" },
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

  return (
    <div className="mt-6 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-800">{sectionTitle}</h2>
        <p className="mt-1 text-sm text-slate-500">{defaultSubtitle}</p>
        {!hideApplyShortcut && onApplyLeave && (
          <div className="mt-3">
            <Button type="button" variant="secondary" onClick={onApplyLeave}>
              Apply for leave
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="w-44 shrink-0 sm:w-52">
          <label className={labelClass}>Department</label>
          <FormSelect
            value={deptFilter}
            onValueChange={setDeptFilter}
            options={departmentSelectOptions}
            placeholder="All departments"
          />
        </div>
        <div className="w-40 shrink-0">
          <label className={labelClass}>Status</label>
          <FormSelect
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={LEAVE_STATUS_OPTIONS}
            placeholder="All"
          />
        </div>
        <div>
          <label className={labelClass}>From date</label>
          <DatePickerField value={fromDate} onChange={onFromDateChange} max={toDate || undefined} className={`${inputClassSlate} w-40`} />
        </div>
        <div>
          <label className={labelClass}>To date</label>
          <DatePickerField value={toDate} onChange={onToDateChange} min={fromDate || undefined} className={`${inputClassSlate} w-40`} />
        </div>
        <div className="flex-1" />
        <Button type="button" variant="secondary" onClick={() => void load()} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </Button>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-center text-sm text-red-700 shadow-sm">
          {error}
        </div>
      )}

      <div className={`${panelClass} overflow-x-auto`}>
        <table className="hris-table min-w-[880px]">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Type</th>
              <th>Start</th>
              <th>End</th>
              <th className="text-right">Days</th>
              <th>Status</th>
              <th>Responsible</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center text-slate-500">
                  No requests found. Try adjusting status or date range.
                </td>
              </tr>
            )}
            {!loading &&
              items.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium text-slate-800">
                    {r.employeeName}
                    {r.employeeCode ? <span className="ml-1 text-xs font-normal text-slate-500">({r.employeeCode})</span> : null}
                  </td>
                  <td className="text-slate-700">{r.leaveTypeName}</td>
                  <td className="text-slate-700">{formatDate(r.startDate)}</td>
                  <td className="text-slate-700">{formatDate(r.endDate)}</td>
                  <td className="text-right tabular-nums text-slate-800">{Number(r.totalDays).toFixed(1)}</td>
                  <td>
                    <span className={leaveStatusBadgeClass(r.status)}>{r.status}</span>
                  </td>
                  <td className="text-slate-600">{r.responsibleUserName ?? "—"}</td>
                  <td className="text-right">
                    <div className="flex flex-wrap justify-end gap-x-2 gap-y-1">
                      {r.medicalCertificateUrl ? (
                        <a
                          href={`${API_BASE_URL}${r.medicalCertificateUrl}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Certificate
                        </a>
                      ) : null}
                      {canUserActOnLeaveRow(r, currentEmployeeId, showApprovalActions) ? (
                        <>
                          <button
                            type="button"
                            className="text-xs text-green-600 hover:underline"
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
                            className="text-xs text-rose-600 hover:underline"
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

      {showPager && (
        <div className={`${panelClass} flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm text-slate-600`}>
          <span>
            Page {page} of {totalPages} ({totalCount} total)
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
