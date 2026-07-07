import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme/colors";
import { formatCurrency } from "@/utils/format";
import type { ComponentProps } from "react";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

interface PayslipsPageHeaderProps {
  title: string;
  subtitle?: string;
}

export function PayslipsPageHeader({ title, subtitle }: PayslipsPageHeaderProps) {
  return (
    <View className="px-4 pb-2 pt-2">
      <View className="flex-row items-center gap-2">
        <View className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.accent }} />
        <Text className="text-xs font-semibold uppercase tracking-widest text-muted">
          Payroll
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

export interface PayslipsSummaryStat {
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

function SummaryStatCell({ label, value, icon, tone = "accent" }: PayslipsSummaryStat) {
  return (
    <View className="min-w-0 flex-1 items-center px-2 py-4">
      <View className="mb-2 rounded-2xl p-2.5" style={{ backgroundColor: colors.accentSoft }}>
        <Ionicons name={icon} size={20} color={colors.accent} />
      </View>
      <Text
        className="text-center text-lg font-bold"
        style={{ color: toneColors[tone] }}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
      >
        {value}
      </Text>
      <Text className="mt-1 text-center text-[11px] font-medium text-muted" numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

interface PayslipsSummaryCardProps {
  latestNetPay: number;
  latestLabel: string;
  count: number;
  ytdNetPay: number;
}

export function PayslipsSummaryCard({
  latestNetPay,
  latestLabel,
  count,
  ytdNetPay,
}: PayslipsSummaryCardProps) {
  const stats: PayslipsSummaryStat[] = [
    {
      label: "Latest net",
      value: formatCurrency(latestNetPay),
      icon: "wallet-outline",
      tone: "accent",
    },
    { label: "Payslips", value: count, icon: "layers-outline", tone: "navy" },
    {
      label: "YTD net",
      value: formatCurrency(ytdNetPay),
      icon: "trending-up-outline",
      tone: "accent",
    },
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
          <Ionicons name="receipt-outline" size={18} color={colors.accent} />
          <Text className="text-xs font-bold uppercase tracking-wide" style={{ color: colors.navy }}>
            Payroll summary
          </Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Ionicons name="calendar-outline" size={13} color={colors.navyMid} />
          <Text className="text-[11px] font-semibold" style={{ color: colors.navyMid }}>
            Latest: {latestLabel}
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

interface PayslipsTopSectionProps {
  title: string;
  subtitle?: string;
  summary?: {
    latestNetPay: number;
    latestLabel: string;
    count: number;
    ytdNetPay: number;
  };
}

export function PayslipsTopSection({ title, subtitle, summary }: PayslipsTopSectionProps) {
  return (
    <View className="px-4">
      <PayslipsPageHeader title={title} subtitle={subtitle} />
      {summary ? (
        <View className="mt-3">
          <PayslipsSummaryCard {...summary} />
        </View>
      ) : null}
    </View>
  );
}

export function PayslipsSectionTitle({ title }: { title: string }) {
  return (
    <View className="mb-3 flex-row items-center gap-2">
      <View className="h-5 w-1 rounded-full" style={{ backgroundColor: colors.accent }} />
      <Text className="text-sm font-bold uppercase tracking-wide" style={{ color: colors.navy }}>
        {title}
      </Text>
    </View>
  );
}
