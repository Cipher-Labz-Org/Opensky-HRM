import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { LOGIN_THEME } from "@/theme/loginTheme";
import { colors } from "@/theme/colors";
import { dashboardCardStyle } from "./dashboardStyles";
import type { ComponentProps } from "react";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

interface QuickActionTileProps {
  label: string;
  icon: IoniconName;
  onPress?: () => void;
  tone?: "teal" | "green" | "navy";
  badge?: number;
  disabled?: boolean;
}

const toneStyles = {
  teal: { bg: colors.tealSoft, icon: colors.brandSky },
  green: { bg: colors.accentSoft, icon: colors.brandGreen },
  navy: { bg: colors.primarySoft, icon: colors.brandNavy },
} as const;

export function QuickActionTile({
  label,
  icon,
  onPress,
  tone = "teal",
  badge,
  disabled,
}: QuickActionTileProps) {
  const style = toneStyles[tone];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        width: 108,
        opacity: disabled ? 0.45 : pressed ? 0.92 : 1,
        transform: [{ scale: disabled ? 1 : pressed ? 0.97 : 1 }],
      })}
    >
      <View
        className="items-center rounded-2xl border bg-white px-3 py-4"
        style={dashboardCardStyle}
      >
        <View className="relative">
          <View className="rounded-2xl p-3" style={{ backgroundColor: style.bg }}>
            <Ionicons name={icon} size={24} color={style.icon} />
          </View>
          {badge && badge > 0 ? (
            <View
              className="absolute -right-1 -top-1 min-w-[18px] items-center rounded-full px-1.5 py-0.5"
              style={{ backgroundColor: LOGIN_THEME.green }}
            >
              <Text className="text-[10px] font-bold text-white">{badge > 9 ? "9+" : badge}</Text>
            </View>
          ) : null}
        </View>
        <Text
          className="mt-3 text-center text-xs font-semibold leading-4"
          style={{ color: LOGIN_THEME.navy }}
          numberOfLines={2}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
