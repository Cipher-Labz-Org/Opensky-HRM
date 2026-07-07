import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Image, Text, View } from "react-native";
import { colors } from "@/theme/colors";
import { formatTodayLabel, getInitials, getTimeGreeting } from "@/utils/greeting";

interface DashboardHeroCardProps {
  displayName: string;
  companyName: string;
  subtitle?: string | null;
  employeeCode?: string | null;
  photoUri?: string | null;
}

export function DashboardHeroCard({
  displayName,
  companyName,
  subtitle,
  employeeCode,
  photoUri,
}: DashboardHeroCardProps) {
  const greeting = getTimeGreeting();
  const today = formatTodayLabel();

  return (
    <View
      className="overflow-hidden rounded-3xl border border-border bg-surface"
      style={{
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.18,
        shadowRadius: 20,
        elevation: 8,
      }}
    >
      <View className="overflow-hidden">
        <LinearGradient
          colors={[colors.accent, colors.primary, "#4a9ad4"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ height: 5, width: "100%" }}
        />
      </View>

      <View className="flex-row items-center gap-4 p-4">
        <View className="overflow-hidden rounded-2xl border-[3px] border-primary bg-primary-light p-0.5">
          <View className="overflow-hidden rounded-[14px] bg-surface" style={{ width: 82, height: 82 }}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} className="h-full w-full" resizeMode="cover" />
            ) : (
              <View className="h-full w-full items-center justify-center bg-primary-light">
                <Text className="text-2xl font-bold text-primary">{getInitials(displayName)}</Text>
              </View>
            )}
          </View>
        </View>

        <View className="min-w-0 flex-1">
          <View className="self-start rounded-full bg-primary px-2.5 py-0.5">
            <Text className="text-[10px] font-bold uppercase tracking-wider text-white">
              {greeting}
            </Text>
          </View>
          <Text className="mt-1.5 text-lg font-bold text-ink" numberOfLines={2}>
            {displayName}
          </Text>
          <Text className="mt-0.5 text-sm font-semibold text-primary" numberOfLines={1}>
            {companyName}
          </Text>
          {subtitle ? (
            <Text className="mt-0.5 text-xs text-muted" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      <View className="flex-row items-center justify-between bg-soft px-4 py-3">
        <View className="flex-row items-center gap-2">
          <View className="rounded-lg bg-primary/15 p-1.5">
            <Ionicons name="calendar" size={14} color={colors.primary} />
          </View>
          <Text className="text-xs font-medium text-ink">{today}</Text>
        </View>
        {employeeCode ? (
          <View className="rounded-full bg-primary px-3 py-1">
            <Text className="text-xs font-bold text-white">{employeeCode}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
