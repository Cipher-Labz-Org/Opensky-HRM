export type LeaveDurationKind = "FullDay" | "HalfDay" | "ShortLeave";
export type HalfDayPeriod = "Morning" | "Afternoon";

export const LEAVE_WORKDAY_HOURS = 8;

export const DEFAULT_SHORT_LEAVE_HOURS = 3;
export const SHORT_LEAVE_TYPE_CODE = "LT-SHL";

export function isShortLeaveType(type?: { code?: string | null; allowShortLeave?: boolean } | null): boolean {
  if (!type) return false;
  if (type.code?.toUpperCase() === SHORT_LEAVE_TYPE_CODE) return true;
  return Boolean(type.allowShortLeave);
}

/** Hours keep 2 decimals so part hours (e.g. 1.5) survive the round trip to the API. */
export function roundLeaveHours(hours: number): number {
  return Math.round(hours * 100) / 100;
}

export function clampShortLeaveHours(hours: number): number {
  if (!Number.isFinite(hours)) return DEFAULT_SHORT_LEAVE_HOURS;
  return Math.min(4, Math.max(1, roundLeaveHours(hours)));
}

/** Remaining for every leave type: Entitled − Used when CF is the closing balance, else Entitled + CF − Used. */
export function computeLeaveRemaining(entitled: number, used: number, carriedForward: number): number {
  const e = Number(entitled) || 0;
  const u = Number(used) || 0;
  const cf = Number(carriedForward) || 0;
  if (e > 0 && cf > 0 && Math.abs(cf - (e - u)) < 1e-6) return e - u;
  return e + cf - u;
}

export function parseOptionalHours(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return clampShortLeaveHours(n);
}

/** Half-hour steps between the type's min and max, always including both ends. */
const SHORT_LEAVE_HOUR_STEP = 0.5;

const TIME24_RE = /^(\d{2}):(\d{2})$/;

export function parseTime24ToMinutes(value: string): number | null {
  const m = TIME24_RE.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

export function formatMinutesToTime24(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(totalMinutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function addMinutesToTime24(time24: string, minutes: number): string | null {
  const start = parseTime24ToMinutes(time24);
  if (start == null) return null;
  return formatMinutesToTime24(start + minutes);
}

/** Hours from `from` to `to` on the same calendar day; null when invalid or to ≤ from. */
export function diffTime24Hours(from: string, to: string): number | null {
  const a = parseTime24ToMinutes(from);
  const b = parseTime24ToMinutes(to);
  if (a == null || b == null || b <= a) return null;
  return roundLeaveHours((b - a) / 60);
}

export function formatTime24Display(value: string): string {
  const m = TIME24_RE.exec(value.trim());
  if (!m) return value;
  const h24 = Number(m[1]);
  const minute = Number(m[2]);
  const period: "AM" | "PM" = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 || 12;
  return `${String(h12).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${period}`;
}

export function shortLeaveHourChoices(minHours?: number | null, maxHours?: number | null, fallback = DEFAULT_SHORT_LEAVE_HOURS): number[] {
  const hasMin = minHours != null && minHours > 0;
  const hasMax = maxHours != null && maxHours > 0;
  if (!hasMin && !hasMax) return [clampShortLeaveHours(fallback)];
  const lo = hasMin ? clampShortLeaveHours(minHours!) : 1;
  const hi = hasMax ? clampShortLeaveHours(maxHours!) : 4;
  const start = Math.min(lo, hi);
  const end = Math.max(lo, hi);
  const hours: number[] = [];
  for (let h = start; h < end; h = roundLeaveHours(h + SHORT_LEAVE_HOUR_STEP)) hours.push(h);
  hours.push(end);
  return hours;
}

export function computeLeaveTotalDays(options: {
  durationKind: LeaveDurationKind;
  startDate: string;
  endDate: string;
  shortLeaveHours?: number;
}): number {
  const { durationKind, startDate, endDate, shortLeaveHours } = options;
  if (!startDate) return 0;
  if (durationKind === "HalfDay") return 0.5;
  if (durationKind === "ShortLeave") return clampShortLeaveHours(shortLeaveHours ?? DEFAULT_SHORT_LEAVE_HOURS) / LEAVE_WORKDAY_HOURS;
  if (!endDate) return 0;
  const days = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1;
  return Math.max(1, days);
}

export function formatLeaveDays(days: number): string {
  if (!Number.isFinite(days)) return "0";
  if (Number.isInteger(days)) return String(days);
  return days.toFixed(2).replace(/\.?0+$/, "");
}

export function formatLeaveDurationLabel(
  kind?: string | null,
  period?: string | null,
  hours?: number | null,
  startTime?: string | null,
  endTime?: string | null,
): string | null {
  if (!kind || kind === "FullDay") return null;
  if (kind === "HalfDay") {
    if (period === "Afternoon") return "Half day (PM)";
    if (period === "Morning") return "Half day (AM)";
    return "Half day";
  }
  if (kind === "ShortLeave") {
    if (startTime && endTime && TIME24_RE.test(startTime) && TIME24_RE.test(endTime)) {
      return `Short leave (${formatTime24Display(startTime)} – ${formatTime24Display(endTime)})`;
    }
    return hours ? `Short leave (${hours}h)` : "Short leave";
  }
  return null;
}
