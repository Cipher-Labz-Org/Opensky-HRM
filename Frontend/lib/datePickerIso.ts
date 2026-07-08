/** Parse YYYY-MM-DD as a local calendar date (noon) to avoid timezone shifts. */
export function parseIsoDateToLocal(s: string | undefined): Date | undefined {
  if (!s || typeof s !== "string") return undefined;
  const day = s.trim().split("T")[0].split(" ")[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return undefined;
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function formatLocalDateToIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Split datetime-local style string (YYYY-MM-DDTHH:mm) into date and time parts. */
export function splitDateTime(iso: string): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const [d, rest] = iso.split("T");
  const timePart = rest ? rest.slice(0, 5) : "";
  return { date: d || "", time: /^\d{2}:\d{2}$/.test(timePart) ? timePart : "" };
}

export function joinDateTime(date: string, time: string): string {
  const d = date || (time ? formatLocalDateToIso(new Date()) : "");
  if (!d) return "";
  const tm = time && /^\d{2}:\d{2}$/.test(time) ? time : "00:00";
  return `${d}T${tm}`;
}

/** When from moves past to, bump to to match (ISO YYYY-MM-DD strings). */
export function applyFromDateInRange(nextFrom: string, currentTo: string): { from: string; to: string } {
  if (nextFrom && currentTo && nextFrom > currentTo) {
    return { from: nextFrom, to: nextFrom };
  }
  return { from: nextFrom, to: currentTo };
}

/** When to moves before from, bump from to match. */
export function applyToDateInRange(currentFrom: string, nextTo: string): { from: string; to: string } {
  if (nextTo && currentFrom && nextTo < currentFrom) {
    return { from: nextTo, to: nextTo };
  }
  return { from: currentFrom, to: nextTo };
}

export function isValidIsoDateRange(from: string, to: string): boolean {
  if (!from || !to) return true;
  return from <= to;
}
