const MONTH_ABBR = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** Commercial Bank Combiz one-to-many salary upload purpose code from the official sample file. */
export const COMMERCIAL_BANK_SALARY_GL_CODE = "784001";
export const COMMERCIAL_BANK_SALARY_GL_DESCRIPTION = "CONSULTANCY FEES LEGAL CHARGES AND SALARIES";

export type CommercialBankSalaryRow = {
  accountNumber?: string | null;
  netPay: number;
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

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

export function commercialBankAccountNumber(accountNumber?: string | null): string {
  return (accountNumber ?? "").replace(/[\s-]/g, "").trim();
}

export function formatCommercialBankAmount(amount: number): string {
  const [whole, fraction] = Math.max(0, Number(amount) || 0).toFixed(2).split(".");
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction}`;
}

export function commercialBankOneToManyFileName(now: Date = new Date()): string {
  const stamp = `${pad2(now.getDate())}${pad2(now.getMonth() + 1)}${String(now.getFullYear()).slice(-2)}-${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
  return `One-To-Many-File-${stamp}.txt`;
}

export function buildCommercialBankOneToManyLine(
  accountNumber: string,
  amount: number,
  month: number,
  year: number,
): string {
  const period = commercialBankSalaryNarratives(month, year);
  return [
    sanitizeField(accountNumber),
    formatCommercialBankAmount(amount),
    sanitizeField(period.longNarrative),
    sanitizeField(period.shortNarrative),
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

export function createCommercialBankDownload(content: string, now: Date = new Date()): { filename: string; url: string } {
  const filename = commercialBankOneToManyFileName(now);
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

export function downloadCommercialBankOneToManyFile(content: string, now: Date = new Date()): string {
  const { filename, url } = createCommercialBankDownload(content, now);
  triggerFileDownload(url, filename);
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return filename;
}
