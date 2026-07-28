import { Image, Text, View } from "react-native";
import { OPENSKY_HRM_BRAND_LOGO } from "@/config/branding";
import { LOGIN_THEME } from "@/theme/loginTheme";

/** Minimal header for mobile login — keeps the form and Sign In button on screen. */
export function LoginCompactHeader() {
  return (
    <View className="items-center px-5 pt-3 pb-1">
      <Image
        source={OPENSKY_HRM_BRAND_LOGO}
        style={{ width: 180, height: 28 }}
        resizeMode="contain"
        accessibilityLabel="OpenSky HRM"
      />
      <Text className="mt-2 text-center text-xs" style={{ color: LOGIN_THEME.muted }}>
        Empowering People. Elevating Performance.
      </Text>
    </View>
  );
}
