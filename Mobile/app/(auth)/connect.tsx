import { useCallback, useEffect, useState } from "react";
import { Alert, Platform, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  AuthErrorBanner,
  AuthInputField,
  LoginFormCard,
  LoginPrimaryButton,
  LoginScreenLayout,
  LoginSecondaryButton,
} from "@/features/auth";
import { getBranding, getMobileConnectionInfo } from "@/api/endpoints/auth";
import { useConfigStore } from "@/store/configStore";
import { normalizeApiBaseUrl, parseConnectionPayload } from "@/utils/connect";
import { LOGIN_THEME } from "@/theme/loginTheme";

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
    <LoginScreenLayout compact={false}>
      <LoginFormCard
        showLogo={false}
        title="Connect to company"
        subtitle="Scan the QR code from Settings or enter your backend URL"
      >
        <View
          className="gap-4 rounded-xl border p-4"
          style={{ borderColor: LOGIN_THEME.border, backgroundColor: LOGIN_THEME.fieldBg }}
        >
          <View className="flex-row items-center gap-2">
            <View
              className="items-center justify-center rounded-xl p-2"
              style={{ backgroundColor: "#E8F6FC" }}
            >
              <Ionicons name="business-outline" size={18} color={LOGIN_THEME.skyBlue} />
            </View>
            <Text className="text-sm font-bold" style={{ color: LOGIN_THEME.navy }}>
              Company connection
            </Text>
          </View>

          {!permission?.granted ? (
            <View className="gap-3">
              <Text className="text-sm" style={{ color: LOGIN_THEME.muted }}>
                Camera access is needed to scan your company QR code.
              </Text>
              <LoginSecondaryButton title="Allow camera" onPress={() => void requestPermission()} />
            </View>
          ) : scanning ? (
            <View
              className="overflow-hidden rounded-xl border-2"
              style={{ borderColor: LOGIN_THEME.skyBlue }}
            >
              <CameraView
                style={{ height: 220 }}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                onBarcodeScanned={onBarcodeScanned}
              />
            </View>
          ) : null}

          <LoginSecondaryButton
            title={scanning ? "Enter URL manually" : "Scan QR code"}
            onPress={() => {
              setScanned(false);
              setScanning((value) => !value);
            }}
          />

          <AuthInputField
            label="Backend URL"
            icon="link-outline"
            placeholder="https://your-backend.openskyhrm.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            value={manualUrl}
            onChangeText={setManualUrl}
          />

          <LoginPrimaryButton
            title="Connect"
            icon="link-outline"
            variant="green"
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
        </View>
      </LoginFormCard>
    </LoginScreenLayout>
  );
}
