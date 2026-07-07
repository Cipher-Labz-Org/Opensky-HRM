import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { colors } from "@/theme/colors";
import type { ComponentProps } from "react";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

interface QuickActionTileProps {
  label: string;
  icon: IoniconName;
  onPress?: () => void;
  tone?: "primary" | "success" | "accent" | "soft";
}

const toneGradients = {
  primary: [colors.primaryDark, colors.navyMid],
  success: ["#5A9420", colors.accent],
  accent: [colors.navyMid, colors.primaryDark],
  soft: [colors.surface, colors.primaryLight],
} as const;

const toneShadows = {
  primary: colors.primaryDark,
  success: colors.accent,
  accent: colors.navyMid,
  soft: colors.border,
} as const;

const iconColors = {
  primary: "#ffffff",
  success: "#ffffff",
  accent: "#ffffff",
  soft: colors.navyMid,
} as const;

export function QuickActionTile({
  label,
  icon,
  onPress,
  tone = "primary",
}: QuickActionTileProps) {
  const gradient = toneGradients[tone];
  const shadow = toneShadows[tone];
  const isSoft = tone === "soft";

  return (
    <Pressable
      onPress={onPress}
      className="min-h-[92px] flex-1"
      style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
    >
      <View
        className={`min-h-[92px] flex-1 overflow-hidden rounded-2xl ${isSoft ? "border border-border" : ""}`}
        style={{
          shadowColor: shadow,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isSoft ? 0.08 : 0.2,
          shadowRadius: 8,
          elevation: isSoft ? 2 : 4,
        }}
      >
        <LinearGradient
          colors={[...gradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1, width: "100%" }}
        >
          <View className="min-h-[92px] flex-1 items-center justify-center px-2 py-3">
            <View
              className="rounded-2xl p-2"
              style={{ backgroundColor: isSoft ? colors.primaryLight : "rgba(255,255,255,0.15)" }}
            >
              <Ionicons name={icon} size={26} color={iconColors[tone]} />
            </View>
            <Text
              className="mt-2 text-center text-xs font-bold"
              style={{ color: isSoft ? colors.navy : "#ffffff" }}
              numberOfLines={2}
            >
              {label}
            </Text>
          </View>
        </LinearGradient>
      </View>
    </Pressable>
  );
}
