/** Business timezone for attendance and biometric punches (Sri Lanka). */
export const BUSINESS_TIME_ZONE = "Asia/Colombo";

function hasExplicitOffset(value: string): boolean {
  return /Z$/i.test(value) || /[+-]\d{2}:\d{2}$/.test(value);
}

/** Format clock time in Sri Lankan timezone; UTC instants are converted, wall times are shown as stored. */
export function formatBusinessTime(value: string | null | undefined): string {
  if (!value) return "—";
  const trimmed = value.trim();
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return "—";

  if (hasExplicitOffset(trimmed)) {
    return d.toLocaleTimeString("en-LK", {
      timeZone: BUSINESS_TIME_ZONE,
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
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

  return d.toLocaleTimeString("en-LK", {
    timeZone: BUSINESS_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

const businessDateTimeFmt: Intl.DateTimeFormatOptions = {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
};

/** Date + time for API values: UTC instants (…Z) → Sri Lanka; wall times (no Z) → as stored. */
export function formatBusinessDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const trimmed = value.trim();

  if (hasExplicitOffset(trimmed)) {
    const d = new Date(trimmed);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-LK", businessDateTimeFmt);
  }

  const wall = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (wall) {
    const d = new Date(
      Number(wall[1]),
      Number(wall[2]) - 1,
      Number(wall[3]),
      Number(wall[4]),
      Number(wall[5]),
    );
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-LK", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }

  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-LK", businessDateTimeFmt);
}

/** Parse API UTC instants; naive `…T…` values from audit logs are UTC wall clock (see ApiDateTimeJsonConverter). */
function parseUtcApiInstant(value: string): Date {
  if (hasExplicitOffset(value)) return new Date(value);
  const match = value.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);
  if (match) return new Date(`${match[1]}Z`);
  return new Date(value);
}

function formatInstantColomboWall(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${pick("year")}-${pick("month")}-${pick("day")} ${pick("hour")}:${pick("minute")}:${pick("second")}`;
}

/** Log tables: `YYYY-MM-DD HH:mm:ss` in Sri Lanka (Colombo / SLST, UTC+5:30). */
export function formatColomboLogDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const trimmed = value.trim();

  // Pre-formatted server value (already Colombo wall clock).
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed;

  const d = hasExplicitOffset(trimmed) ? new Date(trimmed) : parseUtcApiInstant(trimmed);
  if (Number.isNaN(d.getTime())) return "—";
  return formatInstantColomboWall(d);
}

/** Date + time for UTC API instants (…Z or naive UTC wall) → Sri Lanka. */
export function formatUtcInstantAsBusinessDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const trimmed = value.trim();
  const d = parseUtcApiInstant(trimmed);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-LK", businessDateTimeFmt);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const trimmed = value.trim();
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return "—";

  if (hasExplicitOffset(trimmed)) {
    return d.toLocaleString("en-LK", {
      timeZone: BUSINESS_TIME_ZONE,
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }

  if (trimmed.includes("T")) {
    return formatBusinessDateTime(trimmed);
  }

  return d.toLocaleString("en-LK", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const [y, m, d] = value.split("T")[0].split("-");
  return new Date(+y, +m - 1, +d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
