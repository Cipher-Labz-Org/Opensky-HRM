import { Text, View } from "react-native";
import { colors } from "@/theme/colors";
import type { ReactNode } from "react";

interface DashboardSectionTitleProps {
  title: string;
  action?: ReactNode;
}

export function DashboardSectionTitle({ title, action }: DashboardSectionTitleProps) {
  return (
    <View className="mb-3 flex-row items-center justify-between">
      <Text className="text-lg font-bold" style={{ color: colors.navy }}>
        {title}
      </Text>
      {action}
    </View>
  );
}
