import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LoginWaveBackground } from "@/components/ui/LoginWaveBackground";
import { LOGIN_THEME } from "@/theme/loginTheme";
import { LoginBrandPanel } from "./LoginBrandPanel";
import { LoginCompactHeader } from "./LoginCompactHeader";

interface LoginScreenLayoutProps {
  children: ReactNode;
  /** Compact header for login — full brand panel for connect/marketing screens */
  compact?: boolean;
}

export function LoginScreenLayout({ children, compact = true }: LoginScreenLayoutProps) {
  return (
    <View className="flex-1" style={{ backgroundColor: LOGIN_THEME.background }}>
      <LoginWaveBackground />
      <SafeAreaView className="flex-1" edges={["top", "left", "right", "bottom"]}>
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 4 : 0}
        >
          <ScrollView
            className="flex-1"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
          >
            {compact ? <LoginCompactHeader /> : <LoginBrandPanel />}
            <View className="mt-2 px-4">{children}</View>
            <Text className="mt-4 px-4 text-center text-xs" style={{ color: LOGIN_THEME.muted }}>
              © 2026 OpenSky HRM. All rights reserved.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
