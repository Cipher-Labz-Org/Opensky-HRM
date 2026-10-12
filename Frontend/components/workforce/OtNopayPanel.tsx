"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { DatePickerField, TablePagination, InlinePageAlert } from "@/components/ui";
import { Modal } from "@/components/ui/Modal";
import { EmployeeSearchCombobox } from "@/components/workforce/EmployeeSearchCombobox";
import { apiFetch } from "@/lib/api";
import { formatBusinessTime, formatDate } from "@/lib/date-utils";
import {
  canActOnOtRow,
  fmtHours,
  fmtOtHours,
  hasOtHours,
  otStatusBadgeClass,
  otStatusLabel,
  resolveOtStatus,
  type OtNopayDay,
  type OtNopayRow,
} from "@/lib/ot-approval";
import { formatLocalDateToIso, applyFromDateInRange, applyToDateInRange, isValidIsoDateRange } from "@/lib/datePickerIso";
import { useClientPagination } from "@/lib/use-client-pagination";
import { appAlert } from "@/components/ui/appDialogs";
import { useAuth } from "@/contexts/auth-context";

const labelClass = "mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500";
const inputClass =
  "w-full h-[42px] rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-[#2E7BBF] focus:ring-2 focus:ring-[#2E7BBF]/20";

const STATUS_CHIPS: { value: string; label: string; active: string }[] = [
  { value: "", label: "All", active: "border-slate-300 bg-slate-800 text-white" },
  { value: "PendingApproval", label: "Pending Approval", active: "border-amber-300 bg-amber-50 text-amber-800" },
  { value: "Approved", label: "Approved", active: "border-emerald-300 bg-emerald-50 text-emerald-800" },
  { value: "Rejected", label: "Rejected", active: "border-rose-300 bg-rose-50 text-rose-800" },
  { value: "NoOt", label: "No OT", active: "border-slate-300 bg-slate-100 text-slate-700" },
  { value: "SupervisorNotAssigned", label: "Supervisor Not Assigned", active: "border-orange-300 bg-orange-50 text-orange-800" },
];

function employeeInitials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function OtValue({
  value,
  emphasize = false,
}: {
  value: number | undefined | null;
  emphasize?: boolean;
}) {
  const text = fmtOtHours(value);
  if (text === "—") return <span className="text-slate-300">—</span>;
  if (!emphasize) return <span className="font-medium tabular-nums text-[#1a5f94]">{text}</span>;
  return (
    <span className="inline-flex min-w-[2.75rem] justify-end rounded-md bg-[#e8f4fc] px-2 py-0.5 text-xs font-semibold tabular-nums text-[#157fb8]">
      {text}
    </span>
  );
}

