export const SRI_LANKA_BANK_NAMES = [
  "Bank of Ceylon",
  "People's Bank",
  "Commercial Bank",
  "Hatton National Bank",
  "Sampath Bank",
  "Seylan Bank",
  "Nations Trust Bank",
  "DFCC Bank",
  "National Development Bank",
  "Pan Asia Banking Corporation",
  "Union Bank",
  "Amana Bank",
  "Cargills Bank",
  "HSBC",
  "Standard Chartered Bank",
  "Citibank",
  "Deutsche Bank",
  "Other",
] as const;

export function bankNameOptions(extra: Array<string | null | undefined> = []): string[] {
  const names = new Set<string>(SRI_LANKA_BANK_NAMES);
  for (const name of extra) {
    const trimmed = name?.trim();
    if (trimmed) names.add(trimmed);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

export function isCommercialBankName(bankName?: string | null): boolean {
  const name = (bankName ?? "").trim().toLowerCase();
  if (!name) return false;
  if (name.includes("combank")) return true;
  return /\bcommercial(\s+bank(\s+of\s+ceylon)?)?\b/.test(name);
}
