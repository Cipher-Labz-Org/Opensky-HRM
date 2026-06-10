"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { Button } from "@/components/ui/Button";
import { DatePickerField, FormSelect, TablePagination, type FormSelectOption } from "@/components/ui";
import { useClientPagination } from "@/lib/use-client-pagination";
import { Modal } from "@/components/ui/Modal";
import { LeaveRequestsPanel } from "@/components/workforce/LeaveRequestsPanel";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/date-utils";
import { formatLocalDateToIso } from "@/lib/datePickerIso";
import { appAlert } from "@/components/ui/appDialogs";
import { useAuth } from "@/contexts/auth-context";
import { useApplyFilter } from "@/lib/use-apply-filter";

/** Match Recruitment & Hiring (`recruitment/page.tsx`) */
const panelClass = "rounded-2xl border border-slate-200 bg-white shadow-sm";
const inputClassSlate =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-[#2E7BBF] focus:ring-2 focus:ring-[#2E7BBF]/20";

const labelClass = "mb-1 block text-xs font-medium text-slate-500";

interface EmployeeLookup {
  id: string;
  fullName: string;
  employeeCode: string;
  departmentId: string | null;
  departmentName: string | null;
}

interface OtNopayRow {
  employeeId: string;
  employeeName: string;
  employeeCode: string | null;
  totalWorkedHours: number;
  expectedHours: number;
  overtimeHours: number;
  nopayDays: number;
  nopayHours: number;
  lateDays: number;
  presentDays: number;
  absentDays: number;
  overtimeApprovalStatus?: string | null;
  overtimeApprovedAt?: string | null;
  overtimeApproverName?: string | null;
  approvedOvertimeHoursSnapshot?: number | null;
  overtimeHoursOutdated?: boolean;
}

function todayLocalIso(d = new Date()): string {
  return formatLocalDateToIso(d);
}

function FullScreenSpinner() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
    </div>
  );
}

function ApprovalsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading, isAdmin, hasPermission, getLeaveReadScope, hasRole } = useAuth();

  const canLeaveRead = isAdmin || getLeaveReadScope() != null || hasRole("SUPERVISOR");
  const canLeaveApprove = isAdmin || hasPermission("Leave", "Update");
  const canAttendanceRead = isAdmin || hasPermission("Attendance", "Read");
  const canAttendanceApprove = isAdmin || hasPermission("Attendance", "Update");

  const leaveScope = getLeaveReadScope();
  const isHrWideLeave = isAdmin || leaveScope === "All";
  const leaveTeamOnly = !isHrWideLeave && (leaveScope === "Team" || hasRole("SUPERVISOR"));

  const [tab, setTab] = useState<"leave" | "overtime">("leave");

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "overtime" && canAttendanceRead) {
      setTab("overtime");
      return;
    }
    if (t === "leave" && canLeaveRead) {
      setTab("leave");
      return;
    }
    if (canLeaveRead) setTab("leave");
    else if (canAttendanceRead) setTab("overtime");
  }, [searchParams, canLeaveRead, canAttendanceRead]);

  function selectTab(next: "leave" | "overtime") {
    setTab(next);
    router.replace(`/app/approvals?tab=${next}`, { scroll: false });
  }

  if (isLoading || !user) {
    return <FullScreenSpinner />;
  }

  if (!canLeaveRead && !canAttendanceRead) {
    return (
      <>
        <AppTopbar title="Approvals" subtitle="Leave and overtime sign-off." />
        <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          You do not have access to leave or attendance data. Ask an administrator to grant Leave and/or Time &amp;
          Attendance permissions.
        </div>
      </>
    );
  }

  return (
    <>
      <AppTopbar title="Approvals" subtitle="Review and approve leave requests and period overtime in one place." />

      <div className="mt-6 flex flex-wrap gap-1.5 rounded-2xl border border-slate-200 bg-slate-50/90 p-1.5 shadow-sm">
        {canLeaveRead && (
          <button
            type="button"
            onClick={() => selectTab("leave")}
            className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
              tab === "leave"
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/90"
                : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
            }`}
          >
            Leave
          </button>
        )}
        {canAttendanceRead && (
          <button
            type="button"
            onClick={() => selectTab("overtime")}
            className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
              tab === "overtime"
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/90"
                : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
            }`}
          >
            Overtime
          </button>
        )}
      </div>

      {tab === "leave" && canLeaveRead && (
        <LeaveRequestsPanel
          showApprovalActions={canLeaveApprove}
          teamOnly={leaveTeamOnly}
          isEmployeeView={false}
          currentEmployeeId={user.employeeId}
          sectionTitle="Leave requests"
          sectionSubtitle="All employees' leave requests. Filter by department, status, and dates as needed."
          hideApplyShortcut
        />
      )}

      {tab === "overtime" && canAttendanceRead && (
        <OvertimeApprovalsSection canApprove={canAttendanceApprove} />
      )}
    </>
  );
}

