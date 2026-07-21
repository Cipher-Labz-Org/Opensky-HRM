import {
  sanitizeAddressTextInput,
  sanitizeDistanceKmInput,
  sanitizePostalCodeInput,
  validateEmployeeAddressFields,
} from "@/lib/input-validation";

export type EmployeeAddressFieldValues = {
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
};

function trimOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}

/** Normalize employee address text fields before API save (all entry points). */
export function sanitizeEmployeeAddressFields<T extends EmployeeAddressFieldValues>(fields: T): T {
  return {
    ...fields,
    addressStreet1: trimOrNull(sanitizeAddressTextInput(String(fields.addressStreet1 ?? ""))),
    addressStreet2: trimOrNull(sanitizeAddressTextInput(String(fields.addressStreet2 ?? ""))),
    city: trimOrNull(sanitizeAddressTextInput(String(fields.city ?? ""))),
    zipPostalCode: trimOrNull(sanitizePostalCodeInput(String(fields.zipPostalCode ?? ""))),
    pollingDivision: trimOrNull(sanitizeAddressTextInput(String(fields.pollingDivision ?? ""))),
    distanceToOffice: trimOrNull(sanitizeDistanceKmInput(String(fields.distanceToOffice ?? ""))),
    permanentStreet1: trimOrNull(sanitizeAddressTextInput(String(fields.permanentStreet1 ?? ""))),
    permanentStreet2: trimOrNull(sanitizeAddressTextInput(String(fields.permanentStreet2 ?? ""))),
    permanentCity: trimOrNull(sanitizeAddressTextInput(String(fields.permanentCity ?? ""))),
    permanentZipPostalCode: trimOrNull(sanitizePostalCodeInput(String(fields.permanentZipPostalCode ?? ""))),
    permanentPollingDivision: trimOrNull(sanitizeAddressTextInput(String(fields.permanentPollingDivision ?? ""))),
    permanentDistanceToOffice: trimOrNull(sanitizeDistanceKmInput(String(fields.permanentDistanceToOffice ?? ""))),
  };
}

export { validateEmployeeAddressFields };

export function distanceKmInputValue(value: string | null | undefined): string {
  if (!value?.trim()) return "";
  const match = value.trim().match(/^(\d+(?:\.\d+)?)/);
  return match?.[1] ?? "";
}
