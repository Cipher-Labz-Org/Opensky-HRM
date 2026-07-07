export type CurrencyOption = { value: string; label: string };

/** ISO 4217 codes commonly used in OpenSky HRM deployments. */
export const CURRENCY_OPTIONS: CurrencyOption[] = [
  { value: "LKR", label: "LKR — Sri Lankan Rupee" },
  { value: "USD", label: "USD — US Dollar" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "GBP", label: "GBP — British Pound" },
  { value: "AUD", label: "AUD — Australian Dollar" },
  { value: "SGD", label: "SGD — Singapore Dollar" },
  { value: "INR", label: "INR — Indian Rupee" },
  { value: "AED", label: "AED — UAE Dirham" },
  { value: "SAR", label: "SAR — Saudi Riyal" },
  { value: "MYR", label: "MYR — Malaysian Ringgit" },
];

export const DEFAULT_CURRENCY = "LKR";

export function currencySelectOptions(): CurrencyOption[] {
  return CURRENCY_OPTIONS;
}
