import { Text, View } from "react-native";
import { colors } from "@/theme/colors";

export function DashboardBrandBar() {
  return (
    <View className="px-4 pb-2 pt-2">
      <View className="flex-row items-center gap-2">
        <View className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.accent }} />
        <Text className="text-xs font-semibold uppercase tracking-widest text-muted">
          Employee self-service
        </Text>
      </View>
      <View className="mt-1 flex-row items-baseline">
        <Text className="text-xl font-bold" style={{ color: colors.navy }}>
          OPENSKY{" "}
        </Text>
        <Text className="text-xl font-bold" style={{ color: colors.accent }}>
          HRM
        </Text>
      </View>
    </View>
  );
}
