const MONTH_ABBR = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** Commercial Bank Combiz one-to-many salary upload purpose code from the official sample file. */
export const COMMERCIAL_BANK_SALARY_GL_CODE = "784001";
export const COMMERCIAL_BANK_SALARY_GL_DESCRIPTION = "CONSULTANCY FEES LEGAL CHARGES AND SALARIES";

export type CommercialBankSalaryRow = {
  accountNumber?: string | null;
  netPay: number;
};

function monthAbbr(month: number): string {
  return MONTH_ABBR[month - 1] ?? String(month).padStart(3, "0");
}

export function commercialBankSalaryNarratives(month: number, year: number): {
  period: string;
  longNarrative: string;
  shortNarrative: string;
} {
  const period = `${monthAbbr(month)} ${year}`;
  return {
    period,
    longNarrative: `COMPANY SALARIES ${period}`,
    shortNarrative: `SAL ${period}`,
  };
}

function sanitizeField(value: string): string {
  return value.replace(/\|/g, " ").replace(/\r?\n/g, " ").trim();
}

export const COMMERCIAL_ACCOUNT_WIDTH = 12;
export const COMMERCIAL_AMOUNT_WIDTH = 12;
export const COMMERCIAL_LONG_NARRATIVE_WIDTH = 28;
export const COMMERCIAL_SHORT_NARRATIVE_WIDTH = 12;

export function commercialBankAccountNumber(accountNumber?: string | null): string {
  return (accountNumber ?? "").replace(/[\s-]/g, "").trim();
}

/** Combiz One-to-Many account: 12 digits, leading zeros. */
export function commercialBankFileAccount(accountNumber?: string | null): string {
  const digits = commercialBankAccountNumber(accountNumber);
  if (!digits) return "";
  return digits.length >= COMMERCIAL_ACCOUNT_WIDTH ? digits : digits.padStart(COMMERCIAL_ACCOUNT_WIDTH, "0");
}

export function formatCommercialBankAmount(amount: number): string {
  const [whole, fraction] = Math.max(0, Number(amount) || 0).toFixed(2).split(".");
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction}`;
}

export function formatCommercialBankFileAmount(amount: number): string {
  return formatCommercialBankAmount(amount).padStart(COMMERCIAL_AMOUNT_WIDTH, " ");
}

function padField(value: string, width: number): string {
  return value.slice(0, width).padEnd(width, " ");
}

export function commercialBankOneToManyFileName(month: number, year: number): string {
  return `Commercial-Salary-${monthAbbr(month)}-${year}.txt`;
}

export function buildCommercialBankOneToManyLine(
  accountNumber: string,
  amount: number,
  month: number,
  year: number,
): string {
  const period = commercialBankSalaryNarratives(month, year);
  return [
    commercialBankFileAccount(accountNumber),
    formatCommercialBankFileAmount(amount),
    padField(sanitizeField(period.longNarrative), COMMERCIAL_LONG_NARRATIVE_WIDTH),
    padField(sanitizeField(period.shortNarrative), COMMERCIAL_SHORT_NARRATIVE_WIDTH),
    COMMERCIAL_BANK_SALARY_GL_CODE,
    COMMERCIAL_BANK_SALARY_GL_DESCRIPTION,
  ].join("|");
}

export function buildCommercialBankOneToManyFile(
  rows: CommercialBankSalaryRow[],
  month: number,
  year: number,
): { content: string; included: number; skipped: number } {
  const lines: string[] = [];
  let skipped = 0;
  for (const row of rows) {
    const accountNumber = commercialBankAccountNumber(row.accountNumber);
    if (!accountNumber || !Number.isFinite(row.netPay)) {
      skipped += 1;
      continue;
    }
    lines.push(buildCommercialBankOneToManyLine(accountNumber, row.netPay, month, year));
  }
  return {
    content: lines.length > 0 ? `${lines.join("\r\n")}\r\n` : "",
    included: lines.length,
    skipped,
  };
}

export function createCommercialBankDownload(
  content: string,
  month: number,
  year: number,
): { filename: string; url: string } {
  const filename = commercialBankOneToManyFileName(month, year);
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  return { filename, url: URL.createObjectURL(blob) };
}

export function triggerFileDownload(url: string, filename: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  window.setTimeout(() => a.remove(), 1500);
}

export function downloadCommercialBankOneToManyFile(content: string, month: number, year: number): string {
  const { filename, url } = createCommercialBankDownload(content, month, year);
  triggerFileDownload(url, filename);
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return filename;
}
