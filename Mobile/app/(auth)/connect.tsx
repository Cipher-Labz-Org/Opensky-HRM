import { useCallback, useEffect, useState } from "react";
import { Alert, Platform, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { Field } from "@/components/ui";
import {
  AuthErrorBanner,
  AuthFormCard,
  AuthPrimaryButton,
  AuthScreen,
  AuthSecondaryButton,
} from "@/features/auth";
import { getBranding, getMobileConnectionInfo } from "@/api/endpoints/auth";
import { useConfigStore } from "@/store/configStore";
import { normalizeApiBaseUrl, parseConnectionPayload } from "@/utils/connect";

const DEFAULT_DEV_BACKEND = "http://localhost:5000";

export default function ConnectScreen() {
  const setConnection = useConfigStore((s) => s.setConnection);
  const [permission, requestPermission] = useCameraPermissions();
  const [manualUrl, setManualUrl] = useState(Platform.OS === "web" ? DEFAULT_DEV_BACKEND : "");
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(Platform.OS !== "web");
  const [scanned, setScanned] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS === "web") {
      setScanning(false);
    }
  }, []);

  const applyConnection = useCallback(
    async (raw: string) => {
      setLoading(true);
      setError(null);
      try {
        const parsed = parseConnectionPayload(raw);
        const info = await getMobileConnectionInfo(parsed.apiBaseUrl).catch(async () => {
          const branding = await getBranding(parsed.apiBaseUrl);
          return {
            apiBaseUrl: parsed.apiBaseUrl,
            companyName: branding.companyName,
            companyLogoUrl: branding.companyLogoUrl,
            companyId: parsed.companyId,
          };
        });

        await setConnection({
          apiBaseUrl: normalizeApiBaseUrl(info.apiBaseUrl),
          companyName: info.companyName,
          companyLogoUrl: info.companyLogoUrl,
          companyId: info.companyId,
        });
        router.replace("/(auth)/login");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not connect to this backend.";
        setError(message);
        if (Platform.OS !== "web") {
          Alert.alert("Connection failed", message);
        }
        setScanned(false);
      } finally {
        setLoading(false);
      }
    },
    [setConnection]
  );

  const onBarcodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (scanned || loading) return;
      setScanned(true);
      void applyConnection(data);
    },
    [applyConnection, loading, scanned]
  );

  const onManualConnect = async () => {
    if (!manualUrl.trim()) {
      Alert.alert("Backend URL required", "Enter your company backend URL.");
      return;
    }
    await applyConnection(manualUrl.trim());
  };

  return (
    <AuthScreen
      eyebrow="Get started"
      title="Connect to company"
      subtitle="Scan the QR code from Settings or enter your backend URL"
    >
      <AuthFormCard title="Company connection" icon="qr-code-outline">
        {!permission?.granted ? (
          <View className="gap-3">
            <Text className="text-sm text-muted">
              Camera access is needed to scan your company QR code.
            </Text>
            <AuthSecondaryButton title="Allow camera" onPress={() => void requestPermission()} />
          </View>
        ) : scanning ? (
          <View className="overflow-hidden rounded-2xl border border-border">
            <CameraView
              style={{ height: 280 }}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={onBarcodeScanned}
            />
          </View>
        ) : null}

        <AuthSecondaryButton
          title={scanning ? "Enter URL manually" : "Scan QR code"}
          onPress={() => {
            setScanned(false);
            setScanning((value) => !value);
          }}
        />

        <Field
          label="Backend URL"
          placeholder="https://your-backend.openskyhrm.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          value={manualUrl}
          onChangeText={setManualUrl}
        />

        <AuthPrimaryButton
          title="Connect"
          icon="link-outline"
          loading={loading}
          onPress={() => void onManualConnect()}
        />

        {error ? (
          <AuthErrorBanner
            message={error}
            hint={
              Platform.OS === "web"
                ? "Ensure the API is running on port 5000 and has been restarted after the latest changes."
                : undefined
            }
          />
        ) : null}
      </AuthFormCard>
    </AuthScreen>
  );
}
