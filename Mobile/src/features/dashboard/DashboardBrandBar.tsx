import { Image, Text, View } from "react-native";
import { OPENSKY_HRM_LOGO } from "@/config/branding";
import { colors } from "@/theme/colors";
import { formatTodayLabel } from "@/utils/greeting";

export function DashboardBrandBar() {
  return (
    <View className="px-4 pb-3 pt-3">
      <Image
        source={OPENSKY_HRM_LOGO}
        style={{ width: 180, height: 46 }}
        resizeMode="contain"
        accessibilityLabel="OpenSky HRM"
      />
      <Text className="mt-2 text-sm" style={{ color: colors.muted }}>
        {formatTodayLabel()}
      </Text>
    </View>
  );
}