function monthStartIso(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function todayLocalIso(d = new Date()): string {
  return formatLocalDateToIso(d);
}

function prevMonthRange(): { from: string; to: string } {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  const from = monthStartIso(d);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { from, to: formatLocalDateToIso(last) };
}

export function OtNopayPanel({
  embedded = false,
  teamOnly: teamOnlyProp,
}: {
  embedded?: boolean;
  teamOnly?: boolean;
}) {
  const { user, isAdmin, hasRole } = useAuth();
  const teamOnly = teamOnlyProp ?? embedded;
  const hrCanApprove =
    isAdmin ||
    hasRole("HR_MANAGER") ||
    (user?.permissions.some(
      (p) =>
        (p.module === "Attendance" || p.module === "People") &&
        p.action === "Update" &&
        (p.scope ?? "Own") === "All",
    ) ?? false);
  const [results, setResults] = useState<OtNopayRow[]>([]);
  const [fromDate, setFromDate] = useState(() => monthStartIso());
  const [toDate, setToDate] = useState(() => todayLocalIso());
  const [filterEmployee, setFilterEmployee] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [otModal, setOtModal] = useState<{ row: OtNopayRow; approve: boolean } | null>(null);
  const [otRemarks, setOtRemarks] = useState("");
  const [otRemarkError, setOtRemarkError] = useState<string | null>(null);
  const [otBusyId, setOtBusyId] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [resultsView, setResultsView] = useState<"summary" | "detail">("summary");
  const [dayRows, setDayRows] = useState<OtNopayDay[]>([]);
  const [dayLoading, setDayLoading] = useState(false);
  const [dayError, setDayError] = useState<string | null>(null);
  const [hasDayLoaded, setHasDayLoaded] = useState(false);

  const calculate = useCallback(() => {
    if (!fromDate || !toDate) return;
    if (!isValidIsoDateRange(fromDate, toDate)) {
      setError("From date cannot be after to date.");
      return;
    }
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ from: fromDate, to: toDate });
    if (filterEmployee) params.set("employeeId", filterEmployee);
    if (teamOnly) params.set("teamOnly", "true");
    if (embedded) params.set("forApprovals", "true");
    const endpoint = `/api/attendance/overtime-nopay?${params}`;

    const load = (attempt: number) => {
      apiFetch<OtNopayRow[]>(endpoint)
        .then((rows) => {
          setResults(rows ?? []);
          setHasLoaded(true);
          setLoading(false);
        })
        .catch((e) => {
          const msg = e instanceof Error ? e.message : "Calculation failed";
          const transient = /unavailable|internal server error|cannot reach api|timed out/i.test(msg);
          if (transient && attempt < 1) {
            window.setTimeout(() => load(attempt + 1), 1200);
            return;
          }
          setError(msg);
          setLoading(false);
        });
    };

    load(0);
  }, [fromDate, toDate, filterEmployee, teamOnly, embedded]);

  const loadDays = useCallback(() => {
    if (!fromDate || !toDate) return;
    if (!isValidIsoDateRange(fromDate, toDate)) return;
    setDayLoading(true);
    setDayError(null);
    const params = new URLSearchParams({ from: fromDate, to: toDate });
    if (filterEmployee) params.set("employeeId", filterEmployee);
    if (teamOnly) params.set("teamOnly", "true");
    if (embedded) params.set("forApprovals", "true");
    apiFetch<OtNopayDay[]>(`/api/attendance/overtime-nopay/days?${params}`)
      .then((rows) => {
        setDayRows(rows ?? []);
        setHasDayLoaded(true);
        setDayLoading(false);
      })
      .catch((e) => {
        setDayError(e instanceof Error ? e.message : "Could not load OT detail");
        setDayLoading(false);
      });
  }, [fromDate, toDate, filterEmployee, teamOnly, embedded]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      calculate();
      loadDays();
    }, 150);
    return () => window.clearTimeout(timer);
  }, [calculate, loadDays]);

  const teamResults = useMemo(() => {
    const ownId = (user?.employeeId ?? "").toLowerCase();
    return results.filter((r) => {
      const id = (r.employeeId ?? "").toLowerCase();
      if (!id) return false;
      if (ownId && id === ownId) return false;
      if (!hasOtHours(r) || resolveOtStatus(r) === "NoOt") return false;
      if (r.canApprove) return true;
      const status = resolveOtStatus(r);
      if (status === "SupervisorNotAssigned" || r.hasSupervisor === false) return false;
      if (ownId && (r.supervisorId ?? "").toLowerCase() === ownId) return true;
      return false;
    });
  }, [results, user?.employeeId]);

  const otResults = useMemo(() => {
    if (teamOnly) return teamResults;
    return results.filter((r) => hasOtHours(r) && resolveOtStatus(r) !== "NoOt");
  }, [results, teamResults, teamOnly]);

  const filteredResults = useMemo(() => {
    return otResults.filter((r) => {
      if (statusFilter && resolveOtStatus(r) !== statusFilter) return false;
      return true;
    });
  }, [otResults, statusFilter]);

  const resultsPager = useClientPagination(filteredResults, 15);

  const otEmployeeIds = useMemo(
    () => new Set(filteredResults.map((r) => (r.employeeId ?? "").toLowerCase()).filter(Boolean)),
    [filteredResults],
  );

  const filteredDays = useMemo(
    () => dayRows.filter((d) => otEmployeeIds.has((d.employeeId ?? "").toLowerCase())),
    [dayRows, otEmployeeIds],
  );

  const daysPager = useClientPagination(filteredDays, 20);

  const dayTotals = useMemo(
    () =>
      filteredDays.reduce(
        (acc, d) => ({
          expected: acc.expected + d.expectedHours,
          worked: acc.worked + d.workedHours,
          preOt: acc.preOt + d.preOtHours,
          postOt: acc.postOt + d.postOtHours,
          ot: acc.ot + d.overtimeHours,
        }),
        { expected: 0, worked: 0, preOt: 0, postOt: 0, ot: 0 },
      ),
    [filteredDays],
  );

  const totals = useMemo(
    () =>
      filteredResults.reduce(
        (acc, r) => ({
          worked: acc.worked + r.totalWorkedHours,
          expected: acc.expected + r.expectedHours,
          preOt: acc.preOt + (r.preOtHours ?? 0),
          postOt: acc.postOt + (r.postOtHours ?? 0),
          ot: acc.ot + r.overtimeHours,
          nopayDays: acc.nopayDays + r.nopayDays,
          nopayHours: acc.nopayHours + r.nopayHours,
          present: acc.present + r.presentDays,
          absent: acc.absent + r.absentDays,
          late: acc.late + r.lateDays,
        }),
        { worked: 0, expected: 0, preOt: 0, postOt: 0, ot: 0, nopayDays: 0, nopayHours: 0, present: 0, absent: 0, late: 0 },
      ),
    [filteredResults],
  );

  const summary = useMemo(() => {
    const pending = otResults.filter((r) => resolveOtStatus(r) === "PendingApproval").length;
    const approved = otResults.filter((r) => resolveOtStatus(r) === "Approved");
    const noSupervisor = otResults.filter((r) => resolveOtStatus(r) === "SupervisorNotAssigned").length;
    const withNopay = otResults.filter((r) => r.nopayDays > 0 || r.nopayHours > 0).length;
    const approvedHours = approved.reduce((sum, r) => sum + (r.approvedOvertimeHoursSnapshot ?? r.overtimeHours), 0);
    return {
      total: otResults.length,
      pending,
      noSupervisor,
      withNopay,
      approvedHours,
      approvedCount: approved.length,
    };
  }, [otResults]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      "": otResults.length,
      PendingApproval: 0,
      Approved: 0,
      Rejected: 0,
      NoOt: 0,
      SupervisorNotAssigned: 0,
    };
    for (const row of otResults) {
      const status = resolveOtStatus(row);
      counts[status] = (counts[status] ?? 0) + 1;
    }
    return counts;
  }, [otResults]);

  function onOtFromDateChange(v: string) {
    const { from, to } = applyFromDateInRange(v, toDate);
    setFromDate(from);
    setToDate(to);
  }

  function onOtToDateChange(v: string) {
    const { from, to } = applyToDateInRange(fromDate, v);
    setFromDate(from);
    setToDate(to);
  }

  function applyThisMonth() {
    setFromDate(monthStartIso());
    setToDate(todayLocalIso());
  }

  function applyLastMonth() {
    const { from, to } = prevMonthRange();
    setFromDate(from);
    setToDate(to);
  }

  async function submitOtApproval() {
    if (!otModal) return;
    const { row, approve } = otModal;
    if (!approve && !otRemarks.trim()) {
      setOtRemarkError("A reason is required to reject overtime.");
      return;
    }
    setOtRemarkError(null);
    setOtBusyId(row.employeeId);
    try {
      const path = approve ? "/api/attendance/overtime-nopay/approve" : "/api/attendance/overtime-nopay/reject";
      const params = new URLSearchParams({
        from: fromDate,
        to: toDate,
        employeeId: row.employeeId,
      });
      if (teamOnly) params.set("teamOnly", "true");
      if (embedded) params.set("forApprovals", "true");
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

  const showActions = useMemo(
    () => filteredResults.some((r) => canActOnOtRow(r, { hrCanApprove, ownEmployeeId: user?.employeeId })),
    [filteredResults, hrCanApprove, user?.employeeId],
  );
  const summaryColSpan = showActions ? 13 : 12;

  const kpis = [
    { label: "Employees", value: String(summary.total), hint: teamOnly ? "Your team with overtime" : "With overtime", tone: "text-slate-800", accent: "border-slate-200" },
    { label: "Pending approval", value: String(summary.pending), hint: teamOnly ? "Awaiting supervisor" : "Awaiting supervisor or HR", tone: "text-amber-700", accent: "border-amber-200" },
    { label: "Approved OT hours", value: fmtOtHours(summary.approvedHours), hint: `${summary.approvedCount} employee(s) · payroll`, tone: "text-emerald-700", accent: "border-emerald-200" },
    ...(!teamOnly
      ? [{ label: "Supervisor not assigned", value: String(summary.noSupervisor), hint: teamOnly ? "Cannot be approved" : "HR can approve", tone: "text-orange-700", accent: "border-orange-200" }]
      : []),
    { label: "With no-pay", value: String(summary.withNopay), hint: "Absence vs expected hours", tone: "text-rose-700", accent: "border-rose-200" },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
          <div>
            <h2 className={embedded ? "text-base font-semibold tracking-tight text-slate-900" : "text-[17px] font-semibold tracking-tight text-slate-900"}>
              Overtime &amp; No-Pay
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {teamOnly
                ? "Your team's overtime. Approve or reject as the employee's supervisor or a higher-level supervisor."
                : embedded
                  ? "Company overtime. Approve or reject as the employee's supervisor, or as HR if the supervisor has not approved."
                  : "Only employees with overtime are listed. Supervisor or HR approval required; only approved OT is included in payroll."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowRules((open) => !open)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
            aria-expanded={showRules}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#2E7BBF]" aria-hidden>
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            How OT is calculated
          </button>
        </div>

        {showRules && (
          <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3 text-xs leading-5 text-slate-600 sm:px-5">
            Period OT hours = Pre-OT + Post-OT (time before shift start and after shift end).
            Flexi and Open shifts have no Pre/Post OT. Approved leave and off days are excluded.
            Calculated OT stays pending until the employee&apos;s supervisor or HR approves or rejects it.
          </div>
        )}

        <div className="space-y-4 px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
            <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className={labelClass}>From</label>
                <DatePickerField value={fromDate} onChange={onOtFromDateChange} max={toDate || undefined} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>To</label>
                <DatePickerField value={toDate} onChange={onOtToDateChange} min={fromDate || undefined} className={inputClass} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Employee</label>
                <EmployeeSearchCombobox
                  value={filterEmployee}
                  onPick={(emp) => setFilterEmployee(emp?.id ?? "")}
                  placeholder="All employees"
                  allowClear
                />
              </div>
            </div>
            <div className="flex h-[42px] shrink-0 items-center gap-2">
              <div className="inline-flex overflow-hidden rounded-lg border border-slate-200 bg-white">
                <button
                  type="button"
                  onClick={applyThisMonth}
                  className="h-[42px] px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  This month
                </button>
                <span className="h-full w-px bg-slate-200" aria-hidden />
                <button
                  type="button"
                  onClick={applyLastMonth}
                  className="h-[42px] px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Last month
                </button>
              </div>
              <Button type="button" onClick={calculate} disabled={loading} className="h-[42px] px-4">
                {loading ? "Calculating…" : "Refresh"}
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 pt-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-1.5">
              {STATUS_CHIPS.filter((chip) => {
                if (chip.value === "NoOt") return false;
                if (chip.value === "SupervisorNotAssigned" && teamOnly) return false;
                return true;
              }).map((chip) => {
                const selected = statusFilter === chip.value;
                const count = hasLoaded ? statusCounts[chip.value] ?? 0 : null;
                return (
                  <button
                    key={chip.value || "all"}
                    type="button"
                    onClick={() => setStatusFilter(chip.value)}
                    className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold transition ${
                      selected
                        ? chip.active
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {chip.label}
                    {count != null && (
                      <span className={`tabular-nums ${selected ? "opacity-80" : "text-slate-400"}`}>{count}</span>
                    )}
                  </button>
                );
              })}
            </div>
            {hasLoaded && !loading && (
              <span className="text-xs text-slate-400">
                {filteredResults.length} employee{filteredResults.length === 1 ? "" : "s"} with OT
              </span>
            )}
          </div>
        </div>
      </div>

      <InlinePageAlert message={error} />

      {loading && !hasLoaded && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[92px] animate-pulse rounded-2xl border border-slate-200 bg-slate-50" />
          ))}
        </div>
      )}

      {hasLoaded && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {kpis.map((kpi) => (
            <div key={kpi.label} className={`rounded-2xl border bg-white px-4 py-3.5 shadow-sm ${kpi.accent}`}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{kpi.label}</p>
              <p className={`mt-1 text-2xl font-semibold tabular-nums ${kpi.tone}`}>{loading ? "…" : kpi.value}</p>
              <p className="mt-0.5 text-xs text-slate-400">{kpi.hint}</p>
            </div>
          ))}
        </div>
      )}

      {hasLoaded && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">View</span>
          <button
            type="button"
            aria-pressed={resultsView === "summary"}
            onClick={() => setResultsView("summary")}
            className={`inline-flex h-9 items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold transition ${
              resultsView === "summary"
                ? "border-slate-300 bg-white text-slate-900 shadow-sm"
                : "border-slate-200/90 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white"
            }`}
          >
            Summary
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
              resultsView === "summary" ? "bg-[#e8f4fc] text-[#157fb8]" : "bg-slate-200/80 text-slate-500"
            }`}>
              {filteredResults.length}
            </span>
          </button>
          <button
            type="button"
            aria-pressed={resultsView === "detail"}
            onClick={() => setResultsView("detail")}
            className={`inline-flex h-9 items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold transition ${
              resultsView === "detail"
                ? "border-slate-300 bg-white text-slate-900 shadow-sm"
                : "border-slate-200/90 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white"
            }`}
          >
            Detail
            {hasDayLoaded && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                resultsView === "detail" ? "bg-[#e8f4fc] text-[#157fb8]" : "bg-slate-200/80 text-slate-500"
              }`}>
                {filteredDays.length}
              </span>
            )}
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">{resultsView === "detail" ? "OT detail" : "OT summary"}</h3>
            <p className="text-xs text-slate-500">
              {resultsView === "detail"
                ? "Daily overtime that makes up the period totals."
                : teamOnly
                  ? "Period totals. Approve or reject as the employee's supervisor."
                  : embedded
                    ? "Period totals. Approve as supervisor, or as HR if the supervisor has not approved."
                    : "Period totals per employee. Only approved OT is included in payroll."}
            </p>
          </div>
        </div>
        {resultsView === "summary" ? (
        <>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-left">
                <th rowSpan={2} className="sticky left-0 z-10 border-b border-slate-200 bg-slate-50/80 px-4 py-2.5 align-bottom text-[11px] font-semibold uppercase tracking-wide text-slate-500">Employee</th>
                <th rowSpan={2} className="border-b border-slate-200 px-3 py-2.5 align-bottom text-[11px] font-semibold uppercase tracking-wide text-slate-500">Status</th>
                <th colSpan={3} className="border-b border-l border-slate-200 px-3 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Attendance</th>
                <th colSpan={2} className="border-b border-l border-slate-200 px-3 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Hours</th>
                <th colSpan={3} className="border-b border-l border-slate-200 bg-[#f3f9fd] px-3 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-[#1a5f94]">Overtime</th>
                <th colSpan={2} className="border-b border-l border-slate-200 px-3 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">No-pay</th>
                {showActions && (
                  <th rowSpan={2} className="border-b border-l border-slate-200 px-3 py-2.5 text-right align-bottom text-[11px] font-semibold uppercase tracking-wide text-slate-500">Actions</th>
                )}
              </tr>
              <tr className="bg-slate-50/80 text-left">
                <th className="border-l border-slate-200 px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500" title="Days with Present, Late, or Half Day">Present</th>
                <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Absent</th>
                <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Late</th>
                <th className="border-l border-slate-200 px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Expected</th>
                <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Worked</th>
                <th className="border-l border-slate-200 bg-[#f3f9fd] px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-[#1a5f94]" title="Before shift start">Pre</th>
                <th className="bg-[#f3f9fd] px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-[#1a5f94]" title="After shift end">Post</th>
                <th className="bg-[#f3f9fd] px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-[#1a5f94]">Total</th>
                <th className="border-l border-slate-200 px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Days</th>
                <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Hours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && !hasLoaded && (
                <tr>
                  <td colSpan={summaryColSpan} className="px-4 py-14 text-center">
                    <div className="inline-flex items-center gap-3 text-sm text-slate-500">
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-[#2E7BBF]" />
                      Calculating overtime and no-pay…
                    </div>
                  </td>
                </tr>
              )}
              {!hasLoaded && error && (
                <tr>
                  <td colSpan={summaryColSpan} className="px-4 py-14 text-center text-sm text-slate-500">
                    Could not load overtime and no-pay. Click Refresh to try again.
                  </td>
                </tr>
              )}
              {hasLoaded && filteredResults.length === 0 && (
                <tr>
                  <td colSpan={summaryColSpan} className="p-0">
                    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#e8f4fc] text-[#2E7BBF]">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                          <circle cx="12" cy="12" r="9" />
                          <path d="M12 7v5l3 2" strokeLinecap="round" />
                        </svg>
                      </div>
                      <p className="text-sm font-semibold text-slate-800">
                        {otResults.length === 0
                          ? teamOnly
                            ? "No team overtime in this period"
                            : "No overtime in this period"
                          : "No rows match the current filters"}
                      </p>
                      <p className="mt-1 max-w-sm text-xs text-slate-400">
                        Adjust the date range, employee, or status filter and refresh.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
              {hasLoaded &&
                resultsPager.pageItems.map((r) => {
                  const status = resolveOtStatus(r);
                  const pending = status === "PendingApproval";
                  const missingSupervisor = status === "SupervisorNotAssigned";
                  const rowBg = pending ? "bg-amber-50/30" : missingSupervisor ? "bg-orange-50/20" : "bg-white";
                  return (
                    <tr key={r.employeeId} className={`hover:bg-slate-50/80 ${pending ? "bg-amber-50/30" : missingSupervisor ? "bg-orange-50/20" : ""}`}>
                      <td className={`sticky left-0 z-10 px-4 py-3 ${rowBg}`}>
                        <div className="flex min-w-[14rem] items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#2E7BBF] to-[#1a5f94] text-[11px] font-bold text-white">
                            {employeeInitials(r.employeeName)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-800">{r.employeeName || r.employeeCode || "Employee"}</p>
                            <p className="truncate text-xs text-slate-400">
                              {[r.employeeCode, r.departmentName].filter(Boolean).join(" · ") || "—"}
                            </p>
                            {r.supervisorName ? (
                              <p className="mt-0.5 truncate text-[11px] text-slate-400">Supervisor · {r.supervisorName}</p>
                            ) : missingSupervisor ? (
                              <p className="mt-0.5 text-[11px] text-orange-600">No supervisor assigned</p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 align-middle">
                        <div className="flex flex-col gap-1">
                          <span className={otStatusBadgeClass(r)}>{otStatusLabel(r)}</span>
                          {r.overtimeApproverName && (status === "Approved" || status === "Rejected") && (
                            <span className="text-[11px] text-slate-400">
                              by {r.overtimeApproverName}
                              {r.overtimeApprovedAt ? ` · ${formatDate(r.overtimeApprovedAt)}` : ""}
                            </span>
                          )}
                          {status === "Rejected" && r.remarks && (
                            <span className="max-w-[14rem] text-[11px] leading-4 text-slate-500" title={r.remarks}>
                              {r.remarks}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="border-l border-slate-100 px-3 py-3 text-right tabular-nums text-slate-700">{r.presentDays}</td>
                      <td className={`px-3 py-3 text-right tabular-nums ${r.absentDays > 0 ? "font-medium text-rose-600" : "text-slate-300"}`}>
                        {r.absentDays > 0 ? r.absentDays : "—"}
                      </td>
                      <td className={`px-3 py-3 text-right tabular-nums ${r.lateDays > 0 ? "font-medium text-amber-600" : "text-slate-300"}`}>
                        {r.lateDays > 0 ? r.lateDays : "—"}
                      </td>
                      <td className="border-l border-slate-100 px-3 py-3 text-right tabular-nums text-slate-600">{fmtHours(r.expectedHours)}</td>
                      <td className="px-3 py-3 text-right font-medium tabular-nums text-slate-800">{fmtHours(r.totalWorkedHours)}</td>
                      <td className="border-l border-slate-100 bg-[#f8fbfe] px-3 py-3 text-right"><OtValue value={r.preOtHours} /></td>
                      <td className="bg-[#f8fbfe] px-3 py-3 text-right"><OtValue value={r.postOtHours} /></td>
                      <td className="bg-[#f8fbfe] px-3 py-3 text-right"><OtValue value={r.overtimeHours} emphasize /></td>
                      <td className={`border-l border-slate-100 px-3 py-3 text-right tabular-nums ${r.nopayDays > 0 ? "font-medium text-rose-600" : "text-slate-300"}`}>
                        {r.nopayDays > 0 ? r.nopayDays : "—"}
                      </td>
                      <td className={`px-3 py-3 text-right tabular-nums ${r.nopayHours > 0 ? "font-medium text-rose-600" : "text-slate-300"}`}>
                        {fmtOtHours(r.nopayHours)}
                      </td>
                      {showActions && (
                        <td className="border-l border-slate-100 px-3 py-3 text-right">
                          {canActOnOtRow(r, { hrCanApprove, ownEmployeeId: user?.employeeId }) ? (
                            <div className="flex flex-wrap justify-end gap-1.5">
                              <button
                                type="button"
                                disabled={otBusyId === r.employeeId}
                                className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                                onClick={() => {
                                  setOtModal({ row: r, approve: true });
                                  setOtRemarks("");
                                  setOtRemarkError(null);
                                }}
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                disabled={otBusyId === r.employeeId}
                                className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                                onClick={() => {
                                  setOtModal({ row: r, approve: false });
                                  setOtRemarks("");
                                  setOtRemarkError(null);
                                }}
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
            </tbody>
            {!hasLoaded || filteredResults.length === 0 ? null : (
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50 font-semibold">
                  <td className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-slate-700">
                    Totals
                    <span className="ml-1.5 font-normal text-slate-400">({filteredResults.length})</span>
                  </td>
                  <td className="px-3 py-3" />
                  <td className="border-l border-slate-200 px-3 py-3 text-right tabular-nums text-slate-700">{totals.present}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-rose-600">{totals.absent > 0 ? totals.absent : "—"}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-amber-600">{totals.late > 0 ? totals.late : "—"}</td>
                  <td className="border-l border-slate-200 px-3 py-3 text-right tabular-nums text-slate-700">{fmtHours(totals.expected)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-700">{fmtHours(totals.worked)}</td>
                  <td className="border-l border-slate-200 bg-[#f3f9fd] px-3 py-3 text-right tabular-nums text-[#1a5f94]">{fmtOtHours(totals.preOt)}</td>
                  <td className="bg-[#f3f9fd] px-3 py-3 text-right tabular-nums text-[#1a5f94]">{fmtOtHours(totals.postOt)}</td>
                  <td className="bg-[#f3f9fd] px-3 py-3 text-right tabular-nums text-[#1a5f94]">{fmtOtHours(totals.ot)}</td>
                  <td className="border-l border-slate-200 px-3 py-3 text-right tabular-nums text-rose-600">{totals.nopayDays > 0 ? totals.nopayDays : "—"}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-rose-600">{fmtOtHours(totals.nopayHours)}</td>
                  {showActions && <td className="border-l border-slate-200" />}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <TablePagination
          page={resultsPager.page}
          totalPages={resultsPager.totalPages}
          totalCount={resultsPager.totalCount}
          pageSize={resultsPager.pageSize}
          onPageChange={resultsPager.setPage}
        />
        </>
        ) : (
        <>
        <InlinePageAlert message={dayError} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-left">
                <th rowSpan={2} className="sticky left-0 z-10 border-b border-slate-200 bg-slate-50/80 px-4 py-2.5 align-bottom text-[11px] font-semibold uppercase tracking-wide text-slate-500">Employee</th>
                <th colSpan={4} className="border-b border-l border-slate-200 px-3 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Day</th>
                <th colSpan={2} className="border-b border-l border-slate-200 px-3 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Hours</th>
                <th colSpan={3} className="border-b border-l border-slate-200 bg-[#f3f9fd] px-3 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-[#1a5f94]">Overtime</th>
              </tr>
              <tr className="bg-slate-50/80 text-left">
                <th className="border-l border-slate-200 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Date</th>
                <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Shift</th>
                <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">In</th>
                <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Out</th>
                <th className="border-l border-slate-200 px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Expected</th>
                <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Worked</th>
                <th className="border-l border-slate-200 bg-[#f3f9fd] px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-[#1a5f94]">Pre</th>
                <th className="bg-[#f3f9fd] px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-[#1a5f94]">Post</th>
                <th className="bg-[#f3f9fd] px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-[#1a5f94]">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dayLoading && !hasDayLoaded && (
                <tr>
                  <td colSpan={10} className="px-4 py-14 text-center">
                    <div className="inline-flex items-center gap-3 text-sm text-slate-500">
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-[#2E7BBF]" />
                      Loading OT days…
                    </div>
                  </td>
                </tr>
              )}
              {hasDayLoaded && filteredDays.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-0">
                    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#e8f4fc] text-[#2E7BBF]">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                          <rect x="3" y="4" width="18" height="18" rx="2" />
                          <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
                        </svg>
                      </div>
                      <p className="text-sm font-semibold text-slate-800">No overtime days in this period</p>
                      <p className="mt-1 max-w-sm text-xs text-slate-400">Days appear here when Pre-OT or Post-OT is greater than zero.</p>
                    </div>
                  </td>
                </tr>
              )}
              {hasDayLoaded &&
                daysPager.pageItems.map((d, index) => {
                  const prev = daysPager.pageItems[index - 1];
                  const showEmployee = !prev || prev.employeeId !== d.employeeId;
                  return (
                    <tr key={`${d.employeeId}-${d.date}`} className="hover:bg-slate-50/70">
                      <td className="sticky left-0 z-10 bg-white px-4 py-3">
                        {showEmployee ? (
                          <div className="flex min-w-[14rem] items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#2E7BBF] to-[#1a5f94] text-[11px] font-bold text-white">
                              {employeeInitials(d.employeeName)}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-slate-800">{d.employeeName || d.employeeCode || "Employee"}</p>
                              <p className="truncate text-xs text-slate-400">
                                {[d.employeeCode, d.departmentName].filter(Boolean).join(" · ") || "—"}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <span className="sr-only">{d.employeeName}</span>
                        )}
                      </td>
                      <td className="border-l border-slate-100 px-3 py-3 text-slate-700">{formatDate(d.date)}</td>
                      <td className="px-3 py-3 text-slate-600">{d.shiftName || "—"}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-600">{formatBusinessTime(d.punchIn)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-600">{formatBusinessTime(d.punchOut)}</td>
                      <td className="border-l border-slate-100 px-3 py-3 text-right tabular-nums text-slate-600">{fmtHours(d.expectedHours)}</td>
                      <td className="px-3 py-3 text-right font-medium tabular-nums text-slate-800">{fmtHours(d.workedHours)}</td>
                      <td className="border-l border-slate-100 bg-[#f8fbfe] px-3 py-3 text-right"><OtValue value={d.preOtHours} /></td>
                      <td className="bg-[#f8fbfe] px-3 py-3 text-right"><OtValue value={d.postOtHours} /></td>
                      <td className="bg-[#f8fbfe] px-3 py-3 text-right"><OtValue value={d.overtimeHours} emphasize /></td>
                    </tr>
                  );
                })}
            </tbody>
            {hasDayLoaded && filteredDays.length > 0 && (
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50 font-semibold">
                  <td className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-slate-700">
                    Totals
                    <span className="ml-1.5 font-normal text-slate-400">({filteredDays.length} days)</span>
                  </td>
                  <td className="border-l border-slate-200 px-3 py-3" colSpan={4} />
                  <td className="border-l border-slate-200 px-3 py-3 text-right tabular-nums text-slate-700">{fmtHours(dayTotals.expected)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-700">{fmtHours(dayTotals.worked)}</td>
                  <td className="border-l border-slate-200 bg-[#f3f9fd] px-3 py-3 text-right tabular-nums text-[#1a5f94]">{fmtOtHours(dayTotals.preOt)}</td>
                  <td className="bg-[#f3f9fd] px-3 py-3 text-right tabular-nums text-[#1a5f94]">{fmtOtHours(dayTotals.postOt)}</td>
                  <td className="bg-[#f3f9fd] px-3 py-3 text-right tabular-nums text-[#1a5f94]">{fmtOtHours(dayTotals.ot)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <TablePagination
          page={daysPager.page}
          totalPages={daysPager.totalPages}
          totalCount={daysPager.totalCount}
          pageSize={daysPager.pageSize}
          onPageChange={daysPager.setPage}
        />
        </>
        )}
      </div>

      <Modal
        open={!!otModal}
        onClose={() => {
          if (otBusyId) return;
          setOtModal(null);
          setOtRemarks("");
          setOtRemarkError(null);
        }}
        title={otModal?.approve ? "Approve overtime" : "Reject overtime"}
      >
        {otModal && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <p className="font-semibold text-slate-800">{otModal.row.employeeName}</p>
              <p className="mt-1">
                {fromDate} to {toDate} · OT hours{" "}
                <span className="font-semibold text-[#1a5f94]">{fmtHours(otModal.row.overtimeHours)}</span>
              </p>
              {otModal.row.supervisorName && (
                <p className="mt-1 text-xs text-slate-500">Supervisor: {otModal.row.supervisorName}</p>
              )}
              {embedded && !teamOnly && (
                <p className="mt-2 text-xs text-slate-500">
                  You can {otModal.approve ? "approve" : "reject"} this overtime as HR if the supervisor has not.
                </p>
              )}
            </div>
            <div>
              <label className={labelClass}>
                {otModal.approve ? "Remarks (optional)" : "Rejection reason *"}
              </label>
              <textarea
                value={otRemarks}
                onChange={(e) => {
                  setOtRemarks(e.target.value);
                  if (otRemarkError) setOtRemarkError(null);
                }}
                rows={3}
                className={inputClass}
                placeholder={otModal.approve ? "Optional note stored with this approval…" : "Explain why this overtime is rejected…"}
              />
              {otRemarkError && <p className="mt-1 text-xs text-rose-600">{otRemarkError}</p>}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                disabled={!!otBusyId}
                onClick={() => {
                  setOtModal(null);
                  setOtRemarks("");
                  setOtRemarkError(null);
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
