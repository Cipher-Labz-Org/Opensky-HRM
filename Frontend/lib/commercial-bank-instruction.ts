import { sampathBankCode, sampathBranchCode } from "@/lib/sampath-bank-cefts-slips";

/** Headers from Commercial Bank Combiz Bank Master “Instruction Package”. */
export const COMMERCIAL_INSTRUCTION_HEADERS = [
  "Tran ID",
  "Destination Bank",
  "Destination Branch",
  "Destination Account",
  "Destination Account Name",
  "TRN Code",
  "Remit Code",
  "Cr/Dr Code",
  "Return Date",
  "Amount",
  "Currency",
  "Originating Bank",
  "Originating Branch",
  "Originating Account",
  "Originating Account Name",
  "Particulars",
  "Reference",
  "Value Date",
  "Security Field",
] as const;

const MONTH_ABBR = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const COMMERCIAL_BANK_CODE = "7056";
const SALARY_TRN_CODE = "23";

export type CommercialInstructionOrigin = {
  bankCode?: string | null;
  bankName?: string | null;
  branchCode?: string | null;
  accountNumber?: string | null;
  accountName?: string | null;
};

export type CommercialInstructionRow = {
  beneficiaryName?: string | null;
  accountNumber?: string | null;
  bankCode?: string | null;
  branchCode?: string | null;
  bankName?: string | null;
  amount: number;
  particulars?: string | null;
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function digitsOnly(value?: string | null): string {
  return (value ?? "").replace(/\D/g, "");
}

export function commercialInstructionAccount(accountNumber?: string | null, width = 12): string {
  const digits = digitsOnly(accountNumber);
  if (!digits) return "";
  return digits.padStart(width, "0").slice(-width);
}

export function commercialInstructionAmount(amount: number): string {
  const cents = Math.round(amount * 100);
  return String(Math.max(0, cents)).padStart(13, "0");
}

export function commercialOriginatingBranch(code?: string | null): string {
  const digits = digitsOnly(code);
  if (!digits) return "";
  return digits.padStart(4, "0").slice(-4);
}

export function commercialSalaryReference(month: number, year: number): string {
  const abbr = MONTH_ABBR[month - 1] ?? String(month).padStart(2, "0");
  return `SALARY ${abbr} ${year}`;
}

export function commercialValueDate(month: number, year: number): string {
  const lastDay = new Date(year, month, 0).getDate();
  return `${pad2(lastDay)}${pad2(month)}${String(year).slice(-2)}`;
}

export function commercialInstructionFileName(now: Date = new Date()): string {
  const stamp = `${pad2(now.getDate())}${pad2(now.getMonth() + 1)}${String(now.getFullYear()).slice(-2)}-${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
  return `Commercial-Instruction-${stamp}.txt`;
}

function csvCell(value: string): string {
  const text = value.replace(/\r?\n/g, " ").trim();
  if (/[",]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function buildCommercialInstructionRows(
  rows: CommercialInstructionRow[],
  origin: CommercialInstructionOrigin,
  month: number,
  year: number,
): {
  data: string[][];
  included: number;
  skipped: number;
  missingBankOrBranch: number;
} {
  const originatingBank = sampathBankCode(origin.bankCode, origin.bankName) || COMMERCIAL_BANK_CODE;
  const originatingBranch = commercialOriginatingBranch(origin.branchCode);
  const originatingAccount = commercialInstructionAccount(origin.accountNumber);
  const originatingName = (origin.accountName ?? "").trim().toUpperCase();
  const reference = commercialSalaryReference(month, year);
  const valueDate = commercialValueDate(month, year);

  const data: string[][] = [];
  let skipped = 0;
  let missingBankOrBranch = 0;

  for (const [index, row] of rows.entries()) {
    const accountNumber = commercialInstructionAccount(row.accountNumber);
    if (!accountNumber || !Number.isFinite(row.amount)) {
      skipped += 1;
      continue;
    }
    const destBank = sampathBankCode(row.bankCode, row.bankName);
    const destBranch = sampathBranchCode(row.branchCode);
    if (!destBank || !destBranch || !originatingBank || !originatingBranch || !originatingAccount) {
      missingBankOrBranch += 1;
    }
    data.push([
      String(index).padStart(5, "0"),
      destBank,
      destBranch,
      accountNumber,
      (row.beneficiaryName ?? "").trim().toUpperCase(),
      SALARY_TRN_CODE,
      "00",
      "0",
      "000000",
      commercialInstructionAmount(row.amount),
      "SLR",
      originatingBank,
      originatingBranch,
      originatingAccount,
      originatingName,
      (row.particulars ?? "").trim(),
      reference,
      valueDate,
      "@",
    ]);
  }

  return { data, included: data.length, skipped, missingBankOrBranch };
}

/** Comma-separated Instruction Package text file matching Combiz column order. */
export function buildCommercialInstructionFile(
  rows: CommercialInstructionRow[],
  origin: CommercialInstructionOrigin,
  month: number,
  year: number,
): {
  content: string;
  included: number;
  skipped: number;
  missingBankOrBranch: number;
} {
  const built = buildCommercialInstructionRows(rows, origin, month, year);
  const lines = built.data.map((cells) => cells.map((cell) => csvCell(cell)).join(","));
  return {
    content: built.included > 0 ? `${lines.join("\r\n")}\r\n` : "",
    included: built.included,
    skipped: built.skipped,
    missingBankOrBranch: built.missingBankOrBranch,
  };
}

export function createCommercialInstructionDownload(
  rows: CommercialInstructionRow[],
  origin: CommercialInstructionOrigin,
  month: number,
  year: number,
  now: Date = new Date(),
): {
  filename: string;
  url: string;
  included: number;
  skipped: number;
  missingBankOrBranch: number;
} {
  const built = buildCommercialInstructionFile(rows, origin, month, year);
  const filename = commercialInstructionFileName(now);
  const blob = new Blob([built.content], { type: "text/plain;charset=utf-8" });
  return {
    filename,
    url: URL.createObjectURL(blob),
    included: built.included,
    skipped: built.skipped,
    missingBankOrBranch: built.missingBankOrBranch,
  };
}
