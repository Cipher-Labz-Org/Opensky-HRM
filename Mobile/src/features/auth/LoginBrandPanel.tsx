import { Image, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { OPENSKY_HRM_BRAND_LOGO } from "@/config/branding";
import { LOGIN_THEME } from "@/theme/loginTheme";

const FEATURES = [
  { label: "People", icon: "people-outline" as const },
  { label: "Attendance", icon: "calendar-outline" as const },
  { label: "Payroll", icon: "document-text-outline" as const },
  { label: "Insights", icon: "bar-chart-outline" as const },
];

export function LoginBrandPanel() {
  return (
    <View className="px-5 pt-2">
      <Image
        source={OPENSKY_HRM_BRAND_LOGO}
        style={{ width: 200, height: 32 }}
        resizeMode="contain"
        accessibilityLabel="OpenSky HRM"
      />

      <Text className="mt-4 text-[22px] font-bold leading-7" style={{ color: LOGIN_THEME.navy }}>
        Empowering{" "}
        <Text style={{ color: LOGIN_THEME.skyBlue }}>People.</Text>
        {"\n"}
        Elevating{" "}
        <Text style={{ color: LOGIN_THEME.green }}>Performance.</Text>
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="mt-4 gap-2.5 pr-4"
      >
        {FEATURES.map((feature) => (
          <View
            key={feature.label}
            className="flex-row items-center gap-2 rounded-full border px-3 py-2"
            style={{ borderColor: LOGIN_THEME.border, backgroundColor: "#FFFFFF" }}
          >
            <Ionicons name={feature.icon} size={16} color={LOGIN_THEME.skyBlue} />
            <Text className="text-xs font-semibold" style={{ color: LOGIN_THEME.navy }}>
              {feature.label}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
