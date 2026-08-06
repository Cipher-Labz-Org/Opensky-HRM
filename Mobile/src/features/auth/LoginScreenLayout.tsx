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
    <View style={{ flex: 1, backgroundColor: LOGIN_THEME.background }}>
      <LoginWaveBackground />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right", "bottom"]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 4 : 0}
        >
          <ScrollView
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              flexGrow: 1,
              paddingBottom: 32,
              paddingHorizontal: 16,
            }}
          >
            {compact ? <LoginCompactHeader /> : <LoginBrandPanel />}
            <View style={{ marginTop: 8, alignSelf: "stretch", width: "100%" }}>{children}</View>
            <Text
              style={{
                marginTop: 16,
                textAlign: "center",
                fontSize: 12,
                color: LOGIN_THEME.muted,
              }}
            >
              © 2026 OpenSky HRM. All rights reserved.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
