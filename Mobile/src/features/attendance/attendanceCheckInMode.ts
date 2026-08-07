export type AttendanceCheckInMode =
  | "Open"
  | "LocationGeofence"
  | "BusinessUnitQr"
  | "BusinessUnitGeofence"
  | "Hybrid";

const VALID_MODES = new Set<AttendanceCheckInMode>([
  "Open",
  "LocationGeofence",
  "BusinessUnitQr",
  "BusinessUnitGeofence",
  "Hybrid",
]);

export function normalizeCheckInMode(mode: string | null | undefined): AttendanceCheckInMode {
  if (mode && VALID_MODES.has(mode as AttendanceCheckInMode)) {
    return mode as AttendanceCheckInMode;
  }
  // Safer default for ESS: require attendance QR (business unit or location).
  return "BusinessUnitQr";
}

export function modeRequiresQr(mode: AttendanceCheckInMode): boolean {
  // Open also uses QR on mobile so users cannot punch from a plain button.
  return mode === "BusinessUnitQr" || mode === "Hybrid" || mode === "Open";
}

export function modeRequiresGps(mode: AttendanceCheckInMode): boolean {
  return mode === "LocationGeofence" || mode === "BusinessUnitGeofence" || mode === "Hybrid";
}

export function modeAllowsDirectPunch(mode: AttendanceCheckInMode): boolean {
  // Only pure geofence modes allow tap-to-punch (no QR).
  return mode === "LocationGeofence" || mode === "BusinessUnitGeofence";
}

export function checkInModeHint(mode: AttendanceCheckInMode): string {
  switch (mode) {
    case "Open":
      return "Scan a business unit or location attendance QR to punch in or out.";
    case "LocationGeofence":
      return "You must be at your assigned location to punch in or out.";
    case "BusinessUnitQr":
      return "Scan a business unit or location attendance QR to punch in or out.";
    case "BusinessUnitGeofence":
      return "You must be at your business unit location to punch in or out.";
    case "Hybrid":
      return "Scan a business unit or location QR and stay within the geofence.";
    default:
      return "Scan an attendance QR to punch in or out.";
  }
}
