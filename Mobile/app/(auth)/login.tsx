import { useState } from "react";
import { Alert, Platform, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import {
  AuthErrorBanner,
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
  const [error, setError] = useState<string | null>(null);

  const logoUri = buildAssetUrl(apiBaseUrl ?? "", companyLogoUrl);
  const subtitle = companyName
    ? `Sign in to access your ${companyName} workspace`
    : "Sign in to access your OpenSky HRM workspace";

  const onSubmit = async () => {
    const user = username.trim();
    // Do not trim password — trailing spaces may be intentional; leading/trailing username spaces are not.
    if (!user || !password) {
      setError("Enter your username and password.");
      return;
    }
    setError(null);
    try {
      const response = await login(user, password);
      if (!response?.user) {
        setError("Sign-in succeeded but the user profile was missing. Try again.");
        return;
      }
      if (response.user.mustChangePassword) {
        router.replace("/(auth)/change-password");
        return;
      }
      router.replace("/(tabs)");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid credentials.";
      const hint =
        /invalid username or password/i.test(message)
          ? `${message}\n\nUse the exact username or email from People → Login (not the display name).`
          : message;
      setError(hint);
      if (Platform.OS !== "web") {
        Alert.alert("Sign in failed", hint);
      }
    }
  };

  return (
    <LoginScreenLayout compact>
      <View style={{ alignSelf: "stretch", width: "100%" }}>
        <LoginFormCard title="Welcome Back!" subtitle={subtitle} logoUri={logoUri}>
          <View style={{ marginBottom: 16, alignSelf: "stretch" }}>
            <AuthInputField
              label="Username or email"
              icon="person-outline"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              textContentType="username"
              placeholder="Enter your username or email"
              value={username}
              returnKeyType="next"
              onChangeText={(value) => {
                setUsername(value);
                if (error) setError(null);
              }}
            />
          </View>

          <View style={{ marginBottom: 12, alignSelf: "stretch" }}>
            <AuthInputField
              label="Password"
              icon="lock-closed-outline"
              secureToggle
              autoComplete="password"
              textContentType="password"
              placeholder="Enter your password"
              value={password}
              returnKeyType="go"
              blurOnSubmit={false}
              onSubmitEditing={() => void onSubmit()}
              onChangeText={(value) => {
                setPassword(value);
                if (error) setError(null);
              }}
            />
          </View>

          <View
            style={{
              marginBottom: 16,
              flexDirection: "row",
              justifyContent: "flex-end",
              alignSelf: "stretch",
            }}
          >
            <AuthTextLink
              title="Forgot Password?"
              color={LOGIN_THEME.skyBlue}
              onPress={() => router.push("/(auth)/forgot-password")}
            />
          </View>

          {error ? (
            <View style={{ marginBottom: 16, alignSelf: "stretch" }}>
              <AuthErrorBanner message={error} />
            </View>
          ) : null}
        </LoginFormCard>

        {/* Sign In OUTSIDE the card so Android never paints it invisible */}
        <View style={{ marginTop: 16, marginBottom: 12, alignSelf: "stretch", width: "100%" }}>
          <LoginPrimaryButton
            title="Sign In"
            icon="log-in-outline"
            loading={isAuthenticating}
            disabled={isAuthenticating}
            onPress={() => void onSubmit()}
          />
        </View>

        <Text
          style={{
            marginBottom: 12,
            textAlign: "center",
            fontSize: 14,
            color: LOGIN_THEME.muted,
          }}
        >
          Wrong company?{" "}
          <Text
            style={{ color: LOGIN_THEME.skyBlue, fontWeight: "600" }}
            onPress={() => router.push("/(auth)/connect")}
          >
            Reconnect backend
          </Text>
        </Text>

        <TouchableOpacity
          onPress={() => router.replace("/(auth)/connect")}
          activeOpacity={0.75}
          style={{ paddingVertical: 8 }}
        >
          <Text
            style={{
              textAlign: "center",
              fontSize: 14,
              fontWeight: "600",
              color: LOGIN_THEME.skyBlue,
            }}
          >
            Change company
          </Text>
        </TouchableOpacity>
      </View>
    </LoginScreenLayout>
  );
}
