"use client";

import { appAlert, appConfirm } from "@/components/ui/appDialogs";
import { useState, useEffect, useCallback, useMemo, useRef, type FormEvent } from "react";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { apiFetch, ApiHttpError, PAYROLL_LONG_REQUEST_MS } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/date-utils";
import { formatLocalDateToIso } from "@/lib/datePickerIso";
import { DonutMixChart, formatInt, HorizontalCompareBars, WeeklyActivityBars } from "@/lib/workspace-charts";
import { getApiBaseUrl } from "@/config/constants";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { DatePickerField, FormSelect, TablePagination, FlashMessageBanner, FormErrorAlert, InlinePageAlert, SectionErrorBoundary, type FormSelectOption } from "@/components/ui";
import { useClientPagination } from "@/lib/use-client-pagination";
import { useApplyFilter } from "@/lib/use-apply-filter";
import { sanitizeSearchInput } from "@/lib/input-validation";
import { printPayslip } from "@/lib/payslip-print";
import { bankSlipFormatFor, bankSlipFormatLabel } from "@/lib/bank-slip-formats";
import {
  companyBankAccountLabel,
  companyBankAccountsFromSettings,
  filterCompanyBankAccountsForProfile,
  parseCompanyBankAccounts,
  type CompanyBankAccount,
} from "@/lib/company-bank-accounts";
import { PRIMARY_COMPANY_PROFILE_KEY } from "@/lib/additional-company-profiles";
import { useMultiCompanyFeature } from "@/lib/use-multi-company-feature";
import {
  buildCommercialBankOneToManyFile,
  commercialBankAccountNumber,
  commercialBankFileAccount,
  commercialBankSalaryNarratives,
  createCommercialBankDownload,
  formatCommercialBankFileAmount,
  triggerFileDownload,
} from "@/lib/commercial-bank-one-to-many";
import {
  buildSampathCeftsSlipsFile,
  createSampathCeftsSlipsDownload,
  formatSampathFileAmount,
  readJsonField,
  sampathAccountNumber,
  sampathBankCode,
  sampathBranchCode,
  sampathCreditMode,
  sampathFileAccount,
  sampathSalaryRef,
} from "@/lib/sampath-bank-cefts-slips";
import {
  createGenericBankSalaryExcelDownload,
  formatGenericBankAmount,
  genericBankAccountNumber,
  genericBankSalaryNarrative,
} from "@/lib/generic-bank-salary-excel";
import { evaluatePayrollFormula, formulaInputComponentCodes } from "@/lib/payroll-formula";
import { setComponentRoundResult, shouldRoundComponent } from "@/lib/payroll-component-round";
import {
  type EmploymentTypeCatalogItem,
  employeeSkipsProvidentFund,
  isFreelanceExcludedStatutoryLine,
} from "@/lib/employment-types";

interface Component {
  id: string; name: string; code: string; type: string; category: string;
  isTaxable: boolean; isEpfApplicable: boolean; isEtfApplicable: boolean;
  isStatutory: boolean; isActive: boolean;
  description?: string; formulaExpression?: string; dependsOnComponentCode?: string;
  sortOrder: number; isEmployerContribution: boolean; roundResult?: boolean;
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
  employeeCode?: string; department?: string; employmentType?: string; month: number; year: number;
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
interface EligibleEmployee {
  id: string;
  firstName: string;
  lastName: string;
  employeeCode: string;
  department: string;
  grade: string;
  location: string;
  alreadyInBatch?: boolean;
}
interface Settings {
  epfEmployeeRate: number;
  epfEmployerRate: number;
  etfEmployerRate: number;
  otHourlyDivisor: number;
  otMultiplier: number;
  apitTaxMode?: string;
  salaryPeriodStartDay?: number;
  salaryPeriodEndDay?: number;
  otComponentCode?: string;
  nopayComponentCode?: string;
  poyaComponentCode?: string;
  baseComponentCode?: string;
  workingHoursComponentCode?: string;
}

interface AttendanceImportLine {
  employeeId: string; employeeName: string; employeeCode?: string;
  approvedOtHours: number; otAmount: number; otApproved: boolean; otOutdated: boolean;
  attendanceNopayDays: number; leaveNopayDays: number; totalNopayDays: number;
  poyaDaysWorked: number;
  totalWorkedHours?: number;
  basicPay: number; warning?: string;
}

interface PagedResult<T> { items?: T[]; Items?: T[]; totalCount?: number; TotalCount?: number; }

const DEFAULT_PAYROLL_SETTINGS: Settings = {
  epfEmployeeRate: 0.08,
  epfEmployerRate: 0.12,
  etfEmployerRate: 0.03,
  otHourlyDivisor: 208,
  otMultiplier: 1.5,
  apitTaxMode: "Monthly",
  salaryPeriodStartDay: 1,
  salaryPeriodEndDay: 31,
  otComponentCode: "OT",
  nopayComponentCode: "NOPAY",
  poyaComponentCode: "POYA",
  baseComponentCode: "BASIC",
  workingHoursComponentCode: "",
};

function clampDay(day: number | undefined, fallback: number): number {
  if (day === undefined || !Number.isFinite(day) || day < 1) return fallback;
  return Math.min(31, Math.floor(day));
}

/** Allow typing multi-digit day values; clamp on blur / save. */
function sanitizeSalaryPeriodDayInput(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 2);
}

function salaryPeriodDayFromField(raw: string, fallback: number): number {
  const n = parseInt(raw, 10);
  return clampDay(Number.isFinite(n) ? n : undefined, fallback);
}

function formatSalaryPeriodDayField(n: number | undefined, fallback: number): string {
  return String(clampDay(n, fallback));
}

function monthDateRange(
  month: number,
  year: number,
  startDay = 1,
  endDay = 31,
): { from: string; to: string } {
  const start = clampDay(startDay, 1);
  const end = clampDay(endDay, 31);
  const iso = (y: number, m: number, d: number) => {
    const last = new Date(y, m, 0).getDate();
    const day = Math.min(d, last);
    return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };

  if (start <= end) {
    return { from: iso(year, month, start), to: iso(year, month, end) };
  }

  const prev = new Date(year, month - 1, 1);
  prev.setMonth(prev.getMonth() - 1);
  return {
    from: iso(prev.getFullYear(), prev.getMonth() + 1, start),
    to: iso(year, month, end),
  };
}

function pagedItems<T>(result: PagedResult<T> | null | undefined): T[] {
  if (!result) return [];
  return result.items ?? result.Items ?? [];
}

/** API may return PascalCase property names on some hosts. */
function normalizeBatch(raw: Batch & { Id?: string; BatchCode?: string; CreatedAt?: string }): Batch {
  return {
    ...raw,
    id: raw.id || raw.Id || "",
    batchCode: raw.batchCode || raw.BatchCode || "",
    createdAt: raw.createdAt || raw.CreatedAt || "",
  };
}

function normalizeBatches(items: Batch[]): Batch[] {
  return items.map((b) => normalizeBatch(b as Batch & { Id?: string; BatchCode?: string; CreatedAt?: string }));
}

function textIncludes(value: string | null | undefined, q: string) {
  return (value ?? "").toLowerCase().includes(q);
}