function OvertimeApprovalsSection({ canApprove }: { canApprove: boolean }) {
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [toDate, setToDate] = useState(() => todayLocalIso());
  const [deptFilter, setDeptFilter] = useState("");
  const empSearchFilter = useApplyFilter();
  const [employees, setEmployees] = useState<EmployeeLookup[]>([]);
  const [rawResults, setRawResults] = useState<OtNopayRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otModal, setOtModal] = useState<{ row: OtNopayRow; approve: boolean } | null>(null);
  const [otRemarks, setOtRemarks] = useState("");
  const [otBusyId, setOtBusyId] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ items: EmployeeLookup[] }>("/api/employees?pageSize=500&excludeTerminated=true")
      .then((r) => setEmployees(r.items ?? []))
      .catch(() => setEmployees([]));
  }, []);

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

  const empDept = useMemo(() => {
    const m = new Map<string, { deptId: string | null; name: string; code: string }>();
    for (const e of employees) {
      m.set(e.id, { deptId: e.departmentId, name: e.fullName, code: e.employeeCode ?? "" });
    }
    return m;
  }, [employees]);

  const calculate = useCallback(() => {
    if (!fromDate || !toDate) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ from: fromDate, to: toDate });
    apiFetch<OtNopayRow[]>(`/api/attendance/overtime-nopay?${params}`)
      .then(setRawResults)
      .catch((e) => setError(e instanceof Error ? e.message : "Calculation failed"))
      .finally(() => setLoading(false));
  }, [fromDate, toDate]);

  const filteredRows = useMemo(() => {
    const q = empSearchFilter.applied.toLowerCase();
    return rawResults.filter((r) => {
      const meta = empDept.get(r.employeeId);
      if (deptFilter && meta?.deptId !== deptFilter) return false;
      if (!q) return true;
      const name = (meta?.name ?? r.employeeName).toLowerCase();
      const code = (r.employeeCode ?? meta?.code ?? "").toLowerCase();
      return name.includes(q) || code.includes(q);
    });
  }, [rawResults, empSearchFilter.applied, deptFilter, empDept]);

  const rowsPager = useClientPagination(filteredRows, 15);

  async function submitOtApproval() {
    if (!otModal) return;
    const { row, approve } = otModal;
    setOtBusyId(row.employeeId);
    try {
      const path = approve ? "/api/attendance/overtime-nopay/approve" : "/api/attendance/overtime-nopay/reject";
      const params = new URLSearchParams({
        from: fromDate,
        to: toDate,
        employeeId: row.employeeId,
      });
      await apiFetch(`${path}?${params}`, {
        method: "POST",
        body: JSON.stringify({ remarks: otRemarks.trim() || null }),
      });
      setOtModal(null);
      setOtRemarks("");
      calculate();
    } catch (e) {
      await appAlert(e instanceof Error ? e.message : "Request failed", approve ? "Approve overtime" : "Reject overtime");
    } finally {
      setOtBusyId(null);
    }
  }

  function approvalLabel(row: OtNopayRow): string {
    const st = row.overtimeApprovalStatus;
    if (!st) return "—";
    if (row.overtimeHoursOutdated && st.toLowerCase() === "approved") return "Approved (outdated)";
    return st;
  }

  const canActOnOt = (row: OtNopayRow) => {
    if (!canApprove) return false;
    const st = (row.overtimeApprovalStatus ?? "").toLowerCase();
    if (!st || st === "rejected") return true;
    if (st === "approved" && row.overtimeHoursOutdated) return true;
    return false;
  };

  function otApprovalBadgeClass(label: string): string {
    const s = label.toLowerCase();
    if (s.includes("outdated")) return "badge badge-orange";
    if (s.includes("approved")) return "badge badge-green";
    if (s.includes("reject")) return "badge badge-red";
    return "badge badge-yellow";
  }

  return (
    <div className="mt-6 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-800">Overtime (period)</h2>
        <p className="mt-1 text-sm text-slate-500">
          Select a date range, then Calculate. Approve or reject overtime for each employee for that entire period
          (same rules as Time &amp; Attendance → OT / No-Pay).
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <label className={labelClass}>From</label>
          <DatePickerField value={fromDate} onChange={setFromDate} className={`${inputClassSlate} w-40`} />
        </div>
        <div>
          <label className={labelClass}>To</label>
          <DatePickerField value={toDate} onChange={setToDate} className={`${inputClassSlate} w-40`} />
        </div>
        <div className="w-48 shrink-0 sm:w-56">
          <label className={labelClass}>Department</label>
          <FormSelect
            value={deptFilter}
            onValueChange={setDeptFilter}
            options={departmentSelectOptions}
            placeholder="All departments"
          />
        </div>
        <div className="min-w-[180px] flex-1 sm:max-w-xs">
          <label className={labelClass}>Employee</label>
          <input
            type="search"
            value={empSearchFilter.input}
            onChange={(e) => empSearchFilter.setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") empSearchFilter.apply();
            }}
            placeholder="Type name or code… (Enter)"
            className={`${inputClassSlate} min-h-[42px]`}
          />
        </div>
        <div className="flex-1" />
        <Button type="button" onClick={() => calculate()} disabled={loading}>
          {loading ? "Calculating…" : "Calculate"}
        </Button>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 shadow-sm">{error}</div>
      )}

      <div className={`${panelClass} overflow-x-auto`}>
        <table className="hris-table min-w-[1100px]">
          <thead>
            <tr>
              <th>Employee</th>
              <th className="text-right">Present</th>
              <th className="text-right">Absent</th>
              <th className="text-right">Late</th>
              <th className="text-right">Expected Hrs</th>
              <th className="text-right">Worked Hrs</th>
              <th className="text-right">OT Hrs</th>
              <th className="text-right">No-Pay Days</th>
              <th className="text-right">No-Pay Hrs</th>
              <th>Approval</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
              {loading && (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-slate-400">
                    Calculating…
                  </td>
                </tr>
              )}
              {!loading && rawResults.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-slate-400">
                    No data. Select a date range and click Calculate.
                  </td>
                </tr>
              )}
              {!loading &&
                rawResults.length > 0 &&
                filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-4 py-10 text-center text-slate-400">
                      No rows match department or employee search.
                    </td>
                  </tr>
                )}
              {!loading &&
                rowsPager.pageItems.map((r) => (
                  <tr key={r.employeeId} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {r.employeeName}
                      {r.employeeCode ? <span className="ml-1 text-xs font-normal text-slate-400">({r.employeeCode})</span> : null}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-600">{r.presentDays}</td>
                    <td className="px-3 py-3 text-right text-red-600">{r.absentDays}</td>
                    <td className="px-3 py-3 text-right text-amber-600">{r.lateDays}</td>
                    <td className="px-3 py-3 text-right text-slate-600">{Number(r.expectedHours).toFixed(1)}</td>
                    <td className="px-3 py-3 text-right font-medium text-slate-700">{Number(r.totalWorkedHours).toFixed(1)}</td>
                    <td className="px-3 py-3 text-right font-medium text-blue-600">{Number(r.overtimeHours).toFixed(1)}</td>
                    <td className="px-3 py-3 text-right text-red-600">{r.nopayDays}</td>
                    <td className="px-3 py-3 text-right text-red-600">{Number(r.nopayHours).toFixed(1)}</td>
                    <td>
                      {(() => {
                        const lbl = approvalLabel(r);
                        return (
                          <div className="flex flex-col gap-1">
                            {lbl === "—" ? (
                              <span className="text-slate-500">—</span>
                            ) : (
                              <span className={otApprovalBadgeClass(lbl)}>{lbl}</span>
                            )}
                            {r.overtimeApproverName && (
                              <span className="text-xs text-slate-500">by {r.overtimeApproverName}</span>
                            )}
                            {r.overtimeApprovedAt && (
                              <span className="text-xs text-slate-500">{formatDate(r.overtimeApprovedAt)}</span>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="text-right">
                      {canActOnOt(r) ? (
                        <div className="flex flex-wrap justify-end gap-x-2 gap-y-1">
                          <button
                            type="button"
                            disabled={otBusyId === r.employeeId}
                            className="text-xs text-green-600 hover:underline disabled:opacity-50"
                            onClick={() => {
                              setOtModal({ row: r, approve: true });
                              setOtRemarks("");
                            }}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={otBusyId === r.employeeId}
                            className="text-xs text-rose-600 hover:underline disabled:opacity-50"
                            onClick={() => {
                              setOtModal({ row: r, approve: false });
                              setOtRemarks("");
                            }}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        <TablePagination page={rowsPager.page} totalPages={rowsPager.totalPages} totalCount={rowsPager.totalCount} pageSize={rowsPager.pageSize} onPageChange={rowsPager.setPage} />
      </div>

      {!canApprove && (
        <p className="text-sm text-slate-500">
          You can view overtime totals here. Approving requires Time &amp; Attendance <strong>Update</strong> permission
          and a user profile linked to an employee record.
        </p>
      )}

      <Modal
        open={!!otModal}
        onClose={() => {
          if (otBusyId) return;
          setOtModal(null);
          setOtRemarks("");
        }}
        title={otModal?.approve ? "Approve overtime" : "Reject overtime"}
        wide
      >
        {otModal && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              <span className="font-medium text-slate-800">{otModal.row.employeeName}</span> — {fromDate} to {toDate}. OT
              hours: <span className="font-semibold text-blue-700">{Number(otModal.row.overtimeHours).toFixed(1)}</span>
            </p>
            <div>
              <label className={labelClass}>Remarks (optional)</label>
              <textarea
                value={otRemarks}
                onChange={(e) => setOtRemarks(e.target.value)}
                rows={3}
                className={inputClassSlate}
                placeholder="Optional note stored with this decision…"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                disabled={!!otBusyId}
                onClick={() => {
                  setOtModal(null);
                  setOtRemarks("");
                }}
              >
                Cancel
              </Button>
              <Button type="button" disabled={!!otBusyId} onClick={() => void submitOtApproval()}>
                {otBusyId ? "Saving…" : otModal.approve ? "Confirm approve" : "Confirm reject"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default function ApprovalsPage() {
  return (
    <Suspense fallback={<FullScreenSpinner />}>
      <ApprovalsInner />
    </Suspense>
  );
}
