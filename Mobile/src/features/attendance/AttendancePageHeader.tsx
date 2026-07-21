import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme/colors";
import type { AttendanceSummary } from "@/types/attendance";
import type { ComponentProps, ReactNode } from "react";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

interface AttendancePageHeaderProps {
  title: string;
  subtitle?: string;
  monthLabel: string;
}

export function AttendancePageHeader({
  title,
  subtitle,
  monthLabel,
}: AttendancePageHeaderProps) {
  return (
    <View className="px-4 pb-2 pt-2">
      <View className="flex-row items-center gap-2">
        <View className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.accent }} />
        <Text className="text-xs font-semibold uppercase tracking-widest text-muted">
          {monthLabel}
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

export interface AttendanceSummaryStat {
  label: string;
  value: string | number;
  icon: IoniconName;
  tone?: "accent" | "navy" | "warning" | "danger";
}

const toneColors = {
  accent: colors.accent,
  navy: colors.navyMid,
  warning: colors.warning,
  danger: colors.danger,
} as const;

function SummaryStatCell({ label, value, icon, tone = "accent" }: AttendanceSummaryStat) {
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

export function AttendanceSummaryCard({ summary }: { summary: AttendanceSummary }) {
  const stats: AttendanceSummaryStat[] = [
    { label: "Present", value: summary.totalPresent, icon: "checkmark-circle-outline", tone: "accent" },
    { label: "Late", value: summary.totalLate, icon: "time-outline", tone: "warning" },
    { label: "Absent", value: summary.totalAbsent, icon: "close-circle-outline", tone: "danger" },
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
          <Ionicons name="bar-chart-outline" size={18} color={colors.accent} />
          <Text className="text-xs font-bold uppercase tracking-wide" style={{ color: colors.navy }}>
            This month
          </Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Ionicons name="hourglass-outline" size={13} color={colors.navyMid} />
          <Text className="text-[11px] font-semibold" style={{ color: colors.navyMid }}>
            Avg {summary.averageWorkHours.toFixed(1)}h/day
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

interface AttendanceTopSectionProps {
  title: string;
  subtitle?: string;
  monthLabel: string;
  children: ReactNode;
}

export function AttendanceTopSection({
  title,
  subtitle,
  monthLabel,
  children,
}: AttendanceTopSectionProps) {
  return (
    <View className="px-4">
      <AttendancePageHeader title={title} subtitle={subtitle} monthLabel={monthLabel} />
      {children}
    </View>
  );
}

export function AttendanceSectionTitle({ title }: { title: string }) {
  return (
    <View className="mb-3 flex-row items-center gap-2">
      <View className="h-5 w-1 rounded-full" style={{ backgroundColor: colors.accent }} />
      <Text className="text-sm font-bold uppercase tracking-wide" style={{ color: colors.navy }}>
        {title}
      </Text>
    </View>
  );
}
