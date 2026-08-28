import type { AttendanceQrPayload } from "./attendanceQr";

export type EmployeeQrScope = {
  businessUnitId?: string | null;
  locationId?: string | null;
  businessUnitName?: string | null;
  locationName?: string | null;
};

function sameId(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Returns an error message when the scanned QR does not match the employee's assigned BU/location.
 * Returns null when the scan is allowed.
 */
export function validateAttendanceQrForEmployee(
  parsed: AttendanceQrPayload,
  employee: EmployeeQrScope
): string | null {
  if (parsed.kind === "location") {
    if (!employee.locationId) {
      return "Your employee profile has no location assigned. Contact HR before checking in.";
    }
    if (!sameId(employee.locationId, parsed.locationId)) {
      const assigned = employee.locationName?.trim();
      return assigned
        ? `This QR code is not for your location. You must scan the QR at "${assigned}".`
        : "This QR code belongs to a different location. Scan the QR at your assigned location.";
    }
    return null;
  }

  if (!employee.businessUnitId) {
    return "Your employee profile has no business unit assigned. Contact HR before checking in.";
  }
  if (!sameId(employee.businessUnitId, parsed.businessUnitId)) {
    const assigned = employee.businessUnitName?.trim();
    return assigned
      ? `This QR code is not for your business unit. You must scan the QR at "${assigned}".`
      : "This QR code belongs to a different business unit. Scan the QR at your assigned business unit.";
  }

  return null;
}
