import type { ReactNode } from "react";
import { Image, Text, View } from "react-native";
import { OPENSKY_HRM_LOGO } from "@/config/branding";
import { LOGIN_THEME } from "@/theme/loginTheme";

interface LoginFormCardProps {
  title?: string;
  subtitle?: string;
  logoUri?: string | null;
  showLogo?: boolean;
  children: ReactNode;
}

/** Full-width card with NO elevation (Android elevation can hide child controls). */
export function LoginFormCard({
  title = "Welcome Back!",
  subtitle,
  logoUri,
  showLogo = true,
  children,
}: LoginFormCardProps) {
  return (
    <View
      style={{
        alignSelf: "stretch",
        width: "100%",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: LOGIN_THEME.border,
        backgroundColor: "#FFFFFF",
        paddingHorizontal: 20,
        paddingVertical: 20,
      }}
    >
      {showLogo ? (
        <View style={{ marginBottom: 16, alignItems: "center" }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              borderWidth: 1,
              borderColor: LOGIN_THEME.border,
              backgroundColor: LOGIN_THEME.fieldBg,
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {logoUri ? (
              <Image source={{ uri: logoUri }} style={{ width: 72, height: 72 }} resizeMode="contain" />
            ) : (
              <Image source={OPENSKY_HRM_LOGO} style={{ width: 52, height: 52 }} resizeMode="contain" />
            )}
          </View>
        </View>
      ) : null}

      <Text
        style={{
          textAlign: "center",
          fontSize: 20,
          fontWeight: "700",
          color: LOGIN_THEME.navy,
        }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={{
            marginTop: 4,
            textAlign: "center",
            fontSize: 14,
            lineHeight: 20,
            color: LOGIN_THEME.muted,
          }}
          numberOfLines={2}
        >
          {subtitle}
        </Text>
      ) : null}

      <View style={{ marginTop: 20, alignSelf: "stretch", width: "100%" }}>{children}</View>
    </View>
  );
}
