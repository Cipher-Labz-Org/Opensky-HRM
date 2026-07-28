import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { LOGIN_THEME } from "@/theme/loginTheme";
import { colors } from "@/theme/colors";

/** Bottom wave bands — navy / sky / green from logo */
export function LoginWaveBackground() {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: 260,
      }}
    >
      <View
        style={{
          position: "absolute",
          bottom: -40,
          left: -80,
          right: -80,
          height: 200,
          borderTopLeftRadius: 220,
          borderTopRightRadius: 160,
          backgroundColor: LOGIN_THEME.navy,
        }}
      />
      <LinearGradient
        colors={[colors.navy, LOGIN_THEME.skyBlue, "#5BC4EB"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          position: "absolute",
          bottom: -20,
          left: -60,
          right: -60,
          height: 150,
          borderTopLeftRadius: 200,
          borderTopRightRadius: 140,
        }}
      />
      <LinearGradient
        colors={["#5FA022", LOGIN_THEME.green, "#8BC93E"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          position: "absolute",
          bottom: 0,
          left: -40,
          right: -40,
          height: 110,
          borderTopLeftRadius: 180,
          borderTopRightRadius: 120,
        }}
      />
    </View>
  );
}
