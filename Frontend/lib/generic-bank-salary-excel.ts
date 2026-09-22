const MONTH_ABBR = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export const GENERIC_BANK_SALARY_HEADERS = [
  "Employee Code",
  "Employee Name",
  "Bank Name",
  "Account Number",
  "Bank Code",
  "Branch Code",
  "Branch",
  "Amount",
  "Narrative",
] as const;

export type GenericBankSalaryRow = {
  employeeCode?: string | null;
  employeeName?: string | null;
  bankName?: string | null;
  accountNumber?: string | null;
  bankCode?: string | null;
  branchCode?: string | null;
  branch?: string | null;
  amount: number;
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function monthAbbr(month: number): string {
  return MONTH_ABBR[month - 1] ?? String(month).padStart(3, "0");
}

function sanitizeFilePart(value: string): string {
  return value.replace(/[<>:"/\\|?*]+/g, " ").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export function genericBankAccountNumber(accountNumber?: string | null): string {
  return (accountNumber ?? "").replace(/[\s-]/g, "").trim();
}

export function genericBankSalaryNarrative(month: number, year: number): string {
  return `SALARY ${monthAbbr(month)} ${year}`;
}

export function genericBankSalaryFileName(bankName?: string | null, month?: number, year?: number, now: Date = new Date()): string {
  const bank = sanitizeFilePart((bankName ?? "").trim()) || "Bank";
  const period = month && year ? `${monthAbbr(month)}-${year}` : "";
  const stamp = `${pad2(now.getDate())}${pad2(now.getMonth() + 1)}${String(now.getFullYear()).slice(-2)}`;
  return [bank, "Salary", period, stamp].filter(Boolean).join("-") + ".xlsx";
}

export function formatGenericBankAmount(amount: number): string {
  const [whole, fraction] = Math.max(0, Number(amount) || 0).toFixed(2).split(".");
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction}`;
}

export function buildGenericBankSalaryRows(
  rows: GenericBankSalaryRow[],
  month: number,
  year: number,
): { data: Record<(typeof GENERIC_BANK_SALARY_HEADERS)[number], string | number>[]; included: number; skipped: number } {
  const narrative = genericBankSalaryNarrative(month, year);
  const data: Record<(typeof GENERIC_BANK_SALARY_HEADERS)[number], string | number>[] = [];
  let skipped = 0;
  for (const row of rows) {
    const accountNumber = genericBankAccountNumber(row.accountNumber);
    if (!accountNumber || !Number.isFinite(row.amount)) {
      skipped += 1;
      continue;
    }
    data.push({
      "Employee Code": (row.employeeCode ?? "").trim(),
      "Employee Name": (row.employeeName ?? "").trim(),
      "Bank Name": (row.bankName ?? "").trim(),
      "Account Number": accountNumber,
      "Bank Code": (row.bankCode ?? "").trim(),
      "Branch Code": (row.branchCode ?? "").trim(),
      Branch: (row.branch ?? "").trim(),
      Amount: Number(Number(row.amount).toFixed(2)),
      Narrative: narrative,
    });
  }
  return { data, included: data.length, skipped };
}

export async function createGenericBankSalaryExcelDownload(
  rows: GenericBankSalaryRow[],
  month: number,
  year: number,
  bankName?: string | null,
  now: Date = new Date(),
): Promise<{ filename: string; url: string; included: number; skipped: number }> {
  const built = buildGenericBankSalaryRows(rows, month, year);
  if (built.included === 0) {
    return { filename: genericBankSalaryFileName(bankName, month, year, now), url: "", included: 0, skipped: built.skipped };
  }
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(built.data, { header: [...GENERIC_BANK_SALARY_HEADERS] });
  ws["!cols"] = [
    { wch: 16 },
    { wch: 28 },
    { wch: 22 },
    { wch: 18 },
    { wch: 12 },
    { wch: 12 },
    { wch: 18 },
    { wch: 14 },
    { wch: 18 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Salary payments");
  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  const filename = genericBankSalaryFileName(bankName, month, year, now);
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  return {
    filename,
    url: URL.createObjectURL(blob),
    included: built.included,
    skipped: built.skipped,
  };
}
