import type { PayStatement, PayStatementLine } from "@/types/payroll";
import type { BadgeProps } from "@/components/ui/Badge";
import { formatCurrency, monthYearLabel } from "@/utils/format";

export function sortPayslipsByDate(statements: PayStatement[]): PayStatement[] {
  return [...statements].sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });
}

export function summarizePayslips(statements: PayStatement[]): {
  count: number;
  latestNetPay: number;
  latestLabel: string;
  ytdNetPay: number;
} {
  const sorted = sortPayslipsByDate(statements);
  const currentYear = new Date().getFullYear();
  const ytdNetPay = statements
    .filter((item) => item.year === currentYear)
    .reduce((sum, item) => sum + item.netPay, 0);

  const latest = sorted[0];
  return {
    count: statements.length,
    latestNetPay: latest?.netPay ?? 0,
    latestLabel: latest ? monthYearLabel(latest.month, latest.year) : "—",
    ytdNetPay,
  };
}

export function payslipStatusTone(status: string): BadgeProps["tone"] {
  const normalized = status.toLowerCase();
  if (normalized.includes("publish") || normalized.includes("final")) return "success";
  if (normalized.includes("draft") || normalized.includes("pending")) return "warning";
  if (normalized.includes("cancel") || normalized.includes("void")) return "danger";
  return "default";
}

export function shortMonthLabel(month: number, year: number): string {
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export function groupPayLines(lines: PayStatementLine[]): {
  earnings: PayStatementLine[];
  deductions: PayStatementLine[];
} {
  const visible = lines.filter((line) => !line.isEmployerContribution);
  const earnings: PayStatementLine[] = [];
  const deductions: PayStatementLine[] = [];

  for (const line of visible) {
    if (line.type.toLowerCase().includes("deduct")) {
      deductions.push(line);
    } else {
      earnings.push(line);
    }
  }

  earnings.sort((a, b) => a.sortOrder - b.sortOrder);
  deductions.sort((a, b) => a.sortOrder - b.sortOrder);
  return { earnings, deductions };
}

export function formatCompactCurrency(amount: number, currency = "LKR"): string {
  if (amount >= 1_000_000) {
    return `${currency} ${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (amount >= 1_000) {
    return `${currency} ${Math.round(amount / 1_000)}k`;
  }
  return formatCurrency(amount, currency);
}
