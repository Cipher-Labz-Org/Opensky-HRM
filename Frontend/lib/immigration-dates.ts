import { formatLocalDateToIso, parseIsoDateToLocal } from "@/lib/datePickerIso";

/** Passport renewal eligibility: 9 years after issue (1 year before standard 10-year validity). */
const PASSPORT_ELIGIBLE_YEARS_AFTER_ISSUE = 9;

/** Visa renewal eligibility: 6 months before expiry. */
const VISA_ELIGIBLE_MONTHS_BEFORE_EXPIRY = 6;

function addYears(iso: string, years: number): string | null {
  const date = parseIsoDateToLocal(iso);
  if (!date) return null;
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + years);
  return formatLocalDateToIso(next);
}

function subtractMonths(iso: string, months: number): string | null {
  const date = parseIsoDateToLocal(iso);
  if (!date) return null;
  const next = new Date(date);
  next.setMonth(next.getMonth() - months);
  return formatLocalDateToIso(next);
}

export function calculatePassportEligibleDate(issuedDateIso: string): string | null {
  if (!issuedDateIso.trim()) return null;
  return addYears(issuedDateIso, PASSPORT_ELIGIBLE_YEARS_AFTER_ISSUE);
}

export function calculateVisaEligibleDate(expiryDateIso: string): string | null {
  if (!expiryDateIso.trim()) return null;
  return subtractMonths(expiryDateIso, VISA_ELIGIBLE_MONTHS_BEFORE_EXPIRY);
}

export function calculateImmigrationEligibleDate(
  documentType: string,
  issuedDateIso: string,
  expiryDateIso: string,
): string | null {
  if (documentType === "Passport") {
    return calculatePassportEligibleDate(issuedDateIso);
  }
  if (documentType === "Visa") {
    return calculateVisaEligibleDate(expiryDateIso);
  }
  return null;
}

export function diffCalendarDays(fromIso: string, toIso: string): number {
  const from = parseIsoDateToLocal(fromIso);
  const to = parseIsoDateToLocal(toIso);
  if (!from || !to) return NaN;
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((to.getTime() - from.getTime()) / msPerDay);
}

export function formatDateCountdown(targetIso: string, referenceIso?: string): string {
  const ref = referenceIso ?? formatLocalDateToIso(new Date());
  const days = diffCalendarDays(ref, targetIso);
  if (Number.isNaN(days)) return "";
  if (days > 1) return `${days} days remaining`;
  if (days === 1) return "1 day remaining";
  if (days === 0) return "Today";
  if (days === -1) return "Expired 1 day ago";
  return `Expired ${Math.abs(days)} days ago`;
}

/** Countdown phrasing for passport / visa expiry dates. */
export function formatDateCountdownToExpire(targetIso: string, referenceIso?: string): string {
  const ref = referenceIso ?? formatLocalDateToIso(new Date());
  const days = diffCalendarDays(ref, targetIso);
  if (Number.isNaN(days)) return "";
  if (days > 1) return `${days} days remaining to expire`;
  if (days === 1) return "1 day remaining to expire";
  if (days === 0) return "Expires today";
  if (days === -1) return "Expired 1 day ago";
  return `Expired ${Math.abs(days)} days ago`;
}

export function formatRenewalAvailability(availableDateIso: string, referenceIso?: string): string {
  const ref = referenceIso ?? formatLocalDateToIso(new Date());
  const days = diffCalendarDays(ref, availableDateIso);
  if (Number.isNaN(days)) return "";
  if (days <= 0) return "Renewal available now";
  if (days === 1) return "Renewal available in 1 day";
  return `Renewal available in ${days} days`;
}

/** Simple day count to the available date, e.g. "1095 days". */
export function formatAvailableDateDayCount(availableDateIso: string, referenceIso?: string): string {
  const ref = referenceIso ?? formatLocalDateToIso(new Date());
  const days = diffCalendarDays(ref, availableDateIso);
  if (Number.isNaN(days)) return "";
  if (days > 1) return `${days} days`;
  if (days === 1) return "1 day";
  if (days === 0) return "Today";
  if (days === -1) return "1 day ago";
  return `${Math.abs(days)} days ago`;
}

export function countdownTone(targetIso: string, referenceIso?: string): "neutral" | "warning" | "danger" {
  const ref = referenceIso ?? formatLocalDateToIso(new Date());
  const days = diffCalendarDays(ref, targetIso);
  if (Number.isNaN(days) || days > 90) return "neutral";
  if (days >= 0) return "warning";
  return "danger";
}
