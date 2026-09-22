export type CompanyBankAccount = {
  fullName: string;
  bankName: string;
  branchName: string;
  bankCode: string;
  branchCode: string;
  accountNo: string;
};

export const EMPTY_BANK_ACCOUNT: CompanyBankAccount = {
  fullName: "",
  bankName: "",
  branchName: "",
  bankCode: "",
  branchCode: "",
  accountNo: "",
};

function readAccountField(item: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = item[key];
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

function toAccountList(parsed: unknown): CompanyBankAccount[] {
  if (!Array.isArray(parsed)) return [];
  return parsed.map((entry) => {
    const item = (entry ?? {}) as Record<string, unknown>;
    return {
      fullName: readAccountField(item, "fullName", "FullName"),
      bankName: readAccountField(item, "bankName", "BankName"),
      branchName: readAccountField(item, "branchName", "BranchName"),
      bankCode: readAccountField(item, "bankCode", "BankCode"),
      branchCode: readAccountField(item, "branchCode", "BranchCode"),
      accountNo: readAccountField(item, "accountNo", "AccountNo", "accountNumber", "AccountNumber"),
    };
  });
}

export function parseCompanyBankAccounts(raw: unknown): CompanyBankAccount[] {
  let value: unknown = raw;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      value = JSON.parse(trimmed);
      if (typeof value === "string") value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  return toAccountList(value);
}

export function companyBankAccountsFromSettings(settings: Record<string, unknown> | null | undefined): CompanyBankAccount[] {
  if (!settings) return [];
  const match = Object.entries(settings).find(([key]) => key.toLowerCase() === "companybankaccounts");
  return parseCompanyBankAccounts(match?.[1]).filter((account) => !isBlankBankAccount(account));
}

export function isBlankBankAccount(account: CompanyBankAccount) {
  return Object.values(account).every((value) => !value.trim());
}

export function companyBankAccountLabel(account: CompanyBankAccount, index: number): string {
  return account.bankName.trim() || `Bank account ${index + 1}`;
}
