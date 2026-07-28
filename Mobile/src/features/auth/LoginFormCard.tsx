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

export function LoginFormCard({
  title = "Welcome Back!",
  subtitle,
  logoUri,
  showLogo = true,
  children,
}: LoginFormCardProps) {
  return (
    <View
      className="rounded-2xl border bg-white px-5 py-5"
      style={{
        borderColor: LOGIN_THEME.border,
        ...LOGIN_THEME.cardShadow,
      }}
    >
      {showLogo ? (
        <View className="mb-4 items-center">
          <View
            className="items-center justify-center overflow-hidden rounded-full border"
            style={{
              width: 72,
              height: 72,
              borderColor: LOGIN_THEME.border,
              backgroundColor: LOGIN_THEME.fieldBg,
            }}
          >
            {logoUri ? (
              <Image source={{ uri: logoUri }} className="h-full w-full" resizeMode="contain" />
            ) : (
              <Image
                source={OPENSKY_HRM_LOGO}
                style={{ width: 52, height: 52 }}
                resizeMode="contain"
              />
            )}
          </View>
        </View>
      ) : null}

      <Text
        className="text-center text-xl font-bold tracking-tight"
        style={{ color: LOGIN_THEME.navy }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          className="mt-1 text-center text-sm leading-5"
          style={{ color: LOGIN_THEME.muted }}
          numberOfLines={2}
        >
          {subtitle}
        </Text>
      ) : null}

      <View className="mt-5">{children}</View>
    </View>
  );
}
