import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";
import type { NotificationItem } from "@/types/notifications";
import { colors } from "@/theme/colors";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

interface CategoryStyle {
  icon: IoniconName;
  iconBgColor: string;
  iconColor: string;
  label: string;
}

const DEFAULT_STYLE: CategoryStyle = {
  icon: "notifications-outline",
  iconBgColor: colors.primaryLight,
  iconColor: colors.navyMid,
  label: "General",
};

function resolveCategoryStyle(category: string): CategoryStyle {
  const key = category.toLowerCase();

  if (key.includes("birthday")) {
    return {
      icon: "gift-outline",
      iconBgColor: colors.accentSoft,
      iconColor: colors.accent,
      label: "Birthday",
    };
  }
  if (key.includes("leave")) {
    return {
      icon: "airplane-outline",
      iconBgColor: colors.primaryLight,
      iconColor: colors.navyMid,
      label: "Leave",
    };
  }
  if (key.includes("license") || key.includes("compliance") || key.includes("expir")) {
    return {
      icon: "shield-checkmark-outline",
      iconBgColor: colors.warningSoft,
      iconColor: colors.warning,
      label: "Compliance",
    };
  }
  if (key.includes("payroll") || key.includes("payslip")) {
    return {
      icon: "wallet-outline",
      iconBgColor: colors.successSoft,
      iconColor: colors.success,
      label: "Payroll",
    };
  }
  if (key.includes("attendance")) {
    return {
      icon: "time-outline",
      iconBgColor: colors.primaryLight,
      iconColor: colors.navyMid,
      label: "Attendance",
    };
  }
  if (key.includes("approval")) {
    return {
      icon: "checkmark-done-outline",
      iconBgColor: colors.warningSoft,
      iconColor: colors.warning,
      label: "Approval",
    };
  }

  return DEFAULT_STYLE;
}

export function notificationCategoryStyle(category: string): CategoryStyle {
  return resolveCategoryStyle(category);
}

export function countNotifications(items: NotificationItem[]): {
  total: number;
  unread: number;
  read: number;
} {
  const unread = items.filter((item) => !item.readAt).length;
  return {
    total: items.length,
    unread,
    read: items.length - unread,
  };
}

export function formatRelativeTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export type NotificationGroupKey = "today" | "yesterday" | "earlier";

export interface NotificationGroup {
  key: NotificationGroupKey;
  label: string;
  items: NotificationItem[];
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function groupNotificationsByDate(items: NotificationItem[]): NotificationGroup[] {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const today: NotificationItem[] = [];
  const yesterdayItems: NotificationItem[] = [];
  const earlier: NotificationItem[] = [];

  for (const item of items) {
    const created = new Date(item.createdAt);
    if (isSameDay(created, now)) {
      today.push(item);
    } else if (isSameDay(created, yesterday)) {
      yesterdayItems.push(item);
    } else {
      earlier.push(item);
    }
  }

  const groups: NotificationGroup[] = [];
  if (today.length) groups.push({ key: "today", label: "Today", items: today });
  if (yesterdayItems.length) {
    groups.push({ key: "yesterday", label: "Yesterday", items: yesterdayItems });
  }
  if (earlier.length) groups.push({ key: "earlier", label: "Earlier", items: earlier });
  return groups;
}
