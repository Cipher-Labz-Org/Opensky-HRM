export type CurrencyType =
  | "Asia Pacific"
  | "Europe"
  | "Americas"
  | "Middle East"
  | "Africa"
  | "Oceania";

export type CurrencyDefinition = {
  code: string;
  name: string;
  type: CurrencyType;
};

export type CurrencyOption = { value: string; label: string };

/** Unified ISO 4217 list — merged from all OpenSky currency pickers. */
export const CURRENCY_DEFINITIONS: CurrencyDefinition[] = [
  // Asia Pacific
  { code: "LKR", name: "Sri Lankan Rupee", type: "Asia Pacific" },
  { code: "INR", name: "Indian Rupee", type: "Asia Pacific" },
  { code: "SGD", name: "Singapore Dollar", type: "Asia Pacific" },
  { code: "MYR", name: "Malaysian Ringgit", type: "Asia Pacific" },
  { code: "JPY", name: "Japanese Yen", type: "Asia Pacific" },
  { code: "CNY", name: "Chinese Yuan", type: "Asia Pacific" },
  { code: "HKD", name: "Hong Kong Dollar", type: "Asia Pacific" },
  { code: "THB", name: "Thai Baht", type: "Asia Pacific" },
  { code: "PHP", name: "Philippine Peso", type: "Asia Pacific" },
  { code: "PKR", name: "Pakistani Rupee", type: "Asia Pacific" },
  { code: "BDT", name: "Bangladeshi Taka", type: "Asia Pacific" },
  { code: "NPR", name: "Nepalese Rupee", type: "Asia Pacific" },
  { code: "IDR", name: "Indonesian Rupiah", type: "Asia Pacific" },
  { code: "VND", name: "Vietnamese Dong", type: "Asia Pacific" },
  { code: "KRW", name: "South Korean Won", type: "Asia Pacific" },
  { code: "TWD", name: "New Taiwan Dollar", type: "Asia Pacific" },
  { code: "MMK", name: "Myanmar Kyat", type: "Asia Pacific" },
  // Europe
  { code: "EUR", name: "Euro", type: "Europe" },
  { code: "GBP", name: "British Pound", type: "Europe" },
  { code: "CHF", name: "Swiss Franc", type: "Europe" },
  { code: "SEK", name: "Swedish Krona", type: "Europe" },
  { code: "NOK", name: "Norwegian Krone", type: "Europe" },
  { code: "DKK", name: "Danish Krone", type: "Europe" },
  { code: "PLN", name: "Polish Zloty", type: "Europe" },
  { code: "CZK", name: "Czech Koruna", type: "Europe" },
  { code: "HUF", name: "Hungarian Forint", type: "Europe" },
  { code: "RON", name: "Romanian Leu", type: "Europe" },
  { code: "RUB", name: "Russian Ruble", type: "Europe" },
  // Americas
  { code: "USD", name: "US Dollar", type: "Americas" },
  { code: "CAD", name: "Canadian Dollar", type: "Americas" },
  { code: "MXN", name: "Mexican Peso", type: "Americas" },
  { code: "BRL", name: "Brazilian Real", type: "Americas" },
  { code: "ARS", name: "Argentine Peso", type: "Americas" },
  { code: "CLP", name: "Chilean Peso", type: "Americas" },
  { code: "COP", name: "Colombian Peso", type: "Americas" },
  { code: "PEN", name: "Peruvian Sol", type: "Americas" },
  // Middle East
  { code: "AED", name: "UAE Dirham", type: "Middle East" },
  { code: "SAR", name: "Saudi Riyal", type: "Middle East" },
  { code: "QAR", name: "Qatari Riyal", type: "Middle East" },
  { code: "KWD", name: "Kuwaiti Dinar", type: "Middle East" },
  { code: "BHD", name: "Bahraini Dinar", type: "Middle East" },
  { code: "OMR", name: "Omani Rial", type: "Middle East" },
  { code: "JOD", name: "Jordanian Dinar", type: "Middle East" },
  { code: "ILS", name: "Israeli Shekel", type: "Middle East" },
  // Africa
  { code: "ZAR", name: "South African Rand", type: "Africa" },
  { code: "NGN", name: "Nigerian Naira", type: "Africa" },
  { code: "KES", name: "Kenyan Shilling", type: "Africa" },
  { code: "EGP", name: "Egyptian Pound", type: "Africa" },
  { code: "GHS", name: "Ghanaian Cedi", type: "Africa" },
  { code: "MAD", name: "Moroccan Dirham", type: "Africa" },
  { code: "TZS", name: "Tanzanian Shilling", type: "Africa" },
  // Oceania
  { code: "AUD", name: "Australian Dollar", type: "Oceania" },
  { code: "NZD", name: "New Zealand Dollar", type: "Oceania" },
  { code: "FJD", name: "Fijian Dollar", type: "Oceania" },
];

export const DEFAULT_CURRENCY = "LKR";

const currencyByCode = new Map(CURRENCY_DEFINITIONS.map((c) => [c.code, c]));

export function getCurrencyByCode(code: string | null | undefined): CurrencyDefinition | undefined {
  const normalized = code?.trim().toUpperCase();
  if (!normalized) return undefined;
  return currencyByCode.get(normalized);
}

export function formatCurrencyLabel(def: CurrencyDefinition): string {
  return `${def.code} — ${def.name}`;
}

export function currencySelectOptions(): CurrencyOption[] {
  return CURRENCY_DEFINITIONS.map((c) => ({
    value: c.code,
    label: formatCurrencyLabel(c),
  }));
}

export function filterCurrencies(query: string, typeFilter?: CurrencyType | "all"): CurrencyDefinition[] {
  const q = query.trim().toLowerCase();
  return CURRENCY_DEFINITIONS.filter((c) => {
    if (typeFilter && typeFilter !== "all" && c.type !== typeFilter) return false;
    if (!q) return true;
    return (
      c.code.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      c.type.toLowerCase().includes(q)
    );
  });
}

export const CURRENCY_TYPE_OPTIONS: { value: CurrencyType | "all"; label: string }[] = [
  { value: "all", label: "All regions" },
  { value: "Asia Pacific", label: "Asia Pacific" },
  { value: "Europe", label: "Europe" },
  { value: "Americas", label: "Americas" },
  { value: "Middle East", label: "Middle East" },
  { value: "Africa", label: "Africa" },
  { value: "Oceania", label: "Oceania" },
];

export function normalizeCurrencyCode(value: string | null | undefined): string {
  const code = value?.trim().toUpperCase();
  if (code && currencyByCode.has(code)) return code;
  return DEFAULT_CURRENCY;
}
