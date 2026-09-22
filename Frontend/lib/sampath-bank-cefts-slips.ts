/** Columns in the Sampath Vishwa salary deposit text file. */
export const SAMPATH_CEFTS_SLIPS_HEADERS = [
  "REF",
  "BENEFICIARY NAME",
  "ACCOUNT NO",
  "BANK CODE",
  "BRANCH CODE",
  "AMOUNT",
  "REMARKS",
  "TYPE",
] as const;

const MONTH_ABBR = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** LankaPay 4-digit bank codes used when the employee record has a bank name but no code. */
const BANK_CODE_BY_NAME: Array<{ test: RegExp; code: string }> = [
  { test: /\bbank of ceylon\b|\bboc\b/, code: "7010" },
  { test: /\bstandard chartered\b/, code: "7038" },
  { test: /\bciti(bank)?\b/, code: "7047" },
  { test: /\bcommercial(\s+bank)?\b|\bcombank\b/, code: "7056" },
  { test: /\bhatton national\b|\bhnb\b/, code: "7083" },
  { test: /\bhsbc\b|\bhongkong\b/, code: "7092" },
  { test: /\bpeople'?s bank\b/, code: "7135" },
  { test: /\bnations trust\b|\bntb\b/, code: "7162" },
  { test: /\bnational development\b|\bndb\b/, code: "7214" },
  { test: /\bsampath\b/, code: "7278" },
  { test: /\bseylan\b/, code: "7287" },
  { test: /\bunion bank\b/, code: "7302" },
  { test: /\bpan asia\b/, code: "7311" },
  { test: /\bdfcc\b/, code: "7454" },
  { test: /\bamana\b/, code: "7463" },
  { test: /\bcargills\b/, code: "7481" },
];

export type SampathCeftsSlipsRow = {
  companyRef?: string | null;
  beneficiaryName?: string | null;
  accountNumber?: string | null;
  bankCode?: string | null;
  branchCode?: string | null;
  bankName?: string | null;
  amount: number;
  remarks?: string | null;
  nic?: string | null;
  senderMobile?: string | null;
  receiverMobile?: string | null;
  beneficiaryEmail?: string | null;
};

export function readJsonField(row: Record<string, unknown> | undefined, ...keys: string[]): string {
  if (!row) return "";
  for (const key of keys) {
    const value = row[key];
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

export function sampathAccountNumber(accountNumber?: string | null): string {
  return (accountNumber ?? "").replace(/[\s-]/g, "").trim();
}

export function sampathBankCode(code?: string | null, bankName?: string | null): string {
  const digits = (code ?? "").replace(/\D/g, "");
  if (digits) return digits.padStart(4, "0").slice(-4);
  const name = (bankName ?? "").trim().toLowerCase();
  if (!name) return "";
  return BANK_CODE_BY_NAME.find((entry) => entry.test.test(name))?.code ?? "";
}

export function sampathBranchCode(code?: string | null): string {
  const digits = (code ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.padStart(3, "0").slice(-3);
}

export function sampathNic(nic?: string | null): string {
  return (nic ?? "").replace(/\s+/g, "").trim().toUpperCase();
}

export function sampathMobile(phone?: string | null): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("94") && digits.length >= 11) return `0${digits.slice(2, 11)}`;
  if (digits.length === 9 && digits.startsWith("7")) return `0${digits}`;
  return digits;
}

export function sampathSalaryRemarks(month: number, year: number): string {
  const abbr = MONTH_ABBR[month - 1] ?? String(month).padStart(2, "0");
  return `SALARY ${abbr} ${year}`;
}

/** Company reference used in the Sampath salary deposit file, e.g. SAL_SEP. */
export function sampathSalaryRef(month: number): string {
  const abbr = MONTH_ABBR[month - 1] ?? String(month).padStart(2, "0");
  return `SAL_${abbr}`;
}

export const SAMPATH_BANK_CODE = "7278";

/** SBA = credit to a Sampath account. SLI = SLIPS to another bank. */
export function sampathCreditMode(bankCode?: string | null, bankName?: string | null): "SBA" | "SLI" {
  return sampathBankCode(bankCode, bankName) === SAMPATH_BANK_CODE ? "SBA" : "SLI";
}

export function formatSampathAmount(amount: number): string {
  return Math.max(0, Number(amount) || 0).toFixed(2);
}

/** Amount as in the bank file: 7 digits + . + 2, e.g. 0189678.24 */
export function formatSampathFileAmount(amount: number): string {
  const [whole, fraction] = formatSampathAmount(amount).split(".");
  return `${whole.padStart(7, "0")}.${fraction}`;
}

export function sampathFileAccount(accountNumber?: string | null): string {
  const digits = sampathAccountNumber(accountNumber);
  if (!digits) return "";
  return digits.length >= 12 ? digits : digits.padStart(12, "0");
}

function padField(value: string, width: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, width).padEnd(width, " ");
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function sampathCeftsSlipsFileName(now: Date = new Date()): string {
  const stamp = `${pad2(now.getDate())}${pad2(now.getMonth() + 1)}${String(now.getFullYear()).slice(-2)}-${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
  return `Sampath-CEFTS-SLIPS-${stamp}.txt`;
}

export function buildSampathCeftsSlipsRows(rows: SampathCeftsSlipsRow[]): {
  data: string[][];
  included: number;
  skipped: number;
  missingBankOrBranch: number;
} {
  const data: string[][] = [];
  let skipped = 0;
  let missingBankOrBranch = 0;
  for (const row of rows) {
    const accountNumber = sampathAccountNumber(row.accountNumber);
    if (!accountNumber || !Number.isFinite(row.amount)) {
      skipped += 1;
      continue;
    }
    const bankCode = sampathBankCode(row.bankCode, row.bankName);
    const branchCode = sampathBranchCode(row.branchCode);
    if (!bankCode || !branchCode) missingBankOrBranch += 1;
    data.push([
      (row.companyRef ?? "").trim(),
      (row.beneficiaryName ?? "").trim(),
      sampathFileAccount(accountNumber),
      bankCode,
      branchCode,
      formatSampathFileAmount(row.amount),
      (row.remarks ?? row.companyRef ?? "").trim(),
      sampathCreditMode(bankCode, row.bankName),
    ]);
  }
  return { data, included: data.length, skipped, missingBankOrBranch };
}

/**
 * Sampath Vishwa salary deposit file (no header):
 * REF NAME ACCOUNT BANK BRANCH AMOUNT REMARKS SBA|SLI
 */
export function buildSampathCeftsSlipsFile(rows: SampathCeftsSlipsRow[]): {
  content: string;
  included: number;
  skipped: number;
  missingBankOrBranch: number;
} {
  const built = buildSampathCeftsSlipsRows(rows);
  const lines = built.data.map((cells) =>
    [
      padField(cells[0], 12),
      padField(cells[1], 30),
      cells[2],
      cells[3],
      cells[4],
      cells[5],
      padField(cells[6], 12),
      cells[7],
    ].join(" "),
  );
  return {
    content: built.included > 0 ? `${lines.join("\r\n")}\r\n` : "",
    included: built.included,
    skipped: built.skipped,
    missingBankOrBranch: built.missingBankOrBranch,
  };
}

export function createSampathCeftsSlipsDownload(
  content: string,
  now: Date = new Date(),
): { filename: string; url: string } {
  const filename = sampathCeftsSlipsFileName(now);
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  return { filename, url: URL.createObjectURL(blob) };
}
