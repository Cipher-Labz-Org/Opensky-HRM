import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { getEmployee } from "@/api/endpoints/employees";
import { useAuthStore } from "@/store/authStore";
import { getEmployeeId } from "@/utils/permissions";
import { colors } from "@/theme/colors";
import type { AttendanceRecord } from "@/types/attendance";
import { formatTime } from "@/utils/format";
import { parseAttendanceQr } from "./attendanceQr";
import { validateAttendanceQrForEmployee } from "./attendanceQrValidation";
import { useAttendancePunch } from "./useAttendancePunch";
import { useCheckInMode } from "./useCheckInMode";
import {
  checkInModeHint,
  modeAllowsDirectPunch,
  modeRequiresQr,
} from "./attendanceCheckInMode";

interface PunchActionCardProps {
  todayRecord?: AttendanceRecord | null;
  onPunched?: () => void;
}

function formatLiveClock(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatLiveDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function TodayStatus({ record }: { record?: AttendanceRecord | null }) {
  if (!record) {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          borderRadius: 999,
          paddingHorizontal: 12,
          paddingVertical: 6,
          backgroundColor: colors.primaryLight,
        }}
      >
        <View style={{ height: 8, width: 8, borderRadius: 4, backgroundColor: colors.muted }} />
        <Text style={{ fontSize: 12, fontWeight: "500", color: colors.muted }}>
          Not punched in today
        </Text>
      </View>
    );
  }

  const punchedIn = !!record.punchIn;
  const punchedOut = !!record.punchOut;

  if (punchedIn && !punchedOut) {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          borderRadius: 999,
          paddingHorizontal: 12,
          paddingVertical: 6,
          backgroundColor: colors.accentSoft,
        }}
      >
        <View style={{ height: 8, width: 8, borderRadius: 4, backgroundColor: colors.accent }} />
        <Text style={{ fontSize: 12, fontWeight: "600", color: colors.accent }}>
          Clocked in at {formatTime(record.punchIn)}
        </Text>
      </View>
    );
  }

  if (punchedIn && punchedOut) {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          borderRadius: 999,
          paddingHorizontal: 12,
          paddingVertical: 6,
          backgroundColor: colors.primaryLight,
        }}
      >
        <Ionicons name="checkmark-circle" size={14} color={colors.navyMid} />
        <Text style={{ fontSize: 12, fontWeight: "600", color: colors.navyMid }}>
          Last session · {formatTime(record.punchIn)} – {formatTime(record.punchOut)}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: colors.primaryLight,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: "500", color: colors.muted }}>{record.status}</Text>
    </View>
  );
}

/** Browser camera prompt — expo permission hooks are unreliable on web. */
async function requestWebCameraAccess(): Promise<{ ok: boolean; message?: string }> {
  if (typeof window === "undefined") {
    return { ok: false, message: "Camera is not available in this environment." };
  }

  const insecure =
    window.isSecureContext === false &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1";

  if (insecure) {
    return {
      ok: false,
      message:
        "Browsers block the camera on insecure HTTP. Open via http://localhost or use the phone app.",
    };
  }

  const media = navigator.mediaDevices;
  if (!media?.getUserMedia) {
    return {
      ok: false,
      message: "This browser does not support camera access. Use the phone app, or paste the QR payload.",
    };
  }

  try {
    const stream = await media.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });
    stream.getTracks().forEach((track) => track.stop());
    return { ok: true };
  } catch (err) {
    const name = err instanceof DOMException ? err.name : "";
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return {
        ok: false,
        message:
          "Camera was blocked. Allow Camera for this site, then try again. Or use the phone app.",
      };
    }
    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return { ok: false, message: "No camera was found on this device." };
    }
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Could not open the camera.",
    };
  }
}

