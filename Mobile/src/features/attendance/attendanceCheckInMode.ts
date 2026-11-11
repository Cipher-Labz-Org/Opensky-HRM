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
  return mode === "BusinessUnitQr" || mode === "Hybrid";
}

export function modeRequiresGps(mode: AttendanceCheckInMode): boolean {
  return mode === "LocationGeofence" || mode === "BusinessUnitGeofence" || mode === "Hybrid";
}

export function modeAllowsDirectPunch(mode: AttendanceCheckInMode): boolean {
  return mode === "Open" || mode === "LocationGeofence" || mode === "BusinessUnitGeofence";
}

export function checkInModeHint(mode: AttendanceCheckInMode): string {
  switch (mode) {
    case "Open":
      return "Tap Punch in or Punch out. No QR scan or location check is required.";
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
