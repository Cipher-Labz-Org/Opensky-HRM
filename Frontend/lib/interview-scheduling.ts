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
