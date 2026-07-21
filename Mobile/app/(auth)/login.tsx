import { useState } from "react";
import { Alert, View } from "react-native";
import { router } from "expo-router";
import { Field } from "@/components/ui";
import {
  AuthFormCard,
  AuthPrimaryButton,
  AuthScreen,
  AuthSecondaryButton,
  AuthTextLink,
} from "@/features/auth";
import { useAuthStore } from "@/store/authStore";
import { useConfigStore } from "@/store/configStore";
import { buildAssetUrl } from "@/utils/connect";

export default function LoginScreen() {
  const companyName = useConfigStore((s) => s.companyName);
  const companyLogoUrl = useConfigStore((s) => s.companyLogoUrl);
  const apiBaseUrl = useConfigStore((s) => s.apiBaseUrl);
  const login = useAuthStore((s) => s.login);
  const isAuthenticating = useAuthStore((s) => s.isAuthenticating);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const logoUri = buildAssetUrl(apiBaseUrl ?? "", companyLogoUrl);

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
    <AuthScreen
      showBrandLogo
      eyebrow={companyName ?? "Welcome"}
      title="Sign in"
      subtitle="Enter your credentials to access your workspace"
      logoUri={logoUri}
    >
      <AuthFormCard title="Account credentials" icon="person-outline">
        <Field
          label="Username or email"
          autoCapitalize="none"
          autoCorrect={false}
          value={username}
          onChangeText={setUsername}
        />
        <Field label="Password" secureTextEntry value={password} onChangeText={setPassword} />

        <AuthPrimaryButton
          title="Sign in"
          loading={isAuthenticating}
          onPress={() => void onSubmit()}
        />

        <AuthTextLink title="Forgot password?" onPress={() => router.push("/(auth)/forgot-password")} />
      </AuthFormCard>

      <View className="mt-4">
        <AuthSecondaryButton title="Change company" onPress={() => router.replace("/(auth)/connect")} />
      </View>
    </AuthScreen>
  );
}
