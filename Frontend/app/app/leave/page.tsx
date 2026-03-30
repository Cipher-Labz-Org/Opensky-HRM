"use client";

import { useState, useEffect, useRef, useCallback, type FormEvent } from "react";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { DatePickerField } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { API_BASE_URL } from "@/config/constants";
import { formatDate } from "@/lib/date-utils";
import { useAuth } from "@/contexts/auth-context";

// ──────────────────────────── Types ────────────────────────────

interface LeaveRequest {
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
}

interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

interface Dashboard {
  totalRequests: number;
  pendingApprovals: number;
  approvedThisMonth: number;
  upcomingHolidays: number;
  activeLeaveTypes: number;
  recentRequests: LeaveRequest[];
}

interface LeaveTypeItem {
  id: string;
  name: string;
  code: string;
  description: string | null;
  defaultDaysPerYear: number;
  isPaid: boolean;
  isActive: boolean;
}

interface PolicyItem {
  id: string;
  name: string;
  description: string | null;
  maxDaysPerYear: number;
  allowCarryForward: boolean;
  maxCarryForwardDays: number;
  allowEncashment: boolean;
  requiresApproval: boolean;
  leaveTypeId: string;
  leaveTypeName: string;
}

interface BalanceItem {
  id: string;
  leaveTypeName: string;
  year: number;
  periodLabel?: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  entitled: number;
  used: number;
  carriedForward: number;
  remaining: number;
}

interface BalanceSummary {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  balances: BalanceItem[];
}

interface HolidayItem {
  id: string;
  name: string;
  date: string;
  isRestricted: boolean;
  description: string | null;
  year: number;
}

interface CalendarDay {
  date: string;
  entries: { employeeName: string; leaveTypeName: string; status: string }[];
}

interface EntitlementRule {
  id: string;
  leaveTypeId: string;
  leaveTypeName: string;
  ruleType: string;
  ruleConfig: string;
  isActive: boolean;
}

/** Parsed entitlement rule JSON for display only. */
interface EntitlementRuleConfigDisplay {
  year1MonthlyRate?: number;
  year1Days?: number;
  monthlyAccrualEveryYear?: boolean;
  year2ProRata?: { joinMonthStart: number; joinMonthEnd: number; days: number }[];
  year3PlusDays?: number;
  applicableGender?: string;
  brackets?: { childFrom: number; childTo: number | null; days: number }[];
  defaultDays?: number;
}

interface RecalcResult {
  employeesProcessed: number;
  balancesCreated: number;
  balancesUpdated: number;
}

// ──────────────────────────── Tabs ────────────────────────────

type PageTab = "dashboard" | "applyLeave" | "requests" | "approvals" | "balances" | "carryForward" | "leaveTypes" | "policies" | "holidays" | "calendar";

const PAGE_TABS: { key: PageTab; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "applyLeave", label: "Apply Leave" },
  { key: "requests", label: "Leave Requests" },
  { key: "balances", label: "Leave Balances" },
  { key: "carryForward", label: "Carry Forward" },
  { key: "leaveTypes", label: "Leave Types" },
  { key: "policies", label: "Policies" },
  { key: "holidays", label: "Holidays" },
  { key: "calendar", label: "Team Calendar" },
];

const EMPLOYEE_TABS: { key: PageTab; label: string }[] = [
  { key: "applyLeave", label: "Apply Leave" },
  { key: "requests", label: "My Leave" },
];

// Supervisor (Team scope): own leave + team approvals only
const SUPERVISOR_TABS: { key: PageTab; label: string }[] = [
  { key: "applyLeave", label: "Apply Leave" },
  { key: "requests", label: "My Leave" },
  { key: "approvals", label: "Pending Approvals" },
];

// ──────────────────────────── Helpers ────────────────────────────

const labelClass = "mb-1 block text-xs font-medium text-slate-500";
const inputClass = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20";

function fmtDate(d: string) {
  return formatDate(d);
}

