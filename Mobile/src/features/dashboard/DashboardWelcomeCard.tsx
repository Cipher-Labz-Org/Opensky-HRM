import { Ionicons } from "@expo/vector-icons";
import { Image, Text, View } from "react-native";
import { colors } from "@/theme/colors";
import { getInitials, getTimeGreeting } from "@/utils/greeting";
import { softCardShadow } from "./dashboardStyles";
import type { ComponentProps } from "react";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

interface WelcomeStat {
  label: string;
  value: string | number;
  icon: IoniconName;
  tone?: "teal" | "green" | "navy";
}

interface DashboardWelcomeCardProps {
  displayName: string;
  companyName: string;
  subtitle?: string | null;
  employeeCode?: string | null;
  photoUri?: string | null;
  stats: WelcomeStat[];
}

const toneStyles = {
  teal: { bg: colors.tealSoft, icon: colors.teal, value: colors.teal },
  green: { bg: colors.accentSoft, icon: colors.accent, value: colors.accent },
  navy: { bg: colors.primaryLight, icon: colors.navyMid, value: colors.navyMid },
} as const;

function WelcomeStatPill({ label, value, icon, tone = "teal" }: WelcomeStat) {
  const style = toneStyles[tone];
  return (
    <View className="min-w-0 flex-1 rounded-2xl px-2 py-3" style={{ backgroundColor: style.bg }}>
      <View className="items-center">
        <Ionicons name={icon} size={18} color={style.icon} />
        <Text className="mt-1.5 text-xl font-bold" style={{ color: style.value }}>
          {value}
        </Text>
        <Text className="mt-0.5 text-center text-[10px] font-medium" style={{ color: colors.muted }} numberOfLines={2}>
          {label}
        </Text>
      </View>
    </View>
  );
}

export function DashboardWelcomeCard({
  displayName,
  companyName,
  subtitle,
  employeeCode,
  photoUri,
  stats,
}: DashboardWelcomeCardProps) {
  const greeting = getTimeGreeting();

  return (
    <View
      className="overflow-hidden rounded-[24px] border border-border bg-surface p-4"
      style={softCardShadow}
    >
      <View className="flex-row items-center gap-3">
        <View
          className="overflow-hidden rounded-2xl border-2"
          style={{ width: 56, height: 56, borderColor: colors.tealSoft, backgroundColor: colors.primaryLight }}
        >
          {photoUri ? (
            <Image source={{ uri: photoUri }} className="h-full w-full" resizeMode="cover" />
          ) : (
            <View className="h-full w-full items-center justify-center">
              <Text className="text-lg font-bold" style={{ color: colors.navyMid }}>
                {getInitials(displayName)}
              </Text>
            </View>
          )}
        </View>
        <View className="min-w-0 flex-1">
          <View
            className="self-start rounded-full px-2.5 py-0.5"
            style={{ backgroundColor: colors.tealSoft }}
          >
            <Text className="text-[10px] font-bold uppercase tracking-wide" style={{ color: colors.teal }}>
              {greeting}
            </Text>
          </View>
          <Text className="mt-1 text-lg font-bold" style={{ color: colors.navy }} numberOfLines={1}>
            {displayName}
          </Text>
          <Text className="text-xs" style={{ color: colors.muted }} numberOfLines={1}>
            {companyName}
            {subtitle ? ` · ${subtitle}` : ""}
          </Text>
        </View>
        {employeeCode ? (
          <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: colors.soft }}>
            <Text className="text-[11px] font-semibold" style={{ color: colors.navyMid }}>
              #{employeeCode}
            </Text>
          </View>
        ) : null}
      </View>

      {stats.length ? (
        <View className="mt-4 flex-row gap-2">
          {stats.map((stat, index) => (
            <WelcomeStatPill
              key={stat.label}
              {...stat}
              tone={index === 0 ? "green" : index === 1 ? "teal" : "navy"}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
