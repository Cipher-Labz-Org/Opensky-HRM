import { Redirect } from "expo-router";
import { useAuthStore } from "@/store/authStore";
import { useConfigStore } from "@/store/configStore";

export default function Index() {
  const apiBaseUrl = useConfigStore((s) => s.apiBaseUrl);
  const token = useAuthStore((s) => s.token);
  const mustChangePassword = useAuthStore((s) => s.user?.mustChangePassword);

  if (!apiBaseUrl) {
    return <Redirect href="/(auth)/connect" />;
  }

  if (!token) {
    return <Redirect href="/(auth)/login" />;
  }

  if (mustChangePassword) {
    return <Redirect href="/(auth)/change-password" />;
  }

  return <Redirect href="/(tabs)" />;
}
