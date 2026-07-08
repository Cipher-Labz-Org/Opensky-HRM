export const DEFAULT_SALARY_CURRENCY = "LKR";

export const SALARY_CURRENCY_OPTIONS = ["LKR", "USD", "EUR", "GBP", "AUD"] as const;

export const SALARY_CURRENCY_FORM_OPTIONS = SALARY_CURRENCY_OPTIONS.map((code) => ({
  value: code,
  label: code,
}));

export type SalaryCurrencyCode = (typeof SALARY_CURRENCY_OPTIONS)[number];

export function normalizeSalaryCurrency(value: string | null | undefined): string {
  const code = value?.trim().toUpperCase();
  if (code && SALARY_CURRENCY_OPTIONS.includes(code as SalaryCurrencyCode)) return code;
  return DEFAULT_SALARY_CURRENCY;
}

export function formatSalaryRange(
  min: number | null | undefined,
  max: number | null | undefined,
  currency?: string | null,
): string | null {
  const cur = normalizeSalaryCurrency(currency);
  const hasMin = min != null && !Number.isNaN(Number(min));
  const hasMax = max != null && !Number.isNaN(Number(max));
  if (hasMin && hasMax) return `${cur} ${Number(min).toLocaleString()} – ${Number(max).toLocaleString()}`;
  if (hasMin) return `${cur} ${Number(min).toLocaleString()}+`;
  if (hasMax) return `Up to ${cur} ${Number(max).toLocaleString()}`;
  return null;
}
