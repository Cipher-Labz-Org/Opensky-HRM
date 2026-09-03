"use client";

import { appAlert, appConfirm } from "@/components/ui/appDialogs";
import { useState, useEffect, useCallback, useMemo, useRef, type FormEvent } from "react";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { apiFetch } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/date-utils";
import { DonutMixChart, formatInt, HorizontalCompareBars, WeeklyActivityBars } from "@/lib/workspace-charts";
import { API_BASE_URL } from "@/config/constants";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { DatePickerField, FormSelect, TablePagination, FlashMessageBanner, FormErrorAlert, InlinePageAlert, type FormSelectOption } from "@/components/ui";
import { useClientPagination } from "@/lib/use-client-pagination";
import { useApplyFilter } from "@/lib/use-apply-filter";
import { printPayslip } from "@/lib/payslip-print";

interface Component {
  id: string; name: string; code: string; type: string; category: string;
  isTaxable: boolean; isEpfApplicable: boolean; isEtfApplicable: boolean;
  isStatutory: boolean; isActive: boolean;
  description?: string; formulaExpression?: string; dependsOnComponentCode?: string;
  sortOrder: number; isEmployerContribution: boolean;
}

interface EmpComp {
  id: string; employeeId: string; employeeName: string; componentId: string;
  componentName: string; componentCode: string; componentType: string; componentCategory: string;
  amount: number; currency: string; effectiveFrom: string; effectiveTo?: string; isActive: boolean;
  batchId?: string;
}

interface Batch {
  id: string; batchCode: string; month: number; year: number;
  effectiveFrom: string; effectiveTo?: string;
  processType: string; status: string;
  processedAt?: string;
  reviewedBy?: string; reviewedAt?: string;
  approvedBy?: string; approvedAt?: string;
  employeeCount: number;
  totalGross: number; totalDeductions: number; totalNet: number; totalEmployerCost: number;
  notes?: string; selectedCount: number; createdAt: string;
}

interface StatementLine {
  id: string; componentId: string; componentName: string; componentCode: string;
  type: string; amount: number; isEmployerContribution: boolean; sortOrder: number;
}

interface Statement {
  id: string; batchId: string; employeeId: string; employeeName: string;
  employeeCode?: string; department?: string; month: number; year: number;
  basicPay: number; totalEarnings: number; totalDeductions: number;
  grossPay: number; netPay: number; employerCost: number; status: string;
  lines?: StatementLine[];
}

interface Revision {
  id: string; employeeId: string; employeeName: string; revisionType: string;
  currentSalary: number; proposedSalary: number; changePercentage: number;
  justification?: string; status: string; effectiveDate: string;
  approvedBy?: string; approvedAt?: string; remarks?: string;
}

interface Employee { id: string; firstName: string; lastName: string; employeeCode: string; }
interface EligibleEmployee { id: string; firstName: string; lastName: string; employeeCode: string; department: string; grade: string; location: string; }
interface Settings { epfEmployeeRate: number; epfEmployerRate: number; etfEmployerRate: number; otHourlyDivisor: number; otMultiplier: number; }

interface AttendanceImportLine {
  employeeId: string; employeeName: string; employeeCode?: string;
  approvedOtHours: number; otAmount: number; otApproved: boolean; otOutdated: boolean;
  attendanceNopayDays: number; leaveNopayDays: number; totalNopayDays: number;
  poyaDaysWorked: number;
  basicPay: number; warning?: string;
}

interface PagedResult<T> { items?: T[]; Items?: T[]; totalCount?: number; TotalCount?: number; }

const DEFAULT_PAYROLL_SETTINGS: Settings = {
  epfEmployeeRate: 0.08,
  epfEmployerRate: 0.12,
  etfEmployerRate: 0.03,
  otHourlyDivisor: 208,
  otMultiplier: 1.5,
};

function pagedItems<T>(result: PagedResult<T> | null | undefined): T[] {
  if (!result) return [];
  return result.items ?? result.Items ?? [];
}

function sortBatchesNewestFirst(items: Batch[]): Batch[] {
  return items.slice().sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    if (a.month !== b.month) return b.month - a.month;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

function batchNeedsCalculation(batch: Batch): boolean {
  return batch.status === "Draft" || batch.status === "Calculated"
    ? batch.totalGross === 0 && batch.totalNet === 0
    : false;
}

interface AttendanceImportPreview {
  batchId: string; batchCode: string; effectiveFrom: string; effectiveTo?: string;
  lines: AttendanceImportLine[];
  employeesWithApprovedOt: number; employeesMissingOtApproval: number; employeesWithNopay: number;
  employeesWithPoya: number;
}

const TABS = ["Dashboard", "Components", "Employee Salary", "Variable Entry", "Payroll Run", "Pay Slips", "Settings"] as const;
type Tab = typeof TABS[number];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const MONTH_NUMBER_OPTS: FormSelectOption[] = MONTHS.map((m, i) => ({ value: String(i + 1), label: m }));

const PROCESS_TYPE_OPTS: FormSelectOption[] = [
  { value: "Salary", label: "Salary" },
  { value: "Bonus", label: "Bonus" },
  { value: "OtherTransactions", label: "Other Transactions" },
];

function formatProcessType(value?: string): string {
  if (!value || value === "Salary") return "Salary";
  if (value === "OtherTransactions") return "Other Transactions";
  if (value === "Bonus") return "Bonus";
  return value;
}

function monthDateRange(month: number, year: number): { from: string; to: string } {
  const lastDay = new Date(year, month, 0).getDate();
  const mm = String(month).padStart(2, "0");
  return {
    from: `${year}-${mm}-01`,
    to: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

function formatBatchPeriod(b: Batch): string {
  const to = b.effectiveTo ? formatDate(b.effectiveTo) : "—";
  return `${formatDate(b.effectiveFrom)} – ${to}`;
}

function formatBatchLabel(b: Batch): string {
  return `${b.batchCode} — ${formatProcessType(b.processType)} — ${MONTHS[b.month - 1]} ${b.year}`;
}

const PAYROLL_COMPONENT_TYPE_OPTS: FormSelectOption[] = [
  { value: "Earning", label: "Earning" },
  { value: "Deduction", label: "Deduction" },
  { value: "StatutoryDeduction", label: "Statutory Deduction" },
  { value: "StatutoryContribution", label: "Statutory Contribution" },
];

const PAYROLL_COMPONENT_CATEGORY_OPTS: FormSelectOption[] = [
  { value: "Fixed", label: "Fixed" },
  { value: "Variable", label: "Variable" },
  { value: "Statutory", label: "Statutory" },
  { value: "OneTime", label: "One Time" },
];

const YES_NO_TF_OPTS: FormSelectOption[] = [
  { value: "false", label: "No" },
  { value: "true", label: "Yes" },
];

const EPF_ETF_OPTS: FormSelectOption[] = [
  { value: "no", label: "No" },
  { value: "both", label: "EPF & ETF" },
  { value: "epf", label: "EPF only" },
  { value: "etf", label: "ETF only" },
];

function epfEtfKindFromFlags(c?: Pick<Component, "isEpfApplicable" | "isEtfApplicable"> | null): string {
  if (!c) return "no";
  if (c.isEpfApplicable && c.isEtfApplicable) return "both";
  if (c.isEpfApplicable) return "epf";
  if (c.isEtfApplicable) return "etf";
  return "no";
}

function flagsFromEpfEtfKind(kind: string): { isEpfApplicable: boolean; isEtfApplicable: boolean } {
  return {
    isEpfApplicable: kind === "epf" || kind === "both",
    isEtfApplicable: kind === "etf" || kind === "both",
  };
}

function epfEtfKindLabel(c: Pick<Component, "isEpfApplicable" | "isEtfApplicable">): string {
  const kind = epfEtfKindFromFlags(c);
  if (kind === "both") return "EPF & ETF";
  return EPF_ETF_OPTS.find((o) => o.value === kind)?.label ?? "No";
}

function resolveStatutoryBases(epfEarnings: number, etfEarnings: number, basicPay: number) {
  const epfBase = epfEarnings > 0 ? epfEarnings : basicPay;
  const etfBase = etfEarnings > 0 ? etfEarnings : epfEarnings > 0 ? epfEarnings : basicPay;
  return { epfBase, etfBase };
}

const ACTIVE_STATUS_OPTS: FormSelectOption[] = [
  { value: "true", label: "Active" },
  { value: "false", label: "Inactive" },
];

const DEFAULT_FIXED_SALARY_EFFECTIVE_FROM = "2020-01-01";

const fmt = (n: number) => n.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function printStatement(stmt: Statement): Promise<void> {
  if (!isApprovedPaySlip(stmt.status)) return;
  const detail =
    stmt.lines && stmt.lines.length > 0
      ? stmt
      : await apiFetch<Statement>(`/api/payroll/statements/${stmt.id}`);
  await printPayslip(detail);
}

function formatPayrollAmount(n: number): string {
  return `LKR ${fmt(n)}`;
}
const roundMoney = (n: number) => Math.round(n * 100) / 100;

function employeeCodeNumericKey(code?: string): number {
  const trimmed = (code ?? "").trim();
  if (!trimmed) return Number.MAX_SAFE_INTEGER;
  if (/^\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10);
  const digits = trimmed.replace(/\D/g, "");
  return digits ? Number.parseInt(digits, 10) : Number.MAX_SAFE_INTEGER;
}

function compareEmployeeCode(a?: string, b?: string): number {
  const diff = employeeCodeNumericKey(a) - employeeCodeNumericKey(b);
  if (diff !== 0) return diff;
  return (a ?? "").localeCompare(b ?? "", undefined, { sensitivity: "base" });
}

function isApprovedPaySlip(status: string) {
  return status === "Approved" || status === "Finalized";
}

function FormulaInfoTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex shrink-0 align-middle">
      <span
        tabIndex={0}
        role="button"
        aria-label={text}
        title={text}
        className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-orange-400 bg-transparent text-[10px] font-bold leading-none text-orange-500 outline-none transition hover:border-orange-500 hover:text-orange-600 focus-visible:ring-2 focus-visible:ring-orange-300"
      >
        ?
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-30 hidden w-64 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-[11px] font-normal leading-snug text-slate-600 shadow-lg group-hover:block group-focus-within:block"
      >
        {text}
      </span>
    </span>
  );
}

function PayStatementBadge({ status }: { status: string }) {
  const display = status === "Finalized" ? "Approved" : status;
  const styleKey = display === "Approved" ? "Approved" : display;
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeCls[styleKey] || "bg-slate-100 text-slate-600"}`}>
      {display}
    </span>
  );
}

function PaySlipActionLinks({
  statement,
  viewingId,
  printingId,
  onView,
  onPrint,
}: {
  statement: Statement;
  viewingId: string | null;
  printingId: string | null;
  onView: () => void;
  onPrint: () => void;
}) {
  if (!isApprovedPaySlip(statement.status)) {
    return <span className="text-xs text-slate-400">—</span>;
  }
  const busyView = viewingId === statement.id;
  const busyPrint = printingId === statement.id;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <button
        type="button"
        onClick={onView}
        disabled={busyView}
        className="text-xs font-medium text-[#256aa3] hover:underline disabled:opacity-50"
      >
        {busyView ? "Opening…" : "Payslip"}
      </button>
      <button
        type="button"
        onClick={onPrint}
        disabled={busyPrint}
        className="text-xs font-medium text-[#256aa3] hover:underline disabled:opacity-50"
      >
        {busyPrint ? "Printing…" : "Print"}
      </button>
    </div>
  );
}

function calcApitTable01(taxableEarnings: number): number {
  if (taxableEarnings <= 150000) return 0;
  if (taxableEarnings <= 233333) return roundMoney(taxableEarnings * 0.06 - 9000);
  if (taxableEarnings <= 275000) return roundMoney(taxableEarnings * 0.18 - 37000);
  if (taxableEarnings <= 316667) return roundMoney(taxableEarnings * 0.24 - 53500);
  if (taxableEarnings <= 358333) return roundMoney(taxableEarnings * 0.30 - 72500);
  return Math.max(0, roundMoney(taxableEarnings * 0.36 - 94000));
}

function calcStatutoryAmount(
  def: Component,
  epfBase: number,
  etfBase: number,
  taxableEarnings: number,
  settings: Settings | null
): number {
  switch (def.code.toUpperCase()) {
    case "EPF_EE":
      return settings && epfBase > 0 ? roundMoney(epfBase * settings.epfEmployeeRate) : 0;
    case "EPF_ER":
      return settings && epfBase > 0 ? roundMoney(epfBase * settings.epfEmployerRate) : 0;
    case "ETF_ER":
      return settings && etfBase > 0 ? roundMoney(etfBase * settings.etfEmployerRate) : 0;
    case "APIT":
      return calcApitTable01(taxableEarnings);
    default:
      return 0;
  }
}

const inputCls = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100";
const labelCls = "mb-1 block text-xs font-medium text-slate-500";
const badgeCls: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-600",
  Calculated: "bg-blue-50 text-blue-600",
  Reviewed: "bg-indigo-50 text-indigo-600",
  Approved: "bg-green-50 text-green-700",
  Finalized: "bg-emerald-50 text-emerald-700",
  Cancelled: "bg-red-50 text-red-600",
  Pending: "bg-amber-50 text-amber-600",
  Rejected: "bg-red-50 text-red-600",
};

const statusLabel: Record<string, string> = {
  Calculated: "Pending review",
  Reviewed: "Pending HR approval",
};

export default function PayrollPage() {
  const [tab, setTab] = useState<Tab>("Dashboard");

  return (
    <>
      <AppTopbar
        title="Payroll & Compensation"
        subtitle="Manage compensation components, run monthly payroll, and view pay slips."
      />

      <div className="mt-6 mb-6 flex flex-wrap gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`whitespace-nowrap rounded-xl border px-3.5 py-2.5 text-xs font-semibold transition sm:px-4 sm:text-sm ${
              tab === t
                ? "border-slate-300 bg-white text-slate-900 shadow-sm"
                : "border-slate-200/90 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Dashboard" && <DashboardTab onOpenTab={setTab} />}
      {tab === "Components" && <ComponentsTab />}
      {tab === "Employee Salary" && <EmployeeSalaryTab />}
      {tab === "Variable Entry" && <VariableEntryTab />}
      {tab === "Payroll Run" && <PayrollRunTab />}
      {tab === "Pay Slips" && <PayStatementsTab />}
      {tab === "Settings" && <SettingsTab />}
    </>
  );
}

