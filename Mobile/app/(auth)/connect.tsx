import { useCallback, useState } from "react";
import { Alert, Platform, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  AuthErrorBanner,
  LoginFormCard,
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
              `${baseMessage}\n\nYour phone cannot reach this PC.\n\n1. Connect phone to the SAME Wi‑Fi as the PC (turn OFF mobile data).\n2. On PC run PowerShell as Administrator:\n   Backend/Scripts/allow-mobile-api-firewall.ps1\n3. Keep API running: dotnet run (http://0.0.0.0:5000)\n4. In the app enter: http://192.168.1.9:5000\n\nIf it still fails, your Wi‑Fi may block phone-to-PC (guest network). Try another network or USB hotspot from the PC.`
            );
          }
          throw new Error(
            Platform.OS === "web"
              ? `${baseMessage}\n\nCheck the backend URL and make sure the API is running (e.g. http://127.0.0.1:5000).`
              : `${baseMessage}\n\nCheck the backend URL and make sure the phone has internet (mobile data or Wi‑Fi).`
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

  return (
    <LoginScreenLayout compact={false}>
      <View style={{ alignSelf: "stretch", width: "100%" }}>
        <LoginFormCard
          showLogo={false}
          title="Connect to company"
          subtitle="Scan your company QR code to connect"
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
              disabled={loading}
              onPress={() => {
                setScanned(false);
                setScanning((value) => !value);
              }}
            />

            {loading ? (
              <Text style={{ fontSize: 13, color: LOGIN_THEME.muted, textAlign: "center" }}>
                Connecting…
              </Text>
            ) : null}

            {error ? <AuthErrorBanner message={error} /> : null}
          </View>
        </LoginFormCard>
      </View>
    </LoginScreenLayout>
  );
}
