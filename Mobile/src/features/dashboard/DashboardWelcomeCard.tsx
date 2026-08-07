import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Image, Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { LOGIN_THEME } from "@/theme/loginTheme";
import { colors } from "@/theme/colors";
import { getInitials } from "@/utils/greeting";
import { dashboardCardStyle } from "./dashboardStyles";
import type { ComponentProps } from "react";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

interface WelcomeStat {
  label: string;
  value: string | number;
  icon: IoniconName;
  tone?: "teal" | "green" | "navy";
  loading?: boolean;
  onPress?: () => void;
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
  teal: { bg: colors.tealSoft, icon: colors.brandSky, value: colors.brandSky },
  green: { bg: colors.accentSoft, icon: colors.brandGreen, value: colors.brandGreen },
  navy: { bg: colors.primarySoft, icon: colors.brandNavy, value: colors.brandNavy },
} as const;

function WelcomeStatPill({ label, value, icon, tone = "teal", loading, onPress }: WelcomeStat) {
  const style = toneStyles[tone];
  const content = (
    <View
      style={{
        minWidth: 0,
        flex: 1,
        borderRadius: 16,
        paddingHorizontal: 8,
        paddingVertical: 14,
        backgroundColor: style.bg,
        minHeight: 96,
        justifyContent: "center",
      }}
    >
      <View style={{ alignItems: "center" }}>
        <Ionicons name={icon} size={20} color={style.icon} />
        {loading ? (
          <ActivityIndicator style={{ marginTop: 10 }} color={style.value} />
        ) : (
          <Text
            style={{
              marginTop: 8,
              fontSize: 24,
              fontWeight: "700",
              lineHeight: 28,
              color: style.value,
            }}
          >
            {String(value)}
          </Text>
        )}
        <Text
          style={{
            marginTop: 6,
            textAlign: "center",
            fontSize: 10,
            fontWeight: "600",
            letterSpacing: 0.4,
            textTransform: "uppercase",
            color: LOGIN_THEME.muted,
          }}
          numberOfLines={2}
        >
          {label}
        </Text>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        className="min-w-0 flex-1"
        style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}
      >
        {content}
      </Pressable>
    );
  }

  return <View className="min-w-0 flex-1">{content}</View>;
}

export function DashboardWelcomeCard({
  displayName,
  companyName,
  subtitle,
  employeeCode,
  photoUri,
  stats,
}: DashboardWelcomeCardProps) {
  return (
    <View className="overflow-hidden rounded-2xl border bg-white" style={dashboardCardStyle}>
      <LinearGradient
        colors={[colors.brandNavy, colors.brandSky]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingHorizontal: 18, paddingTop: 18, paddingBottom: 22 }}
      >
        <View className="flex-row items-start gap-3.5">
          <View
            className="overflow-hidden rounded-full"
            style={{
              width: 56,
              height: 56,
              borderWidth: 2,
              borderColor: "rgba(255,255,255,0.4)",
              backgroundColor: "rgba(255,255,255,0.12)",
            }}
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
            <Text className="text-lg font-bold leading-6 text-white" numberOfLines={2}>
              {displayName}
            </Text>
            <Text className="mt-0.5 text-sm text-white/90" numberOfLines={1}>
              {companyName}
            </Text>
            {subtitle && subtitle !== "—" ? (
              <Text className="mt-0.5 text-xs text-white/75" numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
            {employeeCode ? (
              <View
                className="mt-1.5 self-start rounded-full px-2.5 py-1"
                style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
              >
                <Text className="text-[11px] font-bold text-white">#{employeeCode}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </LinearGradient>

      {stats.length ? (
        <View style={{ flexDirection: "row", gap: 10, padding: 16 }}>
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
