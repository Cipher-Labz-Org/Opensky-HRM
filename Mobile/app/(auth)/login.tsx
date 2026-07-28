import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import {
  AuthInputField,
  AuthTextLink,
  LoginFormCard,
  LoginPrimaryButton,
  LoginScreenLayout,
} from "@/features/auth";
import { useAuthStore } from "@/store/authStore";
import { useConfigStore } from "@/store/configStore";
import { buildAssetUrl } from "@/utils/connect";
import { LOGIN_THEME } from "@/theme/loginTheme";

export default function LoginScreen() {
  const companyName = useConfigStore((s) => s.companyName);
  const companyLogoUrl = useConfigStore((s) => s.companyLogoUrl);
  const apiBaseUrl = useConfigStore((s) => s.apiBaseUrl);
  const login = useAuthStore((s) => s.login);
  const isAuthenticating = useAuthStore((s) => s.isAuthenticating);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const logoUri = buildAssetUrl(apiBaseUrl ?? "", companyLogoUrl);
  const subtitle = companyName
    ? `Sign in to access your ${companyName} workspace`
    : "Sign in to access your OpenSky HRM workspace";

  const onSubmit = async () => {
    if (!username.trim() || !password) {
      Alert.alert("Missing credentials", "Enter your username and password.");
      return;
    }
    try {
      const response = await login(username.trim(), password);
      if (response.user.mustChangePassword) {
        router.replace("/(auth)/change-password");
        return;
      }
      router.replace("/(tabs)");
    } catch (error) {
      Alert.alert("Sign in failed", error instanceof Error ? error.message : "Invalid credentials.");
    }
  };

  return (
    <LoginScreenLayout compact>
      <LoginFormCard title="Welcome Back!" subtitle={subtitle} logoUri={logoUri}>
        <View className="mb-4">
          <AuthInputField
            label="Username"
            icon="person-outline"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Enter your username"
            value={username}
            onChangeText={setUsername}
          />
        </View>

        <View className="mb-3">
          <AuthInputField
            label="Password"
            icon="lock-closed-outline"
            secureToggle
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
          />
        </View>

        <View className="mb-4 flex-row items-center justify-end">
          <AuthTextLink
            title="Forgot Password?"
            color={LOGIN_THEME.skyBlue}
            onPress={() => router.push("/(auth)/forgot-password")}
          />
        </View>

        <View className="mb-4">
          <LoginPrimaryButton
            title="Sign In"
            loading={isAuthenticating}
            disabled={!username.trim() || !password}
            onPress={() => void onSubmit()}
          />
        </View>

        <Text className="mb-3 text-center text-sm" style={{ color: LOGIN_THEME.muted }}>
          Need help?{" "}
          <Text
            style={{ color: LOGIN_THEME.skyBlue, fontWeight: "600" }}
            onPress={() => router.push("/(auth)/connect")}
          >
            Contact your administrator
          </Text>
        </Text>

        <Pressable
          onPress={() => router.replace("/(auth)/connect")}
          style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
        >
          <Text className="text-center text-sm font-semibold" style={{ color: LOGIN_THEME.skyBlue }}>
            Change company
          </Text>
        </Pressable>
      </LoginFormCard>
    </LoginScreenLayout>
  );
}