function sortBatchesNewestFirst(items: Batch[]): Batch[] {
  return items.slice().sort((a, b) => {
    const aCreated = Date.parse(a.createdAt);
    const bCreated = Date.parse(b.createdAt);
    if (Number.isFinite(aCreated) && Number.isFinite(bCreated) && aCreated !== bCreated) {
      return bCreated - aCreated;
    }
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
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

interface AttendanceImportResult {
  importedCount: number;
  otLinesUpdated: number;
  recalculated: boolean;
  recalculateError?: string | null;
  preview?: AttendanceImportPreview;
}

const TABS = ["Dashboard", "Components", "Employee Salary", "Variable Entry", "Payroll Run", "Slip Generate", "Pay Slips", "Settings"] as const;
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

function formatBatchPeriod(b: Batch): string {
  const to = b.effectiveTo ? formatDate(b.effectiveTo) : "—";
  return `${formatDate(b.effectiveFrom)} – ${to}`;
}

function formatBatchLabel(b: Batch): string {
  return `${b.batchCode} — ${formatProcessType(b.processType)} — ${MONTHS[b.month - 1]} ${b.year}`;
}

const PAYROLL_COMPONENT_TYPE_OPTS: FormSelectOption[] = [
  { value: "Earning", label: "Income" },
  { value: "Rate", label: "Rate" },
  { value: "Hours", label: "Hours" },
  { value: "Day", label: "Days" },
  { value: "Deduction", label: "Deduction" },
  { value: "StatutoryDeduction", label: "Statutory Deduction" },
  { value: "StatutoryContribution", label: "Statutory Contribution" },
];

function formatComponentType(type?: string | null) {
  if (!type) return "—";
  return PAYROLL_COMPONENT_TYPE_OPTS.find((o) => o.value === type)?.label ?? type;
}

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

function componentRoundsResult(c?: Pick<Component, "id" | "roundResult"> | null): boolean {
  return shouldRoundComponent(c?.id, c?.roundResult);
}

const EPF_ETF_OPTS: FormSelectOption[] = [
  { value: "no", label: "No" },
  { value: "both", label: "Yes" },
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
  return epfEtfKindFromFlags(c) === "no" ? "No" : "Yes";
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

function isOpenPayrollBatch(status: string) {
  const value = (status ?? "").trim().toLowerCase();
  return value !== "approved" && value !== "finalized" && value !== "cancelled";
}

const BANK_FILE_APPROVAL_MESSAGE = "Approve this payroll run before downloading the bank file.";

function isPayrollApprovedForBankFile(status?: string | null) {
  const value = (status ?? "").trim();
  return value === "Approved" || value === "Finalized";
}

function bankFileBlockedReason(status?: string | null): string | null {
  const value = (status ?? "").trim();
  if (isPayrollApprovedForBankFile(value)) return null;
  if (value === "Cancelled") return "This payroll run was cancelled. The bank file cannot be downloaded.";
  return BANK_FILE_APPROVAL_MESSAGE;
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
  allowPreview = false,
}: {
  statement: Statement;
  viewingId: string | null;
  printingId: string | null;
  onView: () => void;
  onPrint: () => void;
  allowPreview?: boolean;
}) {
  const approved = isApprovedPaySlip(statement.status);
  if (!approved && !allowPreview) {
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
      {approved ? (
        <button
          type="button"
          onClick={onPrint}
          disabled={busyPrint}
          className="text-xs font-medium text-[#256aa3] hover:underline disabled:opacity-50"
        >
          {busyPrint ? "Printing…" : "Print"}
        </button>
      ) : null}
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

function resolveTaxableBase(taxableRegular: number, epfBase: number, basicPay: number): number {
  if (taxableRegular > 0) return taxableRegular;
  if (epfBase > 0) return epfBase;
  return basicPay;
}

/** Matches backend ResolveApitRegularBase (Table 01 monthly profits). */
function resolveApitRegularBase(
  regularEarnings: number,
  taxableRegular: number,
  epfBase: number,
  basicPay: number,
  skipsProvidentFund: boolean
): number {
  if (regularEarnings > 0) return regularEarnings;
  if (taxableRegular > 0) return taxableRegular;
  if (skipsProvidentFund) return 0;
  return resolveTaxableBase(taxableRegular, epfBase, basicPay);
}

function calcApit(regularTaxable: number, lumpTaxable: number): number {
  const table01 = calcApitTable01(regularTaxable);
  if (lumpTaxable <= 0) return table01;
  const table02 = Math.max(0, calcApitTable01(regularTaxable + lumpTaxable) - table01);
  return roundMoney(table01 + table02);
}

/** IRD Tax Table No. 02: April = 1 … March = 12. */
function apitTable02MonthIndex(calendarMonth: number): number {
  return calendarMonth >= 4 ? calendarMonth - 3 : calendarMonth + 9;
}

function calcLumpSumTaxOnEgar(
  a: number,
  b: number,
  lumpSumNow: number,
  priorLumpSums = 0,
  taxOnA = 0,
  taxOnB = 0,
  priorLumpSumTaxDeducted = 0
): number {
  const lump = Math.max(0, lumpSumNow);
  if (lump <= 0) return 0;
  const d = Math.max(0, a) + Math.max(0, b) + Math.max(0, priorLumpSums) + lump;
  const alreadyDeducted = Math.max(0, taxOnA) + Math.max(0, taxOnB) + Math.max(0, priorLumpSumTaxDeducted);

  let tax = 0;
  if (d <= 1800000) tax = 0;
  else if (d <= 2800000) tax = d * 0.06 - (108000 + alreadyDeducted);
  else if (d <= 3300000) tax = d * 0.18 - (444000 + alreadyDeducted);
  else if (d <= 3800000) tax = d * 0.24 - (642000 + alreadyDeducted);
  else if (d <= 4300000) tax = d * 0.30 - (870000 + alreadyDeducted);
  else tax = d * 0.36 - (1128000 + alreadyDeducted);

  return Math.max(0, roundMoney(tax));
}

/** Official PDF helper: constant monthly pay. A/B use April=1 fiscal months. */
function calcLumpSumTax({
  monthlyPay,
  currentMonthIndex,
  lumpSumNow,
  priorLumpSums = 0,
  priorLumpSumTaxDeducted = 0,
  monthlyTaxPerMonth = 0,
}: {
  monthlyPay: number;
  currentMonthIndex: number;
  lumpSumNow: number;
  priorLumpSums?: number;
  priorLumpSumTaxDeducted?: number;
  monthlyTaxPerMonth?: number;
}): number {
  const monthly = Math.max(0, monthlyPay);
  const monthIndex = Math.min(12, Math.max(1, currentMonthIndex));
  const remainingMonths = 12 - monthIndex;
  return calcLumpSumTaxOnEgar(
    monthly * monthIndex,
    monthly * remainingMonths,
    lumpSumNow,
    priorLumpSums,
    monthlyTaxPerMonth * monthIndex,
    monthlyTaxPerMonth * remainingMonths,
    priorLumpSumTaxDeducted
  );
}

function calcBonusApitByMode(
  monthlyPay: number,
  lumpSumNow: number,
  calendarMonth: number,
  mode?: string
): number {
  const lump = Math.max(0, lumpSumNow);
  if (normalizeApitTaxMode(mode) === "Exact") {
    return Math.max(0, roundMoney(calcExactApit(monthlyPay, lump) - calcApitTable41(monthlyPay)));
  }
  return calcLumpSumTax({
    monthlyPay,
    currentMonthIndex: apitTable02MonthIndex(calendarMonth),
    lumpSumNow: lump,
    monthlyTaxPerMonth: calcApitTable01(Math.max(0, monthlyPay)),
  });
}

function isBasicSalaryCode(code?: string) {
  const value = (code ?? "").toUpperCase();
  return value === "BASIC" || value.startsWith("BASIC");
}

function isEarningComponentType(type?: string | null) {
  return type === "Earning" || type === "Income";
}

function isRateOrQuantityType(type?: string | null) {
  return type === "Rate" || type === "Hours" || type === "Day" || type === "Days";
}

function isIncomePayCode(code?: string | null) {
  const value = (code ?? "").toUpperCase();
  return value === "TOTAL_PAYMENT" || value === "TOTAL_PAY";
}

function isWorkedHoursComponent(code?: string | null) {
  const value = (code ?? "").toUpperCase();
  return value === "WORKED_HOURS" || value === "NO_OF_WORKED_HOURS";
}

function fmtWorkedHours(hours: number) {
  if (!Number.isFinite(hours) || hours <= 0) return "—";
  return hours.toLocaleString("en-LK", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function isEndedSalaryRow(row: EmpComp) {
  if (!row.effectiveTo) return false;
  const end = Date.parse(row.effectiveTo);
  return Number.isFinite(end) && end < Date.now();
}

function latestPositiveFixedSalary(assignments: EmpComp[]): number {
  const byComp = new Map<string, EmpComp>();
  for (const row of assignments) {
    if (row.isActive === false || row.batchId) continue;
    if (row.componentCategory === "OneTime" || row.componentCategory === "Statutory") continue;
    const isEarning = !row.componentType || isEarningComponentType(row.componentType) || isBasicSalaryCode(row.componentCode);
    if (!isEarning) continue;
    if (!(row.amount > 0) || isEndedSalaryRow(row)) continue;
    const prev = byComp.get(row.componentId);
    if (!prev || new Date(row.effectiveFrom).getTime() > new Date(prev.effectiveFrom).getTime()) {
      byComp.set(row.componentId, row);
    }
  }
  return [...byComp.values()].reduce((sum, row) => sum + row.amount, 0);
}

/** Tax year starts 1 March: March = 1 … February = 12. */
function apitTaxYearMonthNumber(calendarMonth: number): number {
  return calendarMonth >= 3 ? calendarMonth - 2 : calendarMonth + 10;
}

function calcCumulativeApit(regularTaxable: number, lumpTaxable: number, calendarMonth: number): number {
  return roundMoney(calcApit(regularTaxable, lumpTaxable) * apitTaxYearMonthNumber(calendarMonth));
}

function normalizeApitTaxMode(mode?: string): "Monthly" | "Annual" | "Exact" {
  const value = (mode ?? "").trim().toLowerCase();
  if (!value || value === "monthly") return "Monthly";
  if (value === "annual" || value === "annualy" || value === "annually") return "Annual";
  return "Exact";
}

function calcApitTableAnnual(yearlyProfits: number): number {
  if (yearlyProfits <= 1800000) return 0;
  if (yearlyProfits <= 2800000) return roundMoney(yearlyProfits * 0.06 - 108000);
  if (yearlyProfits <= 3300000) return roundMoney(yearlyProfits * 0.18 - 444000);
  if (yearlyProfits <= 3800000) return roundMoney(yearlyProfits * 0.24 - 642000);
  if (yearlyProfits <= 4300000) return roundMoney(yearlyProfits * 0.30 - 870000);
  return Math.max(0, roundMoney(yearlyProfits * 0.36 - 1128000));
}

function calcLowSalaryAnnualApit(monthlySalary: number): number {
  if (monthlySalary <= 0) return 0;
  const yearly = monthlySalary * 12;
  if (yearly < 150000) return 0;
  return roundMoney(yearly * 0.06);
}

function calcMonthlyApitWithAnnualFallback(regularTaxable: number, lumpTaxable: number): number {
  return calcApit(regularTaxable, lumpTaxable);
}

function calcAnnualApitIncrement(priorCumulativeTaxable: number, thisMonthTaxable: number): number {
  const prior = Math.max(0, priorCumulativeTaxable);
  const added = Math.max(0, thisMonthTaxable);
  return Math.max(0, roundMoney(calcApitTableAnnual(prior + added) - calcApitTableAnnual(prior)));
}

function calcAnnualApitAmount(regularTaxable: number, lumpTaxable: number): number {
  return calcAnnualApitIncrement(0, regularTaxable + lumpTaxable);
}

function calcApitTable41(monthlyProfits: number): number {
  if (monthlyProfits <= 0) return 0;
  if (monthlyProfits <= 83333) return roundMoney(monthlyProfits * 0.06);
  if (monthlyProfits <= 125000) return roundMoney(monthlyProfits * 0.18 - 10000);
  if (monthlyProfits <= 166667) return roundMoney(monthlyProfits * 0.24 - 17500);
  if (monthlyProfits <= 208333) return roundMoney(monthlyProfits * 0.30 - 27500);
  return Math.max(0, roundMoney(monthlyProfits * 0.36 - 40000));
}

function calcApitTable42Gross(d: number): number {
  if (d <= 0) return 0;
  if (d <= 1000000) return roundMoney(d * 0.06);
  if (d <= 1500000) return roundMoney(d * 0.18 - 120000);
  if (d <= 2000000) return roundMoney(d * 0.24 - 210000);
  if (d <= 2500000) return roundMoney(d * 0.30 - 330000);
  return Math.max(0, roundMoney(d * 0.36 - 480000));
}

function calcExactApit(regularTaxable: number, lumpTaxable: number): number {
  const remainingMonths = 12;
  const expected = regularTaxable * remainingMonths + Math.max(0, lumpTaxable);
  const aggregated = remainingMonths * calcApitTable41(regularTaxable);
  const lumpTax = Math.max(0, roundMoney(calcApitTable42Gross(expected) - aggregated));
  return roundMoney(calcApitTable41(regularTaxable) + lumpTax);
}

function calcApitByMode(
  regularTaxable: number,
  lumpTaxable: number,
  calendarMonth: number,
  mode?: string
): number {
  const monthly = calcMonthlyApitWithAnnualFallback(regularTaxable, lumpTaxable);
  switch (normalizeApitTaxMode(mode)) {
    case "Monthly":
      return monthly;
    case "Annual":
      return calcAnnualApitAmount(regularTaxable, lumpTaxable);
    default:
      return calcExactApit(regularTaxable, lumpTaxable);
  }
}

function isEpfEtfStatutoryCode(code: string) {
  const c = code.toUpperCase();
  return c === "EPF_EE" || c === "EPF_ER" || c === "ETF_ER";
}

function calcStatutoryAmount(
  def: Component,
  epfBase: number,
  etfBase: number,
  apitAmount: number,
  settings: Settings | null,
  skipEpfEtf = false
): number {
  if (skipEpfEtf && isEpfEtfStatutoryCode(def.code)) return 0;
  switch (def.code.toUpperCase()) {
    case "EPF_EE":
      return settings && epfBase > 0 ? roundMoney(epfBase * settings.epfEmployeeRate) : 0;
    case "EPF_ER":
      return settings && epfBase > 0 ? roundMoney(epfBase * settings.epfEmployerRate) : 0;
    case "ETF_ER":
      return settings && etfBase > 0 ? roundMoney(etfBase * settings.etfEmployerRate) : 0;
    case "APIT":
      return apitAmount;
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
        subtitle="Manage compensation components, run monthly payroll, generate slips, and view pay slips."
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

      <SectionErrorBoundary key={tab} title={tab}>
        {tab === "Dashboard" && <DashboardTab onOpenTab={setTab} />}
        {tab === "Components" && <ComponentsTab />}
        {tab === "Employee Salary" && <EmployeeSalaryTab />}
        {tab === "Variable Entry" && <VariableEntryTab />}
        {tab === "Payroll Run" && <PayrollRunTab />}
        {tab === "Slip Generate" && <SlipGenerateTab onOpenPayrollRun={() => setTab("Payroll Run")} />}
        {tab === "Pay Slips" && <PayStatementsTab />}
        {tab === "Settings" && <SettingsTab />}
      </SectionErrorBoundary>
    </>
  );
}

/* ═══════════════════════════ DASHBOARD ═══════════════════════════ */

function payrollBatchStatusColor(status: string): string {
  const u = (status ?? "").toLowerCase();
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
      .then((b) => setBatches(sortBatchesNewestFirst(normalizeBatches(pagedItems(b)))))
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
    { tab: "Slip Generate", title: "Slip generate", sub: "Generate employee pay slips from a batch" },
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
            <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{(settings.epfEmployeeRate * 100).toFixed(2)}%</div>
          </div>
          <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 px-4 py-4 text-center">
            <div className="text-xs font-medium text-slate-500">EPF (Employer)</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{(settings.epfEmployerRate * 100).toFixed(2)}%</div>
          </div>
          <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 px-4 py-4 text-center">
            <div className="text-xs font-medium text-slate-500">ETF (Employer)</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{(settings.etfEmployerRate * 100).toFixed(2)}%</div>
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

function componentMatchesQuery(c: Component, q: string) {
  return (
    textIncludes(c.name, q) ||
    textIncludes(c.code, q) ||
    textIncludes(c.type, q) ||
    textIncludes(formatComponentType(c.type), q) ||
    textIncludes(c.category, q) ||
    textIncludes(c.formulaExpression, q) ||
    textIncludes(c.description, q) ||
    textIncludes(epfEtfKindLabel(c), q) ||
    textIncludes(c.isActive ? "active" : "inactive", q)
  );
}

function ComponentsTab() {
  const [components, setComponents] = useState<Component[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Component | null>(null);
  const [deletingId, setDeletingId] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setLoadError("");
    apiFetch<Component[]>("/api/payroll/components")
      .then((rows) =>
        setComponents(
          rows.map((c) => ({ ...c, roundResult: shouldRoundComponent(c.id, c.roundResult) }))
        )
      )
      .catch((err) => {
        setComponents([]);
        setLoadError(err instanceof Error ? err.message : "Could not load compensation components.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleEdit(c: Component) { setEditing(c); setShowForm(true); }
  async function handleDelete(id: string) {
    if (!(await appConfirm("Delete this component? Salary lines that use it will also be removed, and it will not come back on refresh."))) return;
    setDeletingId(id);
    try {
      await apiFetch(`/api/payroll/components/${id}`, { method: "DELETE" });
      setComponents((prev) => prev.filter((c) => c.id !== id));
      load();
    } catch (err: unknown) {
      await appAlert(err instanceof Error ? err.message : "Could not delete this component.");
    } finally {
      setDeletingId("");
    }
  }

  const searchQuery = search.trim().toLowerCase();
  const filteredComponents = useMemo(
    () => (searchQuery ? components.filter((c) => componentMatchesQuery(c, searchQuery)) : components),
    [components, searchQuery],
  );
  const componentsPager = useClientPagination(filteredComponents);

  if (loading) return <Loading />;

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)]">
        <div className="border-b border-slate-100 bg-gradient-to-b from-slate-50/80 to-white px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-900">Compensation Components</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">
                {searchQuery
                  ? `${filteredComponents.length} of ${components.length} components`
                  : `${components.length} component${components.length === 1 ? "" : "s"}`}
              </p>
            </div>
            <Button className="h-[42px] shrink-0" onClick={() => { setEditing(null); setShowForm(true); }}>
              + Add Component
            </Button>
          </div>
          <div className="mt-5">
            <label htmlFor="payroll-component-search" className={labelCls}>
              Search
            </label>
            <div className="relative">
              <svg
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                id="payroll-component-search"
                type="text"
                autoComplete="off"
                className={`${inputCls} h-[42px] !mb-0 rounded-xl border-slate-200/90 bg-white py-2.5 pl-10 pr-10 shadow-sm placeholder:text-slate-400`}
                placeholder="Search name, code, type, or category…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search ? (
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {loadError ? (
          <div className="px-6 py-4">
            <InlinePageAlert message={loadError} />
          </div>
        ) : components.length === 0 ? (
          <div className="px-6 py-14">
            <EmptyState text="No components defined yet. Add your first component." />
          </div>
        ) : filteredComponents.length === 0 ? (
          <div className="px-6 py-14">
            <EmptyState text={`No components match "${search.trim()}".`} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/90 text-xs text-slate-500">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Taxable</th>
                  <th className="px-4 py-3 font-medium">EPF & ETF</th>
                  <th className="px-4 py-3 font-medium">Formula</th>
                  <th className="px-4 py-3 font-medium">Order</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {componentsPager.pageItems.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium text-slate-700">{c.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.code}</td>
                    <td className="px-4 py-3 text-slate-600">{formatComponentType(c.type)}</td>
                    <td className="px-4 py-3 text-slate-600">{c.category}</td>
                    <td className="px-4 py-3">{c.isTaxable ? <span className="text-amber-600">Yes</span> : <span className="text-slate-400">No</span>}</td>
                    <td className="px-4 py-3">{epfEtfKindLabel(c) === "No" ? <span className="text-slate-400">No</span> : <span className="text-sky-600">{epfEtfKindLabel(c)}</span>}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.formulaExpression || "—"}</td>
                    <td className="px-4 py-3 text-slate-500">{c.sortOrder}</td>
                    <td className="px-4 py-3">{c.isActive ? <span className="text-green-600">Active</span> : <span className="text-slate-400">Inactive</span>}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => handleEdit(c)} className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50">Edit</button>
                        <button
                          type="button"
                          disabled={deletingId === c.id}
                          onClick={() => void handleDelete(c.id)}
                          className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 disabled:opacity-50"
                        >
                          {deletingId === c.id ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <TablePagination page={componentsPager.page} totalPages={componentsPager.totalPages} totalCount={componentsPager.totalCount} pageSize={componentsPager.pageSize} onPageChange={componentsPager.setPage} />
          </div>
        )}
      </div>

      {showForm && <ComponentFormModal editing={editing} onClose={() => setShowForm(false)} onSaved={load} />}
    </div>
  );
}

function ComponentFormModal({ editing, onClose, onSaved }: { editing: Component | null; onClose: () => void; onSaved: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [compType, setCompType] = useState(editing?.type || "Earning");
  const showEpfEtf = compType === "Earning";
  const [roundResult, setRoundResult] = useState(() => componentRoundsResult(editing));
  const [isActive, setIsActive] = useState(() => editing?.isActive !== false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(""); setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: fd.get("name"), code: fd.get("code"), type: fd.get("type"), category: fd.get("category"),
      isTaxable: fd.get("isTaxable") === "true",
      ...flagsFromEpfEtfKind(showEpfEtf ? String(fd.get("epfEtfKind") || "no") : "no"),
      isStatutory: fd.get("isStatutory") === "true",
      description: fd.get("description") || null, formulaExpression: fd.get("formulaExpression") || null,
      dependsOnComponentCode: fd.get("dependsOnComponentCode") || null,
      sortOrder: Number(fd.get("sortOrder") || 0),
      isEmployerContribution: fd.get("isEmployerContribution") === "true",
      roundResult,
      isActive: editing ? isActive : true,
    };
    try {
      const saved = editing
        ? await apiFetch<Component>(`/api/payroll/components/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) })
        : await apiFetch<Component>("/api/payroll/components", { method: "POST", body: JSON.stringify(payload) });
      setComponentRoundResult(saved?.id ?? editing?.id ?? "", roundResult);
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
          <div>
            <label className={labelCls}>Type *</label>
            <FormSelect name="type" defaultValue={editing?.type || "Earning"} options={PAYROLL_COMPONENT_TYPE_OPTS} placeholder="Income, Rate, Hours or Days" onValueChange={setCompType} />
            <p className="mt-1 text-xs text-slate-500">Income = pay. Rate = hourly/daily rate. Hours / Days = quantity. Not added to earnings except Income.</p>
          </div>
          <div><label className={labelCls}>Category *</label>
            <FormSelect name="category" defaultValue={editing?.category || "Fixed"} options={PAYROLL_COMPONENT_CATEGORY_OPTS} placeholder="Category" />
          </div>
          <div><label className={labelCls}>Taxable</label>
            <FormSelect name="isTaxable" defaultValue={String(editing?.isTaxable ?? false)} options={YES_NO_TF_OPTS} placeholder="—" />
          </div>
          {showEpfEtf ? (
          <div><label className={labelCls}>EPF & ETF</label>
            <FormSelect name="epfEtfKind" defaultValue={epfEtfKindFromFlags(editing)} options={EPF_ETF_OPTS} placeholder="—" />
            <p className="mt-1 text-xs text-slate-500">Yes only if this income is part of the EPF/ETF wage. Transport and similar allowances are usually No.</p>
          </div>
          ) : null}
          <div><label className={labelCls}>Statutory</label>
            <FormSelect name="isStatutory" defaultValue={String(editing?.isStatutory ?? false)} options={YES_NO_TF_OPTS} placeholder="—" />
          </div>
          <div><label className={labelCls}>Employer Contribution</label>
            <FormSelect name="isEmployerContribution" defaultValue={String(editing?.isEmployerContribution ?? false)} options={YES_NO_TF_OPTS} placeholder="—" />
          </div>
          <div><label className={labelCls}>Sort Order</label><input name="sortOrder" type="number" className={inputCls} defaultValue={editing?.sortOrder ?? 0} /></div>
        </div>
        <div>
          <label className={labelCls}>Formula Expression</label>
          <input name="formulaExpression" className={inputCls} defaultValue={editing?.formulaExpression ?? ""} placeholder="e.g. BASIC1 / WORKING_DAYS" />
          <p className="mt-1 text-xs text-slate-500">Use exact component codes (BASIC1, WORKING_DAYS). Employee Salary auto-fills the result.</p>
        </div>
        <div>
          <label className={labelCls}>Round result</label>
          <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setRoundResult(false)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                !roundResult
                  ? "bg-[#d7e8fa] text-[#1a5f94] shadow-sm"
                  : "text-slate-600 hover:bg-slate-200/80 hover:text-slate-800"
              }`}
            >
              Do not round
            </button>
            <button
              type="button"
              onClick={() => setRoundResult(true)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                roundResult
                  ? "bg-[#d7e8fa] text-[#1a5f94] shadow-sm"
                  : "text-slate-600 hover:bg-slate-200/80 hover:text-slate-800"
              }`}
            >
              Round
            </button>
          </div>
          <input type="hidden" name="roundResult" value={roundResult ? "round" : "keep"} />
          <p className="mt-1 text-xs text-slate-500">
            {roundResult
              ? "Amounts are rounded to the nearest rupee, whether entered or from a formula (example: 1,840.91 → 1,841)."
              : "Amounts keep cents (example: 1,840.91)."}
          </p>
        </div>
        <div><label className={labelCls}>Depends On Component Code</label><input name="dependsOnComponentCode" className={inputCls} defaultValue={editing?.dependsOnComponentCode ?? ""} /></div>
        <div><label className={labelCls}>Description</label><textarea name="description" className={inputCls} rows={2} defaultValue={editing?.description ?? ""} /></div>
        {editing && (
          <div><label className={labelCls}>Active</label>
            <FormSelect
              name="isActive"
              value={isActive ? "true" : "false"}
              onValueChange={(v) => setIsActive(v === "true")}
              options={ACTIVE_STATUS_OPTS}
              placeholder="—"
              clearable={false}
            />
            <p className="mt-1 text-xs text-slate-500">Inactive components are skipped on payroll run (e.g. turn off Poya Day Pay).</p>
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

interface SalaryEmployee {
  id: string;
  firstName: string;
  lastName: string;
  employeeCode: string;
  department: string;
  grade: string;
  location: string;
  employmentType?: string;
}

function salaryEmployeeDisplayName(e: Pick<SalaryEmployee, "firstName" | "lastName">) {
  return `${e.firstName ?? ""} ${e.lastName ?? ""}`.trim();
}

function salaryEmployeeMatchesQuery(e: SalaryEmployee, raw: string) {
  const q = raw.trim().toLowerCase();
  if (!q) return true;
  return (
    salaryEmployeeDisplayName(e).toLowerCase().includes(q) ||
    textIncludes(e.firstName, q) ||
    textIncludes(e.lastName, q) ||
    textIncludes(e.employeeCode, q)
  );
}

function batchEmployeeDisplayName(e: Pick<EligibleEmployee, "firstName" | "lastName">) {
  return salaryEmployeeDisplayName(e);
}

function batchEmployeeMatchesQuery(e: EligibleEmployee, raw: string) {
  const q = raw.trim().toLowerCase();
  if (!q) return true;
  return (
    batchEmployeeDisplayName(e).toLowerCase().includes(q) ||
    textIncludes(e.firstName, q) ||
    textIncludes(e.lastName, q) ||
    textIncludes(e.employeeCode, q) ||
    textIncludes(e.department, q)
  );
}

function batchEmployeePassesOrgFilters(
  e: EligibleEmployee,
  filterDept: string,
  filterGrade: string,
  filterLocation: string
) {
  if (filterDept && e.department !== filterDept) return false;
  if (filterGrade && e.grade !== filterGrade) return false;
  if (filterLocation && e.location !== filterLocation) return false;
  return true;
}

function EmployeeSalaryTab() {
  const [allEmployees, setAllEmployees] = useState<SalaryEmployee[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const [highlightIdx, setHighlightIdx] = useState(0);
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
  const [employmentTypes, setEmploymentTypes] = useState<EmploymentTypeCatalogItem[]>([]);

  useEffect(() => {
    apiFetch<EmploymentTypeCatalogItem[]>("/api/organization/employment-statuses")
      .then(setEmploymentTypes)
      .catch(() => setEmploymentTypes([]));
    apiFetch<Component[]>("/api/payroll/components")
      .then((rows) =>
        setComponents(
          rows.map((c) => ({ ...c, roundResult: shouldRoundComponent(c.id, c.roundResult) }))
        )
      )
      .catch(() => {});
    apiFetch<Settings>("/api/payroll/settings")
      .then(setPayrollSettings)
      .catch(() => setPayrollSettings(DEFAULT_PAYROLL_SETTINGS));
    apiFetch<PagedResult<Batch>>("/api/payroll/batches?pageSize=200").then(d => {
      const items = sortBatchesNewestFirst(normalizeBatches(pagedItems(d)));
      setBatches(items);
      const open = items.find((b) => b.status === "Draft" || b.status === "Calculated")
        ?? items.find((b) => isOpenPayrollBatch(b.status));
      if (open) setSelectedBatchId(open.id);
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
  const openBatches = useMemo(
    () => batches.filter((b) => isOpenPayrollBatch(b.status)),
    [batches]
  );

  const empSalaryBatchOpts = useMemo<FormSelectOption[]>(
    () => [{ value: "", label: "Select Batch…" }, ...openBatches.map((b) => ({ value: b.id, label: formatBatchLabel(b) }))],
    [openBatches]
  );

  const selectedBatch = openBatches.find((b) => b.id === selectedBatchId);

  useEffect(() => {
    if (selectedBatchId && !openBatches.some((b) => b.id === selectedBatchId)) {
      setSelectedBatchId(openBatches[0]?.id ?? "");
    }
  }, [openBatches, selectedBatchId]);
  const batchEntryCategory =
    selectedBatch?.processType === "Bonus" ? "OneTime" : "Variable";

  const searchQuery = employeeSearch.trim();

  const filtered = useMemo(
    () =>
      allEmployees.filter((e) => {
        if (filterDept && e.department !== filterDept) return false;
        if (filterGrade && e.grade !== filterGrade) return false;
        if (filterLocation && e.location !== filterLocation) return false;
        return salaryEmployeeMatchesQuery(e, searchQuery);
      }),
    [allEmployees, filterDept, filterGrade, filterLocation, searchQuery]
  );

  const selectEmployee = useCallback((emp: SalaryEmployee) => {
    setSelectedEmp(emp);
    setCompLoading(true);
    setCompError(null);
    apiFetch<{ employmentType?: string }>(`/api/employees/${emp.id}`)
      .then((detail) => {
        const employmentType = detail.employmentType ?? emp.employmentType;
        setSelectedEmp((current) =>
          current?.id === emp.id ? { ...current, employmentType } : current
        );
        if (employmentType) {
          setAllEmployees((list) =>
            list.map((e) => (e.id === emp.id ? { ...e, employmentType } : e))
          );
        }
      })
      .catch(() => {});
    apiFetch<EmpComp[]>(`/api/payroll/compensation/${emp.id}`)
      .then(setEmpComp)
      .catch((err: unknown) => {
        setEmpComp([]);
        setCompError(err instanceof Error ? err.message : "Could not load compensation");
      })
      .finally(() => setCompLoading(false));
  }, []);

  const pickFromList = useCallback(
    (emp: SalaryEmployee) => {
      setHighlightIdx(0);
      selectEmployee(emp);
    },
    [selectEmployee]
  );

  useEffect(() => {
    setHighlightIdx(0);
  }, [employeeSearch, filterDept, filterGrade, filterLocation]);

  useEffect(() => {
    if (!selectedEmp) return;
    if (!filtered.some((e) => e.id === selectedEmp.id)) {
      setSelectedEmp(null);
      setEmpComp([]);
    }
  }, [filtered, selectedEmp]);

  if (listLoading) return <Loading />;

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch lg:gap-8">
      {/* Employee list — stretches with salary panel; results box fills to the bottom */}
      <div className="relative z-10 flex w-full min-h-[min(28rem,60vh)] shrink-0 flex-col gap-3 rounded-2xl border border-slate-200/90 bg-gradient-to-b from-slate-50/95 to-white p-4 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.08)] lg:sticky lg:top-20 lg:w-[340px] lg:max-h-[calc(100vh-6rem)]">
        <div ref={searchWrapRef} className="relative">
          <input
            id="employee-salary-search"
            type="text"
            autoComplete="off"
            spellCheck={false}
            aria-autocomplete="list"
            aria-controls="employee-salary-search-results"
            className={
              inputCls +
              " !mb-0 rounded-lg border-slate-200/90 bg-white shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] placeholder:text-slate-400 " +
              "focus:border-[#2E7BBF] focus:ring-2 focus:ring-[#2E7BBF]/20"
            }
            placeholder="Search name or code…"
            value={employeeSearch}
            onChange={(e) => setEmployeeSearch(sanitizeSearchInput(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setEmployeeSearch("");
                return;
              }
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlightIdx((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
                return;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlightIdx((i) => Math.max(i - 1, 0));
                return;
              }
              if (e.key === "Enter") {
                e.preventDefault();
                if (filtered[highlightIdx]) pickFromList(filtered[highlightIdx]);
              }
            }}
          />
        </div>
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
        <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-500">
          <span>{filtered.length} employee{filtered.length !== 1 ? "s" : ""}</span>
          {employeeSearch.trim() ? (
            <button
              type="button"
              className="shrink-0 text-[#2E7BBF] hover:underline"
              onClick={() => setEmployeeSearch("")}
            >
              Clear search
            </button>
          ) : null}
        </div>
        <div
          id="employee-salary-search-results"
          role="listbox"
          className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-slate-200/80 bg-white shadow-inner"
        >
          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-400">No employees match filters</div>
          ) : (
            filtered.map((emp, idx) => {
              const selected = selectedEmp?.id === emp.id;
              const highlighted = employeeSearch.trim().length > 0 && idx === highlightIdx;
              return (
                <button
                  key={emp.id}
                  type="button"
                  role="option"
                  aria-selected={selected || highlighted}
                  onPointerDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setHighlightIdx(idx)}
                  onClick={() => pickFromList(emp)}
                  className={`flex w-full cursor-pointer items-center gap-2 border-b border-slate-100 px-4 py-3 text-left text-sm transition-colors last:border-b-0 hover:bg-slate-50/90 active:bg-sky-50/70 ${
                    selected
                      ? "border-l-[3px] border-l-[#2E7BBF] bg-sky-50/90 pl-[13px]"
                      : highlighted
                        ? "bg-[#e3eef8]"
                        : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-slate-900">
                      {salaryEmployeeDisplayName(emp)}
                    </div>
                    <div className="truncate text-xs text-slate-500">
                      {[emp.employeeCode || null, emp.department || null].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Compensation details */}
      <div className="min-h-[min(28rem,60vh)] min-w-0 flex-1 space-y-5">
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
              employmentType={selectedEmp.employmentType}
              employmentTypes={employmentTypes}
              title={`${selectedEmp.firstName} ${selectedEmp.lastName} — ${selectedEmp.employeeCode}`}
              mode={compTab}
              batchId={compTab === "Variable" ? selectedBatchId : undefined}
              processType={compTab === "Variable" ? selectedBatch?.processType : undefined}
              batchMonth={compTab === "Variable" ? selectedBatch?.month : undefined}
              batchFrom={compTab === "Variable" ? selectedBatch?.effectiveFrom : undefined}
              batchTo={compTab === "Variable" ? selectedBatch?.effectiveTo : undefined}
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
  employmentType,
  employmentTypes,
  title,
  mode,
  batchId,
  processType,
  batchMonth,
  batchFrom,
  batchTo,
  componentsLibrary,
  assignmentsAll,
  payrollSettings,
  loading,
  onReload,
}: {
  employeeId: string;
  employeeName: string;
  employmentType?: string;
  employmentTypes: EmploymentTypeCatalogItem[];
  title: string;
  mode: "Fixed" | "Variable";
  batchId?: string;
  processType?: string;
  batchMonth?: number;
  batchFrom?: string;
  batchTo?: string;
  componentsLibrary: Component[];
  assignmentsAll: EmpComp[];
  payrollSettings: Settings | null;
  loading: boolean;
  onReload: () => void;
}) {
  const batchUsesOneTime = mode === "Variable" && processType === "Bonus";

  const skipsProvidentFund = employeeSkipsProvidentFund(employmentType, employmentTypes);
  const isStatutory = (def: Component) => def.category === "Statutory" || def.isStatutory;
  const isPoya = (def: Component) => {
    const code = def.code.toUpperCase();
    return code === "POYA" || code === "PD002" || code.startsWith("POYA") || /poya/i.test(def.name);
  };
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

  const manualDefinitions = useMemo(
    () => definitions.filter((d) => !isStatutory(d)),
    [definitions]
  );

  const relevantLines = useMemo(() => {
    const lines = assignmentsAll.filter((a) => {
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

    // Codes another formula reads carry over from the employee's last batch, matching what
    // the engine calculates, so the field is not blank on a batch that has no entry yet.
    if (mode !== "Variable" || batchUsesOneTime || !batchId) return lines;

    const carryForward = formulaInputComponentCodes(componentsLibrary, "Variable");
    if (carryForward.size === 0) return lines;

    const entered = new Set(lines.map((a) => a.componentId));
    const carried = new Map<string, EmpComp>();
    for (const a of assignmentsAll) {
      if (a.isActive === false || !a.batchId || a.batchId === batchId) continue;
      if (a.componentCategory !== "Variable" || entered.has(a.componentId)) continue;
      if (!carryForward.has(a.componentCode.toUpperCase())) continue;

      const previous = carried.get(a.componentId);
      if (!previous || a.effectiveFrom > previous.effectiveFrom) carried.set(a.componentId, a);
    }

    return [...lines, ...carried.values()];
  }, [assignmentsAll, componentsLibrary, mode, batchId, batchUsesOneTime]);

  const [draftByComp, setDraftByComp] = useState<Record<string, string>>({});
  const [savingCompId, setSavingCompId] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState<string | null>(null);
  const [employeeTaxMode, setEmployeeTaxMode] = useState<string | undefined>();
  const [attendanceWorkedHours, setAttendanceWorkedHours] = useState<number | null>(null);
  const [attendanceNopayDays, setAttendanceNopayDays] = useState<number | null>(null);

  useEffect(() => {
    setDraftByComp({});
    setSaveError(null);
    setSaveOk(null);
    setAttendanceWorkedHours(null);
    setAttendanceNopayDays(null);
  }, [employeeId, mode, batchId, processType]);

  useEffect(() => {
    if (mode !== "Variable" || !batchId || !employeeId) return;
    let cancelled = false;
    const from = (batchFrom ?? "").slice(0, 10);
    const to = (batchTo ?? batchFrom ?? "").slice(0, 10);
    const otUrl =
      from && to
        ? `/api/attendance/overtime-nopay?from=${from}&to=${to}&employeeId=${employeeId}`
        : null;

    Promise.all([
      apiFetch<{
        totalWorkedHours?: number;
        totalNopayDays?: number;
        attendanceNopayDays?: number;
      }>(`/api/payroll/batches/${batchId}/worked-hours?employeeId=${employeeId}`).catch(() => null),
      otUrl
        ? apiFetch<{ nopayDays?: number; totalWorkedHours?: number }[] | { nopayDays?: number; totalWorkedHours?: number }>(
            otUrl
          ).catch(() => null)
        : Promise.resolve(null),
    ]).then(([hours, ot]) => {
      if (cancelled) return;
      const otRow = Array.isArray(ot) ? ot[0] : ot;
      const nopay =
        Number(hours?.totalNopayDays) ||
        Number(hours?.attendanceNopayDays) ||
        Number(otRow?.nopayDays) ||
        0;
      setAttendanceWorkedHours(Number(hours?.totalWorkedHours ?? otRow?.totalWorkedHours) || 0);
      setAttendanceNopayDays(nopay);
    });
    return () => {
      cancelled = true;
    };
  }, [mode, batchId, employeeId, batchFrom, batchTo]);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ apitTaxMode?: string }>(`/api/payroll/compensation/${employeeId}/apit-summary`)
      .then((data) => {
        if (!cancelled) setEmployeeTaxMode(data.apitTaxMode);
      })
      .catch(() => {
        if (!cancelled) setEmployeeTaxMode(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  function lineForComponent(componentId: string): EmpComp | undefined {
    return relevantLines.find((a) => a.componentId === componentId);
  }

  function parseAmountText(raw?: string | null): number {
    const t = (raw ?? "").trim();
    if (t === "" || t === "—" || t === "-") return 0;
    const n = Number.parseFloat(t.replace(/,/g, ""));
    return Number.isNaN(n) ? 0 : roundMoney(n);
  }

  function isAutoHoursPay(def: Component) {
    return (
      isIncomePayCode(def.code) ||
      /HOURLY_RATE\s*\*\s*WORKED_HOURS/i.test(def.formulaExpression ?? "")
    );
  }

  function workedHoursAmount(def: Component): number {
    if (draftByComp[def.id] !== undefined) return parseAmountText(draftByComp[def.id]);
    const line = lineForComponent(def.id);
    const saved = Number(line?.amount) || 0;
    if (saved > 0) return saved;
    return attendanceWorkedHours && attendanceWorkedHours > 0 ? attendanceWorkedHours : 0;
  }

  function isAutoWorkedHours(def: Component) {
    if (!isWorkedHoursComponent(def.code) || mode !== "Variable") return false;
    if (draftByComp[def.id] !== undefined) return false;
    const saved = Number(lineForComponent(def.id)?.amount) || 0;
    return saved <= 0;
  }

  function isAutoFormula(def: Component) {
    if (isStatutory(def) || isPoya(def)) return false;
    if (isAutoHoursPay(def)) return true;
    return Boolean(def.formulaExpression?.trim());
  }

  function rawAmountForCode(code: string): number {
    const key = code.toUpperCase();
    const def = componentsLibrary.find((c) => c.code.toUpperCase() === key);
    if (def) {
      if (isWorkedHoursComponent(def.code)) return workedHoursAmount(def);
      if (draftByComp[def.id] !== undefined) return parseAmountText(draftByComp[def.id]);
      const onTab = lineForComponent(def.id);
      if (onTab) return Number(onTab.amount) || 0;
    }
    const rows = assignmentsAll
      .filter(
        (a) =>
          a.isActive !== false &&
          (a.componentCode ?? "").toUpperCase() === key
      )
      .sort((a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime());
    return Number(rows[0]?.amount) || 0;
  }

  function amountForCode(code: string): number {
    const key = code.toUpperCase();
    const direct = rawAmountForCode(key);
    if (direct > 0) return direct;
    if (key === "BASIC" || key.startsWith("BASIC")) {
      const basic = rawAmountForCode("BASIC");
      if (basic > 0) return basic;
      for (const c of componentsLibrary) {
        if (c.code.toUpperCase().startsWith("BASIC")) {
          const alias = rawAmountForCode(c.code.toUpperCase());
          if (alias > 0) return alias;
        }
      }
    }
    return direct;
  }

  function formulaAmount(def: Component, visiting = new Set<string>()): number {
    const key = def.code.toUpperCase();
    if (visiting.has(key)) return 0;
    visiting.add(key);
    const expr =
      (def.formulaExpression ?? "").trim() ||
      (isIncomePayCode(def.code) ? "HOURLY_RATE * WORKED_HOURS" : "");
    if (!expr) return 0;
    return evaluatePayrollFormula(expr, (code) => {
      const ref = code.toUpperCase();
      if (ref === key) return 0;
      if (ref === "NOPAY_DAYS") return attendanceNopayDays ?? 0;
      const other = componentsLibrary.find((c) => c.code.toUpperCase() === ref);
      if (other && isAutoFormula(other)) return formulaAmount(other, visiting);
      return amountForCode(code);
    }, { roundResult: shouldRoundComponent(def.id, def.roundResult) });
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

  function parseDraftAmount(draft: string, roundToRupee = false): { isEmpty: boolean; target: number } {
    const trimmed = draft.trim();
    const parsed =
      trimmed === "" || trimmed === "-" || trimmed === "\u2014"
        ? null
        : Number.parseFloat(trimmed.replace(/,/g, ""));
    const isEmpty =
      trimmed === "" || parsed === null || Number.isNaN(parsed) || parsed === 0;
    if (isEmpty) return { isEmpty, target: 0 };
    const value = parsed ?? 0;
    return { isEmpty, target: roundToRupee ? Math.round(value) : Math.round(value * 100) / 100 };
  }

  async function persistComponent(def: Component, draft: string): Promise<{ wrote: boolean; recalculatedBatches?: number }> {
    const line = lineForComponent(def.id);
    const { isEmpty, target } = parseDraftAmount(draft, shouldRoundComponent(def.id, def.roundResult));

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
        effectiveFrom: mode === "Fixed" ? DEFAULT_FIXED_SALARY_EFFECTIVE_FROM : formatLocalDateToIso(new Date()),
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
    if (recalculatedBatches > 0) {
      return `Salary saved. ${recalculatedBatches} payroll run${recalculatedBatches === 1 ? "" : "s"} recalculated — check Pay Slips.`;
    }
    if (mode !== "Fixed") return "Salary saved. Open Payroll Run and click Sync from Employee Salary to refresh pay slips.";
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
      let batches = recalculatedBatches;
      let didWrite = wrote;
      if (!isAutoFormula(def)) {
        for (const pay of manualDefinitions.filter(isAutoFormula)) {
          const computed = formulaAmount(pay);
          const extra = await persistComponent(pay, computed > 0 ? String(computed) : "");
          if (extra.wrote) didWrite = true;
          if ((extra.recalculatedBatches ?? 0) > batches) batches = extra.recalculatedBatches ?? 0;
        }
      }
      clearDraft(def.id);
      if (didWrite) {
        await onReload();
        setSaveOk(saveSuccessMessage(batches));
      }
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSavingCompId(null);
    }
  }

  async function saveAll() {
    if (savingAll || loading) return;
    const dirty = manualDefinitions.filter((d) => draftByComp[d.id] !== undefined && !isAutoFormula(d) && !isAutoWorkedHours(d));
    const autoPay = manualDefinitions.filter(isAutoFormula);
    const autoHours = manualDefinitions.filter(isAutoWorkedHours);
    setSaveError(null);
    setSaveOk(null);
    if (dirty.length === 0 && autoPay.length === 0 && autoHours.length === 0) {
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
      for (const def of autoPay) {
        const computed = formulaAmount(def);
        const { wrote, recalculatedBatches: n = 0 } = await persistComponent(
          def,
          computed > 0 ? String(computed) : ""
        );
        if (wrote) wroteAny = true;
        if (n > recalculatedBatches) recalculatedBatches = n;
      }
      for (const def of autoHours) {
        const hours = workedHoursAmount(def);
        const { wrote, recalculatedBatches: n = 0 } = await persistComponent(
          def,
          hours > 0 ? String(hours) : ""
        );
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

  const earningsDefs = manualDefinitions.filter(
    (d) =>
      isEarningComponentType(d.type) ||
      isIncomePayCode(d.code) ||
      isRateOrQuantityType(d.type)
  );
  const incomeDefs = earningsDefs.filter(
    (d) => isEarningComponentType(d.type) || isIncomePayCode(d.code)
  );
  const manualDeductionDefs = manualDefinitions.filter(
    (d) =>
      !isEarningComponentType(d.type) &&
      !isIncomePayCode(d.code) &&
      !isRateOrQuantityType(d.type)
  );
  const statutoryDefs = definitions.filter((d) => isStatutory(d));
  const payrollStatutoryDefs = skipsProvidentFund ? [] : statutoryDefs;

  function numericAmount(componentId: string): number {
    const def = componentsLibrary.find((c) => c.id === componentId);
    if (def && isWorkedHoursComponent(def.code)) return workedHoursAmount(def);
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

  function payAmount(def: Component) {
    if (isPoya(def)) return poyaPayAmount(def);
    return isAutoFormula(def) ? formulaAmount(def) : numericAmount(def.id);
  }

  const POYA_DAYS_CAP = 15;

  function poyaPayAmount(def: Component): number {
    const stored = numericAmount(def.id);
    if (stored <= 0) return 0;
    if (stored > POYA_DAYS_CAP) return stored;
    if (basicSalaryAmount <= 0) return 0;
    return roundMoney((basicSalaryAmount / 30) * stored);
  }

  const epfEarnings = incomeDefs
    .filter((d) => d.isEpfApplicable)
    .reduce((s, d) => s + payAmount(d), 0);
  const etfEarnings = incomeDefs
    .filter((d) => d.isEtfApplicable)
    .reduce((s, d) => s + payAmount(d), 0);
  const taxableRegularMarked = incomeDefs
    .filter((d) => d.isTaxable && d.category !== "OneTime")
    .reduce((s, d) => s + payAmount(d), 0);
  const taxableLump = incomeDefs
    .filter((d) => d.isTaxable && d.category === "OneTime")
    .reduce((s, d) => s + payAmount(d), 0);
  const basicSalaryAmount = incomeDefs
    .filter((d) => d.code.toUpperCase() === "BASIC" || d.code.toUpperCase().startsWith("BASIC"))
    .reduce((s, d) => s + payAmount(d), 0);
  const { epfBase, etfBase } = resolveStatutoryBases(epfEarnings, etfEarnings, basicSalaryAmount);
  const monthlySalaryForApit = incomeDefs
    .filter((d) => d.category !== "OneTime")
    .reduce((s, d) => s + payAmount(d), 0);
  const fixedMonthlySalary = latestPositiveFixedSalary(assignmentsAll);
  const taxableEarnings = resolveApitRegularBase(
    monthlySalaryForApit,
    taxableRegularMarked,
    epfBase,
    basicSalaryAmount,
    skipsProvidentFund
  );
  const bonusMonthlyPay = fixedMonthlySalary > 0 ? fixedMonthlySalary : taxableEarnings;
  const effectivePayrollSettings = payrollSettings ?? DEFAULT_PAYROLL_SETTINGS;
  const resolvedTaxMode = employeeTaxMode ?? effectivePayrollSettings.apitTaxMode;
  const apitAmount = skipsProvidentFund
    ? 0
    : batchUsesOneTime
      ? calcBonusApitByMode(
          bonusMonthlyPay,
          taxableLump,
          batchMonth ?? new Date().getMonth() + 1,
          resolvedTaxMode
        )
      : calcApitByMode(
          taxableEarnings,
          taxableLump,
          new Date().getMonth() + 1,
          resolvedTaxMode
        );
  const hasStatutoryBase =
    !skipsProvidentFund &&
    (epfBase > 0 || etfBase > 0 || taxableEarnings > 0 || taxableLump > 0);

  function statutoryAmount(def: Component): number {
    return calcStatutoryAmount(
      def,
      epfBase,
      etfBase,
      apitAmount,
      effectivePayrollSettings,
      skipsProvidentFund
    );
  }

  function displayAmount(def: Component): number {
    if (isStatutory(def)) return statutoryAmount(def);
    if (isAutoFormula(def)) return formulaAmount(def);
    if (isWorkedHoursComponent(def.code)) return workedHoursAmount(def);
    if (isPoya(def)) return poyaPayAmount(def);
    return numericAmount(def.id);
  }

  const poyaDayRate = basicSalaryAmount > 0 ? Math.round((basicSalaryAmount / 30) * 100) / 100 : 0;

  const totalEarnings = incomeDefs.reduce((s, d) => s + displayAmount(d), 0);
  const manualDeductions = manualDeductionDefs.reduce((s, d) => s + displayAmount(d), 0);
  const employeeStatutoryDefs = payrollStatutoryDefs.filter((d) => !d.isEmployerContribution);
  const employerStatutoryDefs = payrollStatutoryDefs.filter((d) => d.isEmployerContribution);
  const employeeStatutoryDeductions =
    hasStatutoryBase
      ? employeeStatutoryDefs.reduce((s, d) => s + statutoryAmount(d), 0)
      : 0;
  const totalEmployeeDeductions = manualDeductions + employeeStatutoryDeductions;
  const employerStatutoryCost =
    hasStatutoryBase
      ? employerStatutoryDefs.reduce((s, d) => s + statutoryAmount(d), 0)
      : 0;
  const employeeDeductionDefs = [...manualDeductionDefs, ...employeeStatutoryDefs];
  const deductionDisplayTotal = employeeDeductionDefs.reduce((s, d) => s + displayAmount(d), 0);

  function inputDisplay(def: Component): string {
    if (draftByComp[def.id] !== undefined) return draftByComp[def.id];
    if (isWorkedHoursComponent(def.code)) {
      const hours = workedHoursAmount(def);
      return hours > 0 ? String(hours) : "";
    }
    const line = lineForComponent(def.id);
    if (!line || Number(line.amount) === 0) return "";
    if (shouldRoundComponent(def.id, def.roundResult))
      return String(Math.round(Number(line.amount)));
    return roundMoney(Number(line.amount)).toFixed(2);
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
                      text={`Enter Poya days on this row only (not from attendance import). Payroll uses Basic ÷ 30 × days${
                        poyaDayRate > 0 ? ` (LKR ${fmt(poyaDayRate)} per day)` : ""
                      }. Use 0.5–15 for days, or a larger LKR amount for a fixed payment. Leave blank for no Poya pay.`}
                    />
                  ) : isWorkedHoursComponent(def.code) ? (
                    <FormulaInfoTip
                      text={`Loads attendance worked hours for ${
                        batchFrom
                          ? `${formatDate(batchFrom)}${batchTo ? ` – ${formatDate(batchTo)}` : ""}`
                          : "this payroll month"
                      }. Leave blank to use the month total, or type hours to override.`}
                    />
                  ) : isAutoFormula(def) && def.formulaExpression ? (
                    <FormulaInfoTip
                      text={`Auto from formula ${def.formulaExpression}. Uses the other component codes on this page (for example BASIC1 ÷ WORKING_DAYS).${
                        shouldRoundComponent(def.id, def.roundResult) ? " Result is rounded to the nearest rupee." : ""
                      }`}
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
                {isStatutory(def) || isAutoFormula(def) ? (
                  <div
                    className="flex h-10 min-w-[7rem] items-center justify-end gap-2 rounded-lg border border-slate-200/70 bg-slate-50 px-3 font-mono text-sm tabular-nums text-slate-700 md:min-w-[8.75rem]"
                    title={
                      isAutoFormula(def)
                        ? `${def.formulaExpression || "HOURLY_RATE * WORKED_HOURS"} = ${formulaAmount(def).toFixed(2)}`
                        : def.code.toUpperCase() === "APIT"
                        ? batchUsesOneTime
                          ? `APIT Table 02 on bonus LKR ${fmt(taxableLump)} (EGAR from monthly LKR ${fmt(bonusMonthlyPay)})`
                          : `APIT Table 01 on taxable LKR ${fmt(taxableEarnings)}${taxableLump > 0 ? ` + Table 02 lump LKR ${fmt(taxableLump)}` : ""}`
                        : def.code.toUpperCase().startsWith("ETF")
                          ? `Auto-calculated from ETF-applicable earnings (LKR ${fmt(etfBase)})`
                          : `Auto-calculated from EPF-applicable earnings (LKR ${fmt(epfBase)})`
                    }
                  >
                    <span className="rounded bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                      Auto
                    </span>
                    <span>
                      {isAutoFormula(def)
                        ? formulaAmount(def) > 0
                          ? shouldRoundComponent(def.id, def.roundResult)
                            ? formulaAmount(def).toLocaleString("en-LK", { maximumFractionDigits: 0 })
                            : fmt(formulaAmount(def))
                          : "—"
                        : statutoryDisplay(def)}
                    </span>
                  </div>
                ) : (
                  <input
                    type="text"
                    inputMode="decimal"
                    disabled={isBusy}
                    className={salaryAmtInputCls}
                    value={inputDisplay(def)}
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
                    placeholder={isPoya(def) ? "Days or LKR — blank = none" : "—"}
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
          {skipsProvidentFund
            ? "Freelancer: enter amounts in LKR, then Save. No EPF, ETF, or APIT — statutory deductions are not applied."
            : "Enter amounts in LKR, then click Save. EPF/ETF use the EPF & ETF mark; APIT uses Taxable earnings (IRD Table 01 monthly, Table 02 on bonus / lump sums)."}
          {dirtyCount > 0 ? (
            <span className="mt-1 block text-sm font-medium text-amber-700">
              You have unsaved changes — pay slips will not match until you click Save.
            </span>
          ) : null}
          {hasStatutoryBase ? (
            <span className="mt-1 block text-xs text-slate-400">
              {employeeName} EPF base: LKR {fmt(epfBase)} · ETF base: LKR {fmt(etfBase)} · APIT
              taxable: LKR {fmt(taxableEarnings)}{taxableLump > 0 ? ` + lump LKR ${fmt(taxableLump)}` : ""} · APIT: LKR {fmt(apitAmount)}
            </span>
          ) : skipsProvidentFund ? (
            <span className="mt-1 block text-xs text-slate-400">
              {employeeName} is a freelancer — net pay equals gross earnings (no statutory auto-deductions).
            </span>
          ) : (
            <span className="mt-1 block text-xs text-amber-600">
              Enter Basic or other earnings (and mark Taxable / EPF &amp; ETF on the Components tab where needed) to
              calculate statutory amounts. Rates: EPF employee{" "}
              {(effectivePayrollSettings.epfEmployeeRate * 100).toFixed(0)}% · EPF employer{" "}
              {(effectivePayrollSettings.epfEmployerRate * 100).toFixed(0)}% · ETF{" "}
              {(effectivePayrollSettings.etfEmployerRate * 100).toFixed(0)}% · APIT per IRD tables.
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
                  {incomeDefs.length} component{incomeDefs.length !== 1 ? "s" : ""} • Subtotal LKR{" "}
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
                  {employeeDeductionDefs.length} employee deduction{employeeDeductionDefs.length !== 1 ? "s" : ""} • Subtotal LKR{" "}
                  {fmt(deductionDisplayTotal)}
                  {employerStatutoryCost > 0
                    ? ` · Employer LKR ${fmt(employerStatutoryCost)}`
                    : ""}
                </span>
              </div>
            </div>
            <div className="max-h-[min(62vh,26rem)] min-h-[14rem] overflow-y-auto overscroll-contain">
              {renderSalaryColumnTable(manualDeductionDefs, "deduction")}
              {payrollStatutoryDefs.length > 0 ? (
                <div className="border-t border-slate-200/90 bg-slate-50/50">
                  <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Statutory (auto — {employeeName}
                    {skipsProvidentFund ? " · freelancer" : ""})
                  </div>
                  {renderSalaryColumnTable(payrollStatutoryDefs, "deduction")}
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
  const [effectiveFrom, setEffectiveFrom] = useState(() => formatLocalDateToIso(new Date()));
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number; errors: string[] } | null>(null);
  const [error, setError] = useState("");

  async function downloadTemplate() {
    const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    const res = await fetch(`${getApiBaseUrl()}/api/payroll/compensation/import-template?category=${category}`, {
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
        `${getApiBaseUrl()}/api/payroll/compensation/import?effectiveFrom=${effectiveFrom}${batchParam}`,
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
      const list = normalizeBatches(pagedItems(d));
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
        id, amount: roundMoney(parseFloat(val) || 0),
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
    return textIncludes(e.employeeName, s) || textIncludes(e.employeeCode, s)
      || textIncludes(e.componentName, s) || textIncludes(e.department, s);
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
                          value={isDirty ? edited : roundMoney(Number(e.amount)).toFixed(2)}
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
    apiFetch<PagedResult<Batch>>("/api/payroll/batches?pageSize=200")
      .then(d => setBatches(sortBatchesNewestFirst(normalizeBatches(pagedItems(d)))))
      .catch((err) => {
        setBatches([]);
        setLoadError(err instanceof Error ? err.message : "Could not load payroll batches.");
      })
      .finally(() => setLoading(false));
  }, []);

  async function refreshBatches() {
    const d = await apiFetch<PagedResult<Batch>>("/api/payroll/batches?pageSize=200");
    const items = sortBatchesNewestFirst(normalizeBatches(pagedItems(d)));
    setBatches(items);
    return items;
  }

  function dropBatchFromList(batchId: string) {
    setBatches((prev) => prev.filter((b) => b.id !== batchId));
    setSelectedBatch((current) => (current?.id === batchId ? null : current));
  }

  function isBatchMissingError(err: unknown): boolean {
    if (err instanceof ApiHttpError && err.status === 404) return true;
    const msg = err instanceof Error ? err.message : String(err);
    return /batch not found/i.test(msg);
  }

  useEffect(() => { load(); }, [load]);
  const batchesPager = useClientPagination(batches);

  async function handleAction(batchId: string, action: string) {
    setActionLoading(batchId);
    try {
      if (action === "calculate") {
        if (!(await appConfirm("Rebuild pay slips for every employee in this batch from the Employee Salary tab? Includes Basic, allowances, deductions, and EPF/ETF. Working hours and no-pay come from attendance for the payroll period. Poya pay only if entered on Employee Salary."))) {
          setActionLoading(null);
          return;
        }
        await apiFetch(`/api/payroll/batches/${batchId}/calculate`, {
          method: "POST",
          timeoutMs: PAYROLL_LONG_REQUEST_MS,
        });
        const items = await refreshBatches();
        const updated = items.find(b => b.id === batchId);
        if (updated) await viewBatchDetails(updated);
        return;
      } else if (action === "review") {
        if (!(await appConfirm("Mark this payroll batch as reviewed? Confirm you have checked gross, EPF/ETF, deductions, and net pay."))) {
          setActionLoading(null);
          return;
        }
        await apiFetch(`/api/payroll/batches/${batchId}/review`, {
          method: "PUT",
          timeoutMs: PAYROLL_LONG_REQUEST_MS,
        });
      } else if (action === "return") {
        if (!(await appConfirm("Send this batch back to Calculated so it can be recalculated?"))) {
          setActionLoading(null);
          return;
        }
        await apiFetch(`/api/payroll/batches/${batchId}/return`, {
          method: "PUT",
          timeoutMs: PAYROLL_LONG_REQUEST_MS,
        });
      } else if (action === "approve") {
        if (!(await appConfirm("Approve this salary batch? Pay slips will lock using the last Calculate totals — save Employee Salary and run Calculate (or Sync from Employee Salary) first so EPF and allowances match."))) {
          setActionLoading(null);
          return;
        }
        await apiFetch(`/api/payroll/batches/${batchId}/approve`, {
          method: "PUT",
          timeoutMs: PAYROLL_LONG_REQUEST_MS,
        });
      } else if (action === "finalize") {
        if (!(await appConfirm("Finalize this payroll batch? Payslips will be locked for this period. Only continue if payroll is ready for release."))) {
          setActionLoading(null);
          return;
        }
        await apiFetch(`/api/payroll/batches/${batchId}/finalize`, {
          method: "PUT",
          timeoutMs: PAYROLL_LONG_REQUEST_MS,
        });
      } else if (action === "delete") {
        if (!(await appConfirm("Delete this batch?"))) { setActionLoading(null); return; }
        try {
          await apiFetch(`/api/payroll/batches/${batchId}`, {
            method: "DELETE",
            timeoutMs: PAYROLL_LONG_REQUEST_MS,
          });
        } catch (err: unknown) {
          if (!isBatchMissingError(err)) throw err;
        }
        dropBatchFromList(batchId);
        await refreshBatches().catch(() => {});
        return;
      }
      const items = await refreshBatches();
      const updated = items.find(b => b.id === batchId);
      if (updated) await viewBatchDetails(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Action failed";
      if (isBatchMissingError(err)) {
        dropBatchFromList(batchId);
        await refreshBatches().catch(() => {});
        return;
      }
      await appAlert(msg);
    } finally { setActionLoading(null); }
  }

  async function viewBatchDetails(batch: Batch) {
    const id = batch.id?.trim();
    if (!id) {
      await appAlert("This payroll batch is missing an id. Refresh the page and try again.");
      return;
    }
    setSelectedBatch(batch);
    try {
      const data = await apiFetch<Statement[]>(`/api/payroll/batches/${id}/statements`, {
        timeoutMs: PAYROLL_LONG_REQUEST_MS,
      });
      setBatchStatements(Array.isArray(data) ? data : []);
    } catch (err) {
      setBatchStatements([]);
      await appAlert(err instanceof Error ? err.message : "Could not load batch details.");
    }
  }

  if (loading) return <Loading />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Payroll Batches</h2>
          <p className="mt-0.5 text-xs text-slate-500">Salary batches: calculate (includes EPF/ETF) → review → HR approve. Slip Generate can download the bank file only after Approve (or Finalize).</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ New Batch</Button>
      </div>

      {loadError ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <InlinePageAlert message={loadError} className="min-w-0 flex-1 rounded-xl border border-rose-200/80 bg-rose-50 px-3 py-2 text-sm text-rose-800" />
          <Button variant="secondary" onClick={load}>Retry</Button>
        </div>
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
          onImported={async () => {
            const batchId = importBatch.id;
            setImportBatch(null);
            try {
              const items = await refreshBatches();
              const updated = items.find((b) => b.id === batchId);
              if (updated) await viewBatchDetails(updated);
            } catch {
              load();
            }
          }}
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
    apiFetch<AttendanceImportPreview>(`/api/payroll/batches/${batch.id}/import-attendance-leave/preview`, {
      timeoutMs: PAYROLL_LONG_REQUEST_MS,
    })
      .then(setPreview)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load preview"))
      .finally(() => setLoading(false));
  }, [batch.id]);

  async function handleImport() {
    setImporting(true);
    setError("");
    try {
      const result = await apiFetch<AttendanceImportResult>(`/api/payroll/batches/${batch.id}/import-attendance-leave`, {
        method: "POST",
        timeoutMs: PAYROLL_LONG_REQUEST_MS,
      });
      if (result.recalculateError) {
        await appAlert(`Attendance was imported, but pay slips were not rebuilt: ${result.recalculateError}`);
      }
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
          Working Hours (WORKED_HOURS) is filled from attendance hours for the full payroll month.
          Import rebuilds pay slips so No-Pay and approved OT appear on the salary slip.
        </p>
      </div>

      <InlinePageAlert message={error} className="mb-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 scroll-mt-20" />

      {loading ? <Loading /> : preview ? (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
            <div className="rounded-lg bg-green-50 p-3"><div className="text-xs text-green-700">Approved OT</div><div className="font-semibold text-green-900">{preview.employeesWithApprovedOt}</div></div>
            <div className="rounded-lg bg-amber-50 p-3"><div className="text-xs text-amber-700">Missing OT approval</div><div className="font-semibold text-amber-900">{preview.employeesMissingOtApproval}</div></div>
            <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">With no-pay days</div><div className="font-semibold text-slate-800">{preview.employeesWithNopay}</div></div>
          </div>

          <div className="max-h-[360px] overflow-y-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Employee</th>
                  <th className="px-3 py-2 font-medium text-right">Hours</th>
                  <th className="px-3 py-2 font-medium text-right">OT Hrs</th>
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
                    <td className="px-3 py-2 text-right font-mono">{line.totalWorkedHours ? fmtWorkedHours(line.totalWorkedHours) : "—"}</td>
                    <td className="px-3 py-2 text-right font-mono">{line.approvedOtHours || "—"}</td>
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

  const [step, setStep] = useState<1 | 2>(1);
  const [processType, setProcessType] = useState("Salary");
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);
  const [periodStartDay, setPeriodStartDay] = useState(1);
  const [periodEndDay, setPeriodEndDay] = useState(31);
  const [effectiveFrom, setEffectiveFrom] = useState(() => monthDateRange(initialMonth, initialYear).from);
  const [effectiveTo, setEffectiveTo] = useState(() => monthDateRange(initialMonth, initialYear).to);
  const [notes, setNotes] = useState("");

  const [employees, setEmployees] = useState<EligibleEmployee[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterGrade, setFilterGrade] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [empLoading, setEmpLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<Settings>("/api/payroll/settings")
      .then((s) => {
        setPeriodStartDay(clampDay(s.salaryPeriodStartDay, 1));
        setPeriodEndDay(clampDay(s.salaryPeriodEndDay, 31));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const range = monthDateRange(month, year, periodStartDay, periodEndDay);
    setEffectiveFrom(range.from);
    setEffectiveTo(range.to);
  }, [month, year, periodStartDay, periodEndDay]);

  useEffect(() => {
    if (step !== 2) return;
    setEmpLoading(true);
    setError("");
    apiFetch<EligibleEmployee[]>(
      `/api/payroll/eligible-employees?month=${month}&year=${year}&processType=${encodeURIComponent(processType)}`,
    )
      .then(emps => {
        setEmployees(emps);
        setSelected(new Set(emps.filter((e) => !e.alreadyInBatch).map((e) => e.id)));
      })
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

  const filtered = useMemo(
    () =>
      employees.filter((e) => {
        if (!batchEmployeePassesOrgFilters(e, filterDept, filterGrade, filterLocation)) return false;
        return batchEmployeeMatchesQuery(e, employeeSearch);
      }),
    [employees, filterDept, filterGrade, filterLocation, employeeSearch]
  );

  const selectableFiltered = filtered.filter((e) => !e.alreadyInBatch);
  const allFilteredSelected = selectableFiltered.length > 0 && selectableFiltered.every((e) => selected.has(e.id));

  function clearBatchEmployeeFilters() {
    setEmployeeSearch("");
    setFilterDept("");
    setFilterGrade("");
    setFilterLocation("");
  }

  function toggleAll() {
    const next = new Set(selected);
    if (allFilteredSelected) { selectableFiltered.forEach((e) => next.delete(e.id)); } else { selectableFiltered.forEach((e) => next.add(e.id)); }
    setSelected(next);
  }

  function toggle(id: string) {
    const emp = employees.find((e) => e.id === id);
    if (emp?.alreadyInBatch) return;
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
    clearBatchEmployeeFilters();
    setStep(2);
  }

  function goBackToBatchDetails() {
    clearBatchEmployeeFilters();
    setStep(1);
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
            All active employees are listed, including those without salary yet. Staff already in another {formatProcessType(processType)} batch for {MONTHS[month - 1]} {year} stay on the list as Already calculated so they are not selected twice.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              autoComplete="off"
              spellCheck={false}
              className={inputCls + " !mb-0 min-w-[180px] flex-1"}
              placeholder="Search name or code…"
              value={employeeSearch}
              onChange={(e) => setEmployeeSearch(sanitizeSearchInput(e.target.value))}
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
          {employeeSearch.trim() ? (
            <p className="text-xs text-slate-600">
              Showing employees matching{" "}
              <strong className="font-medium text-slate-800">&quot;{employeeSearch.trim()}&quot;</strong>
              {" · "}
              <button
                type="button"
                className="font-medium text-[#2E7BBF] hover:underline"
                onClick={() => setEmployeeSearch("")}
              >
                Clear search
              </button>
            </p>
          ) : null}

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
                    <th className="px-3 py-2.5 font-medium">Salary batch</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">
                      {employees.length === 0
                        ? "No active employees found."
                        : "No employees match the current filters"}
                    </td></tr>
                  ) : filtered.map(e => (
                    <tr
                      key={e.id}
                      className={`border-b border-slate-50 ${e.alreadyInBatch ? "cursor-not-allowed bg-slate-50/80 opacity-70" : "cursor-pointer hover:bg-slate-50/50"}`}
                      onClick={() => toggle(e.id)}
                    >
                      <td className="px-3 py-2"><input type="checkbox" checked={selected.has(e.id)} disabled={e.alreadyInBatch} onChange={() => toggle(e.id)} className="rounded" /></td>
                      <td className="px-3 py-2 font-medium text-slate-700">{e.firstName} {e.lastName}</td>
                      <td className="px-3 py-2 text-slate-500">{e.employeeCode}</td>
                      <td className="px-3 py-2 text-slate-500">{e.department}</td>
                      <td className="px-3 py-2 text-slate-500">{e.grade}</td>
                      <td className="px-3 py-2 text-slate-500">{e.location}</td>
                      <td className="px-3 py-2 text-slate-500">{e.alreadyInBatch ? "Already calculated" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={goBackToBatchDetails}>Back</Button>
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
    setViewingId(stmt.id);
    setSelectedStmt(stmt);
    try {
      const detail = await apiFetch<Statement>(`/api/payroll/statements/${stmt.id}`);
      setStmtDetail(detail);
    } catch {
      void appAlert("Could not load payslip.");
      setSelectedStmt(null);
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
      {canApproveSalary ? (
        <p className="mb-4 text-xs text-slate-500">Approving this run unlocks the bank file on Slip Generate.</p>
      ) : null}
      {canApproveSalary ? (
        <p className="mb-4 text-xs text-slate-500">
          Open each employee’s payslip in Actions to check earnings and deductions before you approve.
        </p>
      ) : null}
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
                          allowPreview
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

function applyFreelancePayslipView(statement: Statement): Statement {
  if (!employeeSkipsProvidentFund(statement.employmentType, [])) return statement;
  const lines = statement.lines ?? [];
  const removed = lines.filter((l) =>
    isFreelanceExcludedStatutoryLine(l.componentCode, l.componentName)
  );
  if (removed.length === 0) return statement;
  const removedEmployee = removed.filter((l) => !l.isEmployerContribution).reduce((s, l) => s + l.amount, 0);
  const removedEmployer = removed.filter((l) => l.isEmployerContribution).reduce((s, l) => s + l.amount, 0);
  return {
    ...statement,
    lines: lines.filter(
      (l) => !isFreelanceExcludedStatutoryLine(l.componentCode, l.componentName)
    ),
    totalDeductions: Math.max(0, statement.totalDeductions - removedEmployee),
    netPay: statement.netPay + removedEmployee,
    employerCost: Math.max(0, statement.employerCost - removedEmployer),
  };
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
  const view = applyFreelancePayslipView(statement);
  const earnings = view.lines?.filter(l => (isEarningComponentType(l.type) || isIncomePayCode(l.componentCode)) && !l.isEmployerContribution) || [];
  const deductions = view.lines?.filter(l => (l.type === "Deduction" || l.type === "StatutoryDeduction") && !l.isEmployerContribution) || [];
  const employerItems = view.lines?.filter(l => l.isEmployerContribution) || [];
  const isFreelancer = employeeSkipsProvidentFund(statement.employmentType, []);

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
    <Modal open onClose={onClose} title={`Payslip — ${view.employeeName}`} wide>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-slate-500">
        <span>
          {MONTHS[view.month - 1]} {view.year} &middot; {view.employeeCode} &middot; {view.department || ""}
        </span>
        {isFreelancer ? (
          <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-800">
            Freelancer — no EPF / ETF / APIT
          </span>
        ) : null}
        {!isApprovedPaySlip(view.status) ? (
          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">
            Preview — not yet approved
          </span>
        ) : null}
      </div>
      <div className="mb-5 grid gap-3 sm:grid-cols-4 text-sm">
        <div className="rounded-lg bg-slate-50 p-3">
          <div className="text-xs text-slate-400">Gross</div>
          <div className="font-semibold tabular-nums">LKR {fmt(view.grossPay)}</div>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <div className="text-xs text-slate-400">Deductions</div>
          <div className="font-semibold tabular-nums text-red-600">LKR {fmt(view.totalDeductions)}</div>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <div className="text-xs text-slate-400">Net</div>
          <div className="font-semibold tabular-nums">LKR {fmt(view.netPay)}</div>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <div className="text-xs text-slate-400">Employer Cost</div>
          <div className="font-semibold tabular-nums">LKR {fmt(view.employerCost)}</div>
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
              <tr className="font-semibold"><td className="py-1.5">Total Earnings</td><td className="py-1.5 text-right font-mono">LKR {fmt(view.totalEarnings)}</td></tr>
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
              <tr className="font-semibold"><td className="py-1.5">Total Deductions</td><td className="py-1.5 text-right font-mono">LKR {fmt(view.totalDeductions)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 p-4">
        <span className="text-lg font-bold text-slate-800">Net Pay</span>
        <span className="text-2xl font-bold text-green-700">LKR {fmt(view.netPay)}</span>
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
              <tr className="font-semibold"><td className="py-1.5">Total Employer Cost</td><td className="py-1.5 text-right font-mono">LKR {fmt(view.employerCost)}</td></tr>
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

/* ═══════════════════════ SLIP GENERATE ═══════════════════════ */

type BankSlipPreview = {
  accountNumber: string;
  bankCode: string;
  branchCode: string;
  bankName: string;
  branchLocation: string;
  nic: string;
  phone: string;
  email: string;
  isCashPayment: boolean;
};

function slipFlag(row: Record<string, unknown> | undefined, ...keys: string[]): boolean {
  return readJsonField(row, ...keys).toLowerCase() === "true";
}

function previewFromSlipRow(row: Record<string, unknown> | undefined): BankSlipPreview {
  return {
    accountNumber: sampathAccountNumber(readJsonField(row, "accountNumber", "AccountNumber")),
    bankCode: readJsonField(row, "bankCode", "BankCode"),
    branchCode: readJsonField(row, "branchCode", "BranchCode"),
    bankName: readJsonField(row, "bankName", "BankName"),
    branchLocation: readJsonField(row, "branchLocation", "BranchLocation"),
    nic: readJsonField(row, "nationalId", "NationalId"),
    phone: readJsonField(row, "phone", "Phone"),
    email: readJsonField(row, "email", "Email"),
    isCashPayment: slipFlag(row, "isCashPayment", "IsCashPayment"),
  };
}

async function resolveSlipPreviews(
  statements: Array<{ id: string; employeeId?: string }>,
  slipRows: Array<Record<string, unknown>>,
): Promise<Record<string, BankSlipPreview>> {
  const byStatementId = new Map<string, Record<string, unknown>>();
  const byEmployeeId = new Map<string, Record<string, unknown>>();
  for (const row of slipRows) {
    const statementId = readJsonField(row, "statementId", "StatementId").toLowerCase();
    const employeeId = readJsonField(row, "employeeId", "EmployeeId").toLowerCase();
    if (statementId) byStatementId.set(statementId, row);
    if (employeeId) byEmployeeId.set(employeeId, row);
  }

  const indexed: Record<string, BankSlipPreview> = {};
  await Promise.all(
    statements.map(async (stmt) => {
      const statementKey = String(stmt.id ?? "").toLowerCase();
      const employeeKey = String(stmt.employeeId ?? "").toLowerCase();
      const row = (statementKey ? byStatementId.get(statementKey) : undefined)
        ?? (employeeKey ? byEmployeeId.get(employeeKey) : undefined);
      const preview = previewFromSlipRow(row);
      if (!preview.isCashPayment && (!preview.accountNumber || !preview.bankCode || !preview.branchCode) && stmt.employeeId) {
        try {
          const accounts = await apiFetch<Array<Record<string, unknown>>>(
            `/api/employees/${stmt.employeeId}/bank-accounts`,
          );
          const latest = Array.isArray(accounts) ? accounts[0] : null;
          if (latest) {
            preview.accountNumber = preview.accountNumber || sampathAccountNumber(
              readJsonField(latest, "accountNumber", "AccountNumber"),
            );
            preview.bankCode = preview.bankCode || readJsonField(latest, "bankCode", "BankCode");
            preview.branchCode = preview.branchCode || readJsonField(latest, "branchCode", "BranchCode");
            preview.bankName = preview.bankName || readJsonField(latest, "bankName", "BankName");
            preview.branchLocation = preview.branchLocation || readJsonField(
              latest,
              "branchLocation",
              "BranchLocation",
              "branchName",
              "BranchName",
            );
          }
        } catch {
          /* keep the batch slip row */
        }
      }
      if (statementKey) indexed[statementKey] = preview;
      if (employeeKey) indexed[employeeKey] = preview;
    }),
  );
  return indexed;
}

function SlipGenerateTab({ onOpenPayrollRun }: { onOpenPayrollRun?: () => void }) {
  const { multiCompanyActive, companyFilterOptions } = useMultiCompanyFeature();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [batchId, setBatchId] = useState("");
  const [statements, setStatements] = useState<Statement[]>([]);
  const [loadingStmts, setLoadingStmts] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [allCompanyAccounts, setAllCompanyAccounts] = useState<CompanyBankAccount[]>([]);
  const [companyProfileKey, setCompanyProfileKey] = useState(PRIMARY_COMPANY_PROFILE_KEY);
  const [companyAccountIndex, setCompanyAccountIndex] = useState("");
  const [companyAccountsError, setCompanyAccountsError] = useState("");
  const [downloadNotice, setDownloadNotice] = useState("");
  const [readyFile, setReadyFile] = useState<{ url: string; filename: string } | null>(null);
  const [slipByKey, setSlipByKey] = useState<Record<string, BankSlipPreview>>({});

  const slipCompanyProfileOpts = useMemo<FormSelectOption[]>(
    () => companyFilterOptions.filter((option) => option.value !== ""),
    [companyFilterOptions],
  );
  const companyAccounts = useMemo(
    () =>
      multiCompanyActive
        ? filterCompanyBankAccountsForProfile(allCompanyAccounts, companyProfileKey)
        : allCompanyAccounts,
    [allCompanyAccounts, companyProfileKey, multiCompanyActive],
  );
  const selectedBatch = batches.find((b) => b.id === batchId);
  const selectedCompanyAccount =
    companyAccountIndex === "" ? null : companyAccounts[Number(companyAccountIndex)] ?? null;
  const selectedBankSlipFormat = bankSlipFormatFor(selectedCompanyAccount?.bankName);
  const commercialBankSelected = Boolean(selectedCompanyAccount) && selectedBankSlipFormat === "commercial-one-to-many";
  const sampathBankSelected = Boolean(selectedCompanyAccount) && selectedBankSlipFormat === "sampath-cefts-slips";
  const excelBankSelected = Boolean(selectedCompanyAccount) && selectedBankSlipFormat === "excel-salary-sheet";
  const bankFileBlockReason = selectedBatch ? bankFileBlockedReason(selectedBatch.status) : null;
  const canDownloadBankFile = !bankFileBlockReason;
  const sortedStatements = useMemo(
    () => [...statements].sort((a, b) => compareEmployeeCode(a.employeeCode, b.employeeCode)),
    [statements],
  );
  const pager = useClientPagination(sortedStatements);
  const selectedCount = selected.size;
  const bankPayableStatements = sortedStatements.filter((s) => !slipByKey[s.id.toLowerCase()]?.isCashPayment);
  const allSelected = bankPayableStatements.length > 0 && bankPayableStatements.every((s) => selected.has(s.id));
  const slipBatchOpts = useMemo<FormSelectOption[]>(
    () => [
      { value: "", label: "Select a batch" },
      ...batches.map((b) => ({
        value: b.id,
        label: `${b.batchCode} · ${MONTHS[b.month - 1]} ${b.year} · ${statusLabel[b.status] ?? b.status}`,
      })),
    ],
    [batches],
  );
  const slipCompanyBankOpts = useMemo<FormSelectOption[]>(
    () =>
      companyAccounts.length === 0
        ? [{ value: "", label: "Select a company bank" }]
        : companyAccounts.map((account, index) => ({
            value: String(index),
            label: companyBankAccountLabel(account, index),
          })),
    [companyAccounts],
  );

  useEffect(() => {
    setLoading(true);
    setLoadError("");
    apiFetch<PagedResult<Batch>>("/api/payroll/batches?pageSize=200")
      .then((d) => {
        const items = sortBatchesNewestFirst(normalizeBatches(pagedItems(d))).filter((b) => b.status !== "Draft");
        setBatches(items);
      })
      .catch((err) => {
        setBatches([]);
        setLoadError(err instanceof Error ? err.message : "Could not load payroll batches.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    return () => {
      if (readyFile?.url) URL.revokeObjectURL(readyFile.url);
    };
  }, [readyFile]);

  useEffect(() => {
    setDownloadNotice("");
    setReadyFile((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return null;
    });
  }, [companyAccountIndex, companyProfileKey]);

  useEffect(() => {
    let cancelled = false;
    setCompanyAccountsError("");
    (async () => {
      try {
        const settings = await apiFetch<Record<string, unknown>>("/api/system-settings");
        let accounts = companyBankAccountsFromSettings(settings);
        if (accounts.length === 0) {
          const row = await apiFetch<{ value?: unknown }>("/api/system-settings/CompanyBankAccounts").catch(() => null);
          accounts = parseCompanyBankAccounts(row?.value).filter((account) => account.bankName || account.accountNo);
        }
        if (cancelled) return;
        setAllCompanyAccounts(accounts);
        setCompanyProfileKey(PRIMARY_COMPANY_PROFILE_KEY);
        if (accounts.length === 0) {
          setCompanyAccountsError("Add a company bank account in Company Profile first.");
        }
      } catch (err) {
        if (cancelled) return;
        setAllCompanyAccounts([]);
        setCompanyAccountsError(err instanceof Error ? err.message : "Could not load company bank accounts.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setCompanyAccountIndex(companyAccounts.length > 0 ? "0" : "");
  }, [companyAccounts.length, companyProfileKey]);

  useEffect(() => {
    if (allCompanyAccounts.length === 0) return;
    if (multiCompanyActive && companyAccounts.length === 0) {
      setCompanyAccountsError("No bank accounts for this company. Assign accounts in Company Profile.");
      return;
    }
    if (companyAccounts.length > 0) {
      setCompanyAccountsError("");
    }
  }, [allCompanyAccounts.length, companyAccounts.length, companyProfileKey, multiCompanyActive]);

  useEffect(() => {
    if (!batchId) {
      setStatements([]);
      setSelected(new Set());
      setSlipByKey({});
      setDownloadNotice("");
      setReadyFile((prev) => {
        if (prev?.url) URL.revokeObjectURL(prev.url);
        return null;
      });
      return;
    }
    let cancelled = false;
    setLoadingStmts(true);
    setDownloadNotice("");
    setReadyFile((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return null;
    });
    Promise.all([
      apiFetch<Statement[]>(`/api/payroll/batches/${batchId}/statements`),
      apiFetch<Array<Record<string, unknown>>>(`/api/payroll/batches/${batchId}/bank-slips`).catch(() => []),
    ])
      .then(async ([data, slipRows]) => {
        if (cancelled) return;
        const items = Array.isArray(data) ? data : [];
        const previews = await resolveSlipPreviews(items, Array.isArray(slipRows) ? slipRows : []);
        if (cancelled) return;
        setStatements(items);
        setSlipByKey(previews);
        setSelected(new Set(items.filter((s) => !previews[s.id.toLowerCase()]?.isCashPayment).map((s) => s.id)));
      })
      .catch(() => {
        if (!cancelled) {
          setStatements([]);
          setSelected(new Set());
          setSlipByKey({});
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingStmts(false);
      });
    return () => {
      cancelled = true;
    };
  }, [batchId]);

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(bankPayableStatements.map((s) => s.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function loadChosenSlips(chosen: Statement[]) {
    let slipRows: Array<Record<string, unknown>> = [];
    try {
      const rows = await apiFetch<Array<Record<string, unknown>>>(
        `/api/payroll/batches/${selectedBatch!.id}/bank-slips`,
      );
      slipRows = Array.isArray(rows) ? rows : [];
    } catch {
      slipRows = [];
    }
    const previews = await resolveSlipPreviews(chosen, slipRows);
    setSlipByKey((prev) => ({ ...prev, ...previews }));
    return previews;
  }

  async function generateCommercialBankFile(chosen: Statement[]) {
    if (!selectedBatch) return;
    setDownloadNotice("");
    if (readyFile?.url) URL.revokeObjectURL(readyFile.url);
    setReadyFile(null);

    const previews = await loadChosenSlips(chosen);
    const payable = chosen.filter((stmt) => !previews[stmt.id.toLowerCase()]?.isCashPayment);
    const cashSkipped = chosen.length - payable.length;
    const payments = payable.map((stmt) => {
      const slip = previews[stmt.id.toLowerCase()];
      return {
        accountNumber: commercialBankAccountNumber(slip?.accountNumber),
        netPay: Number(stmt.netPay),
        beneficiaryName: stmt.employeeName,
      };
    });

    const built = buildCommercialBankOneToManyFile(payments, selectedBatch.month, selectedBatch.year);
    if (built.included === 0) {
      const names = payments
        .filter((row) => !commercialBankAccountNumber(row.accountNumber))
        .map((row) => row.beneficiaryName)
        .filter(Boolean)
        .slice(0, 5);
      const message = names.length
        ? `Could not build the Commercial Bank file. Add a bank account number for: ${names.join(", ")}.`
        : "Could not build the Commercial Bank file. Each selected employee needs a bank account number.";
      setDownloadNotice(message);
      await appAlert(message);
      return;
    }

    const file = createCommercialBankDownload(built.content, selectedBatch.month, selectedBatch.year);
    setReadyFile(file);
    triggerFileDownload(file.url, file.filename);
    const parts = [
      `File ready: ${file.filename}.`,
      `${built.included} employee${built.included === 1 ? "" : "s"} included.`,
    ];
    if (cashSkipped > 0) parts.push(`${cashSkipped} cash employee${cashSkipped === 1 ? "" : "s"} left out.`);
    if (built.skipped > 0) parts.push(`${built.skipped} skipped (no account number).`);
    parts.push("Upload this One-to-Many file in Combiz Bank Master.");
    setDownloadNotice(parts.join(" "));
  }

  async function generateSampathBankFile(chosen: Statement[]) {
    if (!selectedBatch || !selectedCompanyAccount) return;
    setDownloadNotice("");
    if (readyFile?.url) URL.revokeObjectURL(readyFile.url);
    setReadyFile(null);

    const companyAccount = sampathAccountNumber(selectedCompanyAccount.accountNo);
    if (!companyAccount) {
      const message = "The company bank account needs an account number. Add it in Company Profile.";
      setDownloadNotice(message);
      await appAlert(message);
      return;
    }

    const previews = await loadChosenSlips(chosen);
    const payable = chosen.filter((stmt) => !previews[stmt.id.toLowerCase()]?.isCashPayment);
    const cashSkipped = chosen.length - payable.length;
    const salaryRef = sampathSalaryRef(selectedBatch.month);
    const payments = payable.map((stmt) => {
      const slip = previews[stmt.id.toLowerCase()];
      return {
        companyRef: salaryRef,
        beneficiaryName: stmt.employeeName,
        accountNumber: slip?.accountNumber,
        bankCode: slip?.bankCode,
        branchCode: slip?.branchCode,
        bankName: slip?.bankName,
        amount: Number(stmt.netPay),
        remarks: companyAccount,
      };
    });

    const { content, included, skipped, missingBankOrBranch } = buildSampathCeftsSlipsFile(payments);
    if (included === 0) {
      const names = payments
        .filter((row) => !sampathAccountNumber(row.accountNumber) || !sampathBankCode(row.bankCode, row.bankName) || !sampathBranchCode(row.branchCode))
        .map((row) => row.beneficiaryName)
        .filter(Boolean)
        .slice(0, 5);
      const message = names.length
        ? `Could not build the Sampath Bank file. Add an account number, bank code, and branch code for: ${names.join(", ")}.`
        : "Could not build the Sampath Bank file. Each selected employee needs an account number, bank code, and branch code.";
      setDownloadNotice(message);
      await appAlert(message);
      return;
    }

    const file = createSampathCeftsSlipsDownload(content);
    setReadyFile(file);
    triggerFileDownload(file.url, file.filename);
    const parts = [
      `File ready: ${file.filename}.`,
      `${included} employee${included === 1 ? "" : "s"} included.`,
      `Company account ${companyAccount} is in the remarks column.`,
    ];
    if (cashSkipped > 0) parts.push(`${cashSkipped} cash employee${cashSkipped === 1 ? "" : "s"} left out.`);
    if (skipped > 0) parts.push(`${skipped} skipped (no account number).`);
    if (missingBankOrBranch > 0) {
      parts.push(`${missingBankOrBranch} skipped (missing bank or branch code).`);
    }
    parts.push("Upload this file in Sampath Vishwa from that company account.");
    setDownloadNotice(parts.join(" "));
  }

  async function generateExcelSalarySheet(chosen: Statement[]) {
    if (!selectedBatch || !selectedCompanyAccount) return;
    setDownloadNotice("");
    if (readyFile?.url) URL.revokeObjectURL(readyFile.url);
    setReadyFile(null);

    const previews = await loadChosenSlips(chosen);
    const payable = chosen.filter((stmt) => !previews[stmt.id.toLowerCase()]?.isCashPayment);
    const cashSkipped = chosen.length - payable.length;
    const payments = payable.map((stmt) => {
      const slip = previews[stmt.id.toLowerCase()];
      return {
        employeeCode: stmt.employeeCode,
        employeeName: stmt.employeeName,
        bankName: slip?.bankName,
        accountNumber: slip?.accountNumber,
        bankCode: slip?.bankCode,
        branchCode: slip?.branchCode,
        branch: slip?.branchLocation,
        amount: Number(stmt.netPay),
        companyAccount: selectedCompanyAccount.accountNo,
        companyBank: selectedCompanyAccount.bankName,
        companyBankCode: selectedCompanyAccount.bankCode,
        companyBranchCode: selectedCompanyAccount.branchCode,
      };
    });

    const file = await createGenericBankSalaryExcelDownload(
      payments,
      selectedBatch.month,
      selectedBatch.year,
      selectedCompanyAccount.bankName,
    );
    if (file.included === 0) {
      const missing = payments.filter((row) => !genericBankAccountNumber(row.accountNumber));
      const names = missing.map((row) => row.employeeName).filter(Boolean).slice(0, 5);
      const message = names.length
        ? `Could not build the Excel sheet. Add a bank account number for: ${names.join(", ")}.`
        : "Could not build the Excel sheet. Each selected employee needs a bank account number.";
      setDownloadNotice(message);
      await appAlert(message);
      return;
    }

    setReadyFile({ url: file.url, filename: file.filename });
    triggerFileDownload(file.url, file.filename);
    const parts = [
      `File ready: ${file.filename}.`,
      `${file.included} employee${file.included === 1 ? "" : "s"} included.`,
    ];
    if (cashSkipped > 0) parts.push(`${cashSkipped} cash employee${cashSkipped === 1 ? "" : "s"} left out.`);
    if (file.skipped > 0) {
      parts.push(`${file.skipped} skipped (no account number).`);
    }
    parts.push(`Company account ${selectedCompanyAccount.accountNo || "—"}.`);
    parts.push("Use this Excel sheet for the bank until a dedicated slip format is set up.");
    setDownloadNotice(parts.join(" "));
  }

  async function generateBankSlips(ids: Set<string>) {
    const chosen = sortedStatements.filter((s) => ids.has(s.id));
    if (!selectedCompanyAccount) {
      void appAlert("Choose a company bank account first.");
      return;
    }
    if (chosen.length === 0) {
      void appAlert("Select at least one employee to generate the bank slip.");
      return;
    }
    if (bankFileBlockReason) {
      setDownloadNotice(bankFileBlockReason);
      await appAlert(bankFileBlockReason);
      return;
    }
    setGenerating(true);
    try {
      if (sampathBankSelected) await generateSampathBankFile(chosen);
      else if (commercialBankSelected) await generateCommercialBankFile(chosen);
      else await generateExcelSalarySheet(chosen);
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Could not download the bank file.");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <Loading />;

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)]">
        <div className="border-b border-slate-100 bg-gradient-to-b from-slate-50/80 to-white px-6 py-5">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">Slip Generate</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">
            Choose a payroll batch{multiCompanyActive ? ", company," : ""} and company bank, then download the bank file.
          </p>
          <div className="mt-5 flex w-full flex-wrap items-end gap-3">
            <div className="min-w-[240px] flex-1">
              <label htmlFor="slip-generate-batch" className={labelCls}>
                Payroll Batch
              </label>
              <FormSelect
                id="slip-generate-batch"
                value={batchId}
                onValueChange={setBatchId}
                options={slipBatchOpts}
                placeholder="Select a batch"
              />
            </div>
            {multiCompanyActive && slipCompanyProfileOpts.length > 0 ? (
              <div className="min-w-[200px] flex-1">
                <label htmlFor="slip-generate-company" className={labelCls}>
                  Company
                </label>
                <FormSelect
                  id="slip-generate-company"
                  value={companyProfileKey}
                  onValueChange={setCompanyProfileKey}
                  options={slipCompanyProfileOpts}
                  placeholder="Select a company"
                />
              </div>
            ) : null}
            <div className="min-w-[240px] flex-1">
              <label htmlFor="slip-generate-company-account" className={labelCls}>
                Company Bank Account
              </label>
              <FormSelect
                id="slip-generate-company-account"
                value={companyAccountIndex}
                onValueChange={setCompanyAccountIndex}
                options={slipCompanyBankOpts}
                placeholder="Select a company bank"
                disabled={companyAccounts.length === 0}
                clearable={companyAccounts.length > 0}
              />
            </div>
            <Button
              className="h-[42px] shrink-0 px-4"
              disabled={generating || selectedCount === 0 || !selectedBatch || !selectedCompanyAccount || !canDownloadBankFile}
              onClick={() => void generateBankSlips(selected)}
            >
              {generating ? "Generating…" : excelBankSelected ? "Download .xlsx" : "Download .txt"}
            </Button>
          </div>
          {companyAccountsError ? (
            <p className="mt-2 text-xs text-amber-700">
              {companyAccountsError}{" "}
              <a href="/app/company-profile" className="font-semibold text-[#256aa3] hover:underline">
                Open Company Profile
              </a>
            </p>
          ) : null}
          {selectedCompanyAccount ? (
            <p className="mt-3 text-xs text-slate-500">
              Downloads as {bankSlipFormatLabel(selectedCompanyAccount.bankName)}.
            </p>
          ) : null}
          {bankFileBlockReason ? (
            <div className="mt-3 rounded-xl border border-amber-200/90 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <p>{bankFileBlockReason}</p>
              {onOpenPayrollRun && selectedBatch?.status !== "Cancelled" ? (
                <button
                  type="button"
                  className="mt-1 text-sm font-semibold text-[#256aa3] hover:underline"
                  onClick={onOpenPayrollRun}
                >
                  Open Payroll Run to review and approve
                </button>
              ) : null}
            </div>
          ) : null}
          {selectedCompanyAccount && excelBankSelected ? (
            <p className="mt-3 text-xs text-slate-500">
              No dedicated {selectedCompanyAccount.bankName.trim() || "bank"} slip yet — the download is an Excel salary sheet.
            </p>
          ) : null}
          {downloadNotice ? (
            <p className="mt-3 text-sm text-slate-700">
              {downloadNotice}
              {readyFile && canDownloadBankFile ? (
                <>
                  {" "}
                  <a href={readyFile.url} download={readyFile.filename} className="font-semibold text-[#256aa3] hover:underline">
                    Save again
                  </a>
                </>
              ) : null}
            </p>
          ) : null}
        </div>

        {loadError ? (
          <div className="px-6 py-4">
            <InlinePageAlert message={loadError} className="rounded-xl border border-rose-200/80 bg-rose-50 px-3 py-2 text-sm text-rose-800" />
          </div>
        ) : null}

        {!batchId ? (
          <div className="px-6 py-14">
            <EmptyState text="Choose a payroll batch to generate bank slips." />
          </div>
        ) : loadingStmts ? (
          <div className="py-16">
            <Loading />
          </div>
        ) : sortedStatements.length === 0 ? (
          <div className="px-6 py-14">
            <EmptyState text="No pay slips in this batch. Open Payroll Run and calculate it first." />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className={`w-full table-fixed border-collapse text-sm ${
                sampathBankSelected ? "min-w-[1100px]" : excelBankSelected ? "min-w-[980px]" : ""
              }`}>
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/90">
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        aria-label="Select all employees"
                      />
                    </th>
                    {commercialBankSelected ? (
                      <>
                        <th className="w-[28%] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Employee
                        </th>
                        <th className="w-[22%] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Account no.
                        </th>
                        <th className="w-[18%] px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Amount
                        </th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Narrative
                        </th>
                      </>
                    ) : sampathBankSelected ? (
                      <>
                        <th className="w-[10%] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Ref
                        </th>
                        <th className="w-[18%] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Beneficiary
                        </th>
                        <th className="w-[14%] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Account no.
                        </th>
                        <th className="w-[10%] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Bank
                        </th>
                        <th className="w-[10%] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Branch
                        </th>
                        <th className="w-[12%] px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Amount
                        </th>
                        <th className="w-[10%] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Remarks
                        </th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Type
                        </th>
                      </>
                    ) : (
                      <>
                        <th className="w-[20%] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Employee
                        </th>
                        <th className="w-[16%] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Account no.
                        </th>
                        <th className="w-[16%] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Bank
                        </th>
                        <th className="w-[12%] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Branch
                        </th>
                        <th className="w-[14%] px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Amount
                        </th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Narrative
                        </th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {pager.pageItems.map((stmt) => {
                    const slip = slipByKey[String(stmt.id).toLowerCase()]
                      || slipByKey[String(stmt.employeeId ?? "").toLowerCase()];
                    const destBank = sampathBankCode(slip?.bankCode, slip?.bankName);
                    const destBranch = sampathBranchCode(slip?.branchCode);
                    const salaryRef = sampathSalaryRef(selectedBatch?.month ?? stmt.month);
                    const sampathAccount = sampathFileAccount(slip?.isCashPayment ? "" : slip?.accountNumber);
                    const commercialAccount = commercialBankFileAccount(slip?.isCashPayment ? "" : slip?.accountNumber);
                    const commercialNarratives = commercialBankSalaryNarratives(
                      selectedBatch?.month ?? stmt.month,
                      selectedBatch?.year ?? stmt.year,
                    );
                    const cashPaid = Boolean(slip?.isCashPayment);
                    return (
                    <tr key={stmt.id} className="border-b border-slate-100 hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={!cashPaid && selected.has(stmt.id)}
                          disabled={cashPaid}
                          onChange={() => toggleOne(stmt.id)}
                          aria-label={`Select ${stmt.employeeName}`}
                        />
                      </td>
                      {commercialBankSelected ? (
                        <>
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-800">{stmt.employeeName}</div>
                            <div className="text-xs text-slate-400">{stmt.employeeCode || "—"}{cashPaid ? " · Cash" : ""}</div>
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-800">
                            {cashPaid ? <span className="font-sans text-slate-500">Cash</span> : commercialAccount || <span className="font-sans text-amber-700">Missing</span>}
                          </td>
                          <td className="whitespace-pre px-4 py-3 text-right font-mono tabular-nums text-slate-800">
                            {formatCommercialBankFileAmount(Number(stmt.netPay))}
                          </td>
                          <td className="px-4 py-3 text-slate-700">{commercialNarratives.longNarrative}</td>
                        </>
                      ) : sampathBankSelected ? (
                        <>
                          <td className="px-4 py-3 font-mono text-slate-700">{salaryRef}</td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-800">{stmt.employeeName}</div>
                            <div className="text-xs text-slate-400">{stmt.employeeCode || "—"}{cashPaid ? " · Cash" : ""}</div>
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-800">
                            {cashPaid ? <span className="font-sans text-slate-500">Cash</span> : sampathAccount || <span className="font-sans text-amber-700">Missing</span>}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-700">
                            {cashPaid ? "—" : destBank || <span className="font-sans text-amber-700">Missing</span>}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-700">
                            {cashPaid ? "—" : destBranch || <span className="font-sans text-amber-700">Missing</span>}
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-800">
                            {formatSampathFileAmount(Number(stmt.netPay))}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-700">
                            {cashPaid ? "—" : sampathAccountNumber(selectedCompanyAccount?.accountNo) || salaryRef}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-700">
                            {cashPaid ? "Cash" : sampathCreditMode(destBank, slip?.bankName)}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-800">{stmt.employeeName}</div>
                            <div className="text-xs text-slate-400">{stmt.employeeCode || "—"}{cashPaid ? " · Cash" : ""}</div>
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-800">
                            {cashPaid ? <span className="font-sans text-slate-500">Cash</span> : genericBankAccountNumber(slip?.accountNumber) || <span className="font-sans text-amber-700">Missing</span>}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {cashPaid ? "Cash" : slip?.bankName || <span className="text-amber-700">Missing</span>}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-700">
                            {slip?.branchCode || slip?.branchLocation || "—"}
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-800">
                            {formatGenericBankAmount(Number(stmt.netPay))}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {genericBankSalaryNarrative(selectedBatch?.month ?? stmt.month, selectedBatch?.year ?? stmt.year)}
                          </td>
                        </>
                      )}
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <TablePagination
              page={pager.page}
              totalPages={pager.totalPages}
              totalCount={pager.totalCount}
              pageSize={pager.pageSize}
              onPageChange={pager.setPage}
            />
          </>
        )}
      </div>
    </div>
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
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchId, setBatchId] = useState("");

  const selectedBatch = batches.find((b) => b.id === batchId);
  const hasFilters = searchFilter.hasApplied || Boolean(batchId);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (searchFilter.applied.trim()) params.set("search", searchFilter.applied.trim());
    if (batchId) params.set("batchId", batchId);
    apiFetch<PagedResult<Statement>>(`/api/payroll/statements?${params.toString()}`)
      .then(d => {
        setStatements(pagedItems(d));
        setTotalCount(d.totalCount ?? d.TotalCount ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, searchFilter.applied, batchId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    apiFetch<PagedResult<Batch>>("/api/payroll/batches?pageSize=200")
      .then((d) => setBatches(sortBatchesNewestFirst(normalizeBatches(pagedItems(d)))))
      .catch(() => setBatches([]));
  }, []);

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
    setBatchId("");
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

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const displayStatements = useMemo(
    () => [...statements].sort((a, b) => compareEmployeeCode(a.employeeCode, b.employeeCode)),
    [statements],
  );

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)]">
        <div className="border-b border-slate-100 bg-gradient-to-b from-slate-50/80 to-white px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">Pay Slips</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">
              View and print employee payslips after payroll is approved. Payslip and Print appear only when status is Approved.
            </p>
          </div>

          <div className="mt-5">
            <div className="flex w-full flex-col gap-2 lg:flex-row lg:items-end">
              <div className="min-w-0 flex-1">
                <label htmlFor="payslip-employee-search" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Search employee
                </label>
                <div ref={searchWrapRef} className="relative min-w-0">
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
              </div>
              <div className="w-full min-w-0 lg:w-[22rem]">
                <label htmlFor="payslip-batch-filter" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Search batch
                </label>
                <select
                  id="payslip-batch-filter"
                  className={
                    inputCls +
                    " min-h-10 w-full !mb-0 rounded-lg border-slate-200/90 bg-white py-2.5 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)]"
                  }
                  value={batchId}
                  onChange={(e) => {
                    setBatchId(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All batches</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.batchCode} · {MONTHS[b.month - 1]} {b.year}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex shrink-0 items-stretch gap-2">
                <Button className="min-h-10 min-w-[6.5rem] rounded-lg px-6" onClick={applySearch}>
                  Search
                </Button>
                {hasFilters ? (
                  <Button variant="secondary" className="min-h-10 min-w-[5.5rem] rounded-lg px-4" onClick={clearSearch}>
                    Clear
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
              {hasFilters ? (
                <p className="text-xs text-slate-500">
                  Showing results
                  {searchFilter.hasApplied ? (
                    <>
                      {" "}for{" "}
                      <strong className="font-medium text-slate-700">&quot;{searchFilter.applied}&quot;</strong>
                    </>
                  ) : null}
                  {selectedBatch ? (
                    <>
                      {searchFilter.hasApplied ? " in " : " for "}
                      <strong className="font-medium text-slate-700">{selectedBatch.batchCode}</strong>
                    </>
                  ) : null}
                </p>
              ) : (
                <span className="text-xs text-slate-400">Type a name or code, or choose a batch</span>
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
                hasFilters
                  ? `No pay slips found${searchFilter.hasApplied ? ` for "${searchFilter.applied}"` : ""}${selectedBatch ? ` in ${selectedBatch.batchCode}` : ""}.`
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
  const [components, setComponents] = useState<Component[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [periodStartDay, setPeriodStartDay] = useState("1");
  const [periodEndDay, setPeriodEndDay] = useState("31");
  const [otComponentCode, setOtComponentCode] = useState("OT");
  const [nopayComponentCode, setNopayComponentCode] = useState("NOPAY");
  const [poyaComponentCode, setPoyaComponentCode] = useState("POYA");
  const [baseComponentCode, setBaseComponentCode] = useState("BASIC");
  const [workingHoursComponentCode, setWorkingHoursComponentCode] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiFetch<Settings>("/api/payroll/settings"),
      apiFetch<Component[]>("/api/payroll/components"),
    ])
      .then(([s, comps]) => {
        if (cancelled) return;
        setSettings(s);
        setComponents(comps.filter((c) => c.isActive !== false));
        setPeriodStartDay(formatSalaryPeriodDayField(s.salaryPeriodStartDay, 1));
        setPeriodEndDay(formatSalaryPeriodDayField(s.salaryPeriodEndDay, 31));
        setOtComponentCode(s.otComponentCode || "OT");
        setNopayComponentCode(s.nopayComponentCode || "NOPAY");
        setPoyaComponentCode(s.poyaComponentCode || "POYA");
        setBaseComponentCode(s.baseComponentCode || "BASIC");
        setWorkingHoursComponentCode(s.workingHoursComponentCode || "");
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const componentOptions = useMemo(
    () => components
      .slice()
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((c) => ({
        value: c.code,
        label: `${c.code} — ${c.name}`,
      })),
    [components],
  );

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true); setMsg("");
    const fd = new FormData(e.currentTarget);
    const payload = {
      epfEmployeeRate: Number(fd.get("epfEmployeeRate")) / 100,
      epfEmployerRate: Number(fd.get("epfEmployerRate")) / 100,
      etfEmployerRate: Number(fd.get("etfEmployerRate")) / 100,
      otHourlyDivisor: Number(fd.get("otHourlyDivisor")) || 208,
      otMultiplier: Number(fd.get("otMultiplier")) || 1.5,
      apitTaxMode: String(fd.get("apitTaxMode") || settings?.apitTaxMode || "Monthly"),
      salaryPeriodStartDay: salaryPeriodDayFromField(periodStartDay, 1),
      salaryPeriodEndDay: salaryPeriodDayFromField(periodEndDay, 31),
      otComponentCode,
      nopayComponentCode,
      poyaComponentCode,
      baseComponentCode,
      workingHoursComponentCode: workingHoursComponentCode || "",
    };
    try {
      const result = await apiFetch<Settings>("/api/payroll/settings", { method: "PUT", body: JSON.stringify(payload) });
      setSettings(result);
      setPeriodStartDay(formatSalaryPeriodDayField(result.salaryPeriodStartDay, 1));
      setPeriodEndDay(formatSalaryPeriodDayField(result.salaryPeriodEndDay, 31));
      setOtComponentCode(result.otComponentCode || "OT");
      setNopayComponentCode(result.nopayComponentCode || "NOPAY");
      setPoyaComponentCode(result.poyaComponentCode || "POYA");
      setBaseComponentCode(result.baseComponentCode || "BASIC");
      setWorkingHoursComponentCode(result.workingHoursComponentCode || "");
      setMsg("Settings saved successfully.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed to save settings.");
    }
    finally { setSaving(false); }
  }

  if (loading) return <Loading />;

  const previewNow = new Date();
  const previewRange = monthDateRange(
    previewNow.getMonth() + 1,
    previewNow.getFullYear(),
    salaryPeriodDayFromField(periodStartDay, 1),
    salaryPeriodDayFromField(periodEndDay, 31),
  );
  const previewLabel = `${MONTHS[previewNow.getMonth()]} ${previewNow.getFullYear()}`;

  return (
    <div className="max-w-2xl space-y-5">
      <Card title="Statutory Rates">
        <form id="payroll-settings-form" onSubmit={handleSubmit} className="space-y-4">
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
            <p className="mt-1 text-xs text-slate-400">
              Used when Working hours component is unset or has no amount.
              OT = Base ÷ divisor × multiplier × approved hours
            </p>
          </div>
          <div>
            <label className={labelCls}>OT Multiplier</label>
            <input name="otMultiplier" type="number" step="0.01" className={inputCls}
              defaultValue={settings?.otMultiplier ?? 1.5} />
          </div>
          <div>
            <label className={labelCls}>APIT tax mode</label>
            <select name="apitTaxMode" className={inputCls} defaultValue={settings?.apitTaxMode ?? "Monthly"}>
              <option value="Monthly">Monthly</option>
              <option value="Annual">Annual</option>
              <option value="Exact">Expact</option>
            </select>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <h4 className="mb-1 text-sm font-semibold text-slate-700">Salary calculation period</h4>
            <p className="mb-3 text-xs text-slate-500">
              Days of the month used for attendance / OT / nopay when running each month&apos;s salary.
              If the start day is greater than the end day, the period begins in the previous month
              (e.g. 26 → 25 = 26th last month through 25th this month).
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>From day</label>
                <input
                  name="salaryPeriodStartDay"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={2}
                  className={inputCls}
                  value={periodStartDay}
                  onChange={(e) => setPeriodStartDay(sanitizeSalaryPeriodDayInput(e.target.value))}
                  onBlur={() => setPeriodStartDay(formatSalaryPeriodDayField(salaryPeriodDayFromField(periodStartDay, 1), 1))}
                />
              </div>
              <div>
                <label className={labelCls}>To day</label>
                <input
                  name="salaryPeriodEndDay"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={2}
                  className={inputCls}
                  value={periodEndDay}
                  onChange={(e) => setPeriodEndDay(sanitizeSalaryPeriodDayInput(e.target.value))}
                  onBlur={() => setPeriodEndDay(formatSalaryPeriodDayField(salaryPeriodDayFromField(periodEndDay, 31), 31))}
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Example for {previewLabel}: <span className="font-medium text-slate-700">{previewRange.from}</span>
              {" → "}
              <span className="font-medium text-slate-700">{previewRange.to}</span>
            </p>
          </div>
        </form>
      </Card>

      <Card title="Attendance & leave component mapping">
        <div className="mb-4 text-xs text-slate-500">
          Map each attendance/leave parameter to one payroll component. Import and Calculate use these codes
          instead of hard-coded OT / NOPAY / POYA / BASIC.
        </div>
        <div className="space-y-4">
          <div>
            <label className={labelCls}>OT earning component</label>
            <select className={inputCls} value={otComponentCode} onChange={(e) => setOtComponentCode(e.target.value)} form="payroll-settings-form">
              {componentOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <p className="mt-1 text-xs text-slate-400">Receives imported overtime pay amount.</p>
          </div>
          <div>
            <label className={labelCls}>No-pay deduction component</label>
            <select className={inputCls} value={nopayComponentCode} onChange={(e) => setNopayComponentCode(e.target.value)} form="payroll-settings-form">
              {componentOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <p className="mt-1 text-xs text-slate-400">Formula uses Base ÷ 30 × no-pay days from attendance + unpaid leave.</p>
          </div>
          <div>
            <label className={labelCls}>Poya day pay component</label>
            <select className={inputCls} value={poyaComponentCode} onChange={(e) => setPoyaComponentCode(e.target.value)} form="payroll-settings-form">
              {componentOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <p className="mt-1 text-xs text-slate-400">Poya pay is entered per employee on Employee Salary (days × Base ÷ 30), not from attendance import.</p>
          </div>
          <div>
            <label className={labelCls}>Base pay component</label>
            <select className={inputCls} value={baseComponentCode} onChange={(e) => setBaseComponentCode(e.target.value)} form="payroll-settings-form">
              {componentOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <p className="mt-1 text-xs text-slate-400">Used as BASIC in OT, no-pay, and Poya day-rate formulas.</p>
          </div>
          <div>
            <label className={labelCls}>Working hours component</label>
            <select
              className={inputCls}
              value={workingHoursComponentCode}
              onChange={(e) => setWorkingHoursComponentCode(e.target.value)}
              form="payroll-settings-form"
            >
              <option value="">— Use OT Hourly Divisor setting —</option>
              {componentOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <p className="mt-1 text-xs text-slate-400">
              When set, that component&apos;s employee amount is the OT divisor (and WORKING_HOURS in formulas).
            </p>
          </div>
        </div>
      </Card>

      {msg ? (
        <InlinePageAlert
          message={msg}
          variant={msg.includes("success") ? "success" : "error"}
          className={`rounded-lg px-4 py-2 text-sm scroll-mt-20 ${msg.includes("success") ? "border border-green-200 bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}
        />
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" form="payroll-settings-form" disabled={saving}>{saving ? "Saving..." : "Save Settings"}</Button>
      </div>
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