/* ═══════════════════════════ DASHBOARD ═══════════════════════════ */

function payrollBatchStatusColor(status: string): string {
  const u = status.toLowerCase();
  if (u.includes("draft")) return "#94a3b8";
  if (u.includes("calculat")) return "#3b82f6";
  if (u.includes("review")) return "#6366f1";
  if (u.includes("approv")) return "#22c55e";
  if (u.includes("final")) return "#059669";
  if (u.includes("cancel") || u.includes("reject")) return "#ef4444";
  return "#64748b";
}

function DashboardTab({ onOpenTab }: { onOpenTab: (t: Tab) => void }) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_PAYROLL_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [batchesError, setBatchesError] = useState("");
  const [settingsError, setSettingsError] = useState("");

  const loadDashboard = useCallback(() => {
    setLoading(true);
    setBatchesError("");
    setSettingsError("");

    const batchesReq = apiFetch<PagedResult<Batch>>("/api/payroll/batches?pageSize=20")
      .then((b) => setBatches(sortBatchesNewestFirst(pagedItems(b))))
      .catch((err) => {
        setBatches([]);
        setBatchesError(err instanceof Error ? err.message : "Could not load payroll batches.");
      });

    const settingsReq = apiFetch<Settings>("/api/payroll/settings")
      .then((s) => setSettings(s))
      .catch((err) => {
        setSettings(DEFAULT_PAYROLL_SETTINGS);
        setSettingsError(err instanceof Error ? err.message : "Could not load payroll settings.");
      });

    Promise.all([batchesReq, settingsReq]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const latest = batches[0] ?? null;
  const latestUncalculated = latest != null && batchNeedsCalculation(latest);

  const latestBreakdown = useMemo(() => {
    if (!latest) return [];
    return [
      { label: "Gross pay", value: Math.round(Number(latest.totalGross)), color: "#3b82f6" },
      { label: "Deductions", value: Math.round(Number(latest.totalDeductions)), color: "#f97316" },
      { label: "Net pay", value: Math.round(Number(latest.totalNet)), color: "#22c55e" },
    ];
  }, [latest]);

  const netTrendBars = useMemo(() => {
    const sorted = [...batches].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    return sorted.slice(-7).map((b) => ({
      label: `${MONTHS[b.month - 1]?.slice(0, 3) ?? "?"}`,
      count: Math.max(0, Math.round(Number(b.totalNet) / 1000)),
    }));
  }, [batches]);

  const batchStatusMix = useMemo(() => {
    const tally = new Map<string, number>();
    for (const b of batches) {
      const s = b.status || "Unknown";
      tally.set(s, (tally.get(s) ?? 0) + 1);
    }
    return Array.from(tally.entries())
      .map(([label, value]) => ({ label, value, color: payrollBatchStatusColor(label) }))
      .sort((a, b) => b.value - a.value);
  }, [batches]);

  const timelineItems = useMemo(
    () =>
      [...batches]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 8)
        .map((b) => ({
          at: b.createdAt,
          title: `${b.batchCode} · ${b.status}`,
          body: `${MONTHS[b.month - 1]} ${b.year} · ${formatInt(b.employeeCount)} employees · Net LKR ${fmt(b.totalNet)}`,
        })),
    [batches]
  );

  const kpis = useMemo(() => {
    if (!latest) {
      return [
        { label: "Total gross (latest run)", value: "—", sub: batchesError || "No batches yet — open Payroll Run or create a batch" },
        { label: "Total deductions", value: "—", sub: "—" },
        { label: "Total net pay", value: "—", sub: "—" },
        { label: "Employees in run", value: "—", sub: "—" },
      ];
    }
    const period = `${MONTHS[latest.month - 1]} ${latest.year}`;
    if (latestUncalculated) {
      return [
        {
          label: "Latest batch",
          value: latest.batchCode,
          sub: `${period} · ${formatInt(latest.employeeCount)} employees · Draft — run Calculate on Payroll Run`,
        },
        {
          label: "Total gross (latest run)",
          value: "Pending",
          sub: "Calculate the batch to populate gross, deductions, and net pay",
        },
        {
          label: "Total net pay",
          value: "Pending",
          sub: "EPF/ETF are applied when you calculate a salary batch",
        },
        {
          label: "Employees in run",
          value: formatInt(latest.employeeCount),
          sub: `${formatInt(batches.length)} batch${batches.length === 1 ? "" : "es"} on dashboard`,
        },
      ];
    }
    return [
      {
        label: "Total gross (latest run)",
        value: `LKR ${fmt(latest.totalGross)}`,
        sub: `${period} · batch ${latest.batchCode}`,
      },
      {
        label: "Total deductions",
        value: `LKR ${fmt(latest.totalDeductions)}`,
        sub: "Statutory and other deductions in latest batch",
      },
      {
        label: "Total net pay",
        value: `LKR ${fmt(latest.totalNet)}`,
        sub: "Take-home total for the latest batch",
      },
      {
        label: "Employees in run",
        value: formatInt(latest.employeeCount),
        sub: `${formatInt(batches.length)} recent batch${batches.length === 1 ? "" : "es"} loaded`,
      },
    ];
  }, [latest, latestUncalculated, batches.length, batchesError]);

  const quickLinks: { tab: Tab; title: string; sub: string }[] = [
    { tab: "Components", title: "Components", sub: "Earnings, deductions, and formulas" },
    { tab: "Employee Salary", title: "Employee salary", sub: "Fixed pay and assignments" },
    { tab: "Variable Entry", title: "Variable entry", sub: "One-off adjustments" },
    { tab: "Payroll Run", title: "Payroll run", sub: "Calculate, review, and approve cycles" },
    { tab: "Pay Slips", title: "Pay slips", sub: "Employee payslips and line items" },
    { tab: "Settings", title: "Settings", sub: "EPF, ETF, and payroll rules" },
  ];

  if (loading) {
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" />
        ))}
      </div>
    );
  }

  return (
    <>
      {batchesError || settingsError ? (
        <div className="mb-4 space-y-2">
          {batchesError ? (
            <InlinePageAlert message={batchesError} className="rounded-xl border border-rose-200/80 bg-rose-50 px-3 py-2 text-sm text-rose-800" />
          ) : null}
          {settingsError ? (
            <InlinePageAlert
              message={`${settingsError} Showing default EPF/ETF rates (8% / 12% / 3%).`}
              className="rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2 text-sm text-amber-900"
            />
          ) : null}
          <div className="flex justify-end">
            <Button variant="secondary" className="text-xs" onClick={loadDashboard}>
              Retry
            </Button>
          </div>
        </div>
      ) : null}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="text-xs font-medium uppercase tracking-wider text-slate-500">{kpi.label}</div>
            <div className="mt-2 text-2xl font-semibold leading-tight text-slate-900 sm:text-3xl">{kpi.value}</div>
            {kpi.sub && kpi.sub !== "—" ? (
              <p className="mt-2 text-xs leading-relaxed text-slate-500">{kpi.sub}</p>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-800">Latest run mix</h3>
          </div>
          {!latest || latestBreakdown.every((x) => x.value === 0) ? (
            <p className="py-8 text-center text-sm text-slate-500">
              {latestUncalculated
                ? `${latest.batchCode} is ready — open Payroll Run and click Calculate.`
                : "No batch totals to chart yet."}
            </p>
          ) : (
            <HorizontalCompareBars items={latestBreakdown} />
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-800">Net pay trend</h3>
          </div>
          {netTrendBars.length === 0 || netTrendBars.every((b) => b.count === 0) ? (
            <p className="py-8 text-center text-sm text-slate-500">
              {batches.length > 0
                ? "Net pay trend appears after you calculate a batch."
                : "No batches to plot."}
            </p>
          ) : (
            <>
              <WeeklyActivityBars data={netTrendBars} />
            </>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-800">Batch status mix</h3>
          </div>
          {batchStatusMix.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No status distribution yet.</p>
          ) : (
            <DonutMixChart values={batchStatusMix} />
          )}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800">EPF / ETF rates</h3>
          {settingsError ? (
            <span className="text-xs text-amber-700">Defaults shown</span>
          ) : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 px-4 py-4 text-center">
            <div className="text-xs font-medium text-slate-500">EPF (Employee)</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{(settings.epfEmployeeRate * 100).toFixed(0)}%</div>
          </div>
          <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 px-4 py-4 text-center">
            <div className="text-xs font-medium text-slate-500">EPF (Employer)</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{(settings.epfEmployerRate * 100).toFixed(0)}%</div>
          </div>
          <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 px-4 py-4 text-center">
            <div className="text-xs font-medium text-slate-500">ETF (Employer)</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{(settings.etfEmployerRate * 100).toFixed(0)}%</div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Recent batches</h3>
            </div>
            <Button className="min-h-0 rounded-lg px-3 py-1.5 text-xs" onClick={() => onOpenTab("Payroll Run")}>
              Go to run
            </Button>
          </div>
          {batches.length === 0 ? (
            <EmptyState text="No payroll batches yet." />
          ) : timelineItems.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">No timeline rows.</p>
          ) : (
            <div className="space-y-2.5">
              {timelineItems.map((ev, i) => (
                <div
                  key={`${ev.at}-${i}`}
                  className="group grid grid-cols-[88px_1fr] items-start gap-3 rounded-xl border border-slate-200/90 px-3 py-2.5 transition hover:border-slate-300 hover:bg-slate-50/70"
                >
                  <div className="pt-0.5 text-[11px] font-medium text-slate-500">{formatDateTime(ev.at)}</div>
                  <div className="min-w-0">
                    <div className="mb-0.5 flex items-center gap-2">
                      <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
                      <strong className="truncate text-sm text-slate-800">{ev.title}</strong>
                    </div>
                    <div className="line-clamp-2 text-sm text-slate-600">{ev.body}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-900">Quick actions</h3>
          </div>
          <div className="grid max-h-[min(70vh,28rem)] gap-2.5 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-1">
            {quickLinks.map((link) => (
              <button
                key={link.title}
                type="button"
                onClick={() => onOpenTab(link.tab)}
                className="group rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-800">{link.title}</div>
                  </div>
                  <span className="mt-0.5 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700">
                    →
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

    </>
  );
}

/* ═══════════════════════════ COMPONENTS ═══════════════════════════ */

function ComponentsTab() {
  const [components, setComponents] = useState<Component[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Component | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError("");
    apiFetch<Component[]>("/api/payroll/components")
      .then(setComponents)
      .catch((err) => {
        setComponents([]);
        setLoadError(err instanceof Error ? err.message : "Could not load compensation components.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleEdit(c: Component) { setEditing(c); setShowForm(true); }
  async function handleDelete(id: string) {
    if (!(await appConfirm("Delete this component?"))) return;
    await apiFetch(`/api/payroll/components/${id}`, { method: "DELETE" });
    load();
  }

  const componentsPager = useClientPagination(components);

  if (loading) return <Loading />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Compensation Components</h2>
        <Button onClick={() => { setEditing(null); setShowForm(true); }}>+ Add Component</Button>
      </div>

      {loadError ? (
        <InlinePageAlert message={loadError} />
      ) : components.length === 0 ? (
        <EmptyState text="No components defined yet. Add your first component." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b bg-slate-50 text-xs text-slate-500">
              <th className="px-4 py-3 font-medium">Name</th><th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Type</th><th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Taxable</th><th className="px-4 py-3 font-medium">EPF & ETF</th>
              <th className="px-4 py-3 font-medium">Formula</th>
              <th className="px-4 py-3 font-medium">Order</th><th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr></thead>
            <tbody>
              {componentsPager.pageItems.map(c => (
                <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium text-slate-700">{c.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.code}</td>
                  <td className="px-4 py-3 text-slate-600">{c.type}</td>
                  <td className="px-4 py-3 text-slate-600">{c.category}</td>
                  <td className="px-4 py-3">{c.isTaxable ? <span className="text-amber-600">Yes</span> : <span className="text-slate-400">No</span>}</td>
                  <td className="px-4 py-3">{epfEtfKindLabel(c) === "No" ? <span className="text-slate-400">No</span> : <span className="text-sky-600">{epfEtfKindLabel(c)}</span>}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.formulaExpression || "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{c.sortOrder}</td>
                  <td className="px-4 py-3">{c.isActive ? <span className="text-green-600">Active</span> : <span className="text-slate-400">Inactive</span>}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => handleEdit(c)} className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50">Edit</button>
                      <button onClick={() => handleDelete(c.id)} className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <TablePagination page={componentsPager.page} totalPages={componentsPager.totalPages} totalCount={componentsPager.totalCount} pageSize={componentsPager.pageSize} onPageChange={componentsPager.setPage} />
        </div>
      )}

      {showForm && <ComponentFormModal editing={editing} onClose={() => setShowForm(false)} onSaved={load} />}
    </div>
  );
}

function ComponentFormModal({ editing, onClose, onSaved }: { editing: Component | null; onClose: () => void; onSaved: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(""); setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: fd.get("name"), code: fd.get("code"), type: fd.get("type"), category: fd.get("category"),
      isTaxable: fd.get("isTaxable") === "true",
      ...flagsFromEpfEtfKind(String(fd.get("epfEtfKind") || "no")),
      isStatutory: fd.get("isStatutory") === "true",
      description: fd.get("description") || null, formulaExpression: fd.get("formulaExpression") || null,
      dependsOnComponentCode: fd.get("dependsOnComponentCode") || null,
      sortOrder: Number(fd.get("sortOrder") || 0),
      isEmployerContribution: fd.get("isEmployerContribution") === "true",
      isActive: editing ? fd.get("isActive") === "true" : true,
    };
    try {
      if (editing) {
        await apiFetch(`/api/payroll/components/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await apiFetch("/api/payroll/components", { method: "POST", body: JSON.stringify(payload) });
      }
      onSaved(); onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally { setSubmitting(false); }
  }

  return (
    <Modal open onClose={onClose} title={editing ? "Edit Component" : "Add Component"} wide>
      <form key={editing?.id ?? "new"} onSubmit={handleSubmit} className="space-y-4">
        <InlinePageAlert message={error} className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 scroll-mt-20" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className={labelCls}>Name *</label><input name="name" required className={inputCls} defaultValue={editing?.name} /></div>
          <div><label className={labelCls}>Code *</label><input name="code" required className={inputCls} defaultValue={editing?.code} placeholder="e.g. BASIC" /></div>
          <div><label className={labelCls}>Type *</label>
            <FormSelect name="type" defaultValue={editing?.type || "Earning"} options={PAYROLL_COMPONENT_TYPE_OPTS} placeholder="Type" />
          </div>
          <div><label className={labelCls}>Category *</label>
            <FormSelect name="category" defaultValue={editing?.category || "Fixed"} options={PAYROLL_COMPONENT_CATEGORY_OPTS} placeholder="Category" />
          </div>
          <div><label className={labelCls}>Taxable</label>
            <FormSelect name="isTaxable" defaultValue={String(editing?.isTaxable ?? false)} options={YES_NO_TF_OPTS} placeholder="—" />
          </div>
          <div><label className={labelCls}>EPF & ETF</label>
            <FormSelect name="epfEtfKind" defaultValue={epfEtfKindFromFlags(editing)} options={EPF_ETF_OPTS} placeholder="—" />
          </div>
          <div><label className={labelCls}>Statutory</label>
            <FormSelect name="isStatutory" defaultValue={String(editing?.isStatutory ?? false)} options={YES_NO_TF_OPTS} placeholder="—" />
          </div>
          <div><label className={labelCls}>Employer Contribution</label>
            <FormSelect name="isEmployerContribution" defaultValue={String(editing?.isEmployerContribution ?? false)} options={YES_NO_TF_OPTS} placeholder="—" />
          </div>
          <div><label className={labelCls}>Sort Order</label><input name="sortOrder" type="number" className={inputCls} defaultValue={editing?.sortOrder ?? 0} /></div>
        </div>
        <div><label className={labelCls}>Formula Expression</label><input name="formulaExpression" className={inputCls} defaultValue={editing?.formulaExpression ?? ""} placeholder="e.g. EPF_EARNINGS * EPF_EE_RATE or APIT_AMOUNT" /></div>
        <div><label className={labelCls}>Depends On Component Code</label><input name="dependsOnComponentCode" className={inputCls} defaultValue={editing?.dependsOnComponentCode ?? ""} /></div>
        <div><label className={labelCls}>Description</label><textarea name="description" className={inputCls} rows={2} defaultValue={editing?.description ?? ""} /></div>
        {editing && (
          <div><label className={labelCls}>Active</label>
            <FormSelect name="isActive" defaultValue={String(editing.isActive)} options={ACTIVE_STATUS_OPTS} placeholder="—" />
          </div>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : editing ? "Update" : "Create"}</Button>
        </div>
      </form>
    </Modal>
  );
}

/* ═══════════════════════ EMPLOYEE SALARY ═══════════════════════ */

interface SalaryEmployee { id: string; firstName: string; lastName: string; employeeCode: string; department: string; grade: string; location: string; }

function EmployeeSalaryTab() {
  const [allEmployees, setAllEmployees] = useState<SalaryEmployee[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const searchFilter = useApplyFilter();
  const [filterDept, setFilterDept] = useState("");
  const [filterGrade, setFilterGrade] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [selectedEmp, setSelectedEmp] = useState<SalaryEmployee | null>(null);
  const [empComp, setEmpComp] = useState<EmpComp[]>([]);
  const [compError, setCompError] = useState<string | null>(null);
  const [components, setComponents] = useState<Component[]>([]);
  const [compLoading, setCompLoading] = useState(false);
  const [compTab, setCompTab] = useState<"Fixed" | "Variable">("Fixed");
  const [showImport, setShowImport] = useState(false);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [payrollSettings, setPayrollSettings] = useState<Settings | null>(null);

  useEffect(() => {
    apiFetch<Component[]>("/api/payroll/components").then(setComponents).catch(() => {});
    apiFetch<Settings>("/api/payroll/settings").then(setPayrollSettings).catch(() => {});
    apiFetch<PagedResult<Batch>>("/api/payroll/batches?pageSize=50").then(d => {
      const items = sortBatchesNewestFirst(pagedItems(d));
      setBatches(items);
      const draft = items.find(b => b.status === "Draft" || b.status === "Calculated");
      if (draft) setSelectedBatchId(draft.id);
    }).catch(() => {});
    setListLoading(true);
    apiFetch<SalaryEmployee[]>("/api/payroll/active-employees")
      .then(setAllEmployees).catch(() => {}).finally(() => setListLoading(false));
  }, []);

  const { departments, grades, locations } = useMemo(() => ({
    departments: Array.from(new Set(allEmployees.map(e => e.department).filter(Boolean))).sort(),
    grades: Array.from(new Set(allEmployees.map(e => e.grade).filter(Boolean))).sort(),
    locations: Array.from(new Set(allEmployees.map(e => e.location).filter(Boolean))).sort(),
  }), [allEmployees]);

  const salaryDeptFilterOpts = useMemo<FormSelectOption[]>(
    () => [{ value: "", label: "All Depts" }, ...departments.map((d) => ({ value: d, label: d }))],
    [departments]
  );
  const salaryGradeFilterOpts = useMemo<FormSelectOption[]>(
    () => [{ value: "", label: "All Grades" }, ...grades.map((g) => ({ value: g, label: g }))],
    [grades]
  );
  const salaryLocationFilterOpts = useMemo<FormSelectOption[]>(
    () => [{ value: "", label: "All Locations" }, ...locations.map((l) => ({ value: l, label: l }))],
    [locations]
  );
  const empSalaryBatchOpts = useMemo<FormSelectOption[]>(
    () => [{ value: "", label: "Select Batch…" }, ...batches.map((b) => ({ value: b.id, label: formatBatchLabel(b) }))],
    [batches]
  );

  const selectedBatch = batches.find((b) => b.id === selectedBatchId);
  const batchEntryCategory =
    selectedBatch?.processType === "Bonus" ? "OneTime" : "Variable";

  const filtered = useMemo(
    () =>
      allEmployees.filter((e) => {
        if (filterDept && e.department !== filterDept) return false;
        if (filterGrade && e.grade !== filterGrade) return false;
        if (filterLocation && e.location !== filterLocation) return false;
        if (searchFilter.applied) {
          const q = searchFilter.applied.toLowerCase();
          if (
            !e.firstName.toLowerCase().includes(q) &&
            !e.lastName.toLowerCase().includes(q) &&
            !e.employeeCode.toLowerCase().includes(q)
          )
            return false;
        }
        return true;
      }),
    [allEmployees, filterDept, filterGrade, filterLocation, searchFilter.applied]
  );

  const selectEmployee = useCallback((emp: SalaryEmployee) => {
    setSelectedEmp(emp);
    setCompLoading(true);
    setCompError(null);
    apiFetch<EmpComp[]>(`/api/payroll/compensation/${emp.id}`)
      .then(setEmpComp)
      .catch((err: unknown) => {
        setEmpComp([]);
        setCompError(err instanceof Error ? err.message : "Could not load compensation");
      })
      .finally(() => setCompLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedEmp) return;
    if (!filtered.some((e) => e.id === selectedEmp.id)) {
      setSelectedEmp(null);
      setEmpComp([]);
    }
  }, [filtered, selectedEmp]);

  if (listLoading) return <Loading />;

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:gap-8" style={{ minHeight: 500 }}>
      {/* Employee list */}
      <div className="relative z-10 w-full shrink-0 space-y-3 rounded-2xl border border-slate-200/90 bg-gradient-to-b from-slate-50/95 to-white p-4 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.08)] lg:w-[340px]">
        <input
          className={
            inputCls +
            " !mb-0 rounded-lg border-slate-200/90 bg-white shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] placeholder:text-slate-400"
          }
          placeholder="Search name or code… (Enter)"
          value={searchFilter.input}
          onChange={(e) => searchFilter.setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") searchFilter.apply();
          }}
        />
        <div className="flex min-w-0 gap-2">
          <div className="min-w-0 flex-1">
            <FormSelect
              value={filterDept}
              onValueChange={setFilterDept}
              options={salaryDeptFilterOpts}
              placeholder="All Depts"
              className="!h-9 !min-h-0 !rounded-lg !border-slate-200/90 !bg-white !py-0 text-xs"
            />
          </div>
          <div className="min-w-0 flex-1">
            <FormSelect
              value={filterGrade}
              onValueChange={setFilterGrade}
              options={salaryGradeFilterOpts}
              placeholder="All Grades"
              className="!h-9 !min-h-0 !rounded-lg !border-slate-200/90 !bg-white !py-0 text-xs"
            />
          </div>
          <div className="min-w-0 flex-1">
            <FormSelect
              value={filterLocation}
              onValueChange={setFilterLocation}
              options={salaryLocationFilterOpts}
              placeholder="All Locations"
              className="!h-9 !min-h-0 !rounded-lg !border-slate-200/90 !bg-white !py-0 text-xs"
            />
          </div>
        </div>
        <div className="text-xs font-medium text-slate-500">
          {filtered.length} employee{filtered.length !== 1 ? "s" : ""}
        </div>
        <div className="max-h-[min(70vh,28rem)] overflow-y-auto rounded-xl border border-slate-200/80 bg-white shadow-inner">
          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-400">No employees match filters</div>
          ) : (
            filtered.map((emp) => (
              <button
                key={emp.id}
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  selectEmployee(emp);
                }}
                className={`flex w-full cursor-pointer items-center gap-2 border-b border-slate-100 px-4 py-3 text-left text-sm transition-colors last:border-b-0 hover:bg-slate-50/90 active:bg-sky-50/70 ${
                  selectedEmp?.id === emp.id
                    ? "border-l-[3px] border-l-[#2E7BBF] bg-sky-50/90 pl-[13px]"
                    : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-slate-900">
                    {emp.firstName} {emp.lastName}
                  </div>
                  <div className="truncate text-xs text-slate-500">
                    {emp.employeeCode} · {emp.department || "—"}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Compensation details */}
      <div className="min-w-0 flex-1 space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-0">
          <div className="flex gap-10">
            {(["Fixed", "Variable"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setCompTab(t)}
                className={`relative pb-3 text-sm font-semibold transition-colors ${
                  compTab === t ? "text-[#2E7BBF]" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {t}
                {compTab === t ? (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-[3px] rounded-t-full bg-[#2E7BBF]"
                    aria-hidden
                  />
                ) : null}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 pb-3">
            {compTab === "Variable" && (
              <div className="w-auto min-w-[180px] max-w-[260px] shrink-0">
                <FormSelect
                  value={selectedBatchId}
                  onValueChange={setSelectedBatchId}
                  options={empSalaryBatchOpts}
                  placeholder="Select Batch…"
                  className="!h-10 !min-h-0 !rounded-lg !border-slate-200/90 !bg-white !py-0 text-xs"
                />
              </div>
            )}
            <Button
              variant="secondary"
              className="min-h-10 rounded-lg border-[#2E7BBF]/35 bg-white px-4 py-2 text-[#256aa3] hover:border-[#2E7BBF]/55 hover:bg-[#2E7BBF]/[0.06]"
              onClick={() => setShowImport(true)}
              disabled={compTab === "Variable" && !selectedBatchId}
            >
              Import
            </Button>
          </div>
        </div>

        {compTab === "Variable" && !selectedBatchId ? (
          <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 py-24 text-sm text-slate-500">
            Select a payroll batch above to view variable components
          </div>
        ) : !selectedEmp ? (
          <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 py-24 text-sm text-slate-500">
            Select an employee to view their compensation
          </div>
        ) : (
          <>
            <InlinePageAlert message={compError} className="rounded-lg border border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700 scroll-mt-20" />
            <SalaryComponentsEditor
              key={selectedEmp.id}
              employeeId={selectedEmp.id}
              employeeName={`${selectedEmp.firstName} ${selectedEmp.lastName}`}
              title={`${selectedEmp.firstName} ${selectedEmp.lastName} — ${selectedEmp.employeeCode}`}
              mode={compTab}
              batchId={compTab === "Variable" ? selectedBatchId : undefined}
              processType={compTab === "Variable" ? selectedBatch?.processType : undefined}
              componentsLibrary={components}
              assignmentsAll={empComp}
              payrollSettings={payrollSettings}
              loading={compLoading}
              onReload={() => selectEmployee(selectedEmp)}
            />
          </>
        )}
      </div>

      {showImport && (
        <ImportCompensationModal category={compTab === "Variable" ? batchEntryCategory : compTab}
          batchId={compTab === "Variable" ? selectedBatchId : undefined}
          onClose={() => setShowImport(false)}
          onImported={() => { setShowImport(false); if (selectedEmp) selectEmployee(selectedEmp); }} />
      )}
    </div>
  );
}

/** Lists payroll components for Fixed or batch-scoped Variable / OneTime entry. */
function SalaryComponentsEditor({
  employeeId,
  employeeName,
  title,
  mode,
  batchId,
  processType,
  componentsLibrary,
  assignmentsAll,
  payrollSettings,
  loading,
  onReload,
}: {
  employeeId: string;
  employeeName: string;
  title: string;
  mode: "Fixed" | "Variable";
  batchId?: string;
  processType?: string;
  componentsLibrary: Component[];
  assignmentsAll: EmpComp[];
  payrollSettings: Settings | null;
  loading: boolean;
  onReload: () => void;
}) {
  const batchUsesOneTime = mode === "Variable" && processType === "Bonus";

  const definitions = useMemo(() => {
    const list =
      mode === "Fixed"
        ? componentsLibrary.filter(
            (c) =>
              c.isActive &&
              (c.category === "Fixed" || c.category === "Statutory")
          )
        : batchUsesOneTime
          ? componentsLibrary.filter((c) => c.isActive && c.category === "OneTime")
          : componentsLibrary.filter((c) => c.isActive && c.category === "Variable");
    return [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }, [componentsLibrary, mode, batchUsesOneTime]);

  const isStatutory = (def: Component) => def.category === "Statutory" || def.isStatutory;
  const isPoya = (def: Component) => {
    const code = def.code.toUpperCase();
    return code === "POYA" || code === "PD002" || code.startsWith("POYA") || /poya/i.test(def.name);
  };

  const manualDefinitions = useMemo(
    () => definitions.filter((d) => !isStatutory(d)),
    [definitions]
  );

  const relevantLines = useMemo(() => {
    return assignmentsAll.filter((a) => {
      if (a.isActive === false) return false;
      if (mode === "Fixed") {
        return (
          (a.componentCategory === "Fixed" || a.componentCategory === "Statutory") &&
          !a.batchId
        );
      }
      if (batchUsesOneTime) {
        return Boolean(batchId && a.componentCategory === "OneTime" && a.batchId === batchId);
      }
      return Boolean(batchId && a.componentCategory === "Variable" && a.batchId === batchId);
    });
  }, [assignmentsAll, mode, batchId, batchUsesOneTime]);

  const [draftByComp, setDraftByComp] = useState<Record<string, string>>({});
  const [savingCompId, setSavingCompId] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState<string | null>(null);

  useEffect(() => {
    setDraftByComp({});
    setSaveError(null);
    setSaveOk(null);
  }, [employeeId, mode, batchId, processType]);

  function lineForComponent(componentId: string): EmpComp | undefined {
    return relevantLines.find((a) => a.componentId === componentId);
  }

  function closeEnough(a: number, b: number) {
    return Math.abs(a - b) < 0.005;
  }

  function clearDraft(componentId: string) {
    setDraftByComp((d) => {
      const n = { ...d };
      delete n[componentId];
      return n;
    });
  }

  function parseDraftAmount(draft: string): { isEmpty: boolean; target: number } {
    const trimmed = draft.trim();
    const parsed =
      trimmed === "" || trimmed === "-" || trimmed === "\u2014"
        ? null
        : Number.parseFloat(trimmed.replace(/,/g, ""));
    const isEmpty =
      trimmed === "" || parsed === null || Number.isNaN(parsed) || parsed === 0;
    return { isEmpty, target: isEmpty ? 0 : Math.round((parsed ?? 0) * 100) / 100 };
  }

  async function persistComponent(def: Component, draft: string): Promise<{ wrote: boolean; recalculatedBatches?: number }> {
    const line = lineForComponent(def.id);
    const { isEmpty, target } = parseDraftAmount(draft);

    if (!line && isEmpty) return { wrote: false };
    if (line && !isEmpty && closeEnough(Number(line.amount), target)) return { wrote: false };

    let recalculatedBatches = 0;
    if (isEmpty && line) {
      const res = await apiFetch<{ recalculatedBatches?: number }>(`/api/payroll/compensation/line/${line.id}`, { method: "DELETE" });
      recalculatedBatches = res.recalculatedBatches ?? 0;
    } else if (!isEmpty && line) {
      const res = await apiFetch<{ recalculatedBatches?: number }>(`/api/payroll/compensation/line/${line.id}`, {
        method: "PUT",
        body: JSON.stringify({
          amount: target,
          currency: line.currency || "LKR",
          effectiveFrom: line.effectiveFrom,
          effectiveTo: line.effectiveTo ?? null,
          isActive: true,
        }),
      });
      recalculatedBatches = res.recalculatedBatches ?? 0;
    } else if (!isEmpty && !line) {
      const payload: Record<string, unknown> = {
        componentId: def.id,
        amount: target,
        currency: "LKR",
        effectiveFrom: mode === "Fixed" ? DEFAULT_FIXED_SALARY_EFFECTIVE_FROM : new Date().toISOString(),
      };
      if (mode === "Variable" && batchId) payload.batchId = batchId;
      const res = await apiFetch<{ recalculatedBatches?: number }>(`/api/payroll/compensation/${employeeId}`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      recalculatedBatches = res.recalculatedBatches ?? 0;
    }
    return { wrote: true, recalculatedBatches };
  }

  function saveSuccessMessage(recalculatedBatches: number) {
    if (mode !== "Fixed") return "Salary saved.";
    if (recalculatedBatches > 0) {
      return `Salary saved. ${recalculatedBatches} payroll run${recalculatedBatches === 1 ? "" : "s"} recalculated — check Pay Slips.`;
    }
    return "Salary saved. Open Payroll Run and click Calculate (or Recalculate) to refresh pay slips.";
  }

  async function commitComponent(def: Component) {
    if (savingAll || isStatutory(def)) return;
    const draft = draftByComp[def.id];
    if (draft === undefined) return;

    setSaveError(null);
    setSaveOk(null);
    setSavingCompId(def.id);
    try {
      const { wrote, recalculatedBatches = 0 } = await persistComponent(def, draft);
      clearDraft(def.id);
      if (wrote) {
        await onReload();
        setSaveOk(saveSuccessMessage(recalculatedBatches));
      }
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSavingCompId(null);
    }
  }

  async function saveAll() {
    if (savingAll || loading) return;
    const dirty = manualDefinitions.filter((d) => draftByComp[d.id] !== undefined);
    setSaveError(null);
    setSaveOk(null);
    if (dirty.length === 0) {
      setSaveOk("Salary is already saved.");
      return;
    }

    setSavingAll(true);
    try {
      const snapshot = { ...draftByComp };
      let wroteAny = false;
      let recalculatedBatches = 0;
      for (const def of dirty) {
        const draft = snapshot[def.id];
        if (draft === undefined) continue;
        const { wrote, recalculatedBatches: n = 0 } = await persistComponent(def, draft);
        if (wrote) wroteAny = true;
        if (n > recalculatedBatches) recalculatedBatches = n;
      }
      setDraftByComp({});
      if (wroteAny) await onReload();
      setSaveOk(wroteAny ? saveSuccessMessage(recalculatedBatches) : "Salary is already saved.");
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSavingAll(false);
    }
  }

  const dirtyCount = Object.keys(draftByComp).length;
  const isBusy = loading || savingAll || savingCompId !== null;

  function saveButton(className = "") {
    return (
      <Button
        className={className}
        disabled={loading || savingAll}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => void saveAll()}
      >
        {savingAll ? "Saving…" : "Save"}
      </Button>
    );
  }

  const earningsDefs = manualDefinitions.filter((d) => d.type === "Earning");
  const manualDeductionDefs = manualDefinitions.filter((d) => d.type !== "Earning");
  const statutoryDefs = definitions.filter((d) => isStatutory(d));

  function numericAmount(componentId: string): number {
    const draft = draftByComp[componentId];
    const line = lineForComponent(componentId);
    if (draft !== undefined) {
      const t = draft.trim();
      if (t === "" || t === "—" || t === "-") return 0;
      const n = Number.parseFloat(t.replace(/,/g, ""));
      return Number.isNaN(n) ? 0 : n;
    }
    return line?.amount ?? 0;
  }

  const epfEarnings = earningsDefs
    .filter((d) => d.isEpfApplicable)
    .reduce((s, d) => s + numericAmount(d.id), 0);
  const etfEarnings = earningsDefs
    .filter((d) => d.isEtfApplicable)
    .reduce((s, d) => s + numericAmount(d.id), 0);
  const taxableEarnings = earningsDefs
    .filter((d) => d.isTaxable)
    .reduce((s, d) => s + numericAmount(d.id), 0);
  const basicSalaryAmount = earningsDefs
    .filter((d) => d.code.toUpperCase() === "BASIC" || d.code.toUpperCase().startsWith("BASIC"))
    .reduce((s, d) => s + numericAmount(d.id), 0);
  const { epfBase, etfBase } = resolveStatutoryBases(epfEarnings, etfEarnings, basicSalaryAmount);
  const hasStatutoryBase = epfBase > 0 || etfBase > 0 || taxableEarnings > 0;

  function statutoryAmount(def: Component): number {
    return calcStatutoryAmount(def, epfBase, etfBase, taxableEarnings, payrollSettings);
  }

  function displayAmount(def: Component): number {
    if (isStatutory(def)) return statutoryAmount(def);
    return numericAmount(def.id);
  }

  const poyaDayRate = basicSalaryAmount > 0 ? Math.round((basicSalaryAmount / 30) * 100) / 100 : 0;

  const totalEarnings = earningsDefs.reduce((s, d) => s + numericAmount(d.id), 0);
  const manualDeductions = manualDeductionDefs.reduce((s, d) => s + numericAmount(d.id), 0);
  const employeeStatutoryDeductions =
    hasStatutoryBase
      ? statutoryDefs
          .filter((d) => d.type === "StatutoryDeduction")
          .reduce((s, d) => s + statutoryAmount(d), 0)
      : 0;
  const totalEmployeeDeductions = manualDeductions + employeeStatutoryDeductions;
  const employerStatutoryCost =
    hasStatutoryBase
      ? statutoryDefs
          .filter((d) => d.isEmployerContribution)
          .reduce((s, d) => s + statutoryAmount(d), 0)
      : 0;
  const visibleDeductionDefs =
    hasStatutoryBase ? [...manualDeductionDefs, ...statutoryDefs] : manualDeductionDefs;
  const deductionDisplayTotal = visibleDeductionDefs.reduce((s, d) => s + displayAmount(d), 0);

  function inputDisplay(defId: string): string {
    if (draftByComp[defId] !== undefined) return draftByComp[defId];
    const line = lineForComponent(defId);
    if (!line || Number(line.amount) === 0) return "";
    return String(line.amount);
  }

  function statutoryDisplay(def: Component): string {
    const amount = statutoryAmount(def);
    return amount > 0 ? fmt(amount) : "—";
  }

  const salaryAmtInputCls =
    "h-10 w-full min-w-[7rem] rounded-lg border border-slate-200/90 bg-white px-3 text-right font-mono text-sm tabular-nums text-slate-800 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] outline-none transition placeholder:text-slate-400 focus:border-[#2E7BBF] focus:ring-2 focus:ring-[#2E7BBF]/18 disabled:opacity-60 md:min-w-[8.75rem]";

  function renderSalaryColumnTable(defs: Component[], variant: "earning" | "deduction") {
    if (defs.length === 0) {
      return (
        <div className="py-14 text-center text-sm text-slate-400">No active components in this group.</div>
      );
    }
    return (
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200/90 bg-slate-50/90 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <th className="py-2.5 pl-4 pr-2 font-medium">Component</th>
            <th className="w-[140px] shrink-0 py-2.5 pl-2 pr-4 text-right font-medium md:w-[172px]">Amount (LKR)</th>
          </tr>
        </thead>
        <tbody>
          {defs.map((def) => (
            <tr
              key={def.id}
              className="border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50/60"
            >
              <td className="py-3 pl-4 pr-2 align-top">
                <div className="flex items-center gap-1.5">
                  <div className="font-medium leading-snug text-slate-900">
                    {def.name}{" "}
                    <span className="font-normal text-slate-400">({def.code})</span>
                  </div>
                  {isPoya(def) ? (
                    <FormulaInfoTip
                      text={`Auto on Payroll Run: Basic ÷ 30 × Poya days worked${
                        poyaDayRate > 0 ? ` (LKR ${fmt(poyaDayRate)} per day)` : ""
                      }. Leave blank to use attendance, or enter 0.5–15 days / a larger LKR amount.`}
                    />
                  ) : null}
                </div>
                {variant === "deduction" && !isPoya(def) ? (
                  <span className="mt-1.5 inline-block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    {def.type.toUpperCase()}
                  </span>
                ) : null}
              </td>
              <td className="py-3 pl-2 pr-4 align-top">
                {isStatutory(def) ? (
                  <div
                    className="flex h-10 min-w-[7rem] items-center justify-end gap-2 rounded-lg border border-slate-200/70 bg-slate-50 px-3 font-mono text-sm tabular-nums text-slate-700 md:min-w-[8.75rem]"
                    title={
                      def.code.toUpperCase() === "APIT"
                        ? `APIT (IRD Table 01) from taxable earnings (LKR ${fmt(taxableEarnings)})`
                        : def.code.toUpperCase().startsWith("ETF")
                          ? `Auto-calculated from ETF-applicable earnings (LKR ${fmt(etfBase)})`
                          : `Auto-calculated from EPF-applicable earnings (LKR ${fmt(epfBase)})`
                    }
                  >
                    <span className="rounded bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                      Auto
                    </span>
                    <span>{statutoryDisplay(def)}</span>
                  </div>
                ) : (
                  <input
                    type="text"
                    inputMode="decimal"
                    disabled={isBusy}
                    className={salaryAmtInputCls}
                    value={inputDisplay(def.id)}
                    onChange={(e) =>
                      setDraftByComp((prev) => ({ ...prev, [def.id]: e.target.value }))
                    }
                    onBlur={() => void commitComponent(def)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void saveAll();
                      }
                    }}
                    placeholder="—"
                    aria-label={`${def.name} amount`}
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)]">
      <div className="border-b border-slate-100 bg-white px-6 pb-5 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h2>
          {saveButton("shrink-0")}
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-500">
          Enter amounts in LKR, then click Save. EPF/ETF use the EPF &amp; ETF mark; APIT uses Taxable earnings.
          {dirtyCount > 0 ? (
            <span className="mt-1 block text-sm font-medium text-amber-700">
              You have unsaved changes — pay slips will not match until you click Save.
            </span>
          ) : null}
          {hasStatutoryBase && payrollSettings ? (
            <span className="mt-1 block text-xs text-slate-400">
              {employeeName} EPF base: LKR {fmt(epfBase)} · ETF base: LKR {fmt(etfBase)} · APIT
              taxable: LKR {fmt(taxableEarnings)}
            </span>
          ) : (
            <span className="mt-1 block text-xs text-amber-600">
              Mark earnings as Taxable (APIT) or EPF/ETF on the Components tab to auto-calculate statutory amounts.
            </span>
          )}
        </p>
        <div className="mt-5 flex flex-wrap gap-x-10 gap-y-2 border-t border-slate-100 pt-5 text-sm">
          <span className="font-medium text-emerald-700">Earnings: LKR {fmt(totalEarnings)}</span>
          <span className="font-medium text-red-600">Employee deductions: LKR {fmt(totalEmployeeDeductions)}</span>
          <span className="font-semibold text-slate-900">Net: LKR {fmt(totalEarnings - totalEmployeeDeductions)}</span>
          {employerStatutoryCost > 0 ? (
            <span className="text-slate-500">Employer statutory: LKR {fmt(employerStatutoryCost)}</span>
          ) : null}
        </div>
        <FlashMessageBanner
          msg={
            saveError
              ? { type: "err", text: saveError }
              : saveOk
                ? { type: "ok", text: saveOk }
                : null
          }
          onClear={() => {
            setSaveError(null);
            setSaveOk(null);
          }}
          className="mt-3"
        />
      </div>

      {loading ? (
        <div className="py-16">
          <Loading />
        </div>
      ) : (
        <div className="grid grid-cols-1 divide-y divide-slate-200/90 md:grid-cols-2 md:divide-x md:divide-y-0">
          <section className="flex min-h-0 min-w-0 flex-col bg-white">
            <div className="border-b border-emerald-200/50 bg-emerald-50 px-4 py-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm font-semibold text-emerald-950">Earnings (income)</span>
                <span className="text-xs font-medium text-emerald-900/85">
                  {earningsDefs.length} component{earningsDefs.length !== 1 ? "s" : ""} • Subtotal LKR{" "}
                  {fmt(totalEarnings)}
                </span>
              </div>
            </div>
            <div className="max-h-[min(62vh,26rem)] min-h-[14rem] overflow-y-auto overscroll-contain">
              {renderSalaryColumnTable(earningsDefs, "earning")}
            </div>
          </section>

          <section className="flex min-h-0 min-w-0 flex-col bg-white">
            <div className="border-b border-rose-200/55 bg-rose-50 px-4 py-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm font-semibold text-rose-950">Deductions</span>
                <span className="text-xs font-medium text-rose-900/85">
                  {visibleDeductionDefs.length} component{visibleDeductionDefs.length !== 1 ? "s" : ""} • Subtotal LKR{" "}
                  {fmt(deductionDisplayTotal)}
                </span>
              </div>
            </div>
            <div className="max-h-[min(62vh,26rem)] min-h-[14rem] overflow-y-auto overscroll-contain">
              {renderSalaryColumnTable(manualDeductionDefs, "deduction")}
              {hasStatutoryBase && statutoryDefs.length > 0 ? (
                <div className="border-t border-slate-200/90 bg-slate-50/50">
                  <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Statutory (auto — {employeeName})
                  </div>
                  {renderSalaryColumnTable(statutoryDefs, "deduction")}
                </div>
              ) : null}
            </div>
          </section>
        </div>
      )}

      {!loading && dirtyCount > 0 ? (
        <div className="border-t border-slate-100 bg-slate-50/80 px-6 py-3">
          <span className="text-xs font-medium text-amber-700">
            {dirtyCount} unsaved change{dirtyCount === 1 ? "" : "s"}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function ImportCompensationModal({ category, batchId, onClose, onImported }: { category: string; batchId?: string; onClose: () => void; onImported: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split("T")[0]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number; errors: string[] } | null>(null);
  const [error, setError] = useState("");

  async function downloadTemplate() {
    const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    const res = await fetch(`${API_BASE_URL}/api/payroll/compensation/import-template?category=${category}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) { setError("Failed to download template"); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `compensation_${category.toLowerCase()}_template.xlsx`; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true); setError(""); setResult(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
      const batchParam = batchId ? `&batchId=${batchId}` : "";
      const res = await fetch(
        `${API_BASE_URL}/api/payroll/compensation/import?effectiveFrom=${effectiveFrom}${batchParam}`,
        { method: "POST", body: fd, headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.message || "Import failed"); }
      const data = await res.json();
      setResult(data);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Import failed"); }
    finally { setUploading(false); }
  }

  return (
    <Modal open onClose={onClose} title={`Import ${category} Components`}>
      <div className="space-y-4">
        <InlinePageAlert message={error} className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 scroll-mt-20" />

        <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
          <p className="mb-2 font-medium text-slate-700">How to import:</p>
          <ol className="ml-4 list-decimal space-y-1">
            <li>Download the template with component codes as column headers</li>
            <li>Fill in employee codes in the first column and amounts under each component</li>
            <li>Upload the completed file. Existing assignments will be updated, new ones created.</li>
          </ol>
        </div>

        <button onClick={downloadTemplate} className="text-sm font-medium text-blue-600 hover:underline">
          Download {category} Template (.xlsx)
        </button>

        <div><label className={labelCls}>Effective From *</label>
          <DatePickerField className={inputCls} value={effectiveFrom} onChange={setEffectiveFrom} />
        </div>

        <div><label className={labelCls}>Upload File (.xlsx)</label>
          <input type="file" accept=".xlsx,.xls" className={inputCls} onChange={e => setFile(e.target.files?.[0] || null)} />
        </div>

        {result && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm">
            <p className="font-medium text-green-800">Import Complete</p>
            <p className="text-green-700">{result.created} created, {result.updated} updated, {result.skipped} skipped</p>
            {result.errors.length > 0 && (
              <div className="mt-2 max-h-24 overflow-y-auto text-xs text-red-600">
                {result.errors.map((e, i) => <div key={i}>{e}</div>)}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          {result ? (
            <Button onClick={onImported}>Done</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
              <Button onClick={handleUpload} disabled={!file || uploading}>
                {uploading ? "Importing..." : "Upload & Import"}
              </Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ═══════════════════════ VARIABLE ENTRY ═══════════════════════ */

interface VarEntry {
  id: string; employeeId: string; componentId: string; amount: number; currency: string;
  employeeName: string; employeeCode: string; department: string;
  componentName: string; componentCode: string;
}

function VariableEntryTab() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [components, setComponents] = useState<Component[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [selectedCompId, setSelectedCompId] = useState("");
  const [entries, setEntries] = useState<VarEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editedAmounts, setEditedAmounts] = useState<Record<string, string>>({});
  const searchFilter = useApplyFilter();
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    apiFetch<PagedResult<Batch>>("/api/payroll/batches?pageSize=200").then(d => {
      const list = d.items ?? [];
      setBatches(list);
      if (list.length > 0) setSelectedBatchId(list[0].id);
    }).catch(() => {});
    apiFetch<Component[]>("/api/payroll/components").then(c => {
      setComponents(c.filter(x => x.isActive));
    }).catch(() => {});
  }, []);

  const selectedBatch = batches.find(b => b.id === selectedBatchId);
  const entryComponents = useMemo(() => {
    if (!selectedBatch) return components.filter(x => x.category === "Variable");
    if (selectedBatch.processType === "Bonus") {
      return components.filter(x => x.category === "OneTime");
    }
    return components.filter(x => x.category === "Variable");
  }, [components, selectedBatch]);

  useEffect(() => {
    setSelectedCompId("");
  }, [selectedBatchId, selectedBatch?.processType]);

  const loadEntries = useCallback(async () => {
    if (!selectedBatchId) return;
    setLoading(true);
    try {
      const url = selectedCompId
        ? `/api/payroll/compensation/variable?batchId=${selectedBatchId}&componentId=${selectedCompId}`
        : `/api/payroll/compensation/variable?batchId=${selectedBatchId}`;
      const data = await apiFetch<VarEntry[]>(url);
      setEntries(data);
      setEditedAmounts({});
    } catch { setEntries([]); }
    finally { setLoading(false); }
  }, [selectedBatchId, selectedCompId]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const variableBatchOpts = useMemo<FormSelectOption[]>(
    () => [
      { value: "", label: "-- Select Batch --" },
      ...batches.map((b) => ({ value: b.id, label: formatBatchLabel(b) })),
    ],
    [batches]
  );
  const variableCompOpts = useMemo<FormSelectOption[]>(
    () => [
      { value: "", label: selectedBatch?.processType === "Bonus" ? "All Bonus Components" : "All Variable Components" },
      ...entryComponents.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` })),
    ],
    [entryComponents, selectedBatch?.processType]
  );

  function handleAmountChange(id: string, value: string) {
    setEditedAmounts(prev => ({ ...prev, [id]: value }));
  }

  const dirtyCount = Object.keys(editedAmounts).length;

  async function handleSave() {
    if (dirtyCount === 0) return;
    setSaving(true); setMsg(null);
    try {
      const updates = Object.entries(editedAmounts).map(([id, val]) => ({
        id, amount: parseFloat(val) || 0,
      }));
      await apiFetch("/api/payroll/compensation/variable/bulk", {
        method: "PUT",
        body: JSON.stringify({ updates }),
      });
      setMsg({ text: `${updates.length} record(s) updated successfully.`, ok: true });
      await loadEntries();
    } catch { setMsg({ text: "Failed to save changes.", ok: false }); }
    finally { setSaving(false); }
  }

  const filtered = entries.filter(e => {
    if (!searchFilter.applied) return true;
    const s = searchFilter.applied.toLowerCase();
    return e.employeeName.toLowerCase().includes(s) || e.employeeCode.toLowerCase().includes(s)
      || e.componentName.toLowerCase().includes(s) || e.department.toLowerCase().includes(s);
  });

  const total = filtered.reduce((s, e) => s + (editedAmounts[e.id] !== undefined ? (parseFloat(editedAmounts[e.id]) || 0) : e.amount), 0);

  const entryLabel = selectedBatch?.processType === "Bonus" ? "bonus" : "variable";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px]">
          <label className={labelCls}>Payroll Batch</label>
          <FormSelect
            value={selectedBatchId}
            onValueChange={setSelectedBatchId}
            options={variableBatchOpts}
            placeholder="-- Select Batch --"
          />
        </div>
        <div className="min-w-[220px]">
          <label className={labelCls}>Component</label>
          <FormSelect
            value={selectedCompId}
            onValueChange={setSelectedCompId}
            options={variableCompOpts}
            placeholder={selectedBatch?.processType === "Bonus" ? "All Bonus Components" : "All Variable Components"}
          />
        </div>
        <div className="min-w-[200px]">
          <label className={labelCls}>Search</label>
          <input
            className={inputCls}
            placeholder="Name, code, department..."
            value={searchFilter.input}
            onChange={(e) => searchFilter.setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") searchFilter.apply();
            }}
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          {dirtyCount > 0 && (
            <span className="text-xs text-amber-600 font-medium">{dirtyCount} unsaved change{dirtyCount !== 1 ? "s" : ""}</span>
          )}
          <Button onClick={handleSave} disabled={saving || dirtyCount === 0}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {selectedBatch && (
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span>Batch: <strong className="text-slate-700">{selectedBatch.batchCode}</strong></span>
          <span>Type: <strong className="text-slate-700">{formatProcessType(selectedBatch.processType)}</strong></span>
          <span>Status: <Badge status={selectedBatch.status} /></span>
          <span>Period: <strong className="text-slate-700">{MONTHS[selectedBatch.month - 1]} {selectedBatch.year}</strong></span>
        </div>
      )}

      <FlashMessageBanner
        msg={msg ? { type: msg.ok ? "ok" : "err", text: msg.text } : null}
        onClear={() => setMsg(null)}
        className=""
      />

      {!selectedBatchId ? (
        <EmptyState text="Select a payroll batch to view batch entries" />
      ) : loading ? (
        <Loading />
      ) : filtered.length === 0 ? (
        <EmptyState text={entries.length === 0 ? `No ${entryLabel} components assigned for this batch` : "No matching records found"} />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">#</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Employee Code</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Employee Name</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Department</th>
                  {!selectedCompId && <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Component</th>}
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">Amount</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, i) => {
                  const edited = editedAmounts[e.id];
                  const isDirty = edited !== undefined;
                  return (
                    <tr key={e.id} className={`border-b border-slate-50 ${isDirty ? "bg-amber-50/40" : "hover:bg-slate-50/50"}`}>
                      <td className="px-4 py-2 text-slate-400">{i + 1}</td>
                      <td className="px-4 py-2 font-mono text-xs">{e.employeeCode}</td>
                      <td className="px-4 py-2 font-medium text-slate-700">{e.employeeName}</td>
                      <td className="px-4 py-2 text-slate-500">{e.department}</td>
                      {!selectedCompId && <td className="px-4 py-2 text-slate-500">{e.componentName} <span className="text-slate-400">({e.componentCode})</span></td>}
                      <td className="px-4 py-2 text-right">
                        <input type="number" step="0.01" className="w-32 rounded border border-slate-200 px-2 py-1 text-right text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                          value={isDirty ? edited : e.amount}
                          onChange={ev => handleAmountChange(e.id, ev.target.value)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50 font-semibold">
                  <td colSpan={selectedCompId ? 4 : 5} className="px-4 py-2.5 text-right text-xs text-slate-600">
                    Total ({filtered.length} record{filtered.length !== 1 ? "s" : ""})
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm text-slate-800">{fmt(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════ PAYROLL RUN ═══════════════════════════ */

function PayrollRunTab() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [batchStatements, setBatchStatements] = useState<Statement[]>([]);
  const [importBatch, setImportBatch] = useState<Batch | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError("");
    apiFetch<PagedResult<Batch>>("/api/payroll/batches?pageSize=50")
      .then(d => setBatches(sortBatchesNewestFirst(pagedItems(d))))
      .catch((err) => {
        setBatches([]);
        setLoadError(err instanceof Error ? err.message : "Could not load payroll batches.");
      })
      .finally(() => setLoading(false));
  }, []);

  async function refreshBatches() {
    const d = await apiFetch<PagedResult<Batch>>("/api/payroll/batches?pageSize=50");
    const items = sortBatchesNewestFirst(pagedItems(d));
    setBatches(items);
    return items;
  }

  useEffect(() => { load(); }, [load]);
  const batchesPager = useClientPagination(batches);

  async function handleAction(batchId: string, action: string) {
    setActionLoading(batchId);
    try {
      if (action === "calculate") {
        if (!(await appConfirm("Rebuild pay slips for every employee in this batch from the Employee Salary tab? Includes Basic, allowances, deductions, Poya pay, and EPF/ETF."))) {
          setActionLoading(null);
          return;
        }
        await apiFetch(`/api/payroll/batches/${batchId}/calculate`, { method: "POST" });
        const items = await refreshBatches();
        const updated = items.find(b => b.id === batchId);
        if (updated) await viewBatchDetails(updated);
        return;
      } else if (action === "review") {
        if (!(await appConfirm("Mark this payroll batch as reviewed? Confirm you have checked gross, EPF/ETF, deductions, and net pay."))) {
          setActionLoading(null);
          return;
        }
        await apiFetch(`/api/payroll/batches/${batchId}/review`, { method: "PUT" });
      } else if (action === "return") {
        if (!(await appConfirm("Send this batch back to Calculated so it can be recalculated?"))) {
          setActionLoading(null);
          return;
        }
        await apiFetch(`/api/payroll/batches/${batchId}/return`, { method: "PUT" });
      } else if (action === "approve") {
        if (!(await appConfirm("Approve this salary batch? Pay slips will lock using the last Calculate totals — save Employee Salary and run Calculate (or Sync from Employee Salary) first so EPF and allowances match."))) {
          setActionLoading(null);
          return;
        }
        await apiFetch(`/api/payroll/batches/${batchId}/approve`, { method: "PUT" });
      } else if (action === "finalize") {
        if (!(await appConfirm("Finalize this payroll batch? Payslips will be locked for this period. Only continue if payroll is ready for release."))) {
          setActionLoading(null);
          return;
        }
        await apiFetch(`/api/payroll/batches/${batchId}/finalize`, { method: "PUT" });
      } else if (action === "delete") {
        if (!(await appConfirm("Delete this batch?"))) { setActionLoading(null); return; }
        await apiFetch(`/api/payroll/batches/${batchId}`, { method: "DELETE" });
        setSelectedBatch(null);
        await refreshBatches();
        return;
      }
      const items = await refreshBatches();
      const updated = items.find(b => b.id === batchId);
      if (updated) await viewBatchDetails(updated);
    } catch (err: unknown) {
      await appAlert(err instanceof Error ? err.message : "Action failed");
    } finally { setActionLoading(null); }
  }

  async function viewBatchDetails(batch: Batch) {
    setSelectedBatch(batch);
    const data = await apiFetch<Statement[]>(`/api/payroll/batches/${batch.id}/statements`);
    setBatchStatements(Array.isArray(data) ? data : []);
  }

  if (loading) return <Loading />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Payroll Batches</h2>
          <p className="mt-0.5 text-xs text-slate-500">Salary batches: calculate (includes EPF/ETF) → review → HR approve salary (Finalized).</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ New Batch</Button>
      </div>

      {loadError ? (
        <InlinePageAlert message={loadError} className="mb-4 rounded-xl border border-rose-200/80 bg-rose-50 px-3 py-2 text-sm text-rose-800" />
      ) : null}
      {batches.length === 0 ? <EmptyState text="No payroll batches yet. Create one to start." /> : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b bg-slate-50 text-xs text-slate-500">
              <th className="px-4 py-3 font-medium">Batch</th><th className="px-4 py-3 font-medium">Type</th><th className="px-4 py-3 font-medium">Period</th>
              <th className="px-4 py-3 font-medium">Employees</th><th className="px-4 py-3 font-medium text-right">Gross</th>
              <th className="px-4 py-3 font-medium text-right">Net</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr></thead>
            <tbody>
              {batchesPager.pageItems.map(b => (
                <tr key={b.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-4 py-3">
                    <button onClick={() => viewBatchDetails(b)} className="font-medium text-blue-600 hover:underline">{b.batchCode}</button>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatProcessType(b.processType)}</td>
                  <td className="px-4 py-3 text-slate-600">
                    <div>{MONTHS[b.month - 1]} {b.year}</div>
                    <div className="text-xs text-slate-400">{formatBatchPeriod(b)}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{b.status === "Draft" ? `${b.selectedCount} selected` : b.employeeCount}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700">{b.status === "Draft" ? "—" : formatPayrollAmount(b.totalGross)}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700">{b.status === "Draft" ? "—" : formatPayrollAmount(b.totalNet)}</td>
                  <td className="px-4 py-3"><Badge status={b.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1">
                      {(b.status === "Draft" || b.status === "Calculated")
                        && (b.processType === "Salary" || b.processType === "OtherTransactions") && (
                        <ActionBtn label="Import OT/No-pay" onClick={() => setImportBatch(b)} loading={false} />
                      )}
                      {b.status === "Draft" && b.processType === "Salary" && (
                        <ActionBtn label="Calculate from Employee Salary" onClick={() => handleAction(b.id, "calculate")} loading={actionLoading === b.id} />
                      )}
                      {b.status === "Draft" && b.processType !== "Salary" && (
                        <ActionBtn label="Calculate" onClick={() => handleAction(b.id, "calculate")} loading={actionLoading === b.id} />
                      )}
                      {b.status === "Calculated" && b.processType === "Salary" && (
                        <ActionBtn label="Sync from Employee Salary" onClick={() => handleAction(b.id, "calculate")} loading={actionLoading === b.id} />
                      )}
                      {b.status === "Calculated" && b.processType !== "Salary" && (
                        <ActionBtn label="Recalculate" onClick={() => handleAction(b.id, "calculate")} loading={actionLoading === b.id} />
                      )}
                      {b.status === "Calculated" && <ActionBtn label="Review" onClick={() => handleAction(b.id, "review")} loading={actionLoading === b.id} />}
                      {(b.status === "Calculated" || b.status === "Reviewed") && <ActionBtn label="Approve" onClick={() => handleAction(b.id, "approve")} loading={actionLoading === b.id} />}
                      {b.status === "Reviewed" && (
                        <button type="button" onClick={() => handleAction(b.id, "return")} className="rounded px-2 py-1 text-xs text-amber-600 hover:bg-amber-50">Send back</button>
                      )}
                      {b.status === "Approved" && <ActionBtn label="Finalize" onClick={() => handleAction(b.id, "finalize")} loading={actionLoading === b.id} />}
                      {(b.status === "Draft" || b.status === "Calculated") && (
                        <button type="button" onClick={() => handleAction(b.id, "delete")} className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50">Delete</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <TablePagination page={batchesPager.page} totalPages={batchesPager.totalPages} totalCount={batchesPager.totalCount} pageSize={batchesPager.pageSize} onPageChange={batchesPager.setPage} />
        </div>
      )}

      {showCreate && <CreateBatchModal onClose={() => setShowCreate(false)} onCreated={load} />}

      {selectedBatch && (
        <BatchDetailModal
          batch={selectedBatch}
          statements={batchStatements}
          actionLoading={actionLoading === selectedBatch.id}
          onClose={() => setSelectedBatch(null)}
          onAction={(action) => handleAction(selectedBatch.id, action)}
        />
      )}

      {importBatch && (
        <ImportAttendanceLeaveModal
          batch={importBatch}
          onClose={() => setImportBatch(null)}
          onImported={() => { setImportBatch(null); load(); }}
        />
      )}
    </div>
  );
}

function ImportAttendanceLeaveModal({
  batch,
  onClose,
  onImported,
}: {
  batch: Batch;
  onClose: () => void;
  onImported: () => void;
}) {
  const [preview, setPreview] = useState<AttendanceImportPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    apiFetch<AttendanceImportPreview>(`/api/payroll/batches/${batch.id}/import-attendance-leave/preview`)
      .then(setPreview)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load preview"))
      .finally(() => setLoading(false));
  }, [batch.id]);

  async function handleImport() {
    setImporting(true);
    setError("");
    try {
      await apiFetch(`/api/payroll/batches/${batch.id}/import-attendance-leave`, { method: "POST" });
      onImported();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Import Attendance & Leave — ${batch.batchCode}`} wide>
      <div className="mb-4 space-y-1 text-sm text-slate-600">
        <div>Type: <strong className="text-slate-800">{formatProcessType(batch.processType)}</strong></div>
        <div>Period: <strong className="text-slate-800">{formatBatchPeriod(batch)}</strong></div>
        <p className="text-xs text-slate-500">
          Uses only Approved OT hours. Pending, rejected, and supervisor-not-assigned OT is excluded.
          No-pay combines attendance absences with approved unpaid leave for this exact period.
          Poya pay is Basic ÷ 30 × days the employee was present (or half-day) on a Poya holiday.
        </p>
      </div>

      <InlinePageAlert message={error} className="mb-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 scroll-mt-20" />

      {loading ? <Loading /> : preview ? (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <div className="rounded-lg bg-green-50 p-3"><div className="text-xs text-green-700">Approved OT</div><div className="font-semibold text-green-900">{preview.employeesWithApprovedOt}</div></div>
            <div className="rounded-lg bg-amber-50 p-3"><div className="text-xs text-amber-700">Missing OT approval</div><div className="font-semibold text-amber-900">{preview.employeesMissingOtApproval}</div></div>
            <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">With no-pay days</div><div className="font-semibold text-slate-800">{preview.employeesWithNopay}</div></div>
            <div className="rounded-lg bg-indigo-50 p-3"><div className="text-xs text-indigo-700">With Poya days</div><div className="font-semibold text-indigo-900">{preview.employeesWithPoya ?? 0}</div></div>
          </div>

          <div className="max-h-[360px] overflow-y-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Employee</th>
                  <th className="px-3 py-2 font-medium text-right">OT Hrs</th>
                  <th className="px-3 py-2 font-medium text-right">OT Amount</th>
                  <th className="px-3 py-2 font-medium text-right">Poya</th>
                  <th className="px-3 py-2 font-medium text-right">Att. NP</th>
                  <th className="px-3 py-2 font-medium text-right">Leave NP</th>
                  <th className="px-3 py-2 font-medium text-right">Total NP</th>
                </tr>
              </thead>
              <tbody>
                {preview.lines.map((line) => (
                  <tr key={line.employeeId} className="border-b border-slate-50">
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-700">{line.employeeName}</div>
                      <div className="text-xs text-slate-400">{line.employeeCode}</div>
                      {line.warning && <div className="text-xs text-amber-600">{line.warning}</div>}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{line.approvedOtHours || "—"}</td>
                    <td className="px-3 py-2 text-right font-mono">{line.otAmount ? `LKR ${fmt(line.otAmount)}` : "—"}</td>
                    <td className="px-3 py-2 text-right font-medium">{line.poyaDaysWorked || "—"}</td>
                    <td className="px-3 py-2 text-right">{line.attendanceNopayDays || "—"}</td>
                    <td className="px-3 py-2 text-right">{line.leaveNopayDays || "—"}</td>
                    <td className="px-3 py-2 text-right font-medium">{line.totalNopayDays || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex justify-end gap-3">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={handleImport} disabled={importing}>
              {importing ? "Importing..." : "Import into Batch"}
            </Button>
          </div>
        </>
      ) : (
        <EmptyState text="No preview data available." />
      )}
    </Modal>
  );
}

function CreateBatchModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const now = new Date();
  const initialMonth = now.getMonth() + 1;
  const initialYear = now.getFullYear();
  const initialRange = monthDateRange(initialMonth, initialYear);

  const [step, setStep] = useState<1 | 2>(1);
  const [processType, setProcessType] = useState("Salary");
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);
  const [effectiveFrom, setEffectiveFrom] = useState(initialRange.from);
  const [effectiveTo, setEffectiveTo] = useState(initialRange.to);
  const [notes, setNotes] = useState("");

  const [employees, setEmployees] = useState<EligibleEmployee[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const searchFilter = useApplyFilter();
  const [filterDept, setFilterDept] = useState("");
  const [filterGrade, setFilterGrade] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [empLoading, setEmpLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const range = monthDateRange(month, year);
    setEffectiveFrom(range.from);
    setEffectiveTo(range.to);
  }, [month, year]);

  useEffect(() => {
    if (step !== 2) return;
    setEmpLoading(true);
    setError("");
    apiFetch<EligibleEmployee[]>(
      `/api/payroll/eligible-employees?month=${month}&year=${year}&processType=${encodeURIComponent(processType)}`,
    )
      .then(emps => { setEmployees(emps); setSelected(new Set(emps.map(e => e.id))); })
      .catch(() => setError("Failed to load employees"))
      .finally(() => setEmpLoading(false));
  }, [step, month, year, processType]);

  const { departments, grades, locations } = useMemo(
    () => ({
      departments: Array.from(new Set(employees.map((e) => e.department).filter(Boolean))).sort(),
      grades: Array.from(new Set(employees.map((e) => e.grade).filter(Boolean))).sort(),
      locations: Array.from(new Set(employees.map((e) => e.location).filter(Boolean))).sort(),
    }),
    [employees]
  );

  const createBatchDeptOpts = useMemo<FormSelectOption[]>(
    () => [{ value: "", label: "All Departments" }, ...departments.map((d) => ({ value: d, label: d }))],
    [departments]
  );
  const createBatchGradeOpts = useMemo<FormSelectOption[]>(
    () => [{ value: "", label: "All Grades" }, ...grades.map((g) => ({ value: g, label: g }))],
    [grades]
  );
  const createBatchLocationOpts = useMemo<FormSelectOption[]>(
    () => [{ value: "", label: "All Locations" }, ...locations.map((l) => ({ value: l, label: l }))],
    [locations]
  );

  const filtered = employees.filter(e => {
    if (filterDept && e.department !== filterDept) return false;
    if (filterGrade && e.grade !== filterGrade) return false;
    if (filterLocation && e.location !== filterLocation) return false;
    if (!searchFilter.applied) return true;
    const q = searchFilter.applied.toLowerCase();
    return e.firstName.toLowerCase().includes(q) || e.lastName.toLowerCase().includes(q)
      || e.employeeCode.toLowerCase().includes(q) || e.department.toLowerCase().includes(q);
  });

  const allFilteredSelected = filtered.length > 0 && filtered.every(e => selected.has(e.id));

  function toggleAll() {
    const next = new Set(selected);
    if (allFilteredSelected) { filtered.forEach(e => next.delete(e.id)); } else { filtered.forEach(e => next.add(e.id)); }
    setSelected(next);
  }

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }

  function goToEmployeeStep() {
    if (!effectiveFrom || !effectiveTo) {
      setError("Effective date range is required");
      return;
    }
    if (effectiveFrom > effectiveTo) {
      setError("Effective end date must be on or after the start date");
      return;
    }
    setError("");
    setStep(2);
  }

  async function handleCreate() {
    if (selected.size === 0) { setError("Select at least one employee"); return; }
    if (!effectiveFrom || !effectiveTo) { setError("Effective date range is required"); return; }
    if (effectiveFrom > effectiveTo) { setError("Effective end date must be on or after the start date"); return; }
    setSubmitting(true); setError("");
    try {
      await apiFetch("/api/payroll/batches", {
        method: "POST",
        body: JSON.stringify({
          processType, month, year,
          effectiveFrom, effectiveTo,
          notes: notes || null,
          employeeIds: Array.from(selected),
        }),
      });
      onCreated(); onClose();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed"); }
    finally { setSubmitting(false); }
  }

  return (
    <Modal open onClose={onClose} title={step === 1 ? "New Payroll Batch" : `Select Employees — ${formatProcessType(processType)} — ${MONTHS[month - 1]} ${year}`} wide={step === 2}>
      <InlinePageAlert message={error} className="mb-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 scroll-mt-20" />

      {step === 1 && (
        <div className="space-y-4">
          <div><label className={labelCls}>Process Type *</label>
            <FormSelect
              value={processType}
              onValueChange={setProcessType}
              options={PROCESS_TYPE_OPTS}
              placeholder="Process Type"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className={labelCls}>Month *</label>
              <FormSelect
                value={String(month)}
                onValueChange={(v) => setMonth(Number(v))}
                options={MONTH_NUMBER_OPTS}
                placeholder="Month"
              />
            </div>
            <div><label className={labelCls}>Year *</label><input type="number" className={inputCls} value={year} onChange={e => setYear(Number(e.target.value))} /></div>
          </div>
          <div>
            <label className={labelCls}>Effective Date Range *</label>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <span className="mb-1 block text-[11px] text-slate-400">From</span>
                <DatePickerField className={inputCls} value={effectiveFrom} onChange={setEffectiveFrom} />
              </div>
              <div>
                <span className="mb-1 block text-[11px] text-slate-400">To</span>
                <DatePickerField className={inputCls} value={effectiveTo} onChange={setEffectiveTo} />
              </div>
            </div>
          </div>
          <div><label className={labelCls}>Notes</label><textarea className={inputCls} rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={goToEmployeeStep}>Next — Select Employees</Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            Employees already in another {formatProcessType(processType)} batch for {MONTHS[month - 1]} {year} are hidden so they do not get a second payslip. Select only staff who are not yet in this month’s run (for example a newly added employee).
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className={inputCls + " !mb-0 min-w-[180px] flex-1"}
              placeholder="Search name or code… (Enter)"
              value={searchFilter.input}
              onChange={(e) => searchFilter.setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") searchFilter.apply();
              }}
            />
            <div className="w-auto min-w-[140px] shrink-0">
              <FormSelect
                value={filterDept}
                onValueChange={setFilterDept}
                options={createBatchDeptOpts}
                placeholder="All Departments"
                className="!mb-0"
              />
            </div>
            <div className="w-auto min-w-[120px] shrink-0">
              <FormSelect
                value={filterGrade}
                onValueChange={setFilterGrade}
                options={createBatchGradeOpts}
                placeholder="All Grades"
                className="!mb-0"
              />
            </div>
            <div className="w-auto min-w-[130px] shrink-0">
              <FormSelect
                value={filterLocation}
                onValueChange={setFilterLocation}
                options={createBatchLocationOpts}
                placeholder="All Locations"
                className="!mb-0"
              />
            </div>
            <span className="whitespace-nowrap text-sm text-slate-500">{selected.size}/{employees.length} selected</span>
          </div>

          {empLoading ? <Loading /> : (
            <div className="max-h-[400px] overflow-y-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="border-b text-xs text-slate-500">
                    <th className="px-3 py-2.5"><input type="checkbox" checked={allFilteredSelected} onChange={toggleAll} className="rounded" /></th>
                    <th className="px-3 py-2.5 font-medium">Employee</th>
                    <th className="px-3 py-2.5 font-medium">Code</th>
                    <th className="px-3 py-2.5 font-medium">Department</th>
                    <th className="px-3 py-2.5 font-medium">Grade</th>
                    <th className="px-3 py-2.5 font-medium">Location</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">
                      {employees.length === 0
                        ? `No employees left for this ${formatProcessType(processType)} run. Everyone with salary is already in a ${MONTHS[month - 1]} ${year} batch.`
                        : "No employees match the current filters"}
                    </td></tr>
                  ) : filtered.map(e => (
                    <tr key={e.id} className="border-b border-slate-50 hover:bg-slate-50/50 cursor-pointer" onClick={() => toggle(e.id)}>
                      <td className="px-3 py-2"><input type="checkbox" checked={selected.has(e.id)} onChange={() => toggle(e.id)} className="rounded" /></td>
                      <td className="px-3 py-2 font-medium text-slate-700">{e.firstName} {e.lastName}</td>
                      <td className="px-3 py-2 text-slate-500">{e.employeeCode}</td>
                      <td className="px-3 py-2 text-slate-500">{e.department}</td>
                      <td className="px-3 py-2 text-slate-500">{e.grade}</td>
                      <td className="px-3 py-2 text-slate-500">{e.location}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={handleCreate} disabled={submitting || selected.size === 0}>
              {submitting ? "Creating..." : `Create Batch (${selected.size} employees)`}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function BatchDetailModal({
  batch,
  statements,
  actionLoading,
  onClose,
  onAction,
}: {
  batch: Batch;
  statements: Statement[];
  actionLoading: boolean;
  onClose: () => void;
  onAction: (action: string) => void;
}) {
  const [selectedStmt, setSelectedStmt] = useState<Statement | null>(null);
  const [stmtDetail, setStmtDetail] = useState<Statement | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const canApproveSalary = batch.status === "Calculated" || batch.status === "Reviewed";
  const sortedStatements = useMemo(
    () => [...statements].sort((a, b) => compareEmployeeCode(a.employeeCode, b.employeeCode)),
    [statements],
  );

  async function viewPayslip(stmt: Statement) {
    if (!isApprovedPaySlip(stmt.status)) return;
    setViewingId(stmt.id);
    setSelectedStmt(stmt);
    try {
      if (stmt.lines && stmt.lines.length > 0) {
        setStmtDetail(stmt);
        return;
      }
      const detail = await apiFetch<Statement>(`/api/payroll/statements/${stmt.id}`);
      setStmtDetail(detail);
    } finally {
      setViewingId(null);
    }
  }

  async function handlePrint(stmt: Statement) {
    if (!isApprovedPaySlip(stmt.status)) return;
    setPrintingId(stmt.id);
    try {
      await printStatement(stmt);
    } catch {
      void appAlert("Could not open payslip for printing.");
    } finally {
      setPrintingId(null);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Batch: ${batch.batchCode}`} wide>
      <div className="mb-4 flex flex-wrap gap-3 text-sm text-slate-600">
        <span>Type: <strong className="text-slate-800">{formatProcessType(batch.processType)}</strong></span>
        <span>Period: <strong className="text-slate-800">{MONTHS[batch.month - 1]} {batch.year}</strong></span>
        <span>Effective: <strong className="text-slate-800">{formatBatchPeriod(batch)}</strong></span>
        <span>Status: <Badge status={batch.status} /></span>
        {batch.reviewedBy && (
          <span>Reviewed by: <strong className="text-slate-800">{batch.reviewedBy}</strong>
            {batch.reviewedAt ? ` · ${formatDateTime(batch.reviewedAt)}` : ""}
          </span>
        )}
        {batch.approvedBy && (
          <span>Approved by: <strong className="text-slate-800">{batch.approvedBy}</strong>
            {batch.approvedAt ? ` · ${formatDateTime(batch.approvedAt)}` : ""}
          </span>
        )}
      </div>
      {(batch.status === "Calculated" || batch.status === "Reviewed" || batch.status === "Approved") && (
        <div className="mb-4 flex flex-wrap gap-2">
          {batch.status === "Calculated" && batch.processType === "Salary" && (
            <ActionBtn label="Sync from Employee Salary" onClick={() => onAction("calculate")} loading={actionLoading} />
          )}
          {batch.status === "Calculated" && batch.processType !== "Salary" && (
            <ActionBtn label="Recalculate" onClick={() => onAction("calculate")} loading={actionLoading} />
          )}
          {batch.status === "Calculated" && <ActionBtn label="Review" onClick={() => onAction("review")} loading={actionLoading} />}
          {canApproveSalary && <ActionBtn label="Approve salary" onClick={() => onAction("approve")} loading={actionLoading} />}
          {batch.status === "Reviewed" && (
            <button type="button" onClick={() => onAction("return")} className="rounded px-2 py-1 text-xs text-amber-600 hover:bg-amber-50">Send back</button>
          )}
          {batch.status === "Approved" && (
            <button
              type="button"
              onClick={() => onAction("finalize")}
              disabled={actionLoading}
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeCls.Finalized} hover:opacity-80 disabled:opacity-50`}
            >
              {actionLoading ? "..." : "Finalized"}
            </button>
          )}
        </div>
      )}
      <div className="mb-4 grid gap-3 sm:grid-cols-4 text-sm">
        <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-400">Gross</div><div className="font-semibold">LKR {fmt(batch.totalGross)}</div></div>
        <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-400">Deductions</div><div className="font-semibold">LKR {fmt(batch.totalDeductions)}</div></div>
        <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-400">Net</div><div className="font-semibold">LKR {fmt(batch.totalNet)}</div></div>
        <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-400">Employer Cost</div><div className="font-semibold">LKR {fmt(batch.totalEmployerCost)}</div></div>
      </div>

      {statements.length === 0 ? <EmptyState text="No pay slips in this batch." /> : (
        <div className="max-h-[400px] overflow-x-auto overflow-y-auto rounded-lg border border-slate-100">
          <table className="w-full min-w-[720px] table-fixed border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90">
                <th className="w-[34%] px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Employee
                </th>
                <th className="w-[17%] px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Gross
                </th>
                <th className="w-[17%] px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Deductions
                </th>
                <th className="w-[17%] px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Net
                </th>
                <th className="w-[15%] px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedStatements.map(s => (
                <tr key={s.id} className="border-b border-slate-100 last:border-b-0">
                  <td className="align-middle px-3 py-3">
                    <div className="font-medium leading-snug text-slate-700">{s.employeeName}</div>
                    {s.employeeCode ? (
                      <div className="mt-0.5 text-xs text-slate-400">{s.employeeCode}</div>
                    ) : null}
                  </td>
                  <td className="align-middle whitespace-nowrap px-3 py-3 text-right font-mono text-sm tabular-nums text-slate-700">
                    LKR {fmt(s.grossPay)}
                  </td>
                  <td className="align-middle whitespace-nowrap px-3 py-3 text-right font-mono text-sm tabular-nums text-red-600">
                    LKR {fmt(s.totalDeductions)}
                  </td>
                  <td className="align-middle whitespace-nowrap px-3 py-3 text-right font-mono text-sm font-semibold tabular-nums text-slate-800">
                    LKR {fmt(s.netPay)}
                  </td>
                      <td className="align-middle px-3 py-3">
                        <PaySlipActionLinks
                          statement={s}
                          viewingId={viewingId}
                          printingId={printingId}
                          onView={() => void viewPayslip(s)}
                          onPrint={() => void handlePrint(s)}
                        />
                      </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {stmtDetail && stmtDetail.lines && (
        <PayslipModal
          statement={stmtDetail}
          canApproveSalary={canApproveSalary}
          approveLoading={actionLoading}
          onApprove={() => onAction("approve")}
          onClose={() => { setStmtDetail(null); setSelectedStmt(null); }}
        />
      )}
    </Modal>
  );
}

function PayslipModal({
  statement,
  onClose,
  canApproveSalary = false,
  approveLoading = false,
  onApprove,
}: {
  statement: Statement;
  onClose: () => void;
  canApproveSalary?: boolean;
  approveLoading?: boolean;
  onApprove?: () => void;
}) {
  const [printing, setPrinting] = useState(false);
  const earnings = statement.lines?.filter(l => l.type === "Earning" && !l.isEmployerContribution) || [];
  const deductions = statement.lines?.filter(l => (l.type === "Deduction" || l.type === "StatutoryDeduction") && !l.isEmployerContribution) || [];
  const employerItems = statement.lines?.filter(l => l.isEmployerContribution) || [];

  async function handlePrint() {
    setPrinting(true);
    try {
      await printStatement(statement);
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Could not print payslip");
    } finally {
      setPrinting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Payslip — ${statement.employeeName}`} wide>
      <div className="mb-4 text-sm text-slate-500">
        {MONTHS[statement.month - 1]} {statement.year} &middot; {statement.employeeCode} &middot; {statement.department || ""}
      </div>
      <div className="mb-5 grid gap-3 sm:grid-cols-4 text-sm">
        <div className="rounded-lg bg-slate-50 p-3">
          <div className="text-xs text-slate-400">Gross</div>
          <div className="font-semibold tabular-nums">LKR {fmt(statement.grossPay)}</div>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <div className="text-xs text-slate-400">Deductions</div>
          <div className="font-semibold tabular-nums text-red-600">LKR {fmt(statement.totalDeductions)}</div>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <div className="text-xs text-slate-400">Net</div>
          <div className="font-semibold tabular-nums">LKR {fmt(statement.netPay)}</div>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <div className="text-xs text-slate-400">Employer Cost</div>
          <div className="font-semibold tabular-nums">LKR {fmt(statement.employerCost)}</div>
        </div>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-green-700">Earnings</h4>
          <table className="w-full text-sm">
            <tbody>
              {earnings.map(l => (
                <tr key={l.id} className="border-b border-slate-50">
                  <td className="py-1.5 text-slate-700">{l.componentName}</td>
                  <td className="py-1.5 text-right font-mono">LKR {fmt(l.amount)}</td>
                </tr>
              ))}
              <tr className="font-semibold"><td className="py-1.5">Total Earnings</td><td className="py-1.5 text-right font-mono">LKR {fmt(statement.totalEarnings)}</td></tr>
            </tbody>
          </table>
        </div>
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-red-600">Deductions</h4>
          <table className="w-full text-sm">
            <tbody>
              {deductions.map(l => (
                <tr key={l.id} className="border-b border-slate-50">
                  <td className="py-1.5 text-slate-700">{l.componentName}</td>
                  <td className="py-1.5 text-right font-mono">LKR {fmt(l.amount)}</td>
                </tr>
              ))}
              <tr className="font-semibold"><td className="py-1.5">Total Deductions</td><td className="py-1.5 text-right font-mono">LKR {fmt(statement.totalDeductions)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 p-4">
        <span className="text-lg font-bold text-slate-800">Net Pay</span>
        <span className="text-2xl font-bold text-green-700">LKR {fmt(statement.netPay)}</span>
      </div>
      {employerItems.length > 0 && (
        <div className="mt-4">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Employer Contributions</h4>
          <table className="w-full text-sm">
            <tbody>
              {employerItems.map(l => (
                <tr key={l.id} className="border-b border-slate-50">
                  <td className="py-1.5 text-slate-600">{l.componentName}</td>
                  <td className="py-1.5 text-right font-mono text-slate-600">LKR {fmt(l.amount)}</td>
                </tr>
              ))}
              <tr className="font-semibold"><td className="py-1.5">Total Employer Cost</td><td className="py-1.5 text-right font-mono">LKR {fmt(statement.employerCost)}</td></tr>
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>Close</Button>
        {canApproveSalary && onApprove && (
          <Button variant="secondary" onClick={onApprove} disabled={approveLoading}>
            {approveLoading ? "Approving…" : "Approve salary"}
          </Button>
        )}
        {isApprovedPaySlip(statement.status) ? (
          <Button onClick={() => void handlePrint()} disabled={printing}>
            {printing ? "Preparing…" : "Print"}
          </Button>
        ) : null}
      </div>
    </Modal>
  );
}

/* ═══════════════════════ PAY STATEMENTS ═══════════════════════ */

type PaySlipSearchHit = {
  id: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  employeeCode: string;
  departmentName?: string | null;
};

function paySlipHitName(hit: PaySlipSearchHit): string {
  const fromParts = `${hit.firstName ?? ""} ${hit.lastName ?? ""}`.trim();
  return (hit.fullName ?? "").trim() || fromParts || hit.employeeCode || "Unknown";
}

function PayStatementsTab() {
  const [statements, setStatements] = useState<Statement[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [viewStmt, setViewStmt] = useState<Statement | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const searchFilter = useApplyFilter();
  const pageSize = 20;
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const suggestDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [suggestions, setSuggestions] = useState<PaySlipSearchHit[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (searchFilter.applied.trim()) params.set("search", searchFilter.applied.trim());
    apiFetch<PagedResult<Statement>>(`/api/payroll/statements?${params.toString()}`)
      .then(d => {
        setStatements(pagedItems(d));
        setTotalCount(d.totalCount ?? d.TotalCount ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, searchFilter.applied]);

  useEffect(() => { load(); }, [load]);

  useEffect(
    () => () => {
      if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
    },
    [],
  );

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!searchWrapRef.current?.contains(e.target as Node)) setSuggestOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const fetchSuggestions = useCallback(async (raw: string) => {
    const q = raw.trim();
    if (q.length === 0) {
      setSuggestions([]);
      setSuggestOpen(false);
      setSuggestLoading(false);
      return;
    }
    setSuggestLoading(true);
    setSuggestOpen(true);
    try {
      const params = new URLSearchParams({ pageSize: "8", excludeTerminated: "true", search: q });
      let res: { items?: PaySlipSearchHit[] };
      try {
        res = await apiFetch<{ items: PaySlipSearchHit[] }>(`/api/employees/lookup?${params}`);
      } catch {
        res = await apiFetch<{ items: PaySlipSearchHit[] }>(`/api/employees?${params}`);
      }
      setSuggestions(res.items ?? []);
    } catch {
      setSuggestions([]);
    } finally {
      setSuggestLoading(false);
    }
  }, []);

  function queueSuggestions(raw: string) {
    if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
    suggestDebounceRef.current = setTimeout(() => void fetchSuggestions(raw), 280);
  }

  function applySearch() {
    searchFilter.apply();
    setSuggestOpen(false);
    setSuggestions([]);
    setPage(1);
  }

  function pickSuggestion(hit: PaySlipSearchHit) {
    searchFilter.setApplied(paySlipHitName(hit));
    searchFilter.setInput("");
    setSuggestOpen(false);
    setSuggestions([]);
    setPage(1);
  }

  function clearSearch() {
    searchFilter.clear();
    setSuggestOpen(false);
    setSuggestions([]);
    setPage(1);
  }

  async function viewPayslip(stmt: Statement) {
    if (!isApprovedPaySlip(stmt.status)) return;
    setViewingId(stmt.id);
    try {
      const detail = await apiFetch<Statement>(`/api/payroll/statements/${stmt.id}`);
      setViewStmt(detail);
    } catch {
      void appAlert("Could not load payslip.");
    } finally {
      setViewingId(null);
    }
  }

  async function handlePrint(stmt: Statement) {
    if (!isApprovedPaySlip(stmt.status)) return;
    setPrintingId(stmt.id);
    try {
      await printStatement(stmt);
    } catch {
      void appAlert("Could not open payslip for printing.");
    } finally {
      setPrintingId(null);
    }
  }

  async function syncAllFromEmployeeSalary() {
    if (!(await appConfirm(
      "Rebuild all open pay slips from the Employee Salary tab? Every employee in each draft or calculated salary batch will be recalculated (Basic, allowances, deductions, EPF/ETF)."
    ))) {
      return;
    }
    setSyncMsg(null);
    setSyncing(true);
    try {
      const res = await apiFetch<{ message?: string; recalculated?: number; errors?: string[] }>(
        "/api/payroll/batches/sync-from-employee-salary",
        { method: "POST" }
      );
      const errNote = res.errors?.length ? ` ${res.errors.length} batch(es) could not update.` : "";
      setSyncMsg({ type: "ok", text: `${res.message ?? "Pay slips updated."}${errNote}` });
      setPage(1);
      load();
    } catch (err: unknown) {
      setSyncMsg({
        type: "err",
        text: err instanceof Error ? err.message : "Could not update pay slips from Employee Salary.",
      });
    } finally {
      setSyncing(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const displayStatements = useMemo(
    () => [...statements].sort((a, b) => compareEmployeeCode(a.employeeCode, b.employeeCode)),
    [statements],
  );

  return (
    <div className="space-y-4">
      <FlashMessageBanner msg={syncMsg} onClear={() => setSyncMsg(null)} />

      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)]">
        <div className="border-b border-slate-100 bg-gradient-to-b from-slate-50/80 to-white px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-900">Pay Slips</h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">
                View and print employee payslips after payroll is approved. Payslip and Print appear only when status is Approved.
              </p>
            </div>
            <Button
              variant="secondary"
              className="shrink-0 rounded-lg border-[#2E7BBF]/35 bg-white px-4 text-[#256aa3] hover:border-[#2E7BBF]/55 hover:bg-[#2E7BBF]/[0.06]"
              disabled={syncing}
              onClick={() => void syncAllFromEmployeeSalary()}
            >
              {syncing ? "Updating…" : "Update all from Employee Salary"}
            </Button>
          </div>

          <div className="mt-5">
            <label htmlFor="payslip-employee-search" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Search employee
            </label>
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-stretch">
              <div ref={searchWrapRef} className="relative min-w-0 flex-1">
                <input
                  id="payslip-employee-search"
                  type="text"
                  autoComplete="off"
                  aria-autocomplete="list"
                  aria-expanded={suggestOpen}
                  className={
                    inputCls +
                    " min-h-10 w-full min-w-0 !mb-0 rounded-lg border-slate-200/90 bg-white py-2.5 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] placeholder:text-slate-400"
                  }
                  placeholder="Name or employee code…"
                  value={searchFilter.input}
                  onChange={(e) => {
                    searchFilter.setInput(e.target.value);
                    queueSuggestions(e.target.value);
                  }}
                  onFocus={() => {
                    if (searchFilter.input.trim()) void fetchSuggestions(searchFilter.input);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applySearch();
                    if (e.key === "Escape") setSuggestOpen(false);
                  }}
                />
                {suggestOpen ? (
                  <ul
                    role="listbox"
                    className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-64 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
                  >
                    {suggestLoading && suggestions.length === 0 ? (
                      <li className="px-3 py-2.5 text-sm text-slate-400">Loading suggestions…</li>
                    ) : null}
                    {!suggestLoading && suggestions.length === 0 ? (
                      <li className="px-3 py-2.5 text-sm text-slate-400">No matching employees</li>
                    ) : null}
                    {suggestions.map((hit) => (
                      <li key={hit.id} role="presentation">
                        <button
                          type="button"
                          role="option"
                          className="flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left text-sm hover:bg-[#e3eef8]"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => pickSuggestion(hit)}
                        >
                          <span className="font-medium text-slate-800">{paySlipHitName(hit)}</span>
                          <span className="text-[11px] text-slate-500">
                            {[hit.employeeCode ? hit.employeeCode : null, hit.departmentName?.trim() || null]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <div className="flex shrink-0 items-stretch gap-2">
                <Button className="min-h-10 min-w-[6.5rem] rounded-lg px-6" onClick={applySearch}>
                  Search
                </Button>
                {searchFilter.hasApplied ? (
                  <Button variant="secondary" className="min-h-10 min-w-[5.5rem] rounded-lg px-4" onClick={clearSearch}>
                    Clear
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
              {searchFilter.hasApplied ? (
                <p className="text-xs text-slate-500">
                  Showing results for{" "}
                  <strong className="font-medium text-slate-700">&quot;{searchFilter.applied}&quot;</strong>
                </p>
              ) : (
                <span className="text-xs text-slate-400">Type a name or code — suggestions appear as you type</span>
              )}
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
                {totalCount} pay slip{totalCount !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-16">
            <Loading />
          </div>
        ) : statements.length === 0 ? (
          <div className="px-6 py-14">
            <EmptyState
              text={
                searchFilter.hasApplied
                  ? `No pay slips found for "${searchFilter.applied}".`
                  : "No pay slips generated yet. Open Payroll Run and calculate a salary batch."
              }
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] table-fixed border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/90">
                    <th className="w-[26%] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Employee
                    </th>
                    <th className="w-[14%] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Period
                    </th>
                    <th className="w-[14%] px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Gross
                    </th>
                    <th className="w-[14%] px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Deductions
                    </th>
                    <th className="w-[14%] px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Net Pay
                    </th>
                    <th className="w-[10%] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Status
                    </th>
                    <th className="w-[8%] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayStatements.map((s) => (
                    <tr key={s.id} className="border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50/60">
                      <td className="align-middle px-4 py-3.5">
                        <div className="font-medium leading-snug text-slate-800">{s.employeeName}</div>
                        {s.employeeCode ? (
                          <div className="mt-0.5 text-xs text-slate-400">{s.employeeCode}</div>
                        ) : null}
                      </td>
                      <td className="align-middle whitespace-nowrap px-4 py-3.5 text-slate-600">
                        {MONTHS[s.month - 1]} {s.year}
                      </td>
                      <td className="align-middle whitespace-nowrap px-4 py-3.5 text-right font-mono text-sm tabular-nums text-slate-700">
                        LKR {fmt(s.grossPay)}
                      </td>
                      <td className="align-middle whitespace-nowrap px-4 py-3.5 text-right font-mono text-sm tabular-nums text-red-600">
                        LKR {fmt(s.totalDeductions)}
                      </td>
                      <td className="align-middle whitespace-nowrap px-4 py-3.5 text-right font-mono text-sm font-semibold tabular-nums text-slate-900">
                        LKR {fmt(s.netPay)}
                      </td>
                      <td className="align-middle px-4 py-3.5">
                        <PayStatementBadge status={s.status} />
                      </td>
                      <td className="align-middle px-4 py-3.5">
                        <PaySlipActionLinks
                          statement={s}
                          viewingId={viewingId}
                          printingId={printingId}
                          onView={() => void viewPayslip(s)}
                          onPrint={() => void handlePrint(s)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TablePagination
              className="border-t border-slate-100 px-6 py-3"
              page={page}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={pageSize}
              onPageChange={setPage}
              alwaysShow={totalCount > 0}
            />
          </>
        )}
      </div>

      {viewStmt && viewStmt.lines && <PayslipModal statement={viewStmt} onClose={() => setViewStmt(null)} />}
    </div>
  );
}

/* ═══════════════════════════ SETTINGS ═══════════════════════════ */

function SettingsTab() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    apiFetch<Settings>("/api/payroll/settings").then(setSettings).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true); setMsg("");
    const fd = new FormData(e.currentTarget);
    const payload = {
      epfEmployeeRate: Number(fd.get("epfEmployeeRate")) / 100,
      epfEmployerRate: Number(fd.get("epfEmployerRate")) / 100,
      etfEmployerRate: Number(fd.get("etfEmployerRate")) / 100,
      otHourlyDivisor: Number(fd.get("otHourlyDivisor")) || 208,
      otMultiplier: Number(fd.get("otMultiplier")) || 1.5,
    };
    try {
      const result = await apiFetch<Settings>("/api/payroll/settings", { method: "PUT", body: JSON.stringify(payload) });
      setSettings(result);
      setMsg("Settings saved successfully.");
    } catch { setMsg("Failed to save settings."); }
    finally { setSaving(false); }
  }

  if (loading) return <Loading />;

  return (
    <div className="max-w-lg">
      <Card title="Statutory Rates">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelCls}>EPF Employee Rate (%)</label>
            <input name="epfEmployeeRate" type="number" step="0.01" className={inputCls}
              defaultValue={settings ? (settings.epfEmployeeRate * 100).toFixed(2) : "8"} />
          </div>
          <div>
            <label className={labelCls}>EPF Employer Rate (%)</label>
            <input name="epfEmployerRate" type="number" step="0.01" className={inputCls}
              defaultValue={settings ? (settings.epfEmployerRate * 100).toFixed(2) : "12"} />
          </div>
          <div>
            <label className={labelCls}>ETF Employer Rate (%)</label>
            <input name="etfEmployerRate" type="number" step="0.01" className={inputCls}
              defaultValue={settings ? (settings.etfEmployerRate * 100).toFixed(2) : "3"} />
          </div>
          <div>
            <label className={labelCls}>OT Hourly Divisor</label>
            <input name="otHourlyDivisor" type="number" step="1" className={inputCls}
              defaultValue={settings?.otHourlyDivisor ?? 208} />
            <p className="mt-1 text-xs text-slate-400">OT rate = BASIC ÷ divisor × multiplier × approved hours</p>
          </div>
          <div>
            <label className={labelCls}>OT Multiplier</label>
            <input name="otMultiplier" type="number" step="0.01" className={inputCls}
              defaultValue={settings?.otMultiplier ?? 1.5} />
          </div>
          {msg ? (
            <InlinePageAlert
              message={msg}
              variant={msg.includes("success") ? "success" : "error"}
              className={`rounded-lg px-4 py-2 text-sm scroll-mt-20 ${msg.includes("success") ? "border border-green-200 bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}
            />
          ) : null}
          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Settings"}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

/* ═══════════════════════ SHARED COMPONENTS ═══════════════════════ */

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="mb-4 text-sm font-semibold text-slate-700">{title}</h3>
      {children}
    </div>
  );
}

function Badge({ status }: { status: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeCls[status] || "bg-slate-100 text-slate-600"}`}>{statusLabel[status] ?? status}</span>;
}

function ActionBtn({ label, onClick, loading }: { label: string; onClick: () => void; loading: boolean }) {
  return <button onClick={onClick} disabled={loading} className="rounded bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100 disabled:opacity-50">{loading ? "..." : label}</button>;
}

function Loading() {
  return <div className="flex items-center justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" /></div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">{text}</div>;
}
