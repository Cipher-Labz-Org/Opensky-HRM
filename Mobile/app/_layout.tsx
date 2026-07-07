import "../global.css";

import { useEffect } from "react";
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { useAuthStore } from "@/store/authStore";
import { useConfigStore } from "@/store/configStore";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function Bootstrap() {
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const hydrateConfig = useConfigStore((s) => s.hydrate);
  const authHydrated = useAuthStore((s) => s.hydrated);
  const configHydrated = useConfigStore((s) => s.hydrated);

  useEffect(() => {
    void (async () => {
      await Promise.all([hydrateConfig(), hydrateAuth()]);
      await SplashScreen.hideAsync();
    })();
  }, [hydrateAuth, hydrateConfig]);

  if (!authHydrated || !configHydrated) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <Bootstrap />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
