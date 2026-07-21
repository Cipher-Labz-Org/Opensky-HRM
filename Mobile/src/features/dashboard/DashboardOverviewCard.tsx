import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Image, Text, View } from "react-native";
import { colors } from "@/theme/colors";
import { formatTodayLabel, getInitials, getTimeGreeting } from "@/utils/greeting";
import type { ComponentProps } from "react";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

interface OverviewStat {
  label: string;
  value: string | number;
  icon: IoniconName;
}

interface DashboardOverviewCardProps {
  displayName: string;
  companyName: string;
  subtitle?: string | null;
  employeeCode?: string | null;
  photoUri?: string | null;
  stats: OverviewStat[];
}

function OverviewStatCard({ label, value, icon }: OverviewStat) {
  return (
    <View
      className="min-w-0 flex-1 overflow-hidden rounded-2xl"
      style={{ backgroundColor: "rgba(30, 58, 138, 0.55)" }}
    >
      <View className="items-center px-2 py-3">
        <View className="mb-1.5 rounded-xl bg-white/10 p-2">
          <Ionicons name={icon} size={18} color={colors.accent} />
        </View>
        <Text className="text-xl font-bold text-white">{value}</Text>
        <Text className="mt-0.5 text-center text-[10px] font-medium text-white/75" numberOfLines={2}>
          {label}
        </Text>
      </View>
    </View>
  );
}

export function DashboardOverviewCard({
  displayName,
  companyName,
  subtitle,
  employeeCode,
  photoUri,
  stats,
}: DashboardOverviewCardProps) {
  const greeting = getTimeGreeting();
  const today = formatTodayLabel();

  return (
    <View
      className="overflow-hidden rounded-3xl"
      style={{
        shadowColor: colors.primaryDark,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 8,
      }}
    >
      <View className="overflow-hidden">
        <LinearGradient
          colors={[colors.primaryDark, colors.navyMid]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ width: "100%" }}
        >
          <View className="p-4">
            <View className="flex-row items-center gap-3">
              <View
                className="overflow-hidden rounded-2xl border-2 border-white/20 bg-white/10"
                style={{ width: 56, height: 56 }}
              >
                {photoUri ? (
                  <Image source={{ uri: photoUri }} className="h-full w-full" resizeMode="cover" />
                ) : (
                  <View className="h-full w-full items-center justify-center">
                    <Text className="text-lg font-bold text-white">{getInitials(displayName)}</Text>
                  </View>
                )}
              </View>
              <View className="min-w-0 flex-1">
                <View
                  className="self-start rounded-full px-2.5 py-0.5"
                  style={{ backgroundColor: colors.accent }}
                >
                  <Text className="text-[10px] font-bold uppercase tracking-wider text-white">
                    {greeting}
                  </Text>
                </View>
                <Text className="mt-1 text-base font-bold text-white" numberOfLines={1}>
                  {displayName}
                </Text>
                <Text className="text-xs text-white/75" numberOfLines={1}>
                  {companyName}
                </Text>
                {subtitle ? (
                  <Text className="text-[11px] text-white/60" numberOfLines={1}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
            </View>

            <View className="mt-4 flex-row items-center gap-2">
              <Ionicons name="people-outline" size={16} color={colors.accent} />
              <Text className="text-xs font-bold uppercase tracking-wide text-white/80">
                Workforce overview
              </Text>
            </View>

            {stats.length ? (
              <View className="mt-3 flex-row gap-2">
                {stats.map((stat) => (
                  <OverviewStatCard key={stat.label} {...stat} />
                ))}
              </View>
            ) : null}

            <View className="mt-4 flex-row items-center justify-between border-t border-white/10 pt-3">
              <View className="flex-row items-center gap-2">
                <Ionicons name="calendar-outline" size={14} color={colors.accent} />
                <Text className="text-xs text-white/75">{today}</Text>
              </View>
              {employeeCode ? (
                <View className="rounded-full bg-white/15 px-2.5 py-1">
                  <Text className="text-xs font-semibold text-white">{employeeCode}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </LinearGradient>
      </View>
    </View>
  );
}
