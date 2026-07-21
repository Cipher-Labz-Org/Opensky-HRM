import type { LeaveRequest } from "@/types/leave";
import { formatDate } from "@/utils/format";

export function employeeInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function approvalLevelLabel(status: string, level: number): string {
  if (status.toLowerCase().includes("level2") || level >= 2) return "Level 2 approval";
  return "Level 1 approval";
}

export function formatApprovalDateRange(request: LeaveRequest): string {
  return `${formatDate(request.startDate)} – ${formatDate(request.endDate)}`;
}

export function countByApprovalLevel(requests: LeaveRequest[]): {
  total: number;
  level1: number;
  level2: number;
} {
  let level1 = 0;
  let level2 = 0;
  for (const request of requests) {
    if (
      request.status.toLowerCase().includes("level2") ||
      request.currentApprovalLevel >= 2
    ) {
      level2 += 1;
    } else {
      level1 += 1;
    }
  }
  return { total: requests.length, level1, level2 };
}
