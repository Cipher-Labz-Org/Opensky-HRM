import type { AttendanceRecord } from "@/types/attendance";
import type { BadgeProps } from "@/components/ui/Badge";
import { formatTime } from "@/utils/format";
import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

export function attendanceStatusToBadgeTone(status: string): BadgeProps["tone"] {
  const normalized = status.toLowerCase();
  if (normalized.includes("present")) return "success";
  if (normalized.includes("absent")) return "danger";
  if (normalized.includes("late")) return "warning";
  if (normalized.includes("leave")) return "default";
  return "default";
}

export function attendanceStatusToIconBg(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized.includes("present")) return "bg-success";
  if (normalized.includes("absent")) return "bg-danger";
  if (normalized.includes("late")) return "bg-warning";
  if (normalized.includes("leave")) return "bg-primary";
  return "bg-primary";
}

export function attendanceStatusToIcon(status: string): IoniconName {
  const normalized = status.toLowerCase();
  if (normalized.includes("absent")) return "close-circle-outline";
  if (normalized.includes("late")) return "time-outline";
  if (normalized.includes("leave")) return "calendar-outline";
  if (normalized.includes("present")) return "checkmark-circle-outline";
  return "finger-print-outline";
}

export function formatAttendanceMeta(record: AttendanceRecord): string {
  const parts = [`In: ${formatTime(record.punchIn)} · Out: ${formatTime(record.punchOut)}`];
  if (record.workedHours != null && record.workedHours > 0) {
    parts.push(`${record.workedHours.toFixed(1)}h worked`);
  }
  if (record.isLate && record.lateMins > 0) {
    parts.push(`Late ${record.lateMins}m`);
  }
  if (record.shiftName) {
    parts.push(record.shiftName);
  }
  return parts.join(" · ");
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function findTodayRecord(records: AttendanceRecord[]): AttendanceRecord | undefined {
  const today = todayIsoDate();
  return records.find((record) => record.date.slice(0, 10) === today);
}
