import {
  CURRENCY_DEFINITIONS,
  DEFAULT_CURRENCY,
  normalizeCurrencyCode,
} from "./currencies";

export const DEFAULT_SALARY_CURRENCY = DEFAULT_CURRENCY;

export const SALARY_CURRENCY_OPTIONS = CURRENCY_DEFINITIONS.map((c) => c.code);

export const SALARY_CURRENCY_FORM_OPTIONS = CURRENCY_DEFINITIONS.map((c) => ({
  value: c.code,
  label: c.code,
}));

export type SalaryCurrencyCode = string;

export function normalizeSalaryCurrency(value: string | null | undefined): string {
  return normalizeCurrencyCode(value);
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
