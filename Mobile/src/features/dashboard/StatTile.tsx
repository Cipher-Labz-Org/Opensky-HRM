import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { colors } from "@/theme/colors";
import type { ComponentProps } from "react";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

interface StatTileProps {
  label: string;
  value: string | number;
  icon: IoniconName;
  tone?: "primary" | "success" | "accent" | "warning";
}

const toneStyles = {
  primary: { bg: colors.primaryLight, icon: colors.navyMid, value: colors.navy },
  success: { bg: colors.successSoft, icon: colors.success, value: colors.success },
  accent: { bg: colors.accentSoft, icon: colors.accent, value: colors.accent },
  warning: { bg: colors.warningSoft, icon: colors.warning, value: colors.warning },
} as const;

export function StatTile({ label, value, icon, tone = "primary" }: StatTileProps) {
  const style = toneStyles[tone];
  return (
    <View
      className="min-w-0 flex-1 items-center rounded-2xl border border-border bg-surface px-2 py-3"
      style={{
        shadowColor: colors.primaryDark,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
      }}
    >
      <View className="mb-2 rounded-xl p-2.5" style={{ backgroundColor: style.bg }}>
        <Ionicons name={icon} size={22} color={style.icon} />
      </View>
      <Text className="text-xl font-bold" style={{ color: style.value }}>
        {value}
      </Text>
      <Text className="mt-1 text-center text-[11px] font-medium text-muted" numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}
