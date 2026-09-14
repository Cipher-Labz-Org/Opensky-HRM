"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { ROUTES } from "@/config/routes";

interface CompensationLine {
  id: string;
  componentName: string;
  componentCode: string;
  componentType: string;
  componentCategory: string;
  isTaxable: boolean;
  isEpfApplicable: boolean;
  isEtfApplicable: boolean;
  amount: number;
  isActive: boolean;
  batchId?: string | null;
  effectiveFrom?: string;
  effectiveTo?: string;
}

const fmt = (n: number) =>
  n.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (n: number) => `LKR ${fmt(n)}`;
const roundMoney = (n: number) => Math.round(n * 100) / 100;
function calcApitTableAnnual(yearlyProfits: number): number {
  if (yearlyProfits <= 1800000) return 0;
  if (yearlyProfits <= 2800000) return roundMoney(yearlyProfits * 0.06 - 108000);
  if (yearlyProfits <= 3300000) return roundMoney(yearlyProfits * 0.18 - 444000);
  if (yearlyProfits <= 3800000) return roundMoney(yearlyProfits * 0.24 - 642000);
  if (yearlyProfits <= 4300000) return roundMoney(yearlyProfits * 0.30 - 870000);
  return Math.max(0, roundMoney(yearlyProfits * 0.36 - 1128000));
}

function calcApitTable01(taxableEarnings: number): number {
  if (taxableEarnings <= 150000) return 0;
  if (taxableEarnings <= 233333) return roundMoney(taxableEarnings * 0.06 - 9000);
  if (taxableEarnings <= 275000) return roundMoney(taxableEarnings * 0.18 - 37000);
  if (taxableEarnings <= 316667) return roundMoney(taxableEarnings * 0.24 - 53500);
  if (taxableEarnings <= 358333) return roundMoney(taxableEarnings * 0.30 - 72500);
  return Math.max(0, roundMoney(taxableEarnings * 0.36 - 94000));
}

/** Tax year starts 1 March: March = 1 … February = 12. */
function apitTaxYearMonthNumber(calendarMonth: number): number {
  return calendarMonth >= 3 ? calendarMonth - 2 : calendarMonth + 10;
}

function apitTaxYearStartYear(date: Date): number {
  return date.getMonth() >= 2 ? date.getFullYear() : date.getFullYear() - 1;
}

const TAX_YEAR_MONTHS = [
  { calendarMonth: 3, label: "March" },
  { calendarMonth: 4, label: "April" },
  { calendarMonth: 5, label: "May" },
  { calendarMonth: 6, label: "June" },
  { calendarMonth: 7, label: "July" },
  { calendarMonth: 8, label: "August" },
  { calendarMonth: 9, label: "September" },
  { calendarMonth: 10, label: "October" },
  { calendarMonth: 11, label: "November" },
  { calendarMonth: 12, label: "December" },
  { calendarMonth: 1, label: "January" },
  { calendarMonth: 2, label: "February" },
] as const;

type ApitTaxMode = "Monthly" | "Annual" | "Exact";

const TAX_MODES: { value: ApitTaxMode; label: string }[] = [
  { value: "Monthly", label: "Monthly" },
  { value: "Annual", label: "Annual" },
  { value: "Exact", label: "Expact" },
];

function normalizeApitTaxMode(mode?: string): ApitTaxMode {
  const value = (mode ?? "").trim().toLowerCase();
  if (value === "monthly") return "Monthly";
  if (value === "annual" || value === "annualy" || value === "annually") return "Annual";
  return "Exact";
}

function calcLowSalaryAnnualApit(monthlySalary: number): number {
  if (monthlySalary <= 0) return 0;
  const yearly = monthlySalary * 12;
  if (yearly < 150000) return 0;
  return roundMoney(yearly * 0.06);
}

function calcAnnualApit(cumulativeTaxable: number): number {
  return calcApitTableAnnual(cumulativeTaxable);
}

function calcAnnualApitIncrement(priorCumulativeTaxable: number, thisMonthTaxable: number): number {
  const prior = Math.max(0, priorCumulativeTaxable);
  const added = Math.max(0, thisMonthTaxable);
  return Math.max(0, roundMoney(calcApitTableAnnual(prior + added) - calcApitTableAnnual(prior)));
}

