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

/** Passport / visa document numbers: uppercase letters and digits only. */
export const PASSPORT_NUMBER_PATTERN = /^[A-Z0-9]+$/;

export const PASSPORT_NUMBER_VALIDATION_MESSAGE =
  "Can only contain uppercase letters (A–Z) and numbers (0–9)";

export function sanitizePassportNumberInput(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

export function isValidPassportNumber(value: string, required = false): boolean {
  const trimmed = value.trim();
  if (!trimmed) return !required;
  return PASSPORT_NUMBER_PATTERN.test(trimmed);
}

/** Letters, digits, spaces, hyphens, and apostrophes only. */
export const SEARCH_INPUT_PATTERN = /^[\p{L}\p{N}\s'\-]+$/u;

export const SEARCH_INPUT_VALIDATION_MESSAGE =
  "Search can only contain letters, numbers, spaces, hyphens, and apostrophes";

export function sanitizeSearchInput(value: string): string {
  return value.replace(/[^\p{L}\p{N}\s'\-]/gu, "");
}

export function isValidSearchInput(value: string, required = false): boolean {
  const trimmed = value.trim();
  if (!trimmed) return !required;
  return SEARCH_INPUT_PATTERN.test(trimmed);
}

/** Login username: letters, digits, @ and . only. */
export const USERNAME_PATTERN = /^[A-Za-z0-9@.]+$/;

export const USERNAME_VALIDATION_MESSAGE =
  "Username can only contain letters, numbers, @ and .";

export function sanitizeUsernameInput(value: string): string {
  return value.replace(/[^A-Za-z0-9@.]/g, "");
}

export function isValidUsername(value: string, required = false): boolean {
  const trimmed = value.trim();
  if (!trimmed) return !required;
  return USERNAME_PATTERN.test(trimmed);
}

/** Email address characters: letters, digits, @ and . only. */
export const EMAIL_INPUT_PATTERN = /^[A-Za-z0-9@.]+$/;

export const EMAIL_INPUT_VALIDATION_MESSAGE =
  "Email can only contain letters, numbers, @ and .";

export const EMAIL_FORMAT_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const EMAIL_FORMAT_VALIDATION_MESSAGE =
  "Enter a valid email address (e.g. name@company.com).";

export function sanitizeEmailInput(value: string): string {
  return value.replace(/[^A-Za-z0-9@.]/g, "");
}

export function isValidEmailInput(value: string, required = false): boolean {
  const trimmed = value.trim();
  if (!trimmed) return !required;
  return EMAIL_INPUT_PATTERN.test(trimmed);
}

export function isValidEmailFormat(value: string, required = false): boolean {
  const trimmed = value.trim();
  if (!trimmed) return !required;
  return EMAIL_FORMAT_PATTERN.test(trimmed);
}

/** International TIN: letters and digits only (country-specific formats vary). */
export const TIN_PATTERN = /^[A-Za-z0-9]+$/;

export const TIN_VALIDATION_MESSAGE =
  "TIN may only contain letters (A–Z) and numbers (0–9).";

export function sanitizeTinInput(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 50);
}

export function isValidTin(value: string, required = false): boolean {
  const trimmed = value.trim();
  if (!trimmed) return !required;
  const normalized = sanitizeTinInput(trimmed);
  return normalized.length > 0 && TIN_PATTERN.test(normalized);
}

/** EPFO-style fund number: XX/XXX/0000000/000/0000123 */
export const STATUTORY_FUND_NUMBER_PATTERN =
  /^[A-Z]{2}\/[A-Z]{3}\/\d{7}\/[A-Z0-9]{3}\/\d{7}$/;

export const EPF_VALIDATION_MESSAGE =
  "Enter a valid EPF number (e.g. MH/BAN/0000064/000/0000123).";

export const ETF_VALIDATION_MESSAGE =
  "Enter a valid ETF number (e.g. MH/BAN/0000064/000/0000123).";

export function sanitizeStatutoryFundNumberInput(value: string): string {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!compact) return "";

  let pos = 0;
  const takeLetters = (count: number) => {
    let out = "";
    while (out.length < count && pos < compact.length) {
      const ch = compact[pos]!;
      if (/[A-Z]/.test(ch)) {
        out += ch;
        pos += 1;
      } else {
        break;
      }
    }
    return out;
  };
  const takeDigits = (count: number) => {
    let out = "";
    while (out.length < count && pos < compact.length) {
      const ch = compact[pos]!;
      if (/\d/.test(ch)) {
        out += ch;
        pos += 1;
      } else {
        break;
      }
    }
    return out;
  };
  const takeExtension = (count: number) => {
    let out = "";
    while (out.length < count && pos < compact.length) {
      const ch = compact[pos]!;
      if (/[A-Z0-9]/.test(ch)) {
        out += ch;
        pos += 1;
      } else {
        break;
      }
    }
    return out;
  };

  const region = takeLetters(2);
  const office = takeLetters(3);
  const establishment = takeDigits(7);
  const extension = takeExtension(3);
  const member = takeDigits(7);

  return [region, office, establishment, extension, member].filter(Boolean).join("/");
}

export function isValidStatutoryFundNumber(value: string, required = false): boolean {
  const trimmed = value.trim();
  if (!trimmed) return !required;
  return STATUTORY_FUND_NUMBER_PATTERN.test(sanitizeStatutoryFundNumberInput(trimmed));
}

export const isValidEpfNumber = isValidStatutoryFundNumber;
export const isValidEtfNumber = isValidStatutoryFundNumber;
export const sanitizeEpfInput = sanitizeStatutoryFundNumberInput;
export const sanitizeEtfInput = sanitizeStatutoryFundNumberInput;

/** Street, city, polling division: letters, numbers, spaces, and . , - ' : & only. */
export const ADDRESS_TEXT_PATTERN = /^[\p{L}\p{N}\s.,'\-:&]+$/u;

export const ADDRESS_TEXT_VALIDATION_MESSAGE =
  "Can only contain letters, numbers, spaces, and . , - ' : &";

/** Postal / ZIP codes: same character set as address text. */
export const POSTAL_CODE_PATTERN = /^[\p{L}\p{N}\s.,'\-:&]+$/u;

export const POSTAL_CODE_VALIDATION_MESSAGE =
  "Can only contain letters, numbers, spaces, and . , - ' : &";

/** Distance in KM: positive number, optional decimal. */
export const DISTANCE_KM_PATTERN = /^\d+(\.\d+)?$/;

export const DISTANCE_KM_VALIDATION_MESSAGE =
  "Enter a valid distance in KM (e.g. 15 or 12.5)";

export function sanitizeAddressTextInput(value: string): string {
  return value.replace(/[^\p{L}\p{N}\s.,'\-:&]/gu, "");
}

export function sanitizePostalCodeInput(value: string): string {
  return value.replace(/[^\p{L}\p{N}\s.,'\-:&]/gu, "");
}

export function sanitizeDistanceKmInput(value: string): string {
  const cleaned = value.replace(/[^\d.]/g, "");
  const dot = cleaned.indexOf(".");
  if (dot === -1) return cleaned;
  return `${cleaned.slice(0, dot + 1)}${cleaned.slice(dot + 1).replace(/\./g, "")}`;
}

export function isValidAddressText(value: string, required = false): boolean {
  const trimmed = value.trim();
  if (!trimmed) return !required;
  return ADDRESS_TEXT_PATTERN.test(trimmed);
}

export function isValidPostalCode(value: string, required = false): boolean {
  const trimmed = value.trim();
  if (!trimmed) return !required;
  return POSTAL_CODE_PATTERN.test(trimmed);
}

export function isValidDistanceKm(value: string, required = false): boolean {
  const trimmed = value.trim();
  if (!trimmed) return !required;
  return DISTANCE_KM_PATTERN.test(trimmed);
}

export function validateEmployeeAddressFields(fields: {
  addressStreet1?: string | null;
  addressStreet2?: string | null;
  city?: string | null;
  zipPostalCode?: string | null;
  pollingDivision?: string | null;
  distanceToOffice?: string | null;
  permanentStreet1?: string | null;
  permanentStreet2?: string | null;
  permanentCity?: string | null;
  permanentZipPostalCode?: string | null;
  permanentPollingDivision?: string | null;
  permanentDistanceToOffice?: string | null;
}): string | null {
  const addressChecks: Array<[string, string | null | undefined]> = [
    ["Address Street 1", fields.addressStreet1],
    ["Address Street 2", fields.addressStreet2],
    ["City", fields.city],
    ["Polling Division", fields.pollingDivision],
    ["Permanent Address Street 1", fields.permanentStreet1],
    ["Permanent Address Street 2", fields.permanentStreet2],
    ["Permanent City", fields.permanentCity],
    ["Permanent Polling Division", fields.permanentPollingDivision],
  ];
  for (const [label, value] of addressChecks) {
    const trimmed = (value ?? "").trim();
    if (trimmed && !isValidAddressText(trimmed)) {
      return `${label}: ${ADDRESS_TEXT_VALIDATION_MESSAGE}`;
    }
  }

  const postalChecks: Array<[string, string | null | undefined]> = [
    ["Zip/Postal Code", fields.zipPostalCode],
    ["Permanent Zip/Postal Code", fields.permanentZipPostalCode],
  ];
  for (const [label, value] of postalChecks) {
    const trimmed = (value ?? "").trim();
    if (trimmed && !isValidPostalCode(trimmed)) {
      return `${label}: ${POSTAL_CODE_VALIDATION_MESSAGE}`;
    }
  }

  const distanceChecks: Array<[string, string | null | undefined]> = [
    ["Distance to Office (KM)", fields.distanceToOffice],
    ["Permanent Distance to Office (KM)", fields.permanentDistanceToOffice],
  ];
  for (const [label, value] of distanceChecks) {
    const trimmed = (value ?? "").trim();
    if (trimmed && !isValidDistanceKm(trimmed)) {
      return `${label}: ${DISTANCE_KM_VALIDATION_MESSAGE}`;
    }
  }

  return null;
}
