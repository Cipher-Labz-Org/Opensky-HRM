import type { FormSelectOption } from "@/components/ui";

export const INTERVIEW_TYPE_TITLE: Record<string, string> = {
  Phone: "Phone interview",
  Video: "Video interview",
  Onsite: "On-site interview",
};

export const INTERVIEW_TYPE_OPTS: FormSelectOption[] = [
  { value: "", label: "Select type…" },
  { value: "Phone", label: "Phone" },
  { value: "Video", label: "Video" },
  { value: "Onsite", label: "Onsite" },
];

export function defaultScheduleTitle(
  interviewType: string | undefined,
  candidateFullName: string | undefined,
): string {
  const base =
    interviewType && INTERVIEW_TYPE_TITLE[interviewType] ? INTERVIEW_TYPE_TITLE[interviewType] : "Interview";
  if (candidateFullName) return `${base} — ${candidateFullName}`;
  return base;
}

/** Map a preset title back to interview type; null if title is custom. */
export function inferInterviewTypeFromTitle(
  title: string,
  candidateFullName?: string,
): string | null {
  const trimmed = title.trim();
  if (!trimmed) return "";

  for (const type of Object.keys(INTERVIEW_TYPE_TITLE)) {
    if (trimmed === defaultScheduleTitle(type, candidateFullName)) return type;
  }
  if (trimmed === defaultScheduleTitle(undefined, candidateFullName)) return "";
  return null;
}

/** Physical locations for on-site interviews only (no video/link options). */
export function scheduleOnsiteLocationOptions(locations: { name: string }[]): FormSelectOption[] {
  return [
    { value: "", label: "Select location…" },
    ...locations.map((l) => ({ value: l.name, label: l.name })),
    { value: "Remote", label: "Remote" },
  ];
}

export function resolveInterviewLocation(
  interviewType: string | undefined,
  onsiteLocation: string | undefined,
  meetingLink: string,
): string | null {
  if (interviewType === "Phone") return null;
  if (interviewType === "Video") return meetingLink.trim() || null;
  return onsiteLocation?.trim() || null;
}

export function scheduleTitleOptions(candidateFullName?: string): FormSelectOption[] {
  const titles = new Set<string>();
  titles.add(defaultScheduleTitle(undefined, candidateFullName));
  for (const type of Object.keys(INTERVIEW_TYPE_TITLE)) {
    titles.add(defaultScheduleTitle(type, candidateFullName));
  }
  return [
    { value: "", label: "Select title…" },
    ...Array.from(titles)
      .sort((a, b) => a.localeCompare(b))
      .map((t) => ({ value: t, label: t })),
  ];
}

/** Interview scheduling defaults: 15-minute slots between 8:00 and 18:00. */
export const INTERVIEW_SCHEDULE_MINUTE_STEP = 15;
export const INTERVIEW_SCHEDULE_HOUR_START = 8;
export const INTERVIEW_SCHEDULE_HOUR_END = 18;

function snapMinuteToStep(minute: number, step: number): number {
  return Math.min(59, Math.round(minute / step) * step);
}

function clampInterviewParts(
  dateIso: string,
  time24: string,
  step = INTERVIEW_SCHEDULE_MINUTE_STEP,
  hourStart = INTERVIEW_SCHEDULE_HOUR_START,
  hourEnd = INTERVIEW_SCHEDULE_HOUR_END,
): { date: string; time: string } {
  const [y, mo, d] = dateIso.split("-").map(Number);
  const [hRaw, mRaw] = time24.split(":").map(Number);
  let hour = Number.isFinite(hRaw) ? hRaw : hourStart;
  let minute = snapMinuteToStep(Number.isFinite(mRaw) ? mRaw : 0, step);

  if (hour < hourStart) {
    hour = hourStart;
    minute = 0;
  }
  if (hour > hourEnd || (hour === hourEnd && minute > 0)) {
    const next = new Date(y, mo - 1, d + 1, hourStart, 0, 0, 0);
    return {
      date: `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`,
      time: `${String(hourStart).padStart(2, "0")}:00`,
    };
  }

  return {
    date: dateIso,
    time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
  };
}

/** Next available interview slot from now (15-min steps, business hours). */
export function nextInterviewScheduleDateTime(
  step = INTERVIEW_SCHEDULE_MINUTE_STEP,
  hourStart = INTERVIEW_SCHEDULE_HOUR_START,
  hourEnd = INTERVIEW_SCHEDULE_HOUR_END,
): string {
  const now = new Date();
  now.setSeconds(0, 0);
  const ms = step * 60 * 1000;
  const bumped = new Date(Math.ceil(now.getTime() / ms) * ms);
  const dateIso = `${bumped.getFullYear()}-${String(bumped.getMonth() + 1).padStart(2, "0")}-${String(bumped.getDate()).padStart(2, "0")}`;
  const time24 = `${String(bumped.getHours()).padStart(2, "0")}:${String(bumped.getMinutes()).padStart(2, "0")}`;
  const clamped = clampInterviewParts(dateIso, time24, step, hourStart, hourEnd);
  return `${clamped.date}T${clamped.time}`;
}

/** Normalize a datetime-local value to a valid interview slot. */
export function normalizeInterviewScheduleDateTime(
  value: string,
  step = INTERVIEW_SCHEDULE_MINUTE_STEP,
  hourStart = INTERVIEW_SCHEDULE_HOUR_START,
  hourEnd = INTERVIEW_SCHEDULE_HOUR_END,
): string {
  if (!value) return "";
  const [dateIso, rest] = value.split("T");
  if (!dateIso) return "";
  const time24 = rest?.slice(0, 5) ?? "08:00";
  const clamped = clampInterviewParts(dateIso, time24, step, hourStart, hourEnd);
  return `${clamped.date}T${clamped.time}`;
}

export function isInterviewScheduleInPast(value: string): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return false;
  const [dateIso, time24] = value.split("T");
  const [y, mo, d] = dateIso.split("-").map(Number);
  const [h, m] = time24.split(":").map(Number);
  const when = new Date(y, mo - 1, d, h, m, 0, 0);
  return when.getTime() < Date.now();
}
