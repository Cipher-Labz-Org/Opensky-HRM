/** Letters, spaces, hyphens, and apostrophes only. */
export const PERSON_NAME_PATTERN = /^[A-Za-z\s'\-]+$/;

/** International: + followed by 8–15 digits (first digit after + is 1–9). */
export const PHONE_INTL_PATTERN = /^\+[1-9]\d{7,14}$/;

/** Local: 8–15 digits, no country prefix. */
export const PHONE_LOCAL_PATTERN = /^\d{8,15}$/;

export const PHONE_MIN_DIGITS = 8;
export const PHONE_MAX_DIGITS = 15;

export const PHONE_VALIDATION_MESSAGE =
  "Enter 8–15 digits. Examples: +94112876663 or 0762535363";

export function sanitizePersonName(value: string): string {
  return value.replace(/[^A-Za-z\s'\-]/g, "");
}

export function sanitizePhoneInput(value: string): string {
  const raw = value.replace(/[^\d+]/g, "");
  const startsWithPlus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "").slice(0, PHONE_MAX_DIGITS);
  return startsWithPlus ? `+${digits}` : digits;
}

export function isValidPersonName(value: string, required = true): boolean {
  const trimmed = value.trim();
  if (!trimmed) return !required;
  return PERSON_NAME_PATTERN.test(trimmed);
}

export function isValidPhone(value: string, required = false): boolean {
  const trimmed = value.trim();
  if (!trimmed) return !required;
  return trimmed.startsWith("+")
    ? PHONE_INTL_PATTERN.test(trimmed)
    : PHONE_LOCAL_PATTERN.test(trimmed);
}

export function phoneDigitCount(value: string): number {
  return value.replace(/\D/g, "").length;
}

/** Old NIC: 9 digits + V/X. New NIC: 12 digits. */
export const NIC_PATTERN = /^(\d{9}[VvXx]|\d{12})$/;

export const NIC_VALIDATION_MESSAGE =
  "Enter a valid NIC (9 digits + V/X or 12 digits)";

export function sanitizeNicInput(value: string): string {
  const raw = value.replace(/[^\dVvXx]/g, "");
  if (!raw) return "";

  const lastChar = raw.slice(-1);
  if (/[VvXx]/.test(lastChar)) {
    const digits = raw.slice(0, -1).replace(/[VvXx]/g, "").slice(0, 9);
    return digits + lastChar.toUpperCase();
  }

  return raw.replace(/[VvXx]/g, "").slice(0, 12);
}

export function isValidNic(value: string, required = false): boolean {
  const trimmed = value.trim();
  if (!trimmed) return !required;
  return NIC_PATTERN.test(trimmed);
}

export const DRIVING_LICENSE_PATTERN = /^[A-Za-z0-9]+$/;

export const DRIVING_LICENSE_VALIDATION_MESSAGE =
  "Can only contain letters and numbers";

export function sanitizeDrivingLicenseInput(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, "");
}

export function isValidDrivingLicense(value: string, required = false): boolean {
  const trimmed = value.trim();
  if (!trimmed) return !required;
  return DRIVING_LICENSE_PATTERN.test(trimmed);
}
