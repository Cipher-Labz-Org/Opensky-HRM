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

export function clampShortLeaveHours(hours: number): number {
  if (!Number.isFinite(hours)) return DEFAULT_SHORT_LEAVE_HOURS;
  return Math.min(4, Math.max(1, Math.round(hours)));
}

export function parseOptionalHours(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return clampShortLeaveHours(n);
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
  for (let h = start; h <= end; h++) hours.push(h);
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
): string | null {
  if (!kind || kind === "FullDay") return null;
  if (kind === "HalfDay") {
    if (period === "Afternoon") return "Half day (PM)";
    if (period === "Morning") return "Half day (AM)";
    return "Half day";
  }
  if (kind === "ShortLeave") {
    return hours ? `Short leave (${hours}h)` : "Short leave";
  }
  return null;
}