function StatusBadge({ status, responsibleUser }: { status: string; responsibleUser?: string | null }) {
  const colors: Record<string, string> = {
    Pending: "bg-amber-100 text-amber-700",
    PendingLevel2: "bg-orange-100 text-orange-700",
    Approved: "bg-green-100 text-green-700",
    Rejected: "bg-red-100 text-red-700",
    Cancelled: "bg-slate-100 text-slate-500",
  };
  const labels: Record<string, string> = {
    Pending: "Pending L1",
    PendingLevel2: "Pending L2",
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${colors[status] ?? "bg-slate-100 text-slate-500"}`}>
        {labels[status] ?? status}
      </span>
      {responsibleUser && (
        <span className="text-[10px] text-slate-500" title={`Responsible: ${responsibleUser}`}>{responsibleUser}</span>
      )}
    </div>
  );
}

function CardHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
      <h2 className="text-[15px] font-bold text-slate-700">{title}</h2>
      {children}
    </div>
  );
}

// ──────────────────────────── Page ────────────────────────────

export default function LeavePage() {
  const { getLeaveReadScope, user } = useAuth();
  const leaveScope = getLeaveReadScope();
  const isEmployeeView = leaveScope === "Own";
  const isSupervisorView = leaveScope === "Team";

  const [pageTab, setPageTab] = useState<PageTab>(
    isEmployeeView ? "applyLeave" : isSupervisorView ? "applyLeave" : "dashboard"
  );
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if ((isEmployeeView || isSupervisorView) && (pageTab === "dashboard" || pageTab === "balances" || pageTab === "carryForward" || pageTab === "leaveTypes" || pageTab === "policies" || pageTab === "holidays" || pageTab === "calendar")) {
      setPageTab("applyLeave");
    }
  }, [isEmployeeView, isSupervisorView, pageTab]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) setShowMoreMenu(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const tabs = isEmployeeView ? EMPLOYEE_TABS : isSupervisorView ? SUPERVISOR_TABS : PAGE_TABS;
  const isOverflow = !isEmployeeView && !isSupervisorView && tabs.slice(3).some((t) => t.key === pageTab);
  const primaryTabs = isEmployeeView || isSupervisorView ? tabs : tabs.slice(0, 3);
  const overflowTabs = isEmployeeView || isSupervisorView ? [] : tabs.slice(3);

  return (
    <>
      <AppTopbar
        title="Leave & Absence"
        subtitle={
          isEmployeeView
            ? "Apply leave and view your leave requests."
            : isSupervisorView
              ? "Apply leave, view your requests, and approve team leave."
              : "Manage leave requests, balances, policies, holidays, and team calendars."
        }
      />

      {/* ─── Tab Navigation ─── */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {primaryTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setPageTab(t.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition sm:px-4 sm:py-1.5 sm:text-sm ${pageTab === t.key ? "bg-blue-600 text-white shadow" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            {t.label}
          </button>
        ))}
        {!isEmployeeView && !isSupervisorView && overflowTabs.length > 0 && (
          <div className="relative" ref={moreMenuRef}>
            <button
              onClick={() => setShowMoreMenu((p) => !p)}
              className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition sm:px-4 sm:py-1.5 sm:text-sm ${isOverflow ? "bg-blue-600 text-white shadow" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
              {isOverflow ? PAGE_TABS.find((t) => t.key === pageTab)!.label : "More"}
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </button>
            {showMoreMenu && (
              <div className="absolute left-0 top-full z-30 mt-1 min-w-[180px] rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                {overflowTabs.map((t) => (
                  <button key={t.key} onClick={() => { setPageTab(t.key); setShowMoreMenu(false); }} className={`block w-full px-4 py-2 text-left text-sm transition hover:bg-slate-50 ${pageTab === t.key ? "font-semibold text-blue-600" : "text-slate-600"}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Tab Content ─── */}
      {pageTab === "dashboard" && <DashboardTab onApplyLeave={() => setPageTab("applyLeave")} />}
      {pageTab === "applyLeave" && <ApplyLeaveTab isEmployeeView={isEmployeeView || isSupervisorView} currentEmployeeId={user?.employeeId ?? null} />}
      {pageTab === "requests" && <RequestsTab onApplyLeave={() => setPageTab("applyLeave")} isEmployeeView={isEmployeeView || isSupervisorView} currentEmployeeId={user?.employeeId ?? null} showApprovalActions={!isEmployeeView && !isSupervisorView} />}
      {pageTab === "approvals" && <RequestsTab onApplyLeave={() => setPageTab("applyLeave")} isEmployeeView={false} currentEmployeeId={user?.employeeId ?? null} showApprovalActions={true} teamOnly />}
      {pageTab === "balances" && <BalancesTab />}
      {pageTab === "carryForward" && <CarryForwardTab />}
      {pageTab === "leaveTypes" && <LeaveTypesTab />}
      {pageTab === "policies" && <PoliciesTab />}
      {pageTab === "holidays" && <HolidaysTab />}
      {pageTab === "calendar" && <CalendarTab />}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
//  PHASE 1 – Dashboard Tab
// ═══════════════════════════════════════════════════════════════

function DashboardTab({ onApplyLeave }: { onApplyLeave: () => void }) {
  const [dash, setDash] = useState<Dashboard | null>(null);

  useEffect(() => {
    apiFetch<Dashboard>("/api/leave/dashboard").then(setDash);
  }, []);

  if (!dash) return <div className="py-10 text-center text-sm text-slate-400">Loading dashboard...</div>;

  const kpis = [
    { label: "Total Requests", value: dash.totalRequests, icon: "M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z", color: "bg-blue-100 text-blue-600" },
    { label: "Pending Approvals", value: dash.pendingApprovals, icon: "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z", color: "bg-amber-100 text-amber-600" },
    { label: "Approved This Month", value: dash.approvedThisMonth, icon: "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z", color: "bg-green-100 text-green-600" },
    { label: "Upcoming Holidays", value: dash.upcomingHolidays, icon: "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5", color: "bg-purple-100 text-purple-600" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${k.color}`}>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={k.icon} /></svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{k.value}</p>
                <p className="text-xs text-slate-500">{k.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Requests */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
          <CardHeader title="Recent Leave Requests">
            <Button onClick={onApplyLeave}>+ New Request</Button>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50 text-left">
                <th className="px-6 py-2.5 font-semibold text-slate-600">Employee</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Type</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Dates</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Days</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Status</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {dash.recentRequests.length === 0 && <tr><td colSpan={5} className="px-6 py-6 text-center text-slate-400">No leave requests yet.</td></tr>}
                {dash.recentRequests.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-3 font-medium text-slate-700">{r.employeeName}</td>
                    <td className="px-4 py-3 text-slate-600">{r.leaveTypeName}</td>
                    <td className="px-4 py-3 text-slate-600">{fmtDate(r.startDate)} - {fmtDate(r.endDate)}</td>
                    <td className="px-4 py-3 text-slate-600">{r.totalDays}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} responsibleUser={r.responsibleUserName} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <CardHeader title="Quick Actions" />
          <div className="space-y-3 p-6">
            <button onClick={onApplyLeave} className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3.5 text-left transition hover:bg-slate-50">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100"><svg className="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg></div>
              <div><p className="text-sm font-semibold text-slate-700">New Leave Request</p><p className="text-xs text-slate-400">Submit a leave application</p></div>
            </button>
            <div className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3.5 text-left">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100"><svg className="h-4 w-4 text-green-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg></div>
              <div><p className="text-sm font-semibold text-slate-700">Leave Types: {dash.activeLeaveTypes}</p><p className="text-xs text-slate-400">Active leave categories</p></div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Apply Leave Tab
// ═══════════════════════════════════════════════════════════════

interface EmployeeLookup { id: string; firstName: string; lastName: string; profileImageUrl: string | null; employeeCode?: string }

const BALANCE_COLORS = [
  { bg: "from-blue-500 to-blue-600", ring: "ring-blue-200" },
  { bg: "from-emerald-500 to-emerald-600", ring: "ring-emerald-200" },
  { bg: "from-violet-500 to-violet-600", ring: "ring-violet-200" },
  { bg: "from-amber-500 to-amber-600", ring: "ring-amber-200" },
  { bg: "from-rose-500 to-rose-600", ring: "ring-rose-200" },
  { bg: "from-cyan-500 to-cyan-600", ring: "ring-cyan-200" },
  { bg: "from-fuchsia-500 to-fuchsia-600", ring: "ring-fuchsia-200" },
];

function ApplyLeaveTab({ isEmployeeView, currentEmployeeId }: { isEmployeeView: boolean; currentEmployeeId: string | null }) {
  const [employees, setEmployees] = useState<EmployeeLookup[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeItem[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState(isEmployeeView && currentEmployeeId ? currentEmployeeId : "");
  const [balances, setBalances] = useState<BalanceItem[]>([]);
  const [loadingBal, setLoadingBal] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [coveragePerson, setCoveragePerson] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    if (isEmployeeView && currentEmployeeId) setSelectedEmpId(currentEmployeeId);
  }, [isEmployeeView, currentEmployeeId]);

  useEffect(() => {
    Promise.all([
      isEmployeeView && currentEmployeeId
        ? apiFetch<{ id: string; firstName: string; lastName: string; profileImageUrl: string | null; employeeCode?: string }>(`/api/employees/${currentEmployeeId}`)
            .then((e) => [{ id: e.id, firstName: e.firstName, lastName: e.lastName, profileImageUrl: e.profileImageUrl, employeeCode: e.employeeCode }])
        : isEmployeeView
          ? Promise.resolve([] as EmployeeLookup[])
          : apiFetch<{ items: EmployeeLookup[] }>("/api/employees?pageSize=200").then((r) => r.items ?? []),
      apiFetch<LeaveTypeItem[]>("/api/leave/types"),
    ]).then(([empList, types]) => {
      setEmployees(empList);
      setLeaveTypes(types);
    });
  }, [isEmployeeView, currentEmployeeId]);

  useEffect(() => {
    if (!selectedEmpId) { setBalances([]); return; }
    setLoadingBal(true);
    apiFetch<BalanceItem[]>(`/api/leave/balances/${selectedEmpId}?year=${currentYear}`)
      .then(setBalances)
      .finally(() => setLoadingBal(false));
  }, [selectedEmpId, currentYear]);

  const totalDays = startDate && endDate
    ? Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1)
    : 0;

  const selectedBalance = balances.find((b) => {
    const lt = leaveTypes.find((t) => t.id === selectedTypeId);
    return lt && b.leaveTypeName === lt.name;
  });

  const exceedsBalance = selectedBalance ? totalDays > selectedBalance.remaining : false;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (exceedsBalance) {
      setMessage({ type: "err", text: `Insufficient leave balance. Available: ${selectedBalance!.remaining} days, requested: ${totalDays} days.` });
      return;
    }
    setMessage(null);
    setSubmitting(true);
    try {
      await apiFetch("/api/leave/requests", {
        method: "POST",
        body: JSON.stringify({
          employeeId: selectedEmpId,
          leaveTypeId: selectedTypeId,
          startDate, endDate, totalDays,
          reason: reason || null,
          coveragePerson: coveragePerson || null,
        }),
      });
      setMessage({ type: "ok", text: "Leave request submitted successfully!" });
      setSelectedTypeId(""); setStartDate(""); setEndDate(""); setReason(""); setCoveragePerson("");
      // Refresh balances
      apiFetch<BalanceItem[]>(`/api/leave/balances/${selectedEmpId}?year=${currentYear}`).then(setBalances);
    } catch (err) {
      setMessage({ type: "err", text: err instanceof Error ? err.message : "Failed to submit request" });
    } finally { setSubmitting(false); }
  }

  const selectedEmp = employees.find((e) => e.id === selectedEmpId);
  const apiOrigin = API_BASE_URL.replace(/\/$/, "");
  const applyLabel = "mb-0.5 block text-[11px] font-medium text-slate-500";
  const applyInput =
    "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20";

  return (
    <div className="w-full max-w-[min(100%,88rem)]">
      <div className="mb-3 flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-slate-800 sm:text-base">Apply leave</h2>
          <p className="truncate text-[11px] text-slate-500 sm:text-xs">
            {isEmployeeView
              ? "Pick a leave type, then dates and submit — one screen."
              : "Choose an employee, then a leave type and request details."}
          </p>
        </div>
        {!isEmployeeView && (
          <select
            value={selectedEmpId}
            onChange={(e) => {
              setSelectedEmpId(e.target.value);
              setSelectedTypeId("");
              setMessage(null);
            }}
            className="w-full shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 sm:max-w-xs sm:min-w-[220px]"
          >
            <option value="">Select employee…</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.firstName} {e.lastName}
                {e.employeeCode ? ` (${e.employeeCode})` : ` (${e.id.slice(0, 8)})`}
              </option>
            ))}
          </select>
        )}
        {isEmployeeView && !currentEmployeeId && (
          <p className="text-xs text-amber-700">Account not linked to an employee profile.</p>
        )}
      </div>

      {selectedEmpId && (
        <div className="grid gap-3 lg:grid-cols-12 lg:items-start lg:gap-4">
          <div className="flex min-h-0 flex-col gap-2 lg:col-span-4 xl:col-span-3">
            {selectedEmp && (
              <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-bold text-white">
                  {selectedEmp.profileImageUrl ? (
                    <img
                      src={
                        /^https?:\/\//i.test(selectedEmp.profileImageUrl)
                          ? selectedEmp.profileImageUrl
                          : `${apiOrigin}${selectedEmp.profileImageUrl.startsWith("/") ? "" : "/"}${selectedEmp.profileImageUrl}`
                      }
                      alt=""
                      className="h-10 w-10 object-cover"
                    />
                  ) : (
                    `${selectedEmp.firstName[0]}${selectedEmp.lastName[0]}`
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {selectedEmp.firstName} {selectedEmp.lastName}
                  </p>
                  <p className="text-[10px] text-slate-400">{currentYear} balances · click a row to select</p>
                </div>
              </div>
            )}

            {loadingBal && <p className="py-2 text-center text-xs text-slate-400">Loading balances…</p>}
            {!loadingBal && balances.length === 0 && selectedEmpId && (
              <p className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-4 text-center text-xs text-slate-500">
                No balances for this year. Run <span className="font-medium">Recalculate Balances</span> (admin).
              </p>
            )}
            {!loadingBal && balances.length > 0 && (
              <div className="max-h-[32vh] overflow-y-auto overflow-x-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:max-h-[min(52vh,28rem)]">
                <p className="sticky top-0 z-[1] border-b border-slate-100 bg-slate-50 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Leave types
                </p>
                <ul className="divide-y divide-slate-100 p-1">
                  {balances.map((b, i) => {
                    const color = BALANCE_COLORS[i % BALANCE_COLORS.length];
                    const lt = leaveTypes.find((t) => t.name === b.leaveTypeName);
                    const isSelected = Boolean(lt && lt.id === selectedTypeId);
                    return (
                      <li key={b.id}>
                        <button
                          type="button"
                          disabled={!lt}
                          onClick={() => lt && setSelectedTypeId(lt.id)}
                          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition ${
                            isSelected
                              ? `bg-gradient-to-r ${color.bg} text-white shadow-sm`
                              : "hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <p
                              className={`truncate text-xs font-semibold ${isSelected ? "text-white" : "text-slate-700"}`}
                            >
                              {b.leaveTypeName}
                            </p>
                            <p className={`text-[10px] ${isSelected ? "text-white/75" : "text-slate-400"}`}>
                              Ent. {b.entitled} · Used {b.used}
                              {b.carriedForward ? ` · CF ${b.carriedForward}` : ""}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 tabular-nums text-lg font-bold ${isSelected ? "text-white" : "text-slate-800"}`}
                          >
                            {b.remaining}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          <div className="min-w-0 lg:col-span-8 xl:col-span-9">
            {!selectedTypeId && balances.length > 0 && (
              <div className="flex min-h-[180px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-center lg:min-h-[min(52vh,28rem)]">
                <p className="max-w-sm text-sm text-slate-500">
                  Select a <span className="font-medium text-slate-700">leave type</span> from the list to open the
                  request form.
                </p>
              </div>
            )}

          {selectedTypeId && (
            <form
              onSubmit={handleSubmit}
              className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4 space-y-3"
            >
              {message && (
                <div
                  className={`rounded-lg px-3 py-2 text-xs font-medium sm:text-sm ${
                    message.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
                  }`}
                >
                  {message.text}
                </div>
              )}

              {selectedBalance && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50/80 px-3 py-2">
                  <span className="text-xs font-semibold text-slate-800">{selectedBalance.leaveTypeName}</span>
                  <span className="hidden h-4 w-px bg-slate-200 sm:block" />
                  <span className="text-[11px] text-slate-600">
                    <span className="text-slate-400">Avail.</span>{" "}
                    <span className="font-bold text-blue-600">{selectedBalance.remaining}d</span>
                  </span>
                  {totalDays > 0 && (
                    <>
                      <span className="text-[11px] text-slate-600">
                        <span className="text-slate-400">Req.</span>{" "}
                        <span
                          className={`font-bold ${totalDays > selectedBalance.remaining ? "text-red-600" : "text-emerald-600"}`}
                        >
                          {totalDays}d
                        </span>
                      </span>
                      <span className="text-[11px] text-slate-600">
                        <span className="text-slate-400">After</span>{" "}
                        <span
                          className={`font-bold ${selectedBalance.remaining - totalDays < 0 ? "text-red-600" : "text-slate-700"}`}
                        >
                          {selectedBalance.remaining - totalDays}d
                        </span>
                      </span>
                    </>
                  )}
                </div>
              )}

              {exceedsBalance && totalDays > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  Not enough balance: {selectedBalance!.remaining} available vs {totalDays} requested.
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={applyLabel}>From *</label>
                  <DatePickerField required value={startDate} onChange={setStartDate} className={applyInput} />
                </div>
                <div>
                  <label className={applyLabel}>To *</label>
                  <DatePickerField required value={endDate} onChange={setEndDate} className={applyInput} />
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <div>
                  <label className={applyLabel}>Comments</label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    className={applyInput + " min-h-[2.5rem] resize-y"}
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className={applyLabel}>Coverage person</label>
                  <input
                    value={coveragePerson}
                    onChange={(e) => setCoveragePerson(e.target.value)}
                    className={applyInput}
                    placeholder="Who covers while away?"
                  />
                </div>
              </div>

              <div className="flex justify-end border-t border-slate-100 pt-2">
                <button
                  type="submit"
                  disabled={submitting || !startDate || !endDate || exceedsBalance}
                  className="inline-flex min-w-[8.5rem] items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50"
                >
                  {submitting && (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  )}
                  {submitting ? "Submitting…" : "Submit request"}
                </button>
              </div>
            </form>
          )}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  PHASE 2 – Leave Requests Tab
// ═══════════════════════════════════════════════════════════════

function RequestsTab({
  onApplyLeave,
  isEmployeeView,
  currentEmployeeId,
  showApprovalActions = false,
  teamOnly = false,
}: {
  onApplyLeave: () => void;
  isEmployeeView: boolean;
  currentEmployeeId: string | null;
  showApprovalActions?: boolean;
  teamOnly?: boolean;
}) {
  const [data, setData] = useState<PagedResult<LeaveRequest> | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState(teamOnly ? "Pending" : "");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject">("approve");
  const [remarks, setRemarks] = useState("");
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const pageSize = 15;

  const load = useCallback(() => {
    let url = `/api/leave/requests?page=${page}&pageSize=${pageSize}`;
    if (isEmployeeView && currentEmployeeId) url += `&employeeId=${currentEmployeeId}`;
    if (teamOnly) url += `&excludeSelf=true`;
    if (statusFilter) url += `&status=${statusFilter}`;
    if (fromDate) url += `&fromDate=${fromDate}`;
    if (toDate) url += `&toDate=${toDate}`;
    apiFetch<PagedResult<LeaveRequest>>(url).then(setData);
  }, [page, statusFilter, fromDate, toDate, isEmployeeView, currentEmployeeId, teamOnly]);

  useEffect(() => { load(); }, [load]);

  const totalPages = data ? Math.ceil(data.totalCount / pageSize) : 1;

  function openAction(id: string, type: "approve" | "reject") {
    setActionId(id);
    setActionType(type);
    setRemarks("");
    setActionError(null);
  }

  async function submitAction() {
    if (!actionId) return;
    setActing(true);
    setActionError(null);
    try {
      await apiFetch(`/api/leave/requests/${actionId}/${actionType}`, {
        method: "POST",
        body: JSON.stringify({ remarks }),
      });
      setActionId(null);
      load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to submit action.");
    } finally {
      setActing(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className={labelClass}>Status</label>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className={inputClass + " w-48"}>
            <option value="">All</option>
            <option value="Pending">Pending L1</option>
            <option value="PendingLevel2">Pending L2</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>From Date</label>
          <DatePickerField value={fromDate} onChange={(v) => { setFromDate(v); setPage(1); }} className={inputClass + " w-40"} />
        </div>
        <div>
          <label className={labelClass}>To Date</label>
          <DatePickerField value={toDate} onChange={(v) => { setToDate(v); setPage(1); }} className={inputClass + " w-40"} />
        </div>
        <Button onClick={onApplyLeave}>+ New Request</Button>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 text-left">
              {(!isEmployeeView || teamOnly) && <th className="px-6 py-2.5 font-semibold text-slate-600">Employee</th>}
              <th className="px-4 py-2.5 font-semibold text-slate-600">Type</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Start</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">End</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Days</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Status</th>
              {showApprovalActions && <th className="px-4 py-2.5 font-semibold text-slate-600">Actions</th>}
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {!data && <tr><td colSpan={5 + ((!isEmployeeView || teamOnly) ? 1 : 0) + (showApprovalActions ? 1 : 0)} className="px-6 py-8 text-center text-slate-400">Loading...</td></tr>}
              {data && data.items.length === 0 && <tr><td colSpan={5 + ((!isEmployeeView || teamOnly) ? 1 : 0) + (showApprovalActions ? 1 : 0)} className="px-6 py-8 text-center text-slate-400">{teamOnly ? "No pending requests from your team." : "No requests found."}</td></tr>}
              {data?.items.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/50">
                  {(!isEmployeeView || teamOnly) && <td className="px-6 py-3"><p className="font-medium text-slate-700">{r.employeeName}</p><p className="text-xs text-slate-400">{r.employeeCode}</p></td>}
                  <td className="px-4 py-3 text-slate-600">{r.leaveTypeName}</td>
                  <td className="px-4 py-3 text-slate-600">{fmtDate(r.startDate)}</td>
                  <td className="px-4 py-3 text-slate-600">{fmtDate(r.endDate)}</td>
                  <td className="px-4 py-3 text-slate-600">{r.totalDays}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} responsibleUser={r.responsibleUserName} /></td>
                  <td className="px-4 py-3">
                    {showApprovalActions && (r.status === "Pending" || r.status === "PendingLevel2") && (
                      <div className="flex gap-2">
                        <button onClick={() => openAction(r.id, "approve")} className="rounded bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100">Approve</button>
                        <button onClick={() => openAction(r.id, "reject")} className="rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100">Reject</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3">
            <p className="text-xs text-slate-500">Page {page} of {totalPages} ({data.totalCount} total)</p>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200 disabled:opacity-50">Prev</button>
              <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="rounded bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200 disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Approve/Reject Modal */}
      <Modal open={!!actionId} onClose={() => { setActionId(null); setActionError(null); }} title={actionType === "approve" ? "Approve Request" : "Reject Request"}>
        <div className="space-y-4">
          {(() => {
            const req = data?.items.find((r) => r.id === actionId);
            return req ? (
              <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <p><strong>{req.employeeName}</strong> — {req.leaveTypeName}</p>
                <p className="text-xs text-slate-400">{fmtDate(req.startDate)} to {fmtDate(req.endDate)} ({req.totalDays} days) — Level {req.currentApprovalLevel}</p>
              </div>
            ) : null;
          })()}
          <div>
            <label className={labelClass}>Remarks</label>
            <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} className={inputClass} placeholder="Optional remarks..." />
          </div>
          {actionError && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</div>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setActionId(null)}>Cancel</Button>
            <Button onClick={submitAction} disabled={acting}>
              {acting ? "Processing..." : actionType === "approve" ? "Confirm Approve" : "Confirm Reject"}
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  PHASE 3 – Leave Balances Tab
// ═══════════════════════════════════════════════════════════════

function BalancesTab() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [summaries, setSummaries] = useState<BalanceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [recalcMsg, setRecalcMsg] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBalance, setEditingBalance] = useState<BalanceItem | null>(null);
  const [employees, setEmployees] = useState<{ id: string; firstName: string; lastName: string; employeeCode?: string }[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeItem[]>([]);
  const [addEmployeeId, setAddEmployeeId] = useState("");
  const [addLeaveTypeId, setAddLeaveTypeId] = useState("");
  const [addPeriodKind, setAddPeriodKind] = useState<"year" | "custom">("year");
  const [addYear, setAddYear] = useState(new Date().getFullYear());
  const [addPeriodStart, setAddPeriodStart] = useState("");
  const [addPeriodEnd, setAddPeriodEnd] = useState("");
  const [addEntitled, setAddEntitled] = useState("0");
  const [addUsed, setAddUsed] = useState("0");
  const [addCarriedForward, setAddCarriedForward] = useState("0");
  const [editEntitled, setEditEntitled] = useState("0");
  const [editUsed, setEditUsed] = useState("0");
  const [editCarriedForward, setEditCarriedForward] = useState("0");
  const [balanceSaving, setBalanceSaving] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  const loadBalances = useCallback(() => {
    setLoading(true);
    apiFetch<BalanceSummary[]>(`/api/leave/balances/summary?year=${year}`)
      .then(setSummaries)
      .finally(() => setLoading(false));
  }, [year]);

  useEffect(() => { loadBalances(); }, [loadBalances]);

  useEffect(() => {
    if (showAddModal && employees.length === 0) {
      Promise.all([
        apiFetch<{ items: { id: string; firstName: string; lastName: string; employeeCode?: string }[] }>("/api/employees?pageSize=500").then((r) => r.items),
        apiFetch<LeaveTypeItem[]>("/api/leave/types"),
      ]).then(([emps, types]) => {
        setEmployees(emps);
        setLeaveTypes(types);
      });
    }
  }, [showAddModal, employees.length]);

  async function handleRecalculate() {
    setRecalculating(true);
    setRecalcMsg("");
    try {
      const res = await apiFetch<RecalcResult>(`/api/leave/recalculate-all?year=${year}`, { method: "POST" });
      setRecalcMsg(`Done! ${res.employeesProcessed} employees processed, ${res.balancesCreated} created, ${res.balancesUpdated} updated.`);
      loadBalances();
    } catch { setRecalcMsg("Recalculation failed."); }
    finally { setRecalculating(false); }
  }

  function openAddBalance() {
    setAddEmployeeId("");
    setAddLeaveTypeId("");
    setAddPeriodKind("year");
    setAddYear(year);
    setAddPeriodStart("");
    setAddPeriodEnd("");
    setAddEntitled("0");
    setAddUsed("0");
    setAddCarriedForward("0");
    setBalanceError(null);
    setShowAddModal(true);
  }

  function openEditBalance(b: BalanceItem) {
    setEditingBalance(b);
    setEditEntitled(String(b.entitled));
    setEditUsed(String(b.used));
    setEditCarriedForward(String(b.carriedForward));
    setBalanceError(null);
  }

  async function submitAddBalance(e: React.FormEvent) {
    e.preventDefault();
    if (addPeriodKind === "custom" && (!addPeriodStart || !addPeriodEnd)) {
      setBalanceError("Please enter both period start and end dates.");
      return;
    }
    if (addPeriodKind === "custom" && addPeriodStart > addPeriodEnd) {
      setBalanceError("Period start must be before or equal to period end.");
      return;
    }
    setBalanceSaving(true);
    setBalanceError(null);
    try {
      const payload: Record<string, unknown> = {
        employeeId: addEmployeeId,
        leaveTypeId: addLeaveTypeId,
        entitled: Number(addEntitled) || 0,
        used: Number(addUsed) || 0,
        carriedForward: Number(addCarriedForward) || 0,
      };
      if (addPeriodKind === "year") {
        payload.year = addYear;
      } else {
        payload.periodStart = addPeriodStart;
        payload.periodEnd = addPeriodEnd;
      }
      await apiFetch("/api/leave/balances", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setShowAddModal(false);
      loadBalances();
    } catch (err) {
      setBalanceError(err instanceof Error ? err.message : "Failed to add balance");
    } finally {
      setBalanceSaving(false);
    }
  }

  async function submitEditBalance(e: React.FormEvent) {
    e.preventDefault();
    if (!editingBalance) return;
    setBalanceSaving(true);
    setBalanceError(null);
    try {
      await apiFetch(`/api/leave/balances/${editingBalance.id}`, {
        method: "PUT",
        body: JSON.stringify({
          entitled: Number(editEntitled) || 0,
          used: Number(editUsed) || 0,
          carriedForward: Number(editCarriedForward) || 0,
        }),
      });
      setEditingBalance(null);
      loadBalances();
    } catch (err) {
      setBalanceError(err instanceof Error ? err.message : "Failed to update balance");
    } finally {
      setBalanceSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <label className={labelClass}>Year</label>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={inputClass + " w-32"}>
            {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-3">
          {recalcMsg && <p className={`text-xs ${recalcMsg.startsWith("Done") ? "text-green-600" : "text-red-500"}`}>{recalcMsg}</p>}
          <Button onClick={openAddBalance}>+ Assign Leave Type</Button>
          <button onClick={handleRecalculate} disabled={recalculating} className="inline-flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100 disabled:opacity-50">
            {recalculating && <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-300 border-t-blue-700" />}
            {recalculating ? "Recalculating..." : "Recalculate Balances"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <CardHeader title={`Leave Balances — ${year}`} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 text-left">
              <th className="px-6 py-2.5 font-semibold text-slate-600">Employee</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Leave Type</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Period</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600 text-right">Entitled</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600 text-right">Used</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600 text-right">Carried Fwd</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600 text-right">Remaining</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600 w-20">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {loading && <tr><td colSpan={8} className="px-6 py-8 text-center text-slate-400">Loading...</td></tr>}
              {!loading && summaries.length === 0 && <tr><td colSpan={8} className="px-6 py-8 text-center text-slate-400">No balances found for {year}.</td></tr>}
              {summaries.map((s) =>
                s.balances.map((b, i) => (
                  <tr key={`${s.employeeId}-${b.id}`} className="hover:bg-slate-50/50">
                    {i === 0 && <td className="px-6 py-3 font-medium text-slate-700" rowSpan={s.balances.length}><p>{s.employeeName}</p><p className="text-xs text-slate-400">{s.employeeCode}</p></td>}
                    <td className="px-4 py-3 text-slate-600">{b.leaveTypeName}</td>
                    <td className="px-4 py-3 text-slate-600 text-sm">{b.periodLabel ?? b.year}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{b.entitled}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{b.used}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{b.carriedForward}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-700">{b.remaining}</td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => openEditBalance(b)} className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200">Edit</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Assign Leave Type to Employee">
        <form onSubmit={submitAddBalance} className="space-y-4">
          {balanceError && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{balanceError}</div>}
          <div>
            <label className={labelClass}>Employee *</label>
            <select value={addEmployeeId} onChange={(e) => setAddEmployeeId(e.target.value)} required className={inputClass + " w-full"}>
              <option value="">Select employee...</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}{e.employeeCode ? ` (${e.employeeCode})` : ""}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Leave Type *</label>
            <select value={addLeaveTypeId} onChange={(e) => setAddLeaveTypeId(e.target.value)} required className={inputClass + " w-full"}>
              <option value="">Select leave type...</option>
              {leaveTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Leave period *</label>
            <div className="space-y-3">
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="periodKind" checked={addPeriodKind === "year"} onChange={() => setAddPeriodKind("year")} className="rounded border-slate-300 text-blue-600" />
                  <span className="text-sm text-slate-700">Calendar year</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="periodKind" checked={addPeriodKind === "custom"} onChange={() => setAddPeriodKind("custom")} className="rounded border-slate-300 text-blue-600" />
                  <span className="text-sm text-slate-700">Custom period</span>
                </label>
              </div>
              {addPeriodKind === "year" ? (
                <select value={addYear} onChange={(e) => setAddYear(Number(e.target.value))} className={inputClass + " w-full"}>
                  {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500">From</label>
                    <DatePickerField value={addPeriodStart} onChange={setAddPeriodStart} className={inputClass + " w-full"} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">To</label>
                    <DatePickerField value={addPeriodEnd} onChange={setAddPeriodEnd} className={inputClass + " w-full"} />
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Entitled (days)</label>
              <input type="number" min={0} step={0.5} value={addEntitled} onChange={(e) => setAddEntitled(e.target.value)} className={inputClass + " w-full"} />
            </div>
            <div>
              <label className={labelClass}>Used</label>
              <input type="number" min={0} step={0.5} value={addUsed} onChange={(e) => setAddUsed(e.target.value)} className={inputClass + " w-full"} />
            </div>
            <div>
              <label className={labelClass}>Carried Forward</label>
              <input type="number" min={0} step={0.5} value={addCarriedForward} onChange={(e) => setAddCarriedForward(e.target.value)} className={inputClass + " w-full"} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button type="submit" disabled={balanceSaving}>{balanceSaving ? "Saving..." : "Assign"}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!editingBalance} onClose={() => setEditingBalance(null)} title={`Edit balance: ${editingBalance?.leaveTypeName ?? ""}`}>
        <form onSubmit={submitEditBalance} className="space-y-4">
          {balanceError && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{balanceError}</div>}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Entitled (days)</label>
              <input type="number" min={0} step={0.5} value={editEntitled} onChange={(e) => setEditEntitled(e.target.value)} className={inputClass + " w-full"} />
            </div>
            <div>
              <label className={labelClass}>Used</label>
              <input type="number" min={0} step={0.5} value={editUsed} onChange={(e) => setEditUsed(e.target.value)} className={inputClass + " w-full"} />
            </div>
            <div>
              <label className={labelClass}>Carried Forward</label>
              <input type="number" min={0} step={0.5} value={editCarriedForward} onChange={(e) => setEditCarriedForward(e.target.value)} className={inputClass + " w-full"} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setEditingBalance(null)}>Cancel</Button>
            <Button type="submit" disabled={balanceSaving}>{balanceSaving ? "Saving..." : "Update"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Carry Forward Tab (run at beginning of new year)
// ═══════════════════════════════════════════════════════════════

interface CarryForwardResult {
  fromYear: number;
  toYear: number;
  balancesProcessed: number;
  balancesUpdated: number;
  balancesCreated: number;
  totalDaysCarried: number;
}

function CarryForwardTab() {
  const currentYear = new Date().getFullYear();
  const [fromYear, setFromYear] = useState(currentYear - 1);
  const [toYear, setToYear] = useState(currentYear);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<CarryForwardResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setToYear(fromYear + 1);
  }, [fromYear]);

  async function handleRun() {
    if (toYear !== fromYear + 1) {
      setError("To year must be the year after From year (e.g. 2025 → 2026).");
      return;
    }
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await apiFetch<CarryForwardResult>("/api/leave/process-carry-forward", {
        method: "POST",
        body: JSON.stringify({ fromYear, toYear }),
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Carry forward failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-800 mb-1">Leave Carry Forward</h2>
        <p className="text-sm text-slate-600 mb-4">
          Run this process at the beginning of a new year to carry unused leave from the previous year into the new year.
          Only leave types with <strong>Allow carry forward</strong> enabled in Policies are processed. The number of days
          carried is limited by each policy&apos;s <strong>Max carry forward days</strong>.
        </p>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className={labelClass}>From year (source)</label>
            <select value={fromYear} onChange={(e) => setFromYear(Number(e.target.value))} className={inputClass + " w-32"}>
              {[currentYear - 3, currentYear - 2, currentYear - 1, currentYear].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>To year (target)</label>
            <select value={toYear} onChange={(e) => setToYear(Number(e.target.value))} className={inputClass + " w-32"}>
              {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <Button onClick={handleRun} disabled={running || toYear !== fromYear + 1}>
            {running ? "Processing..." : "Run Carry Forward"}
          </Button>
        </div>
        {toYear !== fromYear + 1 && (
          <p className="mt-3 text-sm text-amber-600">To year must be exactly one year after From year.</p>
        )}
        {error && (
          <div className="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        {result && (
          <div className="mt-4 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
            <p className="font-semibold">Carry forward completed.</p>
            <p className="mt-1">Source balances considered: {result.balancesProcessed}. New balances created: {result.balancesCreated}. Existing balances updated: {result.balancesUpdated}. Total days carried: {result.totalDaysCarried}.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  PHASE 4a – Leave Types Tab
// ═══════════════════════════════════════════════════════════════

function LeaveTypesTab() {
  const [items, setItems] = useState<LeaveTypeItem[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<LeaveTypeItem | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => { apiFetch<LeaveTypeItem[]>("/api/leave/types").then(setItems); }, []);
  useEffect(() => { load(); }, [load]);

  function openAdd() { setEditing(null); setShowModal(true); }
  function openEdit(item: LeaveTypeItem) { setEditing(item); setShowModal(true); }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: fd.get("name") as string,
      code: fd.get("code") as string,
      description: fd.get("description") as string || null,
      defaultDaysPerYear: Number(fd.get("defaultDaysPerYear")),
      isPaid: fd.get("isPaid") === "on",
      isActive: fd.get("isActive") === "on",
    };
    try {
      if (editing) {
        await apiFetch(`/api/leave/types/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await apiFetch("/api/leave/types", { method: "POST", body: JSON.stringify(payload) });
      }
      setShowModal(false);
      load();
    } catch { /* ignore */ } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this leave type?")) return;
    await apiFetch(`/api/leave/types/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button onClick={openAdd}>+ Add Leave Type</Button>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <CardHeader title="Leave Types" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 text-left">
              <th className="px-6 py-2.5 font-semibold text-slate-600">Name</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Code</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Days/Year</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Paid</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Active</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 && <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400">No leave types defined.</td></tr>}
              {items.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-3 font-medium text-slate-700">{t.name}</td>
                  <td className="px-4 py-3 text-slate-600">{t.code}</td>
                  <td className="px-4 py-3 text-slate-600">{t.defaultDaysPerYear}</td>
                  <td className="px-4 py-3">{t.isPaid ? <span className="text-green-600">Yes</span> : <span className="text-slate-400">No</span>}</td>
                  <td className="px-4 py-3">{t.isActive ? <span className="text-green-600">Active</span> : <span className="text-red-400">Inactive</span>}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(t)} className="rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100">Edit</button>
                      <button onClick={() => handleDelete(t.id)} className="rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? "Edit Leave Type" : "Add Leave Type"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className={labelClass}>Name *</label><input name="name" required defaultValue={editing?.name ?? ""} className={inputClass} /></div>
            <div><label className={labelClass}>Code *</label><input name="code" required defaultValue={editing?.code ?? ""} className={inputClass} /></div>
          </div>
          <div><label className={labelClass}>Description</label><textarea name="description" rows={2} defaultValue={editing?.description ?? ""} className={inputClass} /></div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div><label className={labelClass}>Days/Year *</label><input name="defaultDaysPerYear" type="number" required defaultValue={editing?.defaultDaysPerYear ?? 14} className={inputClass} /></div>
            <div className="flex items-center gap-2 pt-5"><input name="isPaid" type="checkbox" defaultChecked={editing?.isPaid ?? true} className="h-4 w-4 rounded border-slate-300" /><label className="text-sm text-slate-600">Paid Leave</label></div>
            <div className="flex items-center gap-2 pt-5"><input name="isActive" type="checkbox" defaultChecked={editing?.isActive ?? true} className="h-4 w-4 rounded border-slate-300" /><label className="text-sm text-slate-600">Active</label></div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)} type="button">Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : editing ? "Update" : "Create"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  PHASE 4b – Policies Tab
// ═══════════════════════════════════════════════════════════════

function PoliciesTab() {
  const [items, setItems] = useState<PolicyItem[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeItem[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PolicyItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [rules, setRules] = useState<EntitlementRule[]>([]);

  const load = useCallback(() => {
    Promise.all([
      apiFetch<PolicyItem[]>("/api/leave/policies"),
      apiFetch<LeaveTypeItem[]>("/api/leave/types"),
      apiFetch<EntitlementRule[]>("/api/leave/entitlement-rules"),
    ]).then(([p, t, r]) => { setItems(p); setLeaveTypes(t); setRules(r); });
  }, []);
  useEffect(() => { load(); }, [load]);

  function openAdd() { setEditing(null); setShowModal(true); }
  function openEdit(item: PolicyItem) { setEditing(item); setShowModal(true); }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: fd.get("name") as string,
      description: fd.get("description") as string || null,
      maxDaysPerYear: Number(fd.get("maxDaysPerYear")),
      allowCarryForward: fd.get("allowCarryForward") === "on",
      maxCarryForwardDays: Number(fd.get("maxCarryForwardDays") || 0),
      allowEncashment: fd.get("allowEncashment") === "on",
      requiresApproval: fd.get("requiresApproval") === "on",
      leaveTypeId: fd.get("leaveTypeId") as string,
    };
    try {
      if (editing) {
        await apiFetch(`/api/leave/policies/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await apiFetch("/api/leave/policies", { method: "POST", body: JSON.stringify(payload) });
      }
      setShowModal(false);
      load();
    } catch { /* ignore */ } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this policy?")) return;
    await apiFetch(`/api/leave/policies/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button onClick={openAdd}>+ Add Policy</Button>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <CardHeader title="Leave Policies" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 text-left">
              <th className="px-6 py-2.5 font-semibold text-slate-600">Policy Name</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Leave Type</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Max Days</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Carry Fwd</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Encashment</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Approval</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 && <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-400">No policies defined.</td></tr>}
              {items.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-3"><p className="font-medium text-slate-700">{p.name}</p>{p.description && <p className="text-xs text-slate-400">{p.description}</p>}</td>
                  <td className="px-4 py-3 text-slate-600">{p.leaveTypeName}</td>
                  <td className="px-4 py-3 text-slate-600">{p.maxDaysPerYear}</td>
                  <td className="px-4 py-3">{p.allowCarryForward ? <span className="text-green-600">Yes ({p.maxCarryForwardDays}d)</span> : <span className="text-slate-400">No</span>}</td>
                  <td className="px-4 py-3">{p.allowEncashment ? <span className="text-green-600">Yes</span> : <span className="text-slate-400">No</span>}</td>
                  <td className="px-4 py-3">{p.requiresApproval ? <span className="text-amber-600">Required</span> : <span className="text-slate-400">Auto</span>}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(p)} className="rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100">Edit</button>
                      <button onClick={() => handleDelete(p.id)} className="rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? "Edit Policy" : "Add Policy"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className={labelClass}>Policy Name *</label><input name="name" required defaultValue={editing?.name ?? ""} className={inputClass} /></div>
          <div><label className={labelClass}>Description</label><textarea name="description" rows={2} defaultValue={editing?.description ?? ""} className={inputClass} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className={labelClass}>Leave Type *</label>
              <select name="leaveTypeId" required defaultValue={editing?.leaveTypeId ?? ""} className={inputClass}>
                <option value="">Select...</option>
                {leaveTypes.map((lt) => <option key={lt.id} value={lt.id}>{lt.name}</option>)}
              </select>
            </div>
            <div><label className={labelClass}>Max Days/Year *</label><input name="maxDaysPerYear" type="number" required defaultValue={editing?.maxDaysPerYear ?? 14} className={inputClass} /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex items-center gap-2"><input name="allowCarryForward" type="checkbox" defaultChecked={editing?.allowCarryForward ?? false} className="h-4 w-4 rounded border-slate-300" /><label className="text-sm text-slate-600">Allow Carry Forward</label></div>
            <div><label className={labelClass}>Max Carry Fwd Days</label><input name="maxCarryForwardDays" type="number" defaultValue={editing?.maxCarryForwardDays ?? 0} className={inputClass} /></div>
            <div className="flex items-center gap-2"><input name="allowEncashment" type="checkbox" defaultChecked={editing?.allowEncashment ?? false} className="h-4 w-4 rounded border-slate-300" /><label className="text-sm text-slate-600">Allow Encashment</label></div>
          </div>
          <div className="flex items-center gap-2">
            <input name="requiresApproval" type="checkbox" defaultChecked={editing?.requiresApproval ?? true} className="h-4 w-4 rounded border-slate-300" />
            <label className="text-sm text-slate-600">Requires Approval</label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)} type="button">Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : editing ? "Update" : "Create"}</Button>
          </div>
        </form>
      </Modal>

      {/* Entitlement Rules */}
      {rules.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <CardHeader title="Entitlement Rules" />
          <div className="divide-y divide-slate-100">
            {rules.map((rule) => {
              let config: EntitlementRuleConfigDisplay | null = null;
              try {
                config = JSON.parse(rule.ruleConfig) as EntitlementRuleConfigDisplay;
              } catch {
                /* ignore */
              }
              const monthLabel = (m: number) => ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m - 1] ?? "";
              const gearIcon = <svg className="h-4 w-4 text-indigo-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;

              return (
                <div key={rule.id} className="px-6 py-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100">{gearIcon}</div>
                    <div>
                      <p className="text-sm font-semibold text-slate-700">{rule.leaveTypeName}</p>
                      <p className="text-xs text-slate-400">Rule type: {rule.ruleType} {!rule.isActive && <span className="text-red-400">(Inactive)</span>}</p>
                    </div>
                  </div>

                  {rule.ruleType === "ShopOfficeAnnual" && (
                    <div className="ml-11 space-y-1.5 text-xs text-slate-600">
                      <p>
                        <strong className="text-slate-800">Sri Lanka Shop &amp; Office Act</strong> — calendar year; annual leave uses employment type and confirmation dates.
                      </p>
                      <ul className="list-disc pl-4 space-y-0.5">
                        <li>
                          <span className="font-medium text-slate-700">1.</span> Joining calendar year: no annual leave. While on probation (employment type or before permanent date): no annual leave.
                        </li>
                        <li>
                          <span className="font-medium text-slate-700">2.</span> Permanent for annual leave from Date of permanency, or the day after Probation end date, or from join if employment type is not probation (e.g. Full-Time Permanent).
                        </li>
                        <li>
                          <span className="font-medium text-slate-700">3.</span> First eligible calendar year after join (and from permanent year): pro-rated by original join quarter — Jan–Mar 14d, Apr–Jun 10d, Jul–Sep 7d, Oct–Dec 4d
                        </li>
                        <li>
                          <span className="font-medium text-slate-700">4.</span> Following calendar years: 14 days per year
                        </li>
                        <li>
                          <span className="font-medium text-slate-700">5.</span> Usage: minimum 7 consecutive calendar days per application
                        </li>
                      </ul>
                    </div>
                  )}
                  {rule.ruleType === "ShopOfficeCasual" && (
                    <div className="ml-11 space-y-1.5 text-xs text-slate-600">
                      <p>
                        <strong className="text-slate-800">Sri Lanka Shop &amp; Office Act</strong> — casual leave (max 7 days).
                      </p>
                      <ul className="list-disc pl-4 space-y-0.5">
                        <li>Joining year: 0.5 day per completed calendar month from join (partial join month excluded), capped at 7</li>
                        <li>From the next calendar year: 7 days per year</li>
                      </ul>
                    </div>
                  )}

                  {/* ServiceYearBased display */}
                  {config && rule.ruleType === "ServiceYearBased" && (
                    <div className="ml-11 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-20 rounded bg-slate-100 px-2 py-0.5 text-center text-[11px] font-semibold text-slate-500">Year 1</span>
                        <span className="text-xs text-slate-600">
                          {config.year1MonthlyRate
                            ? <>{config.year1MonthlyRate} day(s) per month <span className="text-slate-400">(each calendar month employed, through current month)</span></>
                            : config.year1Days === 0 ? "No leave (earned but not taken)" : `${config.year1Days} days`}
                        </span>
                      </div>
                      {config.monthlyAccrualEveryYear && config.year1MonthlyRate ? (
                        <p className="text-[11px] text-emerald-700">
                          Same monthly rate applies <strong>every calendar year</strong> (not a one‑time first-year rule). Year 2+ fixed days below are ignored while this is on.
                        </p>
                      ) : null}
                      {config.year2ProRata?.map((b: { joinMonthStart: number; joinMonthEnd: number; days: number }, i: number) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="inline-block w-20 rounded bg-blue-100 px-2 py-0.5 text-center text-[11px] font-semibold text-blue-600">Year 2</span>
                          <span className="text-xs text-slate-600">
                            Joined {monthLabel(b.joinMonthStart)}–{monthLabel(b.joinMonthEnd)}: <strong className="text-slate-800">{b.days} days</strong> (pro-rata)
                          </span>
                        </div>
                      ))}
                      <div className="flex items-center gap-2">
                        <span className={`inline-block w-20 rounded px-2 py-0.5 text-center text-[11px] font-semibold ${config.year2ProRata?.length ? "bg-green-100 text-green-600" : "bg-blue-100 text-blue-600"}`}>
                          {config.year2ProRata?.length ? "Year 3+" : "Year 2+"}
                        </span>
                        <span className="text-xs text-slate-600"><strong className="text-slate-800">{config.year3PlusDays} days</strong> per year</span>
                      </div>
                    </div>
                  )}

                  {/* ChildOrderBased display */}
                  {config && rule.ruleType === "ChildOrderBased" && (
                    <div className="ml-11 space-y-1.5">
                      {config.applicableGender && (
                        <div className="flex items-center gap-2 mb-1">
                          <span className="inline-block w-24 rounded bg-purple-100 px-2 py-0.5 text-center text-[11px] font-semibold text-purple-600">Applies to</span>
                          <span className="text-xs text-slate-600">{config.applicableGender} employees only</span>
                        </div>
                      )}
                      {config.brackets?.map((b: { childFrom: number; childTo: number | null; days: number }, i: number) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="inline-block w-24 rounded bg-pink-100 px-2 py-0.5 text-center text-[11px] font-semibold text-pink-600">
                            {b.childTo ? `Child ${b.childFrom}–${b.childTo}` : `Child ${b.childFrom}+`}
                          </span>
                          <span className="text-xs text-slate-600">
                            <strong className="text-slate-800">{b.days} days</strong> ({Math.floor(b.days / 7)} weeks)
                          </span>
                        </div>
                      ))}
                      <p className="text-[11px] text-slate-400 mt-1">Default entitlement: {config.defaultDays} days (auto-calculated for 1st/2nd child; adjust manually for 3rd+ child)</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  PHASE 5 – Holidays Tab
// ═══════════════════════════════════════════════════════════════

function HolidaysTab() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [items, setItems] = useState<HolidayItem[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<HolidayItem | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => { apiFetch<HolidayItem[]>(`/api/leave/holidays?year=${year}`).then(setItems); }, [year]);
  useEffect(() => { load(); }, [load]);

  function openAdd() { setEditing(null); setShowModal(true); }
  function openEdit(item: HolidayItem) { setEditing(item); setShowModal(true); }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const dateVal = fd.get("date") as string;
    const payload = {
      name: fd.get("name") as string,
      date: dateVal,
      isRestricted: fd.get("isRestricted") === "on",
      description: fd.get("description") as string || null,
      year: new Date(dateVal).getFullYear(),
    };
    try {
      if (editing) {
        await apiFetch(`/api/leave/holidays/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await apiFetch("/api/leave/holidays", { method: "POST", body: JSON.stringify(payload) });
      }
      setShowModal(false);
      load();
    } catch { /* ignore */ } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this holiday?")) return;
    await apiFetch(`/api/leave/holidays/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <label className={labelClass}>Year</label>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={inputClass + " w-32"}>
            {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <Button onClick={openAdd}>+ Add Holiday</Button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <CardHeader title={`Company Holidays — ${year}`} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 text-left">
              <th className="px-6 py-2.5 font-semibold text-slate-600">Holiday Name</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Date</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Day</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Restricted</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Description</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 && <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400">No holidays for {year}.</td></tr>}
              {items.map((h) => (
                <tr key={h.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-3 font-medium text-slate-700">{h.name}</td>
                  <td className="px-4 py-3 text-slate-600">{fmtDate(h.date)}</td>
                  <td className="px-4 py-3 text-slate-600">{(() => { const [y, m, d] = h.date.split("T")[0].split("-"); return new Date(+y, +m - 1, +d).toLocaleDateString("en-US", { weekday: "long" }); })()}</td>
                  <td className="px-4 py-3">{h.isRestricted ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Restricted</span> : <span className="text-slate-400">No</span>}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{h.description ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(h)} className="rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100">Edit</button>
                      <button onClick={() => handleDelete(h.id)} className="rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? "Edit Holiday" : "Add Holiday"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className={labelClass}>Holiday Name *</label><input name="name" required defaultValue={editing?.name ?? ""} className={inputClass} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className={labelClass}>Date *</label><DatePickerField key={editing?.id ?? "new"} name="date" required defaultValue={editing ? editing.date.substring(0, 10) : ""} className={inputClass} /></div>
            <div className="flex items-center gap-2 pt-5"><input name="isRestricted" type="checkbox" defaultChecked={editing?.isRestricted ?? false} className="h-4 w-4 rounded border-slate-300" /><label className="text-sm text-slate-600">Restricted Date</label></div>
          </div>
          <div><label className={labelClass}>Description</label><textarea name="description" rows={2} defaultValue={editing?.description ?? ""} className={inputClass} /></div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)} type="button">Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : editing ? "Update" : "Create"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  PHASE 6 – Team Calendar Tab
// ═══════════════════════════════════════════════════════════════

function CalendarTab() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [holidays, setHolidays] = useState<HolidayItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiFetch<CalendarDay[]>(`/api/leave/calendar?month=${month}&year=${year}`),
      apiFetch<HolidayItem[]>(`/api/leave/holidays?year=${year}`),
    ]).then(([cal, hol]) => {
      setDays(cal);
      setHolidays(hol.filter((h) => new Date(h.date).getMonth() + 1 === month));
    }).finally(() => setLoading(false));
  }, [month, year]);

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const dayMap = new Map(days.map((d) => [new Date(d.date).getDate(), d]));
  const holidayMap = new Map(holidays.map((h) => [new Date(h.date).getDate(), h]));

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(year - 1); } else setMonth(month - 1);
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(year + 1); } else setMonth(month + 1);
  }

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const typeColors: Record<string, string> = {
    "Annual Leave": "bg-blue-200 text-blue-800",
    "Casual Leave": "bg-teal-200 text-teal-800",
    "Sick Leave": "bg-red-200 text-red-800",
    "Maternity Leave": "bg-pink-200 text-pink-800",
    "No-Pay Leave": "bg-slate-200 text-slate-700",
  };

  return (
    <div className="space-y-5">
      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-200">
          <svg className="h-4 w-4 inline mr-1" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>Prev
        </button>
        <h2 className="text-lg font-bold text-slate-800">{monthNames[month - 1]} {year}</h2>
        <button onClick={nextMonth} className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-200">
          Next<svg className="h-4 w-4 inline ml-1" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-slate-400">Loading calendar...</div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-slate-100">
            {dayNames.map((dn) => (
              <div key={dn} className="py-2.5 text-center text-xs font-semibold text-slate-500">{dn}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {cells.map((day, idx) => {
              const isToday = day === now.getDate() && month === now.getMonth() + 1 && year === now.getFullYear();
              const calDay = day ? dayMap.get(day) : null;
              const holiday = day ? holidayMap.get(day) : null;
              const isWeekend = idx % 7 === 0 || idx % 7 === 6;

              return (
                <div
                  key={idx}
                  className={`min-h-[100px] border-b border-r border-slate-100 p-1.5 ${!day ? "bg-slate-50/50" : isWeekend ? "bg-slate-50/30" : ""}`}
                >
                  {day && (
                    <>
                      <div className={`mb-1 text-right text-xs font-medium ${isToday ? "rounded-full bg-blue-600 text-white w-6 h-6 flex items-center justify-center ml-auto" : "text-slate-500"}`}>
                        {day}
                      </div>
                      {holiday && (
                        <div className={`mb-0.5 rounded px-1 py-0.5 text-[10px] font-medium truncate ${holiday.isRestricted ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`} title={holiday.name}>
                          {holiday.name}
                        </div>
                      )}
                      {calDay?.entries.map((entry, ei) => (
                        <div
                          key={ei}
                          className={`mb-0.5 rounded px-1 py-0.5 text-[10px] font-medium truncate ${typeColors[entry.leaveTypeName] ?? "bg-slate-200 text-slate-700"}`}
                          title={`${entry.employeeName} — ${entry.leaveTypeName}`}
                        >
                          {entry.employeeName.split(" ")[0]}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-medium text-slate-500">Legend:</span>
        {Object.entries(typeColors).map(([name, cls]) => (
          <span key={name} className={`rounded px-2 py-0.5 text-[10px] font-medium ${cls}`}>{name}</span>
        ))}
        <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">Holiday</span>
        <span className="rounded bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">Restricted</span>
      </div>
    </div>
  );
}
