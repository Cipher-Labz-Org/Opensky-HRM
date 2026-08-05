export const BUSINESS_UNIT_ATTENDANCE_QR_TYPE = "opensky-hrm-attendance-bu";

export interface BusinessUnitAttendanceQrPayload {
  type: string;
  v: number;
  purpose?: string;
  businessUnitId: string;
  code?: string | null;
  sig?: string | null;
}

export function parseBusinessUnitAttendanceQr(raw: string): BusinessUnitAttendanceQrPayload | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let jsonText = trimmed;
  const payloadMatch = trimmed.match(/[?&]payload=([^&\s]+)/i);
  if (payloadMatch) {
    try {
      jsonText = decodeURIComponent(payloadMatch[1]);
    } catch {
      return null;
    }
  }

  if (!jsonText.startsWith("{")) return null;

  try {
    const parsed = JSON.parse(jsonText) as Partial<BusinessUnitAttendanceQrPayload>;
    const typeOk =
      parsed.type === BUSINESS_UNIT_ATTENDANCE_QR_TYPE || parsed.purpose === "attendance-bu";
    if (!typeOk || !parsed.businessUnitId) return null;
    return {
      type: String(parsed.type ?? BUSINESS_UNIT_ATTENDANCE_QR_TYPE),
      v: Number(parsed.v ?? 1),
      purpose: parsed.purpose,
      businessUnitId: String(parsed.businessUnitId),
      code: parsed.code ?? null,
      sig: parsed.sig ?? null,
    };
  } catch {
    return null;
  }
}
