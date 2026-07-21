import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme/colors";
import type { ComponentProps } from "react";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

interface NotificationsPageHeaderProps {
  title: string;
  subtitle?: string;
}

export function NotificationsPageHeader({ title, subtitle }: NotificationsPageHeaderProps) {
  return (
    <View className="px-4 pb-2 pt-2">
      <View className="flex-row items-center gap-2">
        <View className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.accent }} />
        <Text className="text-xs font-semibold uppercase tracking-widest text-muted">
          Your inbox
        </Text>
      </View>
      <Text className="mt-1.5 text-2xl font-bold" style={{ color: colors.navy }}>
        {title}
      </Text>
      {subtitle ? (
        <Text className="mt-1 text-sm text-muted" numberOfLines={2}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

export interface NotificationsSummaryStat {
  label: string;
  value: string | number;
  icon: IoniconName;
  tone?: "accent" | "navy" | "warning";
}

const toneColors = {
  accent: colors.accent,
  navy: colors.navyMid,
  warning: colors.warning,
} as const;

function SummaryStatCell({ label, value, icon, tone = "accent" }: NotificationsSummaryStat) {
  return (
    <View className="min-w-0 flex-1 items-center px-2 py-4">
      <View className="mb-2 rounded-2xl p-2.5" style={{ backgroundColor: colors.accentSoft }}>
        <Ionicons name={icon} size={20} color={colors.accent} />
      </View>
      <Text className="text-2xl font-bold" style={{ color: toneColors[tone] }}>
        {value}
      </Text>
      <Text className="mt-1 text-center text-[11px] font-medium text-muted" numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

interface NotificationsSummaryCardProps {
  unread: number;
  total: number;
  read: number;
}

export function NotificationsSummaryCard({ unread, total, read }: NotificationsSummaryCardProps) {
  const stats: NotificationsSummaryStat[] = [
    { label: "Unread", value: unread, icon: "mail-unread-outline", tone: "warning" },
    { label: "Total", value: total, icon: "layers-outline", tone: "navy" },
    { label: "Read", value: read, icon: "checkmark-done-outline", tone: "accent" },
  ];

  return (
    <View
      className="overflow-hidden rounded-3xl border border-border bg-surface"
      style={{
        shadowColor: colors.primaryDark,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
      }}
    >
      <View
        className="flex-row items-center justify-between border-b border-border px-4 py-3"
        style={{ backgroundColor: colors.primaryLight }}
      >
        <View className="flex-row items-center gap-2">
          <Ionicons name="notifications-outline" size={18} color={colors.accent} />
          <Text className="text-xs font-bold uppercase tracking-wide" style={{ color: colors.navy }}>
            Alert summary
          </Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Ionicons
            name={unread === 0 ? "checkmark-circle" : "alert-circle-outline"}
            size={13}
            color={unread === 0 ? colors.accent : colors.warning}
          />
          <Text className="text-[11px] font-semibold" style={{ color: colors.navyMid }}>
            {unread === 0 ? "Inbox clear" : `${unread} unread`}
          </Text>
        </View>
      </View>

      <View className="flex-row">
        {stats.map((stat, index) => (
          <View key={stat.label} className="min-w-0 flex-1 flex-row">
            {index > 0 ? <View className="w-px bg-border" /> : null}
            <SummaryStatCell {...stat} />
          </View>
        ))}
      </View>
    </View>
  );
}

interface NotificationsTopSectionProps {
  title: string;
  subtitle?: string;
  unread: number;
  total: number;
  read: number;
}

export function NotificationsTopSection({
  title,
  subtitle,
  unread,
  total,
  read,
}: NotificationsTopSectionProps) {
  return (
    <View className="px-4">
      <NotificationsPageHeader title={title} subtitle={subtitle} />
      <View className="mt-3">
        <NotificationsSummaryCard unread={unread} total={total} read={read} />
      </View>
    </View>
  );
}

export function NotificationsSectionTitle({ title }: { title: string }) {
  return (
    <View className="mb-3 flex-row items-center gap-2">
      <View className="h-5 w-1 rounded-full" style={{ backgroundColor: colors.accent }} />
      <Text className="text-sm font-bold uppercase tracking-wide" style={{ color: colors.navy }}>
        {title}
      </Text>
    </View>
  );
}
