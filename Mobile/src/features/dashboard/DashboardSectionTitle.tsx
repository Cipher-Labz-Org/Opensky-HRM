import { Text, View } from "react-native";
import { LOGIN_THEME } from "@/theme/loginTheme";
import type { ReactNode } from "react";

interface DashboardSectionTitleProps {
  title: string;
  action?: ReactNode;
}

export function DashboardSectionTitle({ title, action }: DashboardSectionTitleProps) {
  return (
    <View className="mb-3 flex-row items-center justify-between">
      <Text className="text-base font-bold" style={{ color: LOGIN_THEME.navy }}>
        {title}
      </Text>
      {action}
    </View>
  );
}
