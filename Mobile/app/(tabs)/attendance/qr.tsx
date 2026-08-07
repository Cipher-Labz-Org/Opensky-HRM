import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { EmptyState } from "@/components/ui";
import {
  AttendanceQrHeader,
  parseAttendanceQr,
  useAttendancePunch,
  useCheckInMode,
  useTodayAttendanceRecord,
} from "@/features/attendance";
import { useAuthStore } from "@/store/authStore";
import { getEmployeeId } from "@/utils/permissions";
import { colors } from "@/theme/colors";

export default function AttendanceQrScanScreen() {
  const user = useAuthStore((s) => s.user);
  const employeeId = getEmployeeId(user);
  const todayRecordQuery = useTodayAttendanceRecord(employeeId);
  const { punch, punching } = useAttendancePunch();
  const checkInModeQuery = useCheckInMode();
  const checkInMode = checkInModeQuery.data ?? "BusinessUnitQr";
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  const punchType = useMemo<"in" | "out">(() => {
    const record = todayRecordQuery.data;
    if (record?.punchIn && !record.punchOut) return "out";
    return "in";
  }, [todayRecordQuery.data]);

  const handleScanned = useCallback(
    async (data: string) => {
      if (scanned || punching) return;
      setScanned(true);

      const parsed = parseAttendanceQr(data);
      if (!parsed) {
        Alert.alert(
          "Invalid QR",
          "This is not a valid attendance QR. Scan a code from Settings → Attendance Places (business unit or location)."
        );
        setScanned(false);
        return;
      }

      try {
        const qrPayload = data.trim().startsWith("{")
          ? data.trim()
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
        router.back();
      } catch {
        setScanned(false);
      }
    },
    [checkInMode, punch, punchType, punching, scanned]
  );

  if (!employeeId) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top", "left", "right"]}>
        <AttendanceQrHeader
          title="Scan attendance QR"
          subtitle="Scan a business unit or location attendance QR to punch"
          onBack={() => router.back()}
        />
        <View className="px-4 pt-6">
          <EmptyState
            title="No employee profile"
            description="Your account is not linked to an employee record."
          />
        </View>
      </SafeAreaView>
    );
  }

  if (Platform.OS === "web") {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top", "left", "right"]}>
        <AttendanceQrHeader
          title="Scan attendance QR"
          subtitle="Camera scanning is available on the mobile app"
          onBack={() => router.back()}
        />
        <View className="px-4 pt-6">
          <EmptyState
            title="Camera not available"
            description="Open the iOS or Android app to scan a business unit QR code."
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!permission) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top", "left", "right"]}>
        <AttendanceQrHeader
          title="Scan attendance QR"
          subtitle="Camera access is required to scan"
          onBack={() => router.back()}
        />
        <View className="mx-4 mt-6 rounded-2xl border border-border bg-surface p-5">
          <Text className="text-sm text-muted">
            Allow camera access so you can scan an attendance QR (business unit or location).
          </Text>
          <Pressable
            onPress={() => void requestPermission()}
            className="mt-4 items-center rounded-xl py-3"
            style={{ backgroundColor: colors.accent }}
          >
            <Text className="font-semibold text-white">Allow camera</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "left", "right"]}>
      <AttendanceQrHeader
        title="Scan attendance QR"
        subtitle={`Scan to ${punchType === "in" ? "punch in" : "punch out"}`}
        onBack={() => router.back()}
      />

      <View className="mx-4 mt-3 overflow-hidden rounded-3xl border border-border bg-black" style={{ height: 360 }}>
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={
            scanned || punching
              ? undefined
              : ({ data }) => {
                  void handleScanned(data);
                }
          }
        />
        {(scanned || punching) && (
          <View className="absolute inset-0 items-center justify-center bg-black/40">
            <ActivityIndicator color="#ffffff" size="large" />
            <Text className="mt-3 text-sm font-semibold text-white">Recording punch…</Text>
          </View>
        )}
      </View>

      <View className="mx-4 mt-4 flex-row items-start gap-2 rounded-2xl border border-border bg-surface px-4 py-3">
        <Ionicons name="information-circle-outline" size={18} color={colors.navyMid} />
        <Text className="flex-1 text-xs leading-5 text-muted">
          Point your camera at the QR code for your business unit or location (Settings →
          Attendance Places). Old employee QR codes are not used for punch.
        </Text>
      </View>

      {scanned && !punching ? (
        <Pressable
          onPress={() => setScanned(false)}
          className="mx-4 mt-3 items-center rounded-xl border border-border py-3"
          style={{ backgroundColor: colors.primaryLight }}
        >
          <Text className="text-sm font-semibold" style={{ color: colors.navyMid }}>
            Scan again
          </Text>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}
