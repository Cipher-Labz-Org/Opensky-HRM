import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { LOGIN_THEME } from "@/theme/loginTheme";
import type { ComponentProps } from "react";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

interface DashboardEmptyHintProps {
  icon?: IoniconName;
  title: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function DashboardEmptyHint({
  icon = "file-tray-outline",
  title,
  hint,
  actionLabel,
  onAction,
}: DashboardEmptyHintProps) {
  return (
    <View className="items-center px-5 py-8">
      <View
        className="mb-3 items-center justify-center rounded-2xl p-3"
        style={{ backgroundColor: "#E8F6FC" }}
      >
        <Ionicons name={icon} size={28} color={LOGIN_THEME.skyBlue} />
      </View>
      <Text className="text-center text-sm font-semibold" style={{ color: LOGIN_THEME.navy }}>
        {title}
      </Text>
      {hint ? (
        <Text className="mt-1.5 text-center text-xs leading-5" style={{ color: LOGIN_THEME.muted }}>
          {hint}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          className="mt-4 rounded-full px-4 py-2"
          style={({ pressed }) => ({
            backgroundColor: LOGIN_THEME.skyBlue,
            opacity: pressed ? 0.88 : 1,
          })}
        >
          <Text className="text-xs font-bold text-white">{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
