import { PRIMARY_COMPANY_PROFILE_KEY } from "@/lib/additional-company-profiles";

export type CompanyBankAccount = {
  fullName: string;
  bankName: string;
  branchName: string;
  bankCode: string;
  branchCode: string;
  accountNo: string;
  /** Which company profile owns this account (primary when omitted). */
  companyProfileKey?: string;
};

export const EMPTY_BANK_ACCOUNT: CompanyBankAccount = {
  fullName: "",
  bankName: "",
  branchName: "",
  bankCode: "",
  branchCode: "",
  accountNo: "",
  companyProfileKey: PRIMARY_COMPANY_PROFILE_KEY,
};

export function resolveCompanyBankProfileKey(account: CompanyBankAccount): string {
  const key = account.companyProfileKey?.trim();
  return key || PRIMARY_COMPANY_PROFILE_KEY;
}

export function filterCompanyBankAccountsForProfile(
  accounts: CompanyBankAccount[],
  profileKey: string,
): CompanyBankAccount[] {
  const key = profileKey.trim() || PRIMARY_COMPANY_PROFILE_KEY;
  return accounts.filter((account) => resolveCompanyBankProfileKey(account) === key);
}

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
    const companyProfileKey =
      readAccountField(item, "companyProfileKey", "CompanyProfileKey") || PRIMARY_COMPANY_PROFILE_KEY;
    return {
      fullName: readAccountField(item, "fullName", "FullName"),
      bankName: readAccountField(item, "bankName", "BankName"),
      branchName: readAccountField(item, "branchName", "BranchName"),
      bankCode: readAccountField(item, "bankCode", "BankCode"),
      branchCode: readAccountField(item, "branchCode", "BranchCode"),
      accountNo: readAccountField(item, "accountNo", "AccountNo", "accountNumber", "AccountNumber"),
      companyProfileKey,
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
  const { companyProfileKey: _companyProfileKey, ...rest } = account;
  return Object.values(rest).every((value) => !String(value).trim());
}

export function companyBankAccountLabel(account: CompanyBankAccount, index: number): string {
  return account.bankName.trim() || `Bank account ${index + 1}`;
}
