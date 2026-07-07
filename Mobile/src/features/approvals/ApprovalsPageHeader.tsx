import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme/colors";
import type { ComponentProps } from "react";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

interface ApprovalsPageHeaderProps {
  title: string;
  subtitle?: string;
}

export function ApprovalsPageHeader({ title, subtitle }: ApprovalsPageHeaderProps) {
  return (
    <View className="px-4 pb-2 pt-2">
      <View className="flex-row items-center gap-2">
        <View className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.accent }} />
        <Text className="text-xs font-semibold uppercase tracking-widest text-muted">
          Manager inbox
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

export interface ApprovalsSummaryStat {
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

function SummaryStatCell({ label, value, icon, tone = "accent" }: ApprovalsSummaryStat) {
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

interface ApprovalsSummaryCardProps {
  total: number;
  level1: number;
  level2: number;
}

export function ApprovalsSummaryCard({ total, level1, level2 }: ApprovalsSummaryCardProps) {
  const stats: ApprovalsSummaryStat[] = [
    { label: "Pending", value: total, icon: "hourglass-outline", tone: "warning" },
    { label: "Level 1", value: level1, icon: "person-outline", tone: "navy" },
    { label: "Level 2", value: level2, icon: "people-outline", tone: "accent" },
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
          <Ionicons name="checkmark-done-outline" size={18} color={colors.accent} />
          <Text className="text-xs font-bold uppercase tracking-wide" style={{ color: colors.navy }}>
            Approval queue
          </Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Ionicons
            name={total === 0 ? "checkmark-circle" : "alert-circle-outline"}
            size={13}
            color={total === 0 ? colors.accent : colors.warning}
          />
          <Text className="text-[11px] font-semibold" style={{ color: colors.navyMid }}>
            {total === 0 ? "All caught up" : `${total} awaiting action`}
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

interface ApprovalsTopSectionProps {
  title: string;
  subtitle?: string;
  total: number;
  level1: number;
  level2: number;
}

export function ApprovalsTopSection({
  title,
  subtitle,
  total,
  level1,
  level2,
}: ApprovalsTopSectionProps) {
  return (
    <View className="px-4">
      <ApprovalsPageHeader title={title} subtitle={subtitle} />
      <View className="mt-3">
        <ApprovalsSummaryCard total={total} level1={level1} level2={level2} />
      </View>
    </View>
  );
}

export function ApprovalsSectionTitle({ title }: { title: string }) {
  return (
    <View className="mb-3 flex-row items-center gap-2">
      <View className="h-5 w-1 rounded-full" style={{ backgroundColor: colors.accent }} />
      <Text className="text-sm font-bold uppercase tracking-wide" style={{ color: colors.navy }}>
        {title}
      </Text>
    </View>
  );
}
