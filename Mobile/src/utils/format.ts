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

export function formatTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString(undefined, {
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

export function startOfMonthIso(date = new Date()): string {
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);
}

export function endOfMonthIso(date = new Date()): string {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().slice(0, 10);
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
