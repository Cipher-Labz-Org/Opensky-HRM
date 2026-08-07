export const BUSINESS_UNIT_ATTENDANCE_QR_TYPE = "opensky-hrm-attendance-bu";
export const LOCATION_ATTENDANCE_QR_TYPE = "opensky-hrm-attendance-location";

export interface BusinessUnitAttendanceQrPayload {
  type: string;
  v: number;
  purpose?: string;
  businessUnitId: string;
  code?: string | null;
  sig?: string | null;
}

export interface LocationAttendanceQrPayload {
  type: string;
  v: number;
  purpose?: string;
  locationId: string;
  code?: string | null;
  sig?: string | null;
}

export type AttendanceQrPayload =
  | ({ kind: "businessUnit" } & BusinessUnitAttendanceQrPayload)
  | ({ kind: "location" } & LocationAttendanceQrPayload);

function extractJson(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("{")) return trimmed;

  const payloadMatch = trimmed.match(/[?&]payload=([^&\s]+)/i);
  if (!payloadMatch) return null;

  try {
    return decodeURIComponent(payloadMatch[1]);
  } catch {
    return null;
  }
}

export function parseBusinessUnitAttendanceQr(raw: string): BusinessUnitAttendanceQrPayload | null {
  const parsed = parseAttendanceQr(raw);
  return parsed?.kind === "businessUnit" ? parsed : null;
}

export function parseAttendanceQr(raw: string): AttendanceQrPayload | null {
  const jsonText = extractJson(raw);
  if (!jsonText?.startsWith("{")) return null;

  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    const type = String(parsed.type ?? "").toLowerCase();
    const purpose = parsed.purpose != null ? String(parsed.purpose).toLowerCase() : undefined;
    const locationId = parsed.locationId != null ? String(parsed.locationId) : "";
    const businessUnitId = parsed.businessUnitId != null ? String(parsed.businessUnitId) : "";

    const isLocation =
      type === LOCATION_ATTENDANCE_QR_TYPE.toLowerCase() ||
      purpose === "attendance-location" ||
      (Boolean(locationId) && !businessUnitId);

    if (isLocation && locationId) {
      return {
        kind: "location",
        type: type || LOCATION_ATTENDANCE_QR_TYPE,
        v: Number(parsed.v ?? 1),
        purpose: parsed.purpose != null ? String(parsed.purpose) : undefined,
        locationId,
        code: parsed.code != null ? String(parsed.code) : null,
        sig: parsed.sig != null ? String(parsed.sig) : null,
      };
    }

    const isBusinessUnit =
      type === BUSINESS_UNIT_ATTENDANCE_QR_TYPE.toLowerCase() ||
      purpose === "attendance-bu" ||
      (Boolean(businessUnitId) && !locationId);

    if (isBusinessUnit && businessUnitId) {
      return {
        kind: "businessUnit",
        type: type || BUSINESS_UNIT_ATTENDANCE_QR_TYPE,
        v: Number(parsed.v ?? 1),
        purpose: parsed.purpose != null ? String(parsed.purpose) : undefined,
        businessUnitId,
        code: parsed.code != null ? String(parsed.code) : null,
        sig: parsed.sig != null ? String(parsed.sig) : null,
      };
    }

    return null;
  } catch {
    return null;
  }
}
