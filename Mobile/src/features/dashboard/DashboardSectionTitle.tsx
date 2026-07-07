import { Text, View } from "react-native";
import { colors } from "@/theme/colors";
import type { ReactNode } from "react";

interface DashboardSectionTitleProps {
  title: string;
  accentColor?: string;
  action?: ReactNode;
}

export function DashboardSectionTitle({
  title,
  accentColor = colors.accent,
  action,
}: DashboardSectionTitleProps) {
  return (
    <View className="mb-3 flex-row items-center justify-between">
      <View className="flex-row items-center gap-2">
        <View className="h-5 w-1 rounded-full" style={{ backgroundColor: accentColor }} />
        <Text className="text-sm font-bold uppercase tracking-wide" style={{ color: colors.navy }}>
          {title}
        </Text>
      </View>
      {action}
    </View>
  );
}
