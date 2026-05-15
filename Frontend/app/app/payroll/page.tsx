"use client";

import { useState, useEffect, useCallback, useMemo, type FormEvent } from "react";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { apiFetch } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/date-utils";
import { DonutMixChart, formatInt, HorizontalCompareBars, WeeklyActivityBars } from "@/lib/workspace-charts";
import { API_BASE_URL } from "@/config/constants";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { DatePickerField, FormSelect, type FormSelectOption } from "@/components/ui";

import { useAuth } from "@/contexts/auth-context";

interface Component {
  id: string; name: string; code: string; type: string; category: string;
  isTaxable: boolean; isStatutory: boolean; isActive: boolean;
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
  id: string; batchCode: string; month: number; year: number; status: string;
  processedAt?: string; approvedBy?: string; employeeCount: number;
  totalGross: number; totalDeductions: number; totalNet: number; totalEmployerCost: number;
  notes?: string; selectedCount: number; selectedEmployeeIds?: string[]; createdAt: string;
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
interface Settings { epfEmployeeRate: number; epfEmployerRate: number; etfEmployerRate: number; }
interface PagedResult<T> { items: T[]; totalCount: number; page: number; pageSize: number; }

/** Pay runs eligible for salary advance (must match backend PayrollService open batch rules). */
const ADVANCE_ELIGIBLE_BATCH_STATUSES = ["Draft", "Calculated", "Reviewed", "Approved"] as const;

interface AdvanceBatchOption {
  id: string;
  batchCode: string;
  month: number;
  year: number;
  status: string;
}

interface SalaryAdvanceRequestRow {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  payrollBatchId: string;
  batchCode: string;
  batchMonth: number;
  batchYear: number;
  amount: number;
  currency: string;
  status: string;
  remarks?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

const PAYROLL_FULL_TABS = [
  "Dashboard",
  "Components",
  "Employee Salary",
  "Variable Entry",
  "Payroll Run",
  "Pay Statements",
  "Salary Advance",
  "Settings",
] as const;
const PAYROLL_SELF_SERVICE_TABS = ["Pay Statements", "Salary Advance"] as const;
type Tab = (typeof PAYROLL_FULL_TABS)[number];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const MONTH_NUMBER_OPTS: FormSelectOption[] = MONTHS.map((m, i) => ({ value: String(i + 1), label: m }));

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

const ACTIVE_STATUS_OPTS: FormSelectOption[] = [
  { value: "true", label: "Active" },
  { value: "false", label: "Inactive" },
];

const fmt = (n: number) => n.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

export default function PayrollPage() {
  const { getPayrollAccessLevel } = useAuth();
  const payrollUxMode = getPayrollAccessLevel();
  const visibleTabs: readonly Tab[] =
    payrollUxMode === "full"
      ? PAYROLL_FULL_TABS
      : payrollUxMode === "self"
        ? PAYROLL_SELF_SERVICE_TABS
        : [];
  const [tab, setTab] = useState<Tab>(() => (getPayrollAccessLevel() === "full" ? "Dashboard" : "Pay Statements"));

  useEffect(() => {
    if (visibleTabs.length === 0) return;
    if (!(visibleTabs as readonly string[]).includes(tab)) {
      setTab((visibleTabs[0] ?? "Pay Statements") as Tab);
    }
  }, [payrollUxMode, visibleTabs, tab]);

  const pageSubtitle =
    payrollUxMode === "full"
      ? "Manage compensation components, run monthly payroll, and view pay statements."
      : payrollUxMode === "self"
        ? "View your payslips and request a salary advance against an open pay run."
        : "Payroll access is not enabled for your account.";

  if (visibleTabs.length === 0) {
    return (
      <>
        <AppTopbar title="Payroll & Compensation" subtitle={pageSubtitle} />
        <p className="mt-6 text-sm text-slate-600">
          If you need payslips or salary advances, ask your administrator to grant Payroll access (Read, Own scope) and link your user to an employee record.
        </p>
      </>
    );
  }

  return (
    <>
      <AppTopbar title="Payroll & Compensation" subtitle={pageSubtitle} />

      <div className="mt-6 mb-6 flex flex-wrap gap-2 overflow-x-auto pb-1">
        {visibleTabs.map((t) => (
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
      {tab === "Pay Statements" && <PayStatementsTab />}
      {tab === "Salary Advance" && <SalaryAdvanceTab />}
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

function payrollBatchCanEdit(status: string): boolean {
  return status === "Draft" || status === "Calculated" || status === "Reviewed";
}

function DashboardTab({ onOpenTab }: { onOpenTab: (t: Tab) => void }) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<PagedResult<Batch>>("/api/payroll/batches?pageSize=8"),
      apiFetch<Settings>("/api/payroll/settings"),
    ])
      .then(([b, s]) => {
        const items = (b.items ?? []).slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setBatches(items);
        setSettings(s);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const latest = batches[0] ?? null;

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
        { label: "Total gross (latest run)", value: "—", sub: "No batches yet — start a payroll run" },
        { label: "Total deductions", value: "—", sub: "—" },
        { label: "Total net pay", value: "—", sub: "—" },
        { label: "Employees in run", value: "—", sub: "—" },
      ];
    }
    const period = `${MONTHS[latest.month - 1]} ${latest.year}`;
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
  }, [latest, batches.length]);

  const quickLinks: { tab: Tab; title: string; sub: string }[] = [
    { tab: "Components", title: "Components", sub: "Earnings, deductions, and formulas" },
    { tab: "Employee Salary", title: "Employee salary", sub: "Fixed pay and assignments" },
    { tab: "Variable Entry", title: "Variable entry", sub: "One-off adjustments" },
    { tab: "Payroll Run", title: "Payroll run", sub: "Calculate and approve cycles" },
    { tab: "Pay Statements", title: "Pay statements", sub: "Payslips and lines" },
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
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="text-xs font-medium uppercase tracking-wider text-slate-500">{kpi.label}</div>
            <div className="mt-2 text-2xl font-semibold leading-tight text-slate-900 sm:text-3xl">{kpi.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-800">Latest run mix</h3>
          </div>
          {!latest || latestBreakdown.every((x) => x.value === 0) ? (
            <p className="py-8 text-center text-sm text-slate-500">No batch totals to chart yet.</p>
          ) : (
            <HorizontalCompareBars items={latestBreakdown} />
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-800">Net pay trend</h3>
          </div>
          {netTrendBars.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No batches to plot.</p>
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
        </div>
        {settings ? (
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
        ) : (
          <p className="py-6 text-center text-sm text-slate-500">Settings could not be loaded.</p>
        )}
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

function payrollComponentTypeBadgeClass(type: string): string {
  const t = type.toLowerCase();
  if (t === "earning") return "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80";
  if (t.includes("statutorydeduction")) return "bg-amber-50 text-amber-900 ring-1 ring-amber-200/80";
  if (t.includes("statutorycontribution")) return "bg-violet-50 text-violet-800 ring-1 ring-violet-200/80";
  if (t.includes("deduction")) return "bg-rose-50 text-rose-800 ring-1 ring-rose-200/80";
  return "bg-slate-100 text-slate-700 ring-1 ring-slate-200/80";
}

function payrollCategoryBadgeClass(category: string): string {
  const u = category.toLowerCase();
  if (u === "fixed") return "bg-sky-50 text-sky-800 ring-1 ring-sky-200/70";
  if (u === "variable") return "bg-indigo-50 text-indigo-800 ring-1 ring-indigo-200/70";
  if (u === "statutory") return "bg-amber-50 text-amber-900 ring-1 ring-amber-200/70";
  if (u === "onetime") return "bg-teal-50 text-teal-800 ring-1 ring-teal-200/70";
  return "bg-slate-50 text-slate-700 ring-1 ring-slate-200/70";
}

function formatPayrollTypeLabel(type: string): string {
  return type.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim();
}

function ComponentsTab() {
  const [components, setComponents] = useState<Component[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Component | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterActive, setFilterActive] = useState<"" | "true" | "false">("");

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<Component[]>("/api/payroll/components").then(setComponents).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const active = components.filter((c) => c.isActive).length;
    const earnings = components.filter((c) => c.type === "Earning").length;
    const deductions = components.filter((c) => c.type !== "Earning").length;
    return { total: components.length, active, earnings, deductions };
  }, [components]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return components.filter((c) => {
      if (filterType && c.type !== filterType) return false;
      if (filterCategory && c.category !== filterCategory) return false;
      if (filterActive === "true" && !c.isActive) return false;
      if (filterActive === "false" && c.isActive) return false;
      if (q) {
        const hay = `${c.name} ${c.code} ${c.description ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [components, search, filterType, filterCategory, filterActive]);

  const typeFilterOpts = useMemo<FormSelectOption[]>(
    () => [{ value: "", label: "All types" }, ...PAYROLL_COMPONENT_TYPE_OPTS],
    []
  );
  const categoryFilterOpts = useMemo<FormSelectOption[]>(
    () => [{ value: "", label: "All categories" }, ...PAYROLL_COMPONENT_CATEGORY_OPTS],
    []
  );
  const activeFilterOpts = useMemo<FormSelectOption[]>(
    () => [
      { value: "", label: "Active & inactive" },
      { value: "true", label: "Active only" },
      { value: "false", label: "Inactive only" },
    ],
    []
  );

  function handleEdit(c: Component) { setEditing(c); setShowForm(true); }
  async function handleDelete(id: string) {
    if (!confirm("Delete this component? It will be hidden from new assignments.")) return;
    await apiFetch(`/api/payroll/components/${id}`, { method: "DELETE" });
    load();
  }

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50 via-white to-blue-50/40 p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-xl space-y-1">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">Compensation components</h2>
            <p className="text-sm leading-relaxed text-slate-600">
              Define earning and deduction lines used in employee salary, payroll runs, and pay statements. Active components appear
              when assigning pay on the Employee Salary tab.
            </p>
          </div>
          <Button
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="shrink-0 shadow-sm"
          >
            + Add component
          </Button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Total defined", value: stats.total, hint: "All components" },
            { label: "Active", value: stats.active, hint: "Shown in salary UI" },
            { label: "Earnings", value: stats.earnings, hint: "Income-type lines" },
            { label: "Deductions & other", value: stats.deductions, hint: "Non-earning types" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-white/60 bg-white/80 px-4 py-3 shadow-sm backdrop-blur-sm"
            >
              <div className="text-2xl font-semibold tabular-nums text-slate-900">{s.value}</div>
              <div className="text-xs font-medium text-slate-500">{s.label}</div>
              <div className="mt-0.5 text-[11px] text-slate-400">{s.hint}</div>
            </div>
          ))}
        </div>
      </div>

      {components.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="min-w-0 flex-1">
              <label className={labelCls}>Search</label>
              <input
                className={inputCls}
                placeholder="Search by name, code, or description…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="grid w-full gap-2 sm:grid-cols-3 lg:w-auto lg:min-w-[520px] lg:shrink-0">
              <div>
                <label className={labelCls}>Type</label>
                <FormSelect
                  value={filterType}
                  onValueChange={setFilterType}
                  options={typeFilterOpts}
                  placeholder="All types"
                  className="!text-sm"
                />
              </div>
              <div>
                <label className={labelCls}>Category</label>
                <FormSelect
                  value={filterCategory}
                  onValueChange={setFilterCategory}
                  options={categoryFilterOpts}
                  placeholder="All categories"
                  className="!text-sm"
                />
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <FormSelect
                  value={filterActive}
                  onValueChange={(v) => setFilterActive(v as "" | "true" | "false")}
                  options={activeFilterOpts}
                  placeholder="All"
                  className="!text-sm"
                />
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Showing <span className="font-medium text-slate-700">{filtered.length}</span> of{" "}
            <span className="font-medium text-slate-700">{components.length}</span> components
            {(search || filterType || filterCategory || filterActive) && (
              <button
                type="button"
                className="ml-2 font-medium text-blue-600 hover:text-blue-800"
                onClick={() => { setSearch(""); setFilterType(""); setFilterCategory(""); setFilterActive(""); }}
              >
                Clear filters
              </button>
            )}
          </p>
        </div>
      )}

      {components.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-14 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80">
            <svg className="h-7 w-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <p className="text-base font-medium text-slate-800">No components yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Start with basics like Basic Salary and statutory deductions, then add allowances or variable pay as needed.
          </p>
          <Button className="mt-5" onClick={() => { setEditing(null); setShowForm(true); }}>
            Create your first component
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center">
          <p className="text-sm font-medium text-slate-700">No components match your filters</p>
          <p className="mt-1 text-sm text-slate-500">Try clearing search or widening the type / category filters.</p>
          <button
            type="button"
            className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-800"
            onClick={() => { setSearch(""); setFilterType(""); setFilterCategory(""); setFilterActive(""); }}
          >
            Reset filters
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/90 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="whitespace-nowrap px-4 py-3.5">Component</th>
                  <th className="whitespace-nowrap px-4 py-3.5">Type</th>
                  <th className="whitespace-nowrap px-4 py-3.5">Category</th>
                  <th className="whitespace-nowrap px-4 py-3.5">Tax / rules</th>
                  <th className="min-w-[140px] px-4 py-3.5">Formula</th>
                  <th className="whitespace-nowrap px-4 py-3.5 text-right">Order</th>
                  <th className="whitespace-nowrap px-4 py-3.5">Status</th>
                  <th className="whitespace-nowrap px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-slate-50/80">
                    <td className="px-4 py-3.5 align-top">
                      <div className="font-medium text-slate-900">{c.name}</div>
                      <div className="mt-0.5 font-mono text-xs text-slate-500">{c.code}</div>
                      {c.description && (
                        <div className="mt-1 line-clamp-2 text-xs text-slate-500" title={c.description}>
                          {c.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 align-top">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${payrollComponentTypeBadgeClass(c.type)}`}
                      >
                        {formatPayrollTypeLabel(c.type)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 align-top">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${payrollCategoryBadgeClass(c.category)}`}
                      >
                        {c.category}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 align-top text-xs text-slate-600">
                      <div className="flex flex-wrap gap-1.5">
                        {c.isTaxable && (
                          <span className="rounded-md bg-amber-50 px-2 py-0.5 font-medium text-amber-800">Taxable</span>
                        )}
                        {c.isStatutory && (
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-700">Statutory</span>
                        )}
                        {c.isEmployerContribution && (
                          <span className="rounded-md bg-violet-50 px-2 py-0.5 font-medium text-violet-800">Employer</span>
                        )}
                        {!c.isTaxable && !c.isStatutory && !c.isEmployerContribution && (
                          <span className="text-slate-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="max-w-[220px] px-4 py-3.5 align-top">
                      <span className="block truncate font-mono text-xs text-slate-600" title={c.formulaExpression || undefined}>
                        {c.formulaExpression || "—"}
                      </span>
                      {c.dependsOnComponentCode && (
                        <span className="mt-1 block text-[10px] text-slate-400">Uses {c.dependsOnComponentCode}</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 align-top text-right tabular-nums text-slate-600">{c.sortOrder}</td>
                    <td className="px-4 py-3.5 align-top">
                      {c.isActive ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-300" aria-hidden />
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 align-top text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleEdit(c)}
                          className="rounded-lg px-3 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(c.id)}
                          className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
      isTaxable: fd.get("isTaxable") === "true", isStatutory: fd.get("isStatutory") === "true",
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

  const sectionTitle = "text-xs font-semibold uppercase tracking-wide text-slate-500";

  return (
    <Modal open onClose={onClose} title={editing ? "Edit component" : "New component"} wide>
      <form key={editing?.id ?? "new"} onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="space-y-3">
          <p className={sectionTitle}>Basic details</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Display name *</label>
              <input name="name" required className={inputCls} defaultValue={editing?.name} placeholder="e.g. Basic Salary" />
            </div>
            <div>
              <label className={labelCls}>Code *</label>
              <input name="code" required className={inputCls} defaultValue={editing?.code} placeholder="e.g. BASIC" />
              <p className="mt-1 text-[11px] text-slate-400">Short unique code (usually uppercase). Used in imports and formulas.</p>
            </div>
          </div>
        </div>

        <div className="space-y-3 border-t border-slate-100 pt-5">
          <p className={sectionTitle}>Classification</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Pay type *</label>
              <FormSelect name="type" defaultValue={editing?.type || "Earning"} options={PAYROLL_COMPONENT_TYPE_OPTS} placeholder="Type" />
              <p className="mt-1 text-[11px] text-slate-400">Earnings increase gross pay; deductions reduce net pay.</p>
            </div>
            <div>
              <label className={labelCls}>Pay category *</label>
              <FormSelect name="category" defaultValue={editing?.category || "Fixed"} options={PAYROLL_COMPONENT_CATEGORY_OPTS} placeholder="Category" />
              <p className="mt-1 text-[11px] text-slate-400">Fixed/statutory lines vs variable monthly amounts.</p>
            </div>
            <div>
              <label className={labelCls}>Taxable income</label>
              <FormSelect name="isTaxable" defaultValue={String(editing?.isTaxable ?? false)} options={YES_NO_TF_OPTS} placeholder="—" />
            </div>
            <div>
              <label className={labelCls}>Statutory component</label>
              <FormSelect name="isStatutory" defaultValue={String(editing?.isStatutory ?? false)} options={YES_NO_TF_OPTS} placeholder="—" />
            </div>
            <div>
              <label className={labelCls}>Employer contribution</label>
              <FormSelect name="isEmployerContribution" defaultValue={String(editing?.isEmployerContribution ?? false)} options={YES_NO_TF_OPTS} placeholder="—" />
            </div>
            <div>
              <label className={labelCls}>Sort order</label>
              <input name="sortOrder" type="number" className={inputCls} defaultValue={editing?.sortOrder ?? 0} />
              <p className="mt-1 text-[11px] text-slate-400">Lower numbers appear first on pay statements.</p>
            </div>
          </div>
        </div>

        <div className="space-y-3 border-t border-slate-100 pt-5">
          <p className={sectionTitle}>Calculation (optional)</p>
          <div>
            <label className={labelCls}>Formula expression</label>
            <input
              name="formulaExpression"
              className={inputCls}
              defaultValue={editing?.formulaExpression ?? ""}
              placeholder="e.g. BASIC * 0.08"
            />
            <p className="mt-1 text-[11px] text-slate-400">Reference other components by code. Leave blank for flat amounts entered per employee.</p>
          </div>
          <div>
            <label className={labelCls}>Depends on component code</label>
            <input
              name="dependsOnComponentCode"
              className={inputCls}
              defaultValue={editing?.dependsOnComponentCode ?? ""}
              placeholder="e.g. BASIC"
            />
          </div>
        </div>

        <div className="space-y-3 border-t border-slate-100 pt-5">
          <p className={sectionTitle}>Notes</p>
          <div>
            <label className={labelCls}>Description</label>
            <textarea name="description" className={inputCls} rows={3} defaultValue={editing?.description ?? ""} placeholder="Optional notes for administrators" />
          </div>
          {editing && (
            <div>
              <label className={labelCls}>Active</label>
              <FormSelect name="isActive" defaultValue={String(editing.isActive)} options={ACTIVE_STATUS_OPTS} placeholder="—" />
              <p className="mt-1 text-[11px] text-slate-400">Inactive components stay in history but cannot be assigned to new salary rows.</p>
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end sm:gap-3">
          <Button variant="secondary" onClick={onClose} type="button" className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
            {submitting ? "Saving…" : editing ? "Save changes" : "Create component"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ═══════════════════════ EMPLOYEE SALARY ═══════════════════════ */

interface SalaryEmployee { id: string; firstName: string; lastName: string; employeeCode: string; department: string; grade: string; location: string; }

/** Compare API batch ids (handles null/undefined and GUID casing). */
function batchIdsEqual(a: string | undefined | null, b: string | undefined | null): boolean {
  if (a == null || b == null || a === "" || b === "") return false;
  const na = String(a).replace(/-/g, "").toLowerCase();
  const nb = String(b).replace(/-/g, "").toLowerCase();
  return na.length > 0 && na === nb;
}

function findEmpCompLine(
  lines: EmpComp[],
  componentId: string,
  compTab: "Fixed" | "Variable",
  batchId: string
): EmpComp | undefined {
  const match = lines.filter((l) => l.componentId === componentId);
  if (compTab === "Variable") return match.find((l) => batchIdsEqual(l.batchId, batchId));
  return match.find((l) => !l.batchId) ?? match[0];
}

function sumDraftAmounts(componentIds: string[], drafts: Record<string, string>): number {
  let s = 0;
  for (const id of componentIds) {
    const v = parseFloat(String(drafts[id] ?? "").replace(/,/g, ""));
    if (Number.isFinite(v)) s += v;
  }
  return s;
}

function EmployeeSalaryTab() {
  const [allEmployees, setAllEmployees] = useState<SalaryEmployee[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterGrade, setFilterGrade] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [selectedEmp, setSelectedEmp] = useState<SalaryEmployee | null>(null);
  const [empComp, setEmpComp] = useState<EmpComp[]>([]);
  const [components, setComponents] = useState<Component[]>([]);
  const [compLoading, setCompLoading] = useState(false);
  const [compTab, setCompTab] = useState<"Fixed" | "Variable">("Fixed");
  const [showImport, setShowImport] = useState(false);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [amountDrafts, setAmountDrafts] = useState<Record<string, string>>({});
  const [savingComponentId, setSavingComponentId] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Component[]>("/api/payroll/components").then(setComponents).catch(() => {});
    apiFetch<PagedResult<Batch>>("/api/payroll/batches?pageSize=50").then(d => {
      setBatches(d.items);
      const draft = d.items.find(b => b.status === "Draft" || b.status === "Calculated");
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
    () => [{ value: "", label: "Select Batch…" }, ...batches.map((b) => ({ value: b.id, label: `${b.batchCode} — ${MONTHS[b.month - 1]} ${b.year}` }))],
    [batches]
  );

  const filtered = allEmployees.filter(e => {
    if (filterDept && e.department !== filterDept) return false;
    if (filterGrade && e.grade !== filterGrade) return false;
    if (filterLocation && e.location !== filterLocation) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!e.firstName.toLowerCase().includes(q) && !e.lastName.toLowerCase().includes(q)
        && !e.employeeCode.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const visibleLines = useMemo(
    () =>
      empComp.filter((c) =>
        compTab === "Fixed"
          ? c.componentCategory === "Fixed" || c.componentCategory === "Statutory" || c.componentCategory === "OneTime"
          : c.componentCategory === "Variable" && (selectedBatchId ? batchIdsEqual(c.batchId, selectedBatchId) : true)
      ),
    [empComp, compTab, selectedBatchId]
  );

  const salaryTabComponents = useMemo(
    () =>
      components
        .filter((c) => {
          if (!c.isActive) return false;
          if (compTab === "Fixed") {
            return c.category === "Fixed" || c.category === "Statutory" || c.category === "OneTime";
          }
          return c.category === "Variable";
        })
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [components, compTab]
  );

  const earningComponents = useMemo(
    () => salaryTabComponents.filter((c) => c.type === "Earning"),
    [salaryTabComponents]
  );
  const deductionComponents = useMemo(
    () => salaryTabComponents.filter((c) => c.type !== "Earning"),
    [salaryTabComponents]
  );

  useEffect(() => {
    if (!selectedEmp) {
      setAmountDrafts({});
      return;
    }
    const lines = visibleLines;
    const next: Record<string, string> = {};
    for (const c of salaryTabComponents) {
      const line = findEmpCompLine(lines, c.id, compTab, selectedBatchId);
      next[c.id] = line ? String(line.amount) : "";
    }
    setAmountDrafts(next);
  }, [selectedEmp?.id, empComp, compTab, selectedBatchId, salaryTabComponents, visibleLines]);

  function selectEmployee(emp: SalaryEmployee) {
    setSelectedEmp(emp);
    setCompLoading(true);
    apiFetch<EmpComp[]>(`/api/payroll/compensation/${emp.id}`)
      .then(setEmpComp).catch(() => {}).finally(() => setCompLoading(false));
  }

  async function persistComponentAmount(component: Component, raw: string) {
    if (!selectedEmp) return;
    const trimmed = raw.trim();
    const parsed = parseFloat(trimmed.replace(/,/g, ""));
    const hasAmount = Number.isFinite(parsed) && parsed !== 0;
    const line = findEmpCompLine(visibleLines, component.id, compTab, selectedBatchId);

    if (!line && !hasAmount) return;

    if (!line && hasAmount) {
      setSavingComponentId(component.id);
      try {
        await apiFetch(`/api/payroll/compensation/${selectedEmp.id}`, {
          method: "POST",
          body: JSON.stringify({
            componentId: component.id,
            amount: parsed,
            currency: "LKR",
            effectiveFrom: new Date().toISOString().split("T")[0],
            ...(compTab === "Variable" && selectedBatchId ? { batchId: selectedBatchId } : {}),
          }),
        });
        await apiFetch<EmpComp[]>(`/api/payroll/compensation/${selectedEmp.id}`).then(setEmpComp);
      } catch (err: unknown) {
        window.alert(err instanceof Error ? err.message : "Could not save amount");
        setAmountDrafts((d) => ({ ...d, [component.id]: "" }));
      } finally {
        setSavingComponentId(null);
      }
      return;
    }

    if (line && !hasAmount) {
      if (!confirm(`Remove ${component.name} for this employee?`)) {
        setAmountDrafts((d) => ({ ...d, [component.id]: String(line.amount) }));
      } else {
        setSavingComponentId(component.id);
        try {
          await apiFetch(`/api/payroll/compensation/line/${line.id}`, { method: "DELETE" });
          await apiFetch<EmpComp[]>(`/api/payroll/compensation/${selectedEmp.id}`).then(setEmpComp);
        } catch (err: unknown) {
          window.alert(err instanceof Error ? err.message : "Could not remove");
          setAmountDrafts((d) => ({ ...d, [component.id]: String(line.amount) }));
        } finally {
          setSavingComponentId(null);
        }
      }
      return;
    }

    if (line && hasAmount && parsed === line.amount) return;

    setSavingComponentId(component.id);
    try {
      await apiFetch(`/api/payroll/compensation/line/${line!.id}`, {
        method: "PUT",
        body: JSON.stringify({
          amount: parsed,
          currency: line!.currency || "LKR",
          effectiveFrom: line!.effectiveFrom?.slice(0, 10),
          effectiveTo: line!.effectiveTo?.slice(0, 10) || null,
          isActive: line!.isActive !== false,
        }),
      });
      await apiFetch<EmpComp[]>(`/api/payroll/compensation/${selectedEmp.id}`).then(setEmpComp);
    } catch (err: unknown) {
      window.alert(err instanceof Error ? err.message : "Could not save amount");
      setAmountDrafts((d) => ({ ...d, [component.id]: String(line!.amount) }));
    } finally {
      setSavingComponentId(null);
    }
  }

  if (listLoading) return <Loading />;

  return (
    <div className="flex gap-4" style={{ minHeight: 500 }}>
      {/* Employee list */}
      <div className="w-[340px] shrink-0 space-y-2">
        <input className={inputCls + " !mb-0"} placeholder="Search name or code..." value={search} onChange={e => setSearch(e.target.value)} />
        <div className="flex min-w-0 gap-1.5">
          <div className="min-w-0 flex-1">
            <FormSelect
              value={filterDept}
              onValueChange={setFilterDept}
              options={salaryDeptFilterOpts}
              placeholder="All Depts"
              className="!h-9 !min-h-0 !py-0 text-xs"
            />
          </div>
          <div className="min-w-0 flex-1">
            <FormSelect
              value={filterGrade}
              onValueChange={setFilterGrade}
              options={salaryGradeFilterOpts}
              placeholder="All Grades"
              className="!h-9 !min-h-0 !py-0 text-xs"
            />
          </div>
          <div className="min-w-0 flex-1">
            <FormSelect
              value={filterLocation}
              onValueChange={setFilterLocation}
              options={salaryLocationFilterOpts}
              placeholder="All Locations"
              className="!h-9 !min-h-0 !py-0 text-xs"
            />
          </div>
        </div>
        <div className="text-xs text-slate-400">{filtered.length} employee{filtered.length !== 1 ? "s" : ""}</div>
        <div className="max-h-[420px] overflow-y-auto rounded-lg border border-slate-200">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-slate-400">No employees match filters</div>
          ) : filtered.map(emp => (
            <button key={emp.id} onClick={() => selectEmployee(emp)}
              className={`flex w-full items-center gap-2 border-b border-slate-50 px-3 py-2.5 text-left text-sm transition-colors hover:bg-slate-50 ${selectedEmp?.id === emp.id ? "bg-blue-50 border-l-2 border-l-blue-500" : ""}`}>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-slate-700">{emp.firstName} {emp.lastName}</div>
                <div className="truncate text-xs text-slate-400">{emp.employeeCode} · {emp.department}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Compensation details */}
      <div className="flex-1 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5">
            {(["Fixed", "Variable"] as const).map(t => (
              <button key={t} onClick={() => setCompTab(t)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${compTab === t ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                {t}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {compTab === "Variable" && (
              <div className="w-auto min-w-[180px] max-w-[240px] shrink-0">
                <FormSelect
                  value={selectedBatchId}
                  onValueChange={setSelectedBatchId}
                  options={empSalaryBatchOpts}
                  placeholder="Select Batch…"
                  className="!h-9 !min-h-0 !py-0 text-xs"
                />
              </div>
            )}
            <Button variant="secondary" onClick={() => setShowImport(true)}
              disabled={compTab === "Variable" && !selectedBatchId}>Import</Button>
          </div>
        </div>

        {compTab === "Variable" && !selectedBatchId ? (
          <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 py-20 text-sm text-slate-400">
            Select a payroll batch above to view variable components
          </div>
        ) : !selectedEmp ? (
          <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 py-20 text-sm text-slate-400">
            Select an employee to view their compensation
          </div>
        ) : (
          <CompensationTable
            title={`${selectedEmp.firstName} ${selectedEmp.lastName} — ${selectedEmp.employeeCode}`}
            earningComponents={earningComponents}
            deductionComponents={deductionComponents}
            amountDrafts={amountDrafts}
            onAmountChange={(componentId, value) =>
              setAmountDrafts((d) => ({ ...d, [componentId]: value }))
            }
            onAmountBlur={(component, raw) => void persistComponentAmount(component, raw)}
            savingComponentId={savingComponentId}
            visibleLines={visibleLines}
            compTab={compTab}
            selectedBatchId={selectedBatchId}
            loading={compLoading}
          />
        )}
      </div>

      {showImport && (
        <ImportCompensationModal category={compTab}
          batchId={compTab === "Variable" ? selectedBatchId : undefined}
          onClose={() => setShowImport(false)}
          onImported={() => { setShowImport(false); if (selectedEmp) selectEmployee(selectedEmp); }} />
      )}
    </div>
  );
}

function CompensationAmountRow({
  component,
  showTypeBadge,
  visibleLines,
  compTab,
  selectedBatchId,
  amountDrafts,
  onAmountChange,
  onAmountBlur,
  loading,
  saving,
}: {
  component: Component;
  showTypeBadge: boolean;
  visibleLines: EmpComp[];
  compTab: "Fixed" | "Variable";
  selectedBatchId: string;
  amountDrafts: Record<string, string>;
  onAmountChange: (componentId: string, value: string) => void;
  onAmountBlur: (component: Component, raw: string) => void;
  loading: boolean;
  saving: boolean;
}) {
  const line = findEmpCompLine(visibleLines, component.id, compTab, selectedBatchId);
  return (
    <tr className="border-b border-slate-50">
      <td className="px-2 py-2 align-top font-medium text-slate-700">
        <div>{component.name}</div>
        <div className="text-xs font-normal text-slate-400">({component.code})</div>
        {showTypeBadge && (
          <span className="mt-0.5 block text-[10px] font-normal uppercase tracking-wide text-slate-400">
            {component.type}
          </span>
        )}
        {line && <div className="mt-1 text-[10px] text-slate-400">From {formatDate(line.effectiveFrom)}</div>}
      </td>
      <td className="px-2 py-2 text-right align-top">
        <div className="inline-flex w-full min-w-[8rem] flex-col items-stretch gap-1">
          <input
            type="number"
            step="0.01"
            min="0"
            disabled={loading || saving}
            className={`${inputCls} font-mono text-right text-sm tabular-nums`}
            value={amountDrafts[component.id] ?? ""}
            placeholder="—"
            onChange={(e) => onAmountChange(component.id, e.target.value)}
            onBlur={(e) => onAmountBlur(component, e.target.value)}
            aria-label={`Amount for ${component.name}`}
          />
          {saving && <span className="text-[10px] text-slate-400">Saving…</span>}
        </div>
      </td>
    </tr>
  );
}

function CompensationTable({
  title,
  earningComponents,
  deductionComponents,
  amountDrafts,
  onAmountChange,
  onAmountBlur,
  savingComponentId,
  visibleLines,
  compTab,
  selectedBatchId,
  loading,
}: {
  title: string;
  earningComponents: Component[];
  deductionComponents: Component[];
  amountDrafts: Record<string, string>;
  onAmountChange: (componentId: string, value: string) => void;
  onAmountBlur: (component: Component, raw: string) => void;
  savingComponentId: string | null;
  visibleLines: EmpComp[];
  compTab: "Fixed" | "Variable";
  selectedBatchId: string;
  loading: boolean;
}) {
  const earningIds = useMemo(() => earningComponents.map((c) => c.id), [earningComponents]);
  const deductionIds = useMemo(() => deductionComponents.map((c) => c.id), [deductionComponents]);
  const totalEarnings = sumDraftAmounts(earningIds, amountDrafts);
  const totalDeductions = sumDraftAmounts(deductionIds, amountDrafts);
  const anyComponents = earningComponents.length + deductionComponents.length > 0;

  return (
    <Card title={title}>
      <p className="mb-3 text-xs text-slate-500">
        Enter amounts in LKR and leave the field to save. Clear the amount and leave the field to remove an assignment.
      </p>
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <span className="text-emerald-700">Earnings: LKR {fmt(totalEarnings)}</span>
        <span className="text-slate-300">·</span>
        <span className="text-rose-700">Deductions: LKR {fmt(totalDeductions)}</span>
        <span className="text-slate-300">·</span>
        <span className="font-semibold text-slate-800">Net: LKR {fmt(totalEarnings - totalDeductions)}</span>
      </div>

      {loading ? (
        <Loading />
      ) : !anyComponents ? (
        <EmptyState text="No compensation components for this category. Add them under the Components tab." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-emerald-100 bg-white shadow-sm">
            <div className="border-b border-emerald-100 bg-emerald-50/70 px-3 py-2.5">
              <h3 className="text-sm font-semibold text-emerald-900">Earnings (income)</h3>
              <p className="text-xs text-emerald-800/70">
                {earningComponents.length} component{earningComponents.length !== 1 ? "s" : ""} · Subtotal LKR{" "}
                {fmt(totalEarnings)}
              </p>
            </div>
            <div className="min-h-[120px] overflow-x-auto p-2">
              {earningComponents.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-slate-400">No earning components in this category.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs text-slate-400">
                      <th className="px-2 py-2 font-medium">Component</th>
                      <th className="px-2 py-2 font-medium text-right">Amount (LKR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {earningComponents.map((c) => (
                      <CompensationAmountRow
                        key={c.id}
                        component={c}
                        showTypeBadge={false}
                        visibleLines={visibleLines}
                        compTab={compTab}
                        selectedBatchId={selectedBatchId}
                        amountDrafts={amountDrafts}
                        onAmountChange={onAmountChange}
                        onAmountBlur={onAmountBlur}
                        loading={loading}
                        saving={savingComponentId === c.id}
                      />
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-rose-100 bg-white shadow-sm">
            <div className="border-b border-rose-100 bg-rose-50/70 px-3 py-2.5">
              <h3 className="text-sm font-semibold text-rose-900">Deductions</h3>
              <p className="text-xs text-rose-800/70">
                {deductionComponents.length} component{deductionComponents.length !== 1 ? "s" : ""} · Subtotal LKR{" "}
                {fmt(totalDeductions)}
              </p>
            </div>
            <div className="min-h-[120px] overflow-x-auto p-2">
              {deductionComponents.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-slate-400">No deduction components in this category.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs text-slate-400">
                      <th className="px-2 py-2 font-medium">Component</th>
                      <th className="px-2 py-2 font-medium text-right">Amount (LKR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deductionComponents.map((c) => (
                      <CompensationAmountRow
                        key={c.id}
                        component={c}
                        showTypeBadge
                        visibleLines={visibleLines}
                        compTab={compTab}
                        selectedBatchId={selectedBatchId}
                        amountDrafts={amountDrafts}
                        onAmountChange={onAmountChange}
                        onAmountBlur={onAmountBlur}
                        loading={loading}
                        saving={savingComponentId === c.id}
                      />
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>
      )}
    </Card>
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
        {error && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}

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
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    apiFetch<PagedResult<Batch>>("/api/payroll/batches?pageSize=200").then(d => {
      const list = d.items ?? [];
      setBatches(list);
      if (list.length > 0) setSelectedBatchId(list[0].id);
    }).catch(() => {});
    apiFetch<Component[]>("/api/payroll/components").then(c => {
      const varComps = c.filter(x => x.category === "Variable" && x.isActive);
      setComponents(varComps);
    }).catch(() => {});
  }, []);

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
      ...batches.map((b) => ({ value: b.id, label: `${b.batchCode} — ${MONTHS[b.month - 1]} ${b.year}` })),
    ],
    [batches]
  );
  const variableCompOpts = useMemo<FormSelectOption[]>(
    () => [
      { value: "", label: "All Variable Components" },
      ...components.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` })),
    ],
    [components]
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
    if (!search) return true;
    const s = search.toLowerCase();
    return e.employeeName.toLowerCase().includes(s) || e.employeeCode.toLowerCase().includes(s)
      || e.componentName.toLowerCase().includes(s) || e.department.toLowerCase().includes(s);
  });

  const total = filtered.reduce((s, e) => s + (editedAmounts[e.id] !== undefined ? (parseFloat(editedAmounts[e.id]) || 0) : e.amount), 0);

  const selectedBatch = batches.find(b => b.id === selectedBatchId);

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
            placeholder="All Variable Components"
          />
        </div>
        <div className="min-w-[200px]">
          <label className={labelCls}>Search</label>
          <input className={inputCls} placeholder="Name, code, department..." value={search} onChange={e => setSearch(e.target.value)} />
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
          <span>Status: <Badge status={selectedBatch.status} /></span>
          <span>Period: <strong className="text-slate-700">{MONTHS[selectedBatch.month - 1]} {selectedBatch.year}</strong></span>
        </div>
      )}

      {msg && (
        <div className={`rounded-lg px-4 py-2 text-sm ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{msg.text}</div>
      )}

      {!selectedBatchId ? (
        <EmptyState text="Select a payroll batch to view variable components" />
      ) : loading ? (
        <Loading />
      ) : filtered.length === 0 ? (
        <EmptyState text={entries.length === 0 ? "No variable components assigned for this batch" : "No matching records found"} />
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
  const [showCreate, setShowCreate] = useState(false);
  const [editBatchId, setEditBatchId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [batchStatements, setBatchStatements] = useState<Statement[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<PagedResult<Batch>>("/api/payroll/batches?pageSize=50").then(d => setBatches(d.items)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAction(batchId: string, action: string) {
    setActionLoading(batchId);
    try {
      if (action === "calculate") {
        if (!confirm("Run payroll calculation for this batch? Totals will be computed (or refreshed) from current compensation data.")) {
          setActionLoading(null);
          return;
        }
        await apiFetch(`/api/payroll/batches/${batchId}/calculate`, { method: "POST" });
      } else if (action === "approve") {
        if (!confirm("Approve this payroll batch? Confirm you have reviewed gross, deductions, and net pay before approving.")) {
          setActionLoading(null);
          return;
        }
        await apiFetch(`/api/payroll/batches/${batchId}/approve`, { method: "PUT" });
      } else if (action === "finalize") {
        if (!confirm("Finalize this payroll batch? Payslips will be locked for this period. Only continue if payroll is ready for release.")) {
          setActionLoading(null);
          return;
        }
        await apiFetch(`/api/payroll/batches/${batchId}/finalize`, { method: "PUT" });
      } else if (action === "delete") {
        if (!confirm("Delete this batch?")) { setActionLoading(null); return; }
        await apiFetch(`/api/payroll/batches/${batchId}`, { method: "DELETE" });
      }
      load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Action failed");
    } finally { setActionLoading(null); }
  }

  async function viewBatchDetails(batch: Batch) {
    setSelectedBatch(batch);
    const data = await apiFetch<PagedResult<Statement>>(`/api/payroll/statements?pageSize=200`);
    setBatchStatements(data.items.filter(s => s.batchId === batch.id));
  }

  if (loading) return <Loading />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Payroll Batches</h2>
        <Button onClick={() => setShowCreate(true)}>+ New Batch</Button>
      </div>

      {batches.length === 0 ? <EmptyState text="No payroll batches yet. Create one to start." /> : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b bg-slate-50 text-xs text-slate-500">
              <th className="px-4 py-3 font-medium">Batch</th><th className="px-4 py-3 font-medium">Period</th>
              <th className="px-4 py-3 font-medium">Employees</th><th className="px-4 py-3 font-medium text-right">Gross</th>
              <th className="px-4 py-3 font-medium text-right">Net</th><th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr></thead>
            <tbody>
              {batches.map(b => (
                <tr key={b.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-4 py-3">
                    <button onClick={() => viewBatchDetails(b)} className="font-medium text-blue-600 hover:underline">{b.batchCode}</button>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{MONTHS[b.month - 1]} {b.year}</td>
                  <td className="px-4 py-3 text-slate-600">{b.status === "Draft" ? `${b.selectedCount} selected` : b.employeeCount}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700">{b.totalGross ? `LKR ${fmt(b.totalGross)}` : "—"}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700">{b.totalNet ? `LKR ${fmt(b.totalNet)}` : "—"}</td>
                  <td className="px-4 py-3"><Badge status={b.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {payrollBatchCanEdit(b.status) && (
                        <button type="button" onClick={() => setEditBatchId(b.id)} className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50">
                          Edit
                        </button>
                      )}
                      {b.status === "Draft" && <ActionBtn label="Calculate" onClick={() => handleAction(b.id, "calculate")} loading={actionLoading === b.id} />}
                      {b.status === "Calculated" && <ActionBtn label="Recalculate" onClick={() => handleAction(b.id, "calculate")} loading={actionLoading === b.id} />}
                      {b.status === "Calculated" && <ActionBtn label="Approve" onClick={() => handleAction(b.id, "approve")} loading={actionLoading === b.id} />}
                      {b.status === "Reviewed" && <ActionBtn label="Approve" onClick={() => handleAction(b.id, "approve")} loading={actionLoading === b.id} />}
                      {b.status === "Reviewed" && <ActionBtn label="Recalculate" onClick={() => handleAction(b.id, "calculate")} loading={actionLoading === b.id} />}
                      {b.status === "Approved" && <ActionBtn label="Finalize" onClick={() => handleAction(b.id, "finalize")} loading={actionLoading === b.id} />}
                      {(b.status === "Draft" || b.status === "Calculated") && <button onClick={() => handleAction(b.id, "delete")} className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50">Delete</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <CreateBatchModal onClose={() => setShowCreate(false)} onCreated={load} />}

      {editBatchId && (
        <EditBatchModal
          batchId={editBatchId}
          onClose={() => setEditBatchId(null)}
          onSaved={() => {
            setEditBatchId(null);
            load();
          }}
        />
      )}

      {selectedBatch && (
        <BatchDetailModal batch={selectedBatch} statements={batchStatements} onClose={() => setSelectedBatch(null)} />
      )}
    </div>
  );
}

function CreateBatchModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [notes, setNotes] = useState("");

  const [employees, setEmployees] = useState<EligibleEmployee[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterGrade, setFilterGrade] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [empLoading, setEmpLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (step !== 2) return;
    setEmpLoading(true);
    apiFetch<EligibleEmployee[]>("/api/payroll/eligible-employees")
      .then(emps => { setEmployees(emps); setSelected(new Set(emps.map(e => e.id))); })
      .catch(() => setError("Failed to load employees"))
      .finally(() => setEmpLoading(false));
  }, [step]);

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
    if (!search) return true;
    const q = search.toLowerCase();
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

  async function handleCreate() {
    if (selected.size === 0) { setError("Select at least one employee"); return; }
    setSubmitting(true); setError("");
    try {
      await apiFetch("/api/payroll/batches", {
        method: "POST",
        body: JSON.stringify({ month, year, notes: notes || null, employeeIds: Array.from(selected) }),
      });
      onCreated(); onClose();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed"); }
    finally { setSubmitting(false); }
  }

  return (
    <Modal open onClose={onClose} title={step === 1 ? "New Payroll Batch" : `Select Employees — ${MONTHS[month - 1]} ${year}`} wide={step === 2}>
      {error && <div className="mb-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}

      {step === 1 && (
        <div className="space-y-4">
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
          <div><label className={labelCls}>Notes</label><textarea className={inputCls} rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={() => setStep(2)}>Next — Select Employees</Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input className={inputCls + " !mb-0 min-w-[180px] flex-1"} placeholder="Search name or code..."
              value={search} onChange={e => setSearch(e.target.value)} />
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
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">No employees match the current filters</td></tr>
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

function EditBatchModal({
  batchId,
  onClose,
  onSaved,
}: {
  batchId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [batchMeta, setBatchMeta] = useState<Batch | null>(null);
  const [notes, setNotes] = useState("");
  const [employees, setEmployees] = useState<EligibleEmployee[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterGrade, setFilterGrade] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all([
      apiFetch<Batch>(`/api/payroll/batches/${batchId}`),
      apiFetch<EligibleEmployee[]>("/api/payroll/eligible-employees"),
    ])
      .then(([b, emps]) => {
        if (cancelled) return;
        setBatchMeta(b);
        setNotes(b.notes ?? "");
        setEmployees(emps);
        const fromBatch = new Set((b.selectedEmployeeIds ?? []).map(String));
        if (fromBatch.size > 0) {
          const next = new Set(emps.filter((e) => fromBatch.has(e.id)).map((e) => e.id));
          setSelected(next.size > 0 ? next : new Set(emps.map((e) => e.id)));
        } else {
          setSelected(new Set(emps.map((e) => e.id)));
        }
      })
      .catch(() => {
        if (!cancelled) setError("Could not load batch or employees.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [batchId]);

  const { departments, grades, locations } = useMemo(
    () => ({
      departments: Array.from(new Set(employees.map((e) => e.department).filter(Boolean))).sort(),
      grades: Array.from(new Set(employees.map((e) => e.grade).filter(Boolean))).sort(),
      locations: Array.from(new Set(employees.map((e) => e.location).filter(Boolean))).sort(),
    }),
    [employees]
  );

  const editBatchDeptOpts = useMemo<FormSelectOption[]>(
    () => [{ value: "", label: "All Departments" }, ...departments.map((d) => ({ value: d, label: d }))],
    [departments]
  );
  const editBatchGradeOpts = useMemo<FormSelectOption[]>(
    () => [{ value: "", label: "All Grades" }, ...grades.map((g) => ({ value: g, label: g }))],
    [grades]
  );
  const editBatchLocationOpts = useMemo<FormSelectOption[]>(
    () => [{ value: "", label: "All Locations" }, ...locations.map((l) => ({ value: l, label: l }))],
    [locations]
  );

  const filtered = employees.filter((e) => {
    if (filterDept && e.department !== filterDept) return false;
    if (filterGrade && e.grade !== filterGrade) return false;
    if (filterLocation && e.location !== filterLocation) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      e.firstName.toLowerCase().includes(q) ||
      e.lastName.toLowerCase().includes(q) ||
      e.employeeCode.toLowerCase().includes(q) ||
      e.department.toLowerCase().includes(q)
    );
  });

  const allFilteredSelected = filtered.length > 0 && filtered.every((e) => selected.has(e.id));

  function toggleAll() {
    const next = new Set(selected);
    if (allFilteredSelected) {
      filtered.forEach((e) => next.delete(e.id));
    } else {
      filtered.forEach((e) => next.add(e.id));
    }
    setSelected(next);
  }

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function handleSave() {
    if (selected.size === 0) {
      setError("Select at least one employee");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await apiFetch(`/api/payroll/batches/${batchId}`, {
        method: "PUT",
        body: JSON.stringify({
          notes: notes.trim() === "" ? null : notes.trim(),
          employeeIds: Array.from(selected),
        }),
      });
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  }

  const title = batchMeta
    ? `Edit batch — ${batchMeta.batchCode} (${MONTHS[batchMeta.month - 1]} ${batchMeta.year})`
    : "Edit batch";

  return (
    <Modal open onClose={onClose} title={title} wide>
      {error && <div className="mb-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}
      {loading || !batchMeta ? (
        <Loading />
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Update notes and the employee roster. If you change who is in this run, use <strong className="font-medium text-slate-800">Recalculate</strong> so totals and payslips stay in sync.
          </p>
          <div>
            <label className={labelCls}>Notes</label>
            <textarea className={inputCls} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className={inputCls + " !mb-0 min-w-[180px] flex-1"}
              placeholder="Search name or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="w-auto min-w-[140px] shrink-0">
              <FormSelect
                value={filterDept}
                onValueChange={setFilterDept}
                options={editBatchDeptOpts}
                placeholder="All Departments"
                className="!mb-0"
              />
            </div>
            <div className="w-auto min-w-[120px] shrink-0">
              <FormSelect
                value={filterGrade}
                onValueChange={setFilterGrade}
                options={editBatchGradeOpts}
                placeholder="All Grades"
                className="!mb-0"
              />
            </div>
            <div className="w-auto min-w-[130px] shrink-0">
              <FormSelect
                value={filterLocation}
                onValueChange={setFilterLocation}
                options={editBatchLocationOpts}
                placeholder="All Locations"
                className="!mb-0"
              />
            </div>
            <span className="whitespace-nowrap text-sm text-slate-500">
              {selected.size}/{employees.length} selected
            </span>
          </div>

          <div className="max-h-[400px] overflow-y-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="border-b text-xs text-slate-500">
                  <th className="px-3 py-2.5">
                    <input type="checkbox" checked={allFilteredSelected} onChange={toggleAll} className="rounded" />
                  </th>
                  <th className="px-3 py-2.5 font-medium">Employee</th>
                  <th className="px-3 py-2.5 font-medium">Code</th>
                  <th className="px-3 py-2.5 font-medium">Department</th>
                  <th className="px-3 py-2.5 font-medium">Grade</th>
                  <th className="px-3 py-2.5 font-medium">Location</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-slate-400">
                      No employees match the current filters
                    </td>
                  </tr>
                ) : (
                  filtered.map((e) => (
                    <tr
                      key={e.id}
                      className="cursor-pointer border-b border-slate-50 hover:bg-slate-50/50"
                      onClick={() => toggle(e.id)}
                    >
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggle(e.id)} className="rounded" />
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-700">
                        {e.firstName} {e.lastName}
                      </td>
                      <td className="px-3 py-2 text-slate-500">{e.employeeCode}</td>
                      <td className="px-3 py-2 text-slate-500">{e.department}</td>
                      <td className="px-3 py-2 text-slate-500">{e.grade}</td>
                      <td className="px-3 py-2 text-slate-500">{e.location}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={submitting || selected.size === 0}>
              {submitting ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function BatchDetailModal({ batch, statements, onClose }: { batch: Batch; statements: Statement[]; onClose: () => void }) {
  const [selectedStmt, setSelectedStmt] = useState<Statement | null>(null);
  const [stmtDetail, setStmtDetail] = useState<Statement | null>(null);

  async function viewPayslip(stmt: Statement) {
    setSelectedStmt(stmt);
    const detail = await apiFetch<Statement>(`/api/payroll/statements/${stmt.id}`);
    setStmtDetail(detail);
  }

  return (
    <Modal open onClose={onClose} title={`Batch: ${batch.batchCode}`} wide>
      <div className="mb-4 grid gap-3 sm:grid-cols-4 text-sm">
        <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-400">Gross</div><div className="font-semibold">LKR {fmt(batch.totalGross)}</div></div>
        <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-400">Deductions</div><div className="font-semibold">LKR {fmt(batch.totalDeductions)}</div></div>
        <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-400">Net</div><div className="font-semibold">LKR {fmt(batch.totalNet)}</div></div>
        <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-400">Employer Cost</div><div className="font-semibold">LKR {fmt(batch.totalEmployerCost)}</div></div>
      </div>

      {statements.length === 0 ? <EmptyState text="No pay statements in this batch." /> : (
        <div className="max-h-[400px] overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b text-xs text-slate-400">
              <th className="pb-2 font-medium">Employee</th><th className="pb-2 font-medium text-right">Gross</th>
              <th className="pb-2 font-medium text-right">Deductions</th><th className="pb-2 font-medium text-right">Net</th>
              <th className="pb-2 font-medium">View</th>
            </tr></thead>
            <tbody>
              {statements.map(s => (
                <tr key={s.id} className="border-b border-slate-50">
                  <td className="py-2.5"><span className="font-medium text-slate-700">{s.employeeName}</span> <span className="text-xs text-slate-400">{s.employeeCode}</span></td>
                  <td className="py-2.5 text-right font-mono">LKR {fmt(s.grossPay)}</td>
                  <td className="py-2.5 text-right font-mono text-red-600">LKR {fmt(s.totalDeductions)}</td>
                  <td className="py-2.5 text-right font-mono font-semibold">LKR {fmt(s.netPay)}</td>
                  <td className="py-2.5"><button onClick={() => viewPayslip(s)} className="text-xs text-blue-600 hover:underline">Payslip</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {stmtDetail && stmtDetail.lines && (
        <PayslipModal statement={stmtDetail} onClose={() => { setStmtDetail(null); setSelectedStmt(null); }} />
      )}
    </Modal>
  );
}

function PayslipModal({ statement, onClose }: { statement: Statement; onClose: () => void }) {
  const earnings = statement.lines?.filter(l => l.type === "Earning" && !l.isEmployerContribution) || [];
  const deductions = statement.lines?.filter(l => (l.type === "Deduction" || l.type === "StatutoryDeduction") && !l.isEmployerContribution) || [];
  const employerItems = statement.lines?.filter(l => l.isEmployerContribution) || [];

  return (
    <Modal open onClose={onClose} title={`Payslip — ${statement.employeeName}`} wide>
      <div className="mb-4 text-sm text-slate-500">
        {MONTHS[statement.month - 1]} {statement.year} &middot; {statement.employeeCode} &middot; {statement.department || ""}
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
    </Modal>
  );
}

/* ═══════════════════════ PAY STATEMENTS ═══════════════════════ */

function PayStatementsTab() {
  const [statements, setStatements] = useState<Statement[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [viewStmt, setViewStmt] = useState<Statement | null>(null);
  const pageSize = 20;

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<PagedResult<Statement>>(`/api/payroll/statements?page=${page}&pageSize=${pageSize}`)
      .then(d => { setStatements(d.items); setTotalCount(d.totalCount); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [page]);

  useEffect(() => { load(); }, [load]);

  async function viewPayslip(stmt: Statement) {
    const detail = await apiFetch<Statement>(`/api/payroll/statements/${stmt.id}`);
    setViewStmt(detail);
  }

  if (loading) return <Loading />;

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-800">Pay Statements</h2>

      {statements.length === 0 ? <EmptyState text="No pay statements generated yet." /> : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b bg-slate-50 text-xs text-slate-500">
                <th className="px-4 py-3 font-medium">Employee</th><th className="px-4 py-3 font-medium">Period</th>
                <th className="px-4 py-3 font-medium text-right">Gross</th><th className="px-4 py-3 font-medium text-right">Deductions</th>
                <th className="px-4 py-3 font-medium text-right">Net Pay</th><th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">View</th>
              </tr></thead>
              <tbody>
                {statements.map(s => (
                  <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3"><span className="font-medium text-slate-700">{s.employeeName}</span><br/><span className="text-xs text-slate-400">{s.employeeCode}</span></td>
                    <td className="px-4 py-3 text-slate-600">{MONTHS[s.month - 1]} {s.year}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700">LKR {fmt(s.grossPay)}</td>
                    <td className="px-4 py-3 text-right font-mono text-red-600">LKR {fmt(s.totalDeductions)}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-slate-800">LKR {fmt(s.netPay)}</td>
                    <td className="px-4 py-3"><Badge status={s.status} /></td>
                    <td className="px-4 py-3"><button onClick={() => viewPayslip(s)} className="text-xs text-blue-600 hover:underline">Payslip</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="rounded border px-3 py-1 text-sm disabled:opacity-40">Prev</button>
              <span className="text-sm text-slate-500">Page {page} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="rounded border px-3 py-1 text-sm disabled:opacity-40">Next</button>
            </div>
          )}
        </>
      )}

      {viewStmt && viewStmt.lines && <PayslipModal statement={viewStmt} onClose={() => setViewStmt(null)} />}
    </div>
  );
}

/* ═══════════════════════ SALARY ADVANCE ═══════════════════════ */

function SalaryAdvanceTab() {
  const { getPayrollAccessLevel, isAdmin, user } = useAuth();
  const payrollFull = getPayrollAccessLevel() === "full" || isAdmin;

  const [batches, setBatches] = useState<AdvanceBatchOption[]>([]);
  const [myRequests, setMyRequests] = useState<SalaryAdvanceRequestRow[]>([]);
  const [hrQueue, setHrQueue] = useState<SalaryAdvanceRequestRow[]>([]);
  const [hrCanApprove, setHrCanApprove] = useState(false);
  const [advanceEmployees, setAdvanceEmployees] = useState<SalaryEmployee[]>([]);
  const [batchId, setBatchId] = useState("");
  const [forEmployeeId, setForEmployeeId] = useState("");
  const [amount, setAmount] = useState("");
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hrLoading, setHrLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [rejectFor, setRejectFor] = useState<SalaryAdvanceRequestRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const canEnterForOthers = payrollFull || hrCanApprove;

  const batchSelectOpts = useMemo<FormSelectOption[]>(
    () => [
      { value: "", label: "Select pay run…" },
      ...batches.map((b) => ({
        value: b.id,
        label: `${b.batchCode} — ${MONTHS[b.month - 1] ?? "?"} ${b.year} (${b.status})`,
      })),
    ],
    [batches]
  );

  const advanceEmployeeOpts = useMemo<FormSelectOption[]>(
    () => [
      {
        value: "",
        label: user?.employeeId ? "Yourself (this account)" : "Select employee…",
      },
      ...advanceEmployees.map((e) => ({
        value: e.id,
        label: `${e.firstName} ${e.lastName} (${e.employeeCode})${e.department ? ` · ${e.department}` : ""}`,
      })),
    ],
    [advanceEmployees, user?.employeeId]
  );

  const loadMyAndBatches = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    try {
      const b = await apiFetch<AdvanceBatchOption[]>("/api/payroll/advance-requests/active-batches");
      if (!Array.isArray(b)) throw new Error("Unexpected response from active-batches.");
      setBatches(b);
    } catch (e1) {
      const primaryErr = e1 instanceof Error ? e1.message : "Request failed";
      try {
        const paged = await apiFetch<PagedResult<Batch>>("/api/payroll/batches?pageSize=200");
        const raw = paged.items ?? [];
        const open = raw.filter((x) =>
          ADVANCE_ELIGIBLE_BATCH_STATUSES.includes(
            x.status as (typeof ADVANCE_ELIGIBLE_BATCH_STATUSES)[number]
          )
        );
        const mapped: AdvanceBatchOption[] = [...open]
          .sort((a, b) => b.year - a.year || b.month - a.month)
          .map((x) => ({
            id: x.id,
            batchCode: x.batchCode,
            month: x.month,
            year: x.year,
            status: x.status,
          }));
        setBatches(mapped);
        if (mapped.length === 0 && raw.length > 0) {
          setMsg({
            text: "Payroll has batches, but none are open for advances right now (need Draft, Calculated, Reviewed, or Approved before finalize).",
            ok: false,
          });
        }
      } catch {
        setBatches([]);
        setMsg({
          text: `Could not load open pay runs. ${primaryErr}`,
          ok: false,
        });
      }
    }
    try {
      const mine = await apiFetch<SalaryAdvanceRequestRow[]>("/api/payroll/advance-requests/my");
      setMyRequests(mine);
    } catch {
      setMyRequests([]);
      if (!payrollFull && !user?.employeeId) {
        setMsg((prev) =>
          prev?.ok === false
            ? prev
            : {
                text: "Your account is not linked to an employee, so you cannot submit a request for yourself. If you administer payroll, pick an employee in the form above (when available).",
                ok: false,
              }
        );
      }
    } finally {
      setLoading(false);
    }
  }, [payrollFull, user?.employeeId]);

  const loadHrQueue = useCallback(async () => {
    setHrLoading(true);
    try {
      const all = await apiFetch<SalaryAdvanceRequestRow[]>("/api/payroll/advance-requests/hr-queue");
      setHrQueue(all);
      setHrCanApprove(true);
    } catch {
      setHrQueue([]);
      setHrCanApprove(false);
    } finally {
      setHrLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canEnterForOthers) {
      setAdvanceEmployees([]);
      return;
    }
    apiFetch<SalaryEmployee[]>("/api/payroll/active-employees")
      .then(setAdvanceEmployees)
      .catch(() => setAdvanceEmployees([]));
  }, [canEnterForOthers]);

  useEffect(() => {
    void loadMyAndBatches();
    void loadHrQueue();
  }, [loadMyAndBatches, loadHrQueue]);

  async function submitRequest(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!batchId) {
      setMsg({ text: "Select a pay run.", ok: false });
      return;
    }
    if (canEnterForOthers && !forEmployeeId && !user?.employeeId) {
      setMsg({ text: "Select an employee, or link this account to an employee record to submit for yourself.", ok: false });
      return;
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setMsg({ text: "Enter a valid amount greater than zero.", ok: false });
      return;
    }
    setSubmitting(true);
    const submittedForAnother = !!(canEnterForOthers && forEmployeeId);
    try {
      const body: Record<string, unknown> = {
        payrollBatchId: batchId,
        amount: amt,
        currency: "LKR",
        remarks: remarks.trim() || null,
      };
      if (canEnterForOthers && forEmployeeId) {
        body.employeeId = forEmployeeId;
      }
      await apiFetch("/api/payroll/advance-requests", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setAmount("");
      setRemarks("");
      setForEmployeeId("");
      setMsg({
        text: submittedForAnother ? "Advance request submitted for the selected employee." : "Request submitted. HR will review it.",
        ok: true,
      });
      await loadMyAndBatches();
      if (hrCanApprove) await loadHrQueue();
    } catch (err: unknown) {
      setMsg({ text: err instanceof Error ? err.message : "Request failed", ok: false });
    } finally {
      setSubmitting(false);
    }
  }

  async function approveRequest(row: SalaryAdvanceRequestRow) {
    if (!confirm(`Approve advance of LKR ${fmt(row.amount)} for ${row.employeeName}?`)) return;
    setMsg(null);
    try {
      await apiFetch(`/api/payroll/advance-requests/${row.id}/approve`, { method: "POST" });
      setMsg({ text: "Advance approved.", ok: true });
      await loadHrQueue();
      await loadMyAndBatches();
    } catch (err: unknown) {
      setMsg({ text: err instanceof Error ? err.message : "Approve failed", ok: false });
    }
  }

  async function submitReject() {
    if (!rejectFor) return;
    setMsg(null);
    try {
      await apiFetch(`/api/payroll/advance-requests/${rejectFor.id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: rejectReason.trim() || null }),
      });
      setRejectFor(null);
      setRejectReason("");
      setMsg({ text: "Request rejected.", ok: true });
      await loadHrQueue();
      await loadMyAndBatches();
    } catch (err: unknown) {
      setMsg({ text: err instanceof Error ? err.message : "Reject failed", ok: false });
    }
  }

  if (loading) return <Loading />;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Salary advance</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Request an advance against an <strong>open pay run</strong> (Draft, Calculated, Reviewed, or Approved — not yet finalized).{" "}
          <strong>Payroll administrators</strong> can submit requests for any employee they can access in People. Users with{" "}
          <code className="rounded bg-slate-100 px-1 text-xs">Payroll:Update:All</code> (or ADMIN) can approve or reject requests.
        </p>
      </div>

      {msg && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            msg.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="New request">
          {batches.length === 0 ? (
            <p className="text-sm text-slate-500">
              There is no open pay run right now. Create or open a batch under <strong>Payroll Run</strong> first.
            </p>
          ) : (
            <form onSubmit={submitRequest} className="space-y-4">
              {canEnterForOthers && (
                <div>
                  <label className={labelCls}>Employee *</label>
                  <FormSelect
                    value={forEmployeeId}
                    onValueChange={setForEmployeeId}
                    options={advanceEmployeeOpts}
                    placeholder="Select employee…"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    Choose who will receive the advance. Leave as &quot;Yourself&quot; only if this login is linked to your employee record (for your own request).
                  </p>
                </div>
              )}
              <div>
                <label className={labelCls}>Pay run *</label>
                <FormSelect
                  value={batchId}
                  onValueChange={setBatchId}
                  options={batchSelectOpts}
                  placeholder="Select pay run…"
                />
              </div>
              <div>
                <label className={labelCls}>Amount (LKR) *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={inputCls}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className={labelCls}>Note (optional)</label>
                <textarea
                  className={inputCls}
                  rows={2}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Reason for advance"
                />
              </div>
              <Button
                type="submit"
                disabled={submitting || (canEnterForOthers && !user?.employeeId && advanceEmployees.length === 0)}
              >
                {submitting ? "Submitting…" : "Submit request"}
              </Button>
            </form>
          )}
        </Card>

        <Card title="My requests">
          {myRequests.length === 0 ? (
            <p className="text-sm text-slate-500">You have no advance requests yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-xs text-slate-500">
                    <th className="pb-2 font-medium">Pay run</th>
                    <th className="pb-2 font-medium text-right">Amount</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {myRequests.map((r) => (
                    <tr key={r.id} className="border-b border-slate-50">
                      <td className="py-2 text-slate-700">
                        {r.batchCode}
                        <div className="text-xs text-slate-400">
                          {MONTHS[r.batchMonth - 1]} {r.batchYear}
                        </div>
                        {r.remarks && <div className="mt-1 text-xs text-slate-500">{r.remarks}</div>}
                      </td>
                      <td className="py-2 text-right font-mono">
                        {r.currency} {fmt(r.amount)}
                      </td>
                      <td className="py-2">
                        <Badge status={r.status} />
                        {r.status === "Rejected" && r.rejectionReason && (
                          <div className="mt-1 text-xs text-red-600">{r.rejectionReason}</div>
                        )}
                      </td>
                      <td className="py-2 text-xs text-slate-500">{formatDateTime(r.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {hrCanApprove && (
        <Card title="HR — advance approvals">
          <p className="mb-4 text-sm text-slate-600">
            Pending requests appear first. Use Refresh after actions.
          </p>
          <div className="mb-3 flex gap-2">
            <Button type="button" variant="secondary" className="!py-1.5 !text-xs" onClick={() => void loadHrQueue()} disabled={hrLoading}>
              {hrLoading ? "Loading…" : "Refresh queue"}
            </Button>
          </div>
          {hrQueue.length === 0 ? (
            <p className="text-sm text-slate-500">No advance requests to show.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-xs text-slate-500">
                    <th className="px-3 py-2 font-medium">Employee</th>
                    <th className="px-3 py-2 font-medium">Pay run</th>
                    <th className="px-3 py-2 font-medium text-right">Amount</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {hrQueue.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100">
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-800">{r.employeeName}</div>
                        <div className="text-xs text-slate-400">{r.employeeCode}</div>
                        {r.remarks && <div className="mt-1 text-xs text-slate-500">{r.remarks}</div>}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {r.batchCode}
                        <div className="text-xs text-slate-400">
                          {MONTHS[r.batchMonth - 1]} {r.batchYear}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{r.currency} {fmt(r.amount)}</td>
                      <td className="px-3 py-2">
                        <Badge status={r.status} />
                        {r.reviewedBy && (
                          <div className="mt-1 text-[10px] text-slate-400">
                            {r.status === "Approved" ? "Approved" : "Reviewed"} by {r.reviewedBy}
                            {r.reviewedAt && ` · ${formatDateTime(r.reviewedAt)}`}
                          </div>
                        )}
                        {r.rejectionReason && <div className="mt-1 text-xs text-red-600">{r.rejectionReason}</div>}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {r.status === "Pending" && (
                          <div className="flex flex-wrap justify-end gap-1">
                            <button
                              type="button"
                              className="rounded-lg px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                              onClick={() => void approveRequest(r)}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="rounded-lg px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                              onClick={() => { setRejectFor(r); setRejectReason(""); }}
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {rejectFor && (
        <Modal open={!!rejectFor} title={`Reject advance — ${rejectFor.employeeName}`} onClose={() => setRejectFor(null)}>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Amount: <strong>{rejectFor.currency} {fmt(rejectFor.amount)}</strong>
            </p>
            <div>
              <label className={labelCls}>Reason (optional)</label>
              <textarea className={inputCls} rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" type="button" onClick={() => setRejectFor(null)}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void submitReject()}>
                Reject request
              </Button>
            </div>
          </div>
        </Modal>
      )}
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
          {msg && <div className={`rounded-lg px-4 py-2 text-sm ${msg.includes("success") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{msg}</div>}
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
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeCls[status] || "bg-slate-100 text-slate-600"}`}>{status}</span>;
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