function calcMonthlyApitWithAnnualFallback(monthlySalary: number): number {
  return calcApitTable01(monthlySalary);
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

function calcExactApit(
  monthlySalary: number,
  lumpTaxable = 0,
  priorCumulativeTaxable = 0,
  confirmedMonths = 0
): number {
  let paidMonths = confirmedMonths;
  if (paidMonths <= 0 && priorCumulativeTaxable > 0 && monthlySalary > 0) {
    paidMonths = Math.round(priorCumulativeTaxable / monthlySalary);
  }
  paidMonths = Math.min(11, Math.max(0, paidMonths));
  const remainingMonths = 12 - paidMonths;
  const alreadyPaid = Math.max(0, priorCumulativeTaxable);
  const expected = alreadyPaid + monthlySalary * remainingMonths + Math.max(0, lumpTaxable);
  const averagePaid = paidMonths > 0 ? alreadyPaid / paidMonths : 0;
  const aggregated =
    paidMonths * calcApitTable41(averagePaid) + remainingMonths * calcApitTable41(monthlySalary);
  const lumpTax = Math.max(0, roundMoney(calcApitTable42Gross(expected) - aggregated));
  return roundMoney(calcApitTable41(monthlySalary) + lumpTax);
}

function calcApitByMode(
  monthlySalary: number,
  calendarMonth: number,
  mode: ApitTaxMode,
  priorCumulativeTaxable = 0,
  confirmedMonths = 0
): number {
  if (mode === "Monthly") return calcMonthlyApitWithAnnualFallback(monthlySalary);
  if (mode === "Annual") return calcAnnualApitIncrement(priorCumulativeTaxable, monthlySalary);
  return calcExactApit(monthlySalary, 0, priorCumulativeTaxable, confirmedMonths);
}

interface ApitSummary {
  monthlySalary: number;
  yearlySalary: number;
  monthlyApit: number;
  annualApit: number;
  displayApit: number;
  apitTaxMode: string;
  belowMonthlyRelief: boolean;
  taxYearMonthNumber: number;
  cumulativeTaxable: number;
  cumulativeApit: number;
  confirmedMonths?: number;
}

function isBasicSalaryCode(code?: string) {
  const value = (code ?? "").toUpperCase();
  return value === "BASIC" || value.startsWith("BASIC");
}

function isEarning(line: CompensationLine) {
  return (
    line.componentType === "Earning" ||
    line.componentType === "Income" ||
    isBasicSalaryCode(line.componentCode)
  );
}

function isCurrentSalaryLine(line: CompensationLine) {
  if (!line.isActive || line.batchId) return false;
  if (line.componentCategory === "OneTime") return false;
  if (!isEarning(line)) return false;
  if (!line.effectiveTo) return true;
  const end = Date.parse(line.effectiveTo);
  return !Number.isFinite(end) || end >= Date.now();
}

export function EmployeePayrollTab({ employeeId }: { employeeId: string }) {
  const [lines, setLines] = useState<CompensationLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [taxMonth] = useState(() => new Date().getMonth() + 1);
  const [taxMode, setTaxMode] = useState<ApitTaxMode>("Annual");
  const [serverSummary, setServerSummary] = useState<ApitSummary | null>(null);
  const [savingMode, setSavingMode] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    apiFetch<CompensationLine[]>(`/api/payroll/compensation/${employeeId}`)
      .then((data) => {
        if (cancelled) return;
        setLines(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (cancelled) return;
        setLines([]);
        setError(err instanceof Error ? err.message : "Could not load salary.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ month: String(taxMonth) });
    apiFetch<ApitSummary>(`/api/payroll/compensation/${employeeId}/apit-summary?${params}`)
      .then((data) => {
        if (cancelled) return;
        setServerSummary(data);
        setTaxMode(normalizeApitTaxMode(data.apitTaxMode));
      })
      .catch(() => {
        if (!cancelled) setServerSummary(null);
      });
    return () => {
      cancelled = true;
    };
  }, [employeeId, taxMonth]);

  const summary = useMemo(() => {
    const salary = lines.filter(isCurrentSalaryLine);
    const regular = salary.filter((l) => l.componentCategory !== "OneTime");
    const monthlySalary = regular.reduce((s, l) => s + Number(l.amount || 0), 0);
    const monthNumber = apitTaxYearMonthNumber(taxMonth);
    const monthlyApitRate = calcMonthlyApitWithAnnualFallback(monthlySalary);
    const yearlySalary = roundMoney(monthlySalary * 12);
    const cumulativeTaxable = serverSummary?.cumulativeTaxable ?? 0;
    const cumulativeApit = serverSummary?.cumulativeApit ?? calcAnnualApit(cumulativeTaxable);
    const annualApit = serverSummary?.annualApit ?? calcAnnualApit(cumulativeTaxable);
    const belowMonthlyRelief = monthlySalary > 0 && monthlySalary <= 150000;
    const apit = calcApitByMode(
      monthlySalary,
      taxMonth,
      taxMode,
      cumulativeTaxable,
      serverSummary?.confirmedMonths ?? 0
    );
    const taxYearStart = apitTaxYearStartYear(new Date());
    const selected = TAX_YEAR_MONTHS.find((m) => m.calendarMonth === taxMonth);
    const apitLabel =
      taxMode === "Annual" ? "Annual APIT" : taxMode === "Exact" ? "Expact APIT" : "Cumulative taxable";

    return {
      salary,
      monthlySalary: serverSummary?.monthlySalary ?? monthlySalary,
      yearlySalary: serverSummary?.yearlySalary ?? yearlySalary,
      cumulativeTaxable,
      cumulativeApit,
      annualApit: serverSummary?.annualApit ?? annualApit,
      belowMonthlyRelief: serverSummary?.belowMonthlyRelief ?? belowMonthlyRelief,
      slabUnits: (serverSummary?.yearlySalary ?? yearlySalary) > 0
        ? (serverSummary?.yearlySalary ?? yearlySalary) / 150000
        : 0,
      monthNumber: serverSummary?.taxYearMonthNumber ?? monthNumber,
      monthlyApitRate: serverSummary?.monthlyApit ?? monthlyApitRate,
      apit: serverSummary?.displayApit ?? apit,
      apitLabel,
      taxYearStart,
      taxYearEnd: taxYearStart + 1,
      monthLabel: selected?.label ?? "",
    };
  }, [lines, taxMonth, taxMode, serverSummary]);

  async function changeTaxMode(next: ApitTaxMode) {
    setTaxMode(next);
    setSavingMode(true);
    try {
      const saved = await apiFetch<ApitSummary>(
        `/api/payroll/compensation/${employeeId}/apit-tax-mode`,
        {
          method: "PUT",
          body: JSON.stringify({ apitTaxMode: next }),
        }
      );
      setServerSummary(saved);
      setTaxMode(normalizeApitTaxMode(saved.apitTaxMode));
    } catch {
      /* keep the selected mode locally if save fails */
    } finally {
      setSavingMode(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
        Loading payroll…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error} Payroll totals are shown as LKR 0.00 until salary can be loaded.
        </div>
      ) : null}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-bold tracking-tight text-slate-800">Payroll</h2>
            <p className="mt-1 text-sm text-slate-500">
              Monthly salary and APIT from the employee&apos;s salary. Choose Monthly, Annual, or Expact. Tax year starts 1 March.
            </p>
          </div>
          <Link
            href={`${ROUTES.payroll}?tab=${encodeURIComponent("Employee Salary")}`}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Open Employee Salary
          </Link>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex flex-col gap-1 text-sm text-slate-600">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Tax mode
              </span>
              <select
                value={taxMode}
                disabled={savingMode}
                onChange={(e) => void changeTaxMode(e.target.value as ApitTaxMode)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                {TAX_MODES.map((mode) => (
                  <option key={mode.value} value={mode.value}>
                    {mode.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className="grid gap-3 px-5 py-5 sm:grid-cols-2">
          <Stat label="Monthly salary" value={money(summary.monthlySalary)} />
          {taxMode === "Exact" ? (
            <Stat label="Expact APIT" value={money(summary.apit)} emphasize="tax" />
          ) : (
            <Stat label="Cumulative taxable" value={money(summary.cumulativeTaxable)} />
          )}
        </div>
        <p className="px-5 pb-3 text-xs text-slate-500">
          {summary.salary.length === 0
            ? "No salary components are assigned yet. Totals stay at LKR 0.00 until amounts are added on Payroll → Employee Salary."
            : taxMode === "Monthly"
              ? "Monthly mode shows this month’s salary and confirmed year-to-date cumulative taxable. Tax year starts 1 March."
              : taxMode === "Annual"
                ? "Annual shows confirmed year-to-date cumulative taxable. The total updates after that month’s payroll is confirmed. Tax year starts 1 March."
                : "Expact uses IRD Table 4.1 on monthly salary for non-resident, non-citizen staff. Lump sums use Table 4.2 on expected yearly income (already paid + still payable + this month’s lump)."}
        </p>

        <div className="overflow-x-auto border-t border-slate-100">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-5 py-2.5">Component</th>
                <th className="px-4 py-2.5">Code</th>
                <th className="px-4 py-2.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {summary.salary.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-5 py-6 text-center text-sm text-slate-400">
                    No salary components yet
                  </td>
                </tr>
              ) : (
                summary.salary.map((line) => (
                  <tr key={line.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-2.5 font-medium text-slate-700">{line.componentName}</td>
                    <td className="px-4 py-2.5 text-slate-500">{line.componentCode}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-800">
                      {money(Number(line.amount || 0))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: "tax" | "net";
}) {
  const valueClass =
    emphasize === "tax"
      ? "text-rose-700"
      : emphasize === "net"
        ? "text-emerald-700"
        : "text-slate-900";
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${valueClass}`}>{value}</div>
    </div>
  );
}
