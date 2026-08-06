import { useCallback, useState } from "react";
import { Alert, Platform, Text, TextInput, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  AuthErrorBanner,
  LoginFormCard,
  LoginPrimaryButton,
  LoginScreenLayout,
  LoginSecondaryButton,
} from "@/features/auth";
import { getBranding, getMobileConnectionInfo } from "@/api/endpoints/auth";
import { useConfigStore } from "@/store/configStore";
import {
  buildConnectionCandidates,
  isLoopbackApiBaseUrl,
  isPrivateLanApiBaseUrl,
  normalizeApiBaseUrl,
  parseConnectionPayload,
  resolveReachableApiBaseUrl,
} from "@/utils/connect";
import { LOGIN_THEME } from "@/theme/loginTheme";

const EXAMPLE_BACKEND_URL =
  Platform.OS === "web" ? "http://127.0.0.1:5000" : "https://your-backend.example.com";

type ConnectionInfo = {
  apiBaseUrl: string;
  companyName: string;
  companyLogoUrl: string | null;
  companyId: string;
};

async function probeBackend(baseUrl: string, companyIdFallback: string): Promise<ConnectionInfo> {
  try {
    const info = await getMobileConnectionInfo(baseUrl);
    return {
      apiBaseUrl: resolveReachableApiBaseUrl(baseUrl, info.apiBaseUrl),
      companyName: info.companyName,
      companyLogoUrl: info.companyLogoUrl,
      companyId: info.companyId || companyIdFallback,
    };
  } catch (primaryError) {
    try {
      const branding = await getBranding(baseUrl);
      return {
        apiBaseUrl: normalizeApiBaseUrl(baseUrl),
        companyName: branding.companyName,
        companyLogoUrl: branding.companyLogoUrl,
        companyId: companyIdFallback,
      };
    } catch {
      // Prefer the connection-info failure — it includes the real native fetch detail.
      throw primaryError instanceof Error
        ? primaryError
        : new Error("Cannot reach the server. Check your connection and backend URL.");
    }
  }
}

export default function ConnectScreen() {
  const setConnection = useConfigStore((s) => s.setConnection);
  const [permission, requestPermission] = useCameraPermissions();
  const [manualUrl, setManualUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyConnection = useCallback(
    async (raw: string) => {
      setLoading(true);
      setError(null);
      try {
        const parsed = parseConnectionPayload(raw);
        const candidates = buildConnectionCandidates(parsed.apiBaseUrl);

        let lastError: Error | null = null;
        let connected: ConnectionInfo | null = null;

        for (const candidate of candidates) {
          try {
            connected = await probeBackend(candidate, parsed.companyId);
            break;
          } catch (err) {
            lastError =
              err instanceof Error
                ? err
                : new Error("Cannot reach the server. Check your connection and backend URL.");
          }
        }

        if (!connected) {
          const baseMessage =
            lastError?.message ??
            "Cannot reach the server. Check your connection and backend URL.";
          if (isPrivateLanApiBaseUrl(parsed.apiBaseUrl) && Platform.OS !== "web") {
            throw new Error(
              `${baseMessage}\n\nYour phone cannot reach this PC address. Connect the phone to the same Wi‑Fi as the PC, allow inbound TCP 5000 in Windows Firewall (run Backend/Scripts/allow-mobile-api-firewall.ps1 as Admin), and keep the API running on http://0.0.0.0:5000.`
            );
          }
          throw new Error(
            `${baseMessage}\n\nCheck the backend URL and make sure the phone has internet (mobile data or Wi‑Fi).`
          );
        }

        if (isLoopbackApiBaseUrl(connected.apiBaseUrl) && Platform.OS !== "web") {
          throw new Error(
            `This backend URL is not reachable from your phone. Use your server’s LAN or public HTTPS URL instead of localhost.`
          );
        }

        await setConnection({
          apiBaseUrl: connected.apiBaseUrl,
          companyName: connected.companyName || parsed.companyName,
          companyLogoUrl: connected.companyLogoUrl,
          companyId: connected.companyId || parsed.companyId,
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
      Alert.alert("Backend URL required", `Example: ${EXAMPLE_BACKEND_URL}`);
      return;
    }
    await applyConnection(manualUrl.trim());
  };

  return (
    <LoginScreenLayout compact={false}>
      <View style={{ alignSelf: "stretch", width: "100%" }}>
        <LoginFormCard
          showLogo={false}
          title="Connect to company"
          subtitle="Scan a company QR code, or enter your backend URL"
        >
          <View style={{ gap: 14, alignSelf: "stretch" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View
                style={{
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 12,
                  padding: 8,
                  backgroundColor: "#E8F6FC",
                }}
              >
                <Ionicons name="business-outline" size={18} color={LOGIN_THEME.skyBlue} />
              </View>
              <Text style={{ fontSize: 14, fontWeight: "700", color: LOGIN_THEME.navy }}>
                Company connection
              </Text>
            </View>

            {!permission?.granted ? (
              <View style={{ gap: 10 }}>
                <Text style={{ fontSize: 13, color: LOGIN_THEME.muted }}>
                  Optional: allow camera to scan a company QR code.
                </Text>
                <LoginSecondaryButton title="Allow camera" onPress={() => void requestPermission()} />
              </View>
            ) : scanning ? (
              <View
                style={{
                  height: 200,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: LOGIN_THEME.skyBlue,
                  overflow: "hidden",
                }}
              >
                <CameraView
                  style={{ flex: 1, width: "100%", height: 200 }}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                  onBarcodeScanned={scanned ? undefined : onBarcodeScanned}
                />
              </View>
            ) : null}

            <LoginSecondaryButton
              title={scanning ? "Hide QR scanner" : "Scan QR code"}
              onPress={() => {
                setScanned(false);
                setScanning((value) => !value);
              }}
            />

            <Text style={{ fontSize: 13, fontWeight: "600", color: LOGIN_THEME.navy }}>
              Backend URL
            </Text>
            <View
              style={{
                alignSelf: "stretch",
                flexDirection: "row",
                alignItems: "center",
                borderRadius: 12,
                borderWidth: 1,
                borderColor: LOGIN_THEME.border,
                backgroundColor: "#FFFFFF",
                paddingHorizontal: 12,
                minHeight: 48,
              }}
            >
              <Ionicons name="link-outline" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
              <TextInput
                value={manualUrl}
                onChangeText={setManualUrl}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                // Avoid keyboardType="url" — on some Androids it corrupts "https://" in the field.
                keyboardType="default"
                placeholder={EXAMPLE_BACKEND_URL}
                placeholderTextColor="#94A3B8"
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 14,
                  color: LOGIN_THEME.navy,
                  paddingVertical: 10,
                }}
              />
            </View>

            <Text style={{ fontSize: 12, color: LOGIN_THEME.muted, lineHeight: 18 }}>
              Enter your company’s API base URL (https://… or http://LAN-IP:5000 for local), then
              connect.
            </Text>

            {error ? <AuthErrorBanner message={error} /> : null}
          </View>
        </LoginFormCard>

        {/* Buttons OUTSIDE the card — avoids Android invisible-button bug */}
        <View style={{ marginTop: 16, gap: 12, alignSelf: "stretch" }}>
          <LoginPrimaryButton
            title={loading ? "Connecting…" : "Connect with URL above"}
            loading={loading}
            disabled={loading}
            onPress={() => void onManualConnect()}
          />
        </View>
      </View>
    </LoginScreenLayout>
  );
}
