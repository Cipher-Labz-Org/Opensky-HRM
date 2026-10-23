/** Shared rules for birthday wish / company notice visibility (QA: history until month end). */

export type NoticeVisibilityItem = {
  category: string;
  createdAt: string;
  readAt?: string | null;
};

const digestCategories = new Set(["BirthdayToday", "BirthdayUpcoming", "EmployeeBirthdayDigest"]);

const leaveCategories = new Set([
  "LeaveApprovalRequest",
  "LeaveCancellationRequest",
  "LeaveCovering",
  "LeaveSubmitted",
  "LeaveApproved",
  "LeaveRejected",
]);

export function isWithinSameCalendarMonth(iso: string, ref = new Date()): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return true;
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
}

/** Whether a notice belongs in the Birthdays widget company-notices list. */
export function isVisibleCompanyNotice(n: NoticeVisibilityItem): boolean {
  if (digestCategories.has(n.category) || leaveCategories.has(n.category) || n.category === "BirthdayWishMyReply")
    return false;
  if (n.category === "BirthdayWishSent") return isWithinSameCalendarMonth(n.createdAt);
  if (n.category === "BirthdayWish") return !n.readAt;
  return true;
}

/** Whether a notice should appear in the header notification dropdown. */
export function isVisibleHeaderNotification(n: NoticeVisibilityItem): boolean {
  if (n.category === "BirthdayWishMyReply") return false;
  if (n.category === "BirthdayWishSent") return isWithinSameCalendarMonth(n.createdAt);
  if (n.category === "BirthdayWish") return !n.readAt;
  return true;
}

/** Header / API mark-read: recipient wishes use next-login lifecycle instead. */
export function shouldMarkReadFromHeader(category: string): boolean {
  return category !== "BirthdayWish";
}
