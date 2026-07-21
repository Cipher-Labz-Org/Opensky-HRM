import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { colors } from "@/theme/colors";
import { softCardShadow } from "./dashboardStyles";
import type { ComponentProps } from "react";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

interface QuickActionTileProps {
  label: string;
  icon: IoniconName;
  onPress?: () => void;
  tone?: "teal" | "green" | "navy";
}

const toneStyles = {
  teal: { bg: colors.tealSoft, icon: colors.teal },
  green: { bg: colors.accentSoft, icon: colors.accent },
  navy: { bg: colors.primaryLight, icon: colors.navyMid },
} as const;

export function QuickActionTile({ label, icon, onPress, tone = "teal" }: QuickActionTileProps) {
  const style = toneStyles[tone];

  return (
    <Pressable
      onPress={onPress}
      className="min-h-[96px] flex-1"
      style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
    >
      <View
        className="min-h-[96px] flex-1 items-center justify-center rounded-[20px] border border-border bg-surface px-2 py-3"
        style={softCardShadow}
      >
        <View className="rounded-2xl p-2.5" style={{ backgroundColor: style.bg }}>
          <Ionicons name={icon} size={24} color={style.icon} />
        </View>
        <Text
          className="mt-2 text-center text-xs font-bold"
          style={{ color: colors.navy }}
          numberOfLines={2}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
