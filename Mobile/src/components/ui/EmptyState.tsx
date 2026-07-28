import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { LOGIN_THEME } from "@/theme/loginTheme";
import type { ComponentProps } from "react";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: IoniconName;
}

export function EmptyState({ title, description, icon = "file-tray-outline" }: EmptyStateProps) {
  return (
    <View className="items-center justify-center px-6 py-14">
      <View
        className="mb-4 items-center justify-center rounded-2xl p-4"
        style={{ backgroundColor: "#E8F6FC" }}
      >
        <Ionicons name={icon} size={36} color={LOGIN_THEME.skyBlue} />
      </View>
      <Text className="text-center text-base font-bold" style={{ color: LOGIN_THEME.navy }}>
        {title}
      </Text>
      {description ? (
        <Text className="mt-2 text-center text-sm leading-5" style={{ color: LOGIN_THEME.muted }}>
          {description}
        </Text>
      ) : null}
    </View>
  );
}
