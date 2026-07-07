import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme/colors";
import type { ComponentProps } from "react";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

interface LeavePageHeaderProps {
  title: string;
  subtitle?: string;
  showApply?: boolean;
  onApply?: () => void;
}

/** Light top bar — title and optional Apply action on the page background. */
export function LeavePageHeader({ title, subtitle, showApply, onApply }: LeavePageHeaderProps) {
  return (
    <View className="px-4 pb-2 pt-2">
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-2">
            <View className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.accent }} />
            <Text className="text-xs font-semibold uppercase tracking-widest text-muted">
              Time off
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
        {showApply && onApply ? <ApplyHeaderButton onPress={onApply} /> : null}
      </View>
    </View>
  );
}

export interface LeaveSummaryStat {
  label: string;
  value: string | number;
  icon: IoniconName;
  tone?: "accent" | "navy" | "warning";
}

interface LeaveSummaryCardProps {
  stats: LeaveSummaryStat[];
}

const toneColors = {
  accent: colors.accent,
  navy: colors.navyMid,
  warning: colors.warning,
} as const;

function SummaryStatCell({ label, value, icon, tone = "accent" }: LeaveSummaryStat) {
  const valueColor = toneColors[tone];
  return (
    <View className="min-w-0 flex-1 items-center px-2 py-4">
      <View
        className="mb-2 rounded-2xl p-2.5"
        style={{ backgroundColor: colors.accentSoft }}
      >
        <Ionicons name={icon} size={20} color={colors.accent} />
      </View>
      <Text className="text-2xl font-bold" style={{ color: valueColor }}>
        {value}
      </Text>
      <Text className="mt-1 text-center text-[11px] font-medium text-muted" numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

/** White summary card — sits clearly below the title, not on a dark header. */
export function LeaveSummaryCard({ stats }: LeaveSummaryCardProps) {
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
        className="flex-row items-center gap-2 border-b border-border px-4 py-3"
        style={{ backgroundColor: colors.primaryLight }}
      >
        <Ionicons name="calendar-outline" size={18} color={colors.accent} />
        <Text className="text-xs font-bold uppercase tracking-wide" style={{ color: colors.navy }}>
          Leave summary
        </Text>
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

interface LeaveTopSectionProps {
  title: string;
  subtitle?: string;
  stats: LeaveSummaryStat[];
  onApply: () => void;
}

/** Single clear top block: title row + white summary card. */
export function LeaveTopSection({ title, subtitle, stats, onApply }: LeaveTopSectionProps) {
  return (
    <View className="px-4">
      <LeavePageHeader
        title={title}
        subtitle={subtitle}
        showApply
        onApply={onApply}
      />
      <LeaveSummaryCard stats={stats} />
    </View>
  );
}

export function ApplyHeaderButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-1.5 rounded-full px-4 py-2.5"
      style={({ pressed }) => ({
        opacity: pressed ? 0.9 : 1,
        backgroundColor: colors.accent,
      })}
    >
      <Ionicons name="add-circle" size={18} color="#ffffff" />
      <Text className="text-sm font-bold text-white">Apply</Text>
    </Pressable>
  );
}

export function LeaveSectionTitle({ title }: { title: string }) {
  return (
    <View className="mb-3 flex-row items-center gap-2">
      <View className="h-5 w-1 rounded-full" style={{ backgroundColor: colors.accent }} />
      <Text className="text-sm font-bold uppercase tracking-wide" style={{ color: colors.navy }}>
        {title}
      </Text>
    </View>
  );
}