export function PunchActionCard({ todayRecord, onPunched }: PunchActionCardProps) {
  const employeeId = getEmployeeId(useAuthStore((s) => s.user));
  const profileQuery = useQuery({
    queryKey: ["profile", employeeId],
    queryFn: () => getEmployee(employeeId!),
    enabled: !!employeeId,
    staleTime: 60_000,
  });
  const [now, setNow] = useState(() => new Date());
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [manualPayload, setManualPayload] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [cameraKey, setCameraKey] = useState(0);
  const [webCameraOk, setWebCameraOk] = useState(Platform.OS !== "web");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const { punch, punching } = useAttendancePunch();
  const checkInModeQuery = useCheckInMode();
  // Prefer QR until policy loads — never flash a direct Punch button for QR companies.
  const checkInMode = checkInModeQuery.data ?? "BusinessUnitQr";
  const useQrFlow = modeRequiresQr(checkInMode);
  const useDirectFlow = modeAllowsDirectPunch(checkInMode) && checkInModeQuery.isSuccess;

  const isOpenSession = Boolean(todayRecord?.punchIn && !todayRecord?.punchOut);
  const nextAction = isOpenSession ? "Punch out" : "Punch in";
  const punchType = useMemo<"in" | "out">(
    () => (isOpenSession ? "out" : "in"),
    [isOpenSession]
  );

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const ensureCameraAccess = useCallback(async (): Promise<boolean> => {
    setCameraError(null);
    setRequesting(true);
    try {
      if (Platform.OS === "web") {
        const web = await requestWebCameraAccess();
        if (!web.ok) {
          setWebCameraOk(false);
          setCameraError(web.message ?? "Camera access denied.");
          setShowManual(true);
          return false;
        }
        setWebCameraOk(true);
        await requestPermission().catch(() => null);
        setCameraKey((k) => k + 1);
        return true;
      }

      const result = permission?.granted ? permission : await requestPermission();
      if (!result?.granted) {
        setCameraError(
          result?.canAskAgain === false
            ? "Camera permission was denied. Enable it in phone Settings → OpenSky HRM → Camera."
            : "Camera permission is required to scan the QR code."
        );
        setShowManual(true);
        return false;
      }
      setCameraKey((k) => k + 1);
      return true;
    } finally {
      setRequesting(false);
    }
  }, [permission, requestPermission]);

  const startScan = useCallback(async () => {
    setScanned(false);
    setShowManual(false);
    setScanning(true);
    const ok = await ensureCameraAccess();
    if (!ok) {
      // Stay in scanning panel so user can allow again or paste payload.
    }
  }, [ensureCameraAccess]);

  const stopScan = useCallback(() => {
    setScanning(false);
    setScanned(false);
    setShowManual(false);
    setManualPayload("");
    setCameraError(null);
  }, []);

  const submitPayload = useCallback(
    async (raw: string) => {
      if (punching) return;

      const parsed = parseAttendanceQr(raw);
      if (!parsed) {
        Alert.alert(
          "Invalid QR",
          "This is not a valid attendance QR. Scan a code from Settings → Attendance Places (business unit or location)."
        );
        setScanned(false);
        return;
      }

      const profile = profileQuery.data;
      if (profile) {
        const scopeError = validateAttendanceQrForEmployee(parsed, profile);
        if (scopeError) {
          Alert.alert("Cannot punch", scopeError);
          setScanned(false);
          return;
        }
      }

      try {
        const qrPayload = raw.trim().startsWith("{")
          ? raw.trim()
          : JSON.stringify(
              parsed.kind === "location"
                ? {
                    type: parsed.type,
                    v: parsed.v,
                    purpose: parsed.purpose ?? "attendance-location",
                    locationId: parsed.locationId,
                    code: parsed.code,
                    sig: parsed.sig,
                  }
                : {
                    type: parsed.type,
                    v: parsed.v,
                    purpose: parsed.purpose ?? "attendance-bu",
                    businessUnitId: parsed.businessUnitId,
                    code: parsed.code,
                    sig: parsed.sig,
                  }
            );

        await punch({
          type: punchType,
          businessUnitId: parsed.kind === "businessUnit" ? parsed.businessUnitId : undefined,
          locationId: parsed.kind === "location" ? parsed.locationId : undefined,
          qrPayload,
          checkInMode,
        });
        setManualPayload("");
        setScanning(false);
        setShowManual(false);
        setCameraError(null);
        onPunched?.();
      } catch (error) {
        Alert.alert(
          "Punch failed",
          error instanceof Error ? error.message : "Could not record punch."
        );
      } finally {
        setScanned(false);
      }
    },
    [checkInMode, onPunched, profileQuery.data, punch, punchType, punching]
  );

  const directPunch = useCallback(async () => {
    if (punching) return;
    try {
      await punch({ kind: "direct", type: punchType, checkInMode });
      onPunched?.();
    } catch (error) {
      Alert.alert(
        "Punch failed",
        error instanceof Error ? error.message : "Could not record punch."
      );
    }
  }, [checkInMode, onPunched, punch, punchType, punching]);

  const onBarcodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (scanned || punching) return;
      setScanned(true);
      void submitPayload(data);
    },
    [punching, scanned, submitPayload]
  );

  const cameraReady = Platform.OS === "web" ? webCameraOk : permission?.granted === true;
  const busy = Boolean(punching) || requesting;

  return (
    <View style={{ marginTop: 12, alignSelf: "stretch", width: "100%" }}>
      {/* Status card — NO elevation (Android elevation can hide nested action buttons). */}
      <View
        style={{
          overflow: "hidden",
          borderRadius: 24,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            paddingHorizontal: 16,
            paddingVertical: 12,
            backgroundColor: colors.primaryLight,
          }}
        >
          <Ionicons name={useQrFlow ? "qr-code-outline" : "time-outline"} size={18} color={colors.accent} />
          <Text
            style={{
              fontSize: 12,
              fontWeight: "700",
              textTransform: "uppercase",
              letterSpacing: 0.6,
              color: colors.navy,
            }}
          >
            {useQrFlow ? "Scan to punch" : "Punch attendance"}
          </Text>
        </View>

        <View style={{ padding: 20, alignItems: "center" }}>
          <Text style={{ fontSize: 36, fontWeight: "700", letterSpacing: -0.5, color: colors.navy }}>
            {formatLiveClock(now)}
          </Text>
          <Text style={{ marginTop: 4, fontSize: 14, color: colors.muted }}>
            {formatLiveDate(now)}
          </Text>
          <View style={{ marginTop: 12 }}>
            <TodayStatus record={todayRecord} />
          </View>
          <Text style={{ marginTop: 8, fontSize: 12, fontWeight: "600", color: colors.navyMid }}>
            Next: {nextAction}
            {isOpenSession ? " (scan QR to clock out)" : " (scan QR — multiple sessions allowed)"}
          </Text>
          <Text style={{ marginTop: 6, textAlign: "center", fontSize: 11, color: colors.muted, paddingHorizontal: 8 }}>
            {checkInModeHint(checkInMode)}
          </Text>
        </View>
      </View>

      {useDirectFlow && !scanning ? (
        <>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => void directPunch()}
            disabled={busy || checkInModeQuery.isLoading}
            accessibilityRole="button"
            accessibilityLabel={nextAction}
            style={{
              marginTop: 16,
              alignSelf: "stretch",
              minHeight: 88,
              borderRadius: 16,
              backgroundColor: "#76B82A",
              borderWidth: 2,
              borderColor: "#5A8F1F",
              opacity: busy || checkInModeQuery.isLoading ? 0.65 : 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 16,
              paddingVertical: 16,
              ...Platform.select({
                android: { elevation: 0 },
                default: {},
              }),
            }}
          >
            <View
              style={{
                backgroundColor: "rgba(255,255,255,0.25)",
                borderRadius: 999,
                padding: 8,
                marginRight: 12,
              }}
            >
              {punching ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Ionicons name="finger-print-outline" size={24} color="#ffffff" />
              )}
            </View>
            <View style={{ flexShrink: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: "800", color: "#ffffff" }}>{nextAction}</Text>
              <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.9)", marginTop: 2 }}>
                {checkInModeQuery.isLoading ? "Loading check-in policy…" : checkInMode.replace(/([A-Z])/g, " $1").trim()}
              </Text>
            </View>
          </TouchableOpacity>
        </>
      ) : null}

      {useQrFlow && !scanning ? (
        <>
          {/* OUTSIDE the card so Android never paints this action invisible */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => void startScan()}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={isOpenSession ? "Scan QR to punch out" : "Scan QR to punch in"}
            accessibilityState={{ disabled: busy }}
            style={{
              marginTop: 16,
              alignSelf: "stretch",
              minHeight: 88,
              borderRadius: 16,
              backgroundColor: isOpenSession ? colors.navy : "#76B82A",
              borderWidth: 2,
              borderColor: isOpenSession ? colors.navyMid : "#5A8F1F",
              opacity: busy ? 0.65 : 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 16,
              paddingVertical: 16,
              ...Platform.select({
                android: { elevation: 0 },
                default: {},
              }),
            }}
          >
            <View
              style={{
                backgroundColor: "rgba(255,255,255,0.25)",
                borderRadius: 999,
                padding: 8,
                marginRight: 12,
              }}
            >
              {requesting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Ionicons
                  name={isOpenSession ? "log-out-outline" : "scan-outline"}
                  size={24}
                  color="#ffffff"
                />
              )}
            </View>
            <View style={{ flexShrink: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: "800", color: "#ffffff" }}>
                {isOpenSession ? "Scan to punch out" : "Scan to punch in"}
              </Text>
              <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.9)", marginTop: 2 }}>
                Business unit or location QR
              </Text>
            </View>
          </TouchableOpacity>

          <View
            style={{
              marginTop: 12,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <Ionicons name="business-outline" size={13} color={colors.muted} />
            <Text style={{ fontSize: 11, color: colors.muted }}>
              Use the QR from Settings → Attendance Places
            </Text>
          </View>
        </>
      ) : null}

      {useQrFlow && scanning ? (
        <View
          style={{
            marginTop: 16,
            overflow: "hidden",
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            padding: 16,
          }}
        >
          <View
            style={{
              overflow: "hidden",
              borderRadius: 16,
              borderWidth: 2,
              borderColor: colors.accent,
              backgroundColor: "#0b1220",
              minHeight: 240,
            }}
          >
            {requesting ? (
              <View
                style={{
                  height: 240,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                  paddingHorizontal: 24,
                }}
              >
                <ActivityIndicator color="#ffffff" />
                <Text style={{ textAlign: "center", fontSize: 14, color: "#ffffff" }}>
                  Requesting camera…
                </Text>
              </View>
            ) : !cameraReady ? (
              <View
                style={{
                  height: 240,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                  paddingHorizontal: 24,
                }}
              >
                <Ionicons name="camera-outline" size={36} color="#ffffff" />
                <Text style={{ textAlign: "center", fontSize: 14, color: "#ffffff" }}>
                  {cameraError ?? "Camera access is required to scan"}
                </Text>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => void ensureCameraAccess()}
                  style={{
                    backgroundColor: "#76B82A",
                    borderWidth: 2,
                    borderColor: "#5A8F1F",
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    ...Platform.select({ android: { elevation: 0 }, default: {} }),
                  }}
                >
                  <Text style={{ color: "#ffffff", fontWeight: "700" }}>Allow camera</Text>
                </TouchableOpacity>
                {Platform.OS !== "web" && permission?.canAskAgain === false ? (
                  <TouchableOpacity activeOpacity={0.8} onPress={() => void Linking.openSettings()}>
                    <Text style={{ color: "#93c5fd", fontSize: 12, fontWeight: "600" }}>
                      Open phone settings
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : (
              <View style={{ height: 240, width: "100%" }}>
                <CameraView
                  key={cameraKey}
                  style={{ flex: 1, width: "100%", height: 240 }}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                  onBarcodeScanned={scanned || punching ? undefined : onBarcodeScanned}
                />
                {(scanned || punching) && (
                  <View
                    style={{
                      position: "absolute",
                      top: 0,
                      right: 0,
                      bottom: 0,
                      left: 0,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "rgba(0,0,0,0.45)",
                    }}
                  >
                    <ActivityIndicator color="#ffffff" size="large" />
                    <Text style={{ marginTop: 12, fontSize: 14, fontWeight: "600", color: "#ffffff" }}>
                      Recording {nextAction.toLowerCase()}…
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {cameraError && cameraReady === false ? (
            <Text style={{ marginTop: 8, textAlign: "center", fontSize: 11, color: colors.danger }}>
              {cameraError}
            </Text>
          ) : (
            <View
              style={{
                marginTop: 12,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <Ionicons name="scan-outline" size={13} color={colors.muted} />
              <Text style={{ fontSize: 11, color: colors.muted }}>
                Point at the QR from Settings → Attendance Places
              </Text>
            </View>
          )}

          <View style={{ marginTop: 12, flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={stopScan}
              disabled={!!punching}
              style={{
                flex: 1,
                alignItems: "center",
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                paddingVertical: 12,
                backgroundColor: colors.primaryLight,
                opacity: punching ? 0.6 : 1,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: "600", color: colors.navyMid }}>Cancel</Text>
            </TouchableOpacity>
            {scanned && !punching ? (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setScanned(false)}
                style={{
                  flex: 1,
                  alignItems: "center",
                  borderRadius: 12,
                  paddingVertical: 12,
                  backgroundColor: "#76B82A",
                  borderWidth: 2,
                  borderColor: "#5A8F1F",
                  ...Platform.select({ android: { elevation: 0 }, default: {} }),
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#ffffff" }}>Scan again</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setShowManual((v) => !v)}
            style={{ marginTop: 12, alignItems: "center", paddingVertical: 8 }}
          >
            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.navyMid }}>
              {showManual ? "Hide manual entry" : "Paste QR payload instead"}
            </Text>
          </TouchableOpacity>

          {showManual ? (
            <View style={{ marginTop: 4, gap: 8 }}>
              <TextInput
                value={manualPayload}
                onChangeText={setManualPayload}
                placeholder="Paste JSON from Business Unit QR…"
                placeholderTextColor={colors.muted}
                multiline
                style={{
                  minHeight: 72,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  padding: 12,
                  color: colors.text,
                  backgroundColor: colors.fieldBg,
                  fontSize: 12,
                  textAlignVertical: "top",
                }}
              />
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => void submitPayload(manualPayload)}
                disabled={!!punching || !manualPayload.trim()}
                style={{
                  backgroundColor: "#76B82A",
                  borderWidth: 2,
                  borderColor: "#5A8F1F",
                  borderRadius: 12,
                  paddingVertical: 12,
                  alignItems: "center",
                  opacity: punching || !manualPayload.trim() ? 0.5 : 1,
                  ...Platform.select({ android: { elevation: 0 }, default: {} }),
                }}
              >
                {punching ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={{ color: "#ffffff", fontWeight: "700" }}>
                    Submit & {nextAction.toLowerCase()}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
