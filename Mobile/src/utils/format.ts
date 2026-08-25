export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Business timezone for attendance punches (Sri Lanka). */
const BUSINESS_TIME_ZONE = "Asia/Colombo";

function hasExplicitOffset(value: string): boolean {
  return /Z$/i.test(value) || /[+-]\d{2}:\d{2}$/.test(value);
}

/** Match back-office: UTC instants (…Z) → Colombo; wall times (no offset) → as stored. */
export function formatTime(value: string | null | undefined): string {
  if (!value) return "—";
  const trimmed = value.trim();
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return value;

  if (hasExplicitOffset(trimmed)) {
    return date.toLocaleTimeString("en-LK", {
      timeZone: BUSINESS_TIME_ZONE,
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const timePart = trimmed.includes("T") ? trimmed.split("T")[1] : trimmed;
  const match = timePart?.match(/^(\d{2}):(\d{2})/);
  if (match) {
    const hour = parseInt(match[1], 10);
    const minute = match[2];
    const period = hour >= 12 ? "pm" : "am";
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${hour12}:${minute} ${period}`;
  }

  return date.toLocaleTimeString("en-LK", {
    timeZone: BUSINESS_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatCurrency(amount: number, currency = "LKR"): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function monthYearLabel(month: number, year: number): string {
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function localIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function startOfMonthIso(date = new Date()): string {
  return localIsoDate(new Date(date.getFullYear(), date.getMonth(), 1));
}

export function endOfMonthIso(date = new Date()): string {
  return localIsoDate(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

export function daysBetweenInclusive(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  const diff = e.getTime() - s.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
}

export function statusColor(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized.includes("approve")) return "text-success";
  if (normalized.includes("reject") || normalized.includes("cancel")) return "text-danger";
  if (normalized.includes("pending")) return "text-warning";
  return "text-muted";
}
