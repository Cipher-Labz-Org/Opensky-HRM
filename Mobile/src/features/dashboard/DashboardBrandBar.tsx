import { Image, Text, View } from "react-native";
import { OPENSKY_HRM_LOGO } from "@/config/branding";
import { colors } from "@/theme/colors";
import { formatTodayLabel } from "@/utils/greeting";

export function DashboardBrandBar() {
  return (
    <View className="px-4 pb-2 pt-3">
      <View
        className="overflow-hidden rounded-[24px] border border-border px-4 py-4"
        style={{ backgroundColor: colors.surface }}
      >
        <Image
          source={OPENSKY_HRM_LOGO}
          style={{ width: 190, height: 48 }}
          resizeMode="contain"
          accessibilityLabel="OpenSky HRM"
        />
        <Text className="mt-2 text-sm font-medium" style={{ color: colors.muted }}>
          {formatTodayLabel()}
        </Text>
      </View>
    </View>
  );
}
