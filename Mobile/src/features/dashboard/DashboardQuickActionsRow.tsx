import { ScrollView, Text, View } from "react-native";
import type { ReactNode } from "react";

interface DashboardQuickActionsRowProps {
  children: ReactNode;
}

export function DashboardQuickActionsRow({ children }: DashboardQuickActionsRowProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-3 pr-4"
    >
      {children}
    </ScrollView>
  );
}
