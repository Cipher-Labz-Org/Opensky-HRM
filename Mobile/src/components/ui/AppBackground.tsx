import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "@/theme/colors";

interface AppBackgroundProps {
  children: ReactNode;
  variant?: "page" | "auth";
  style?: StyleProp<ViewStyle>;
}

/** Soft branded page backdrop — matches web login gradient feel. */
export function AppBackground({ children, variant = "page", style }: AppBackgroundProps) {
  if (variant === "auth") {
    return (
      <View className="flex-1" style={[{ backgroundColor: colors.background }, style]}>
        <LinearGradient
          colors={[colors.loginNavy, colors.skyBlue, colors.tealSoft]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: 340 }}
        />
        <View
          style={{
            position: "absolute",
            top: 120,
            right: -40,
            width: 160,
            height: 160,
            borderRadius: 80,
            backgroundColor: "rgba(118,184,42,0.18)",
          }}
        />
        <View
          style={{
            position: "absolute",
            top: 40,
            left: -30,
            width: 120,
            height: 120,
            borderRadius: 60,
            backgroundColor: "rgba(40,169,224,0.15)",
          }}
        />
        {children}
      </View>
    );
  }

  return (
    <View className="flex-1" style={[{ backgroundColor: colors.background }, style]}>
      <LinearGradient
        colors={["rgba(40,169,224,0.12)", "rgba(244,248,252,0)"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 220 }}
      />
      {children}
    </View>
  );
}
