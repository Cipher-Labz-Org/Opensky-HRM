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

export function parseCompanyBankAccounts(raw: string | undefined): CompanyBankAccount[] {
  if (!raw?.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry) => {
      const item = (entry ?? {}) as Record<string, unknown>;
      return {
        fullName: String(item.fullName ?? ""),
        bankName: String(item.bankName ?? ""),
        branchName: String(item.branchName ?? ""),
        bankCode: String(item.bankCode ?? ""),
        branchCode: String(item.branchCode ?? ""),
        accountNo: String(item.accountNo ?? ""),
      };
    });
  } catch {
    return [];
  }
}

export function isBlankBankAccount(account: CompanyBankAccount) {
  return Object.values(account).every((value) => !value.trim());
}

export function companyBankAccountLabel(account: CompanyBankAccount, index: number): string {
  return account.bankName.trim() || `Bank account ${index + 1}`;
}
