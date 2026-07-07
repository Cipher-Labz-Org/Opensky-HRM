import type { Employee } from "@/types/employee";
import type { BadgeProps } from "@/components/ui/Badge";
import { formatDate } from "@/utils/format";

export function employmentStatusTone(status: string): BadgeProps["tone"] {
  const normalized = status.toLowerCase();
  if (normalized.includes("active")) return "success";
  if (normalized.includes("probation")) return "warning";
  if (normalized.includes("terminat") || normalized.includes("inactive")) return "danger";
  return "default";
}

export function resolveJobTitle(profile: Employee): string {
  return profile.jobTitleName ?? profile.positionTitle ?? "—";
}

export function formatTenure(joinDate: string): string {
  const joined = new Date(joinDate);
  if (Number.isNaN(joined.getTime())) return formatDate(joinDate);

  const now = new Date();
  let years = now.getFullYear() - joined.getFullYear();
  let months = now.getMonth() - joined.getMonth();
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (years <= 0 && months <= 0) return "New joiner";
  if (years <= 0) return `${months} month${months === 1 ? "" : "s"}`;
  if (months <= 0) return `${years} year${years === 1 ? "" : "s"}`;
  return `${years}y ${months}m`;
}

export function formatAddress(profile: Employee): string | null {
  const parts = [
    profile.addressStreet1,
    profile.city,
    profile.stateProvince,
    profile.country,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}
