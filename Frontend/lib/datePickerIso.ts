/** Parse YYYY-MM-DD as a local calendar date (noon) to avoid timezone shifts. */
export function parseIsoDateToLocal(s: string | undefined): Date | undefined {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const [y, m, d] = s.split("-").map(Number);
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
  if (!date) return "";
  const tm = time && /^\d{2}:\d{2}$/.test(time) ? time : "00:00";
  return `${date}T${tm}`;
}
