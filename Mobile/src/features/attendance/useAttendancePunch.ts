import { useState } from "react";
import { Alert } from "react-native";
import * as Location from "expo-location";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { punchAttendance } from "@/api/endpoints/attendance";
import type { AttendanceCheckInMode } from "./attendanceCheckInMode";
import { modeRequiresGps } from "./attendanceCheckInMode";

export type PunchWithQrInput = {
  type: "in" | "out";
  businessUnitId?: string;
  locationId?: string;
  qrPayload: string;
  checkInMode: AttendanceCheckInMode;
};

export type DirectPunchInput = {
  type: "in" | "out";
  checkInMode: AttendanceCheckInMode;
};

async function resolveGps(requireGps: boolean): Promise<{ latitude?: number; longitude?: number }> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      if (requireGps) {
        throw new Error("Location permission is required for this check-in mode. Enable it in Settings.");
      }
      return {};
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  } catch (error) {
    if (requireGps) {
      throw error instanceof Error
        ? error
        : new Error("Could not read GPS location. Enable location services and try again.");
    }
    return {};
  }
}

export function useAttendancePunch() {
  const queryClient = useQueryClient();
  const [punching, setPunching] = useState<"in" | "out" | null>(null);

  const mutation = useMutation({
    mutationFn: async (input: PunchWithQrInput | (DirectPunchInput & { kind: "direct" })) => {
      setPunching(input.type);

      if ("kind" in input && input.kind === "direct") {
        const requireGps = modeRequiresGps(input.checkInMode);
        const { latitude, longitude } = await resolveGps(requireGps);
        return punchAttendance({
          type: input.type,
          latitude,
          longitude,
          source: "Mobile",
        });
      }

      const { type, businessUnitId, locationId, qrPayload, checkInMode } = input as PunchWithQrInput;
      const { latitude, longitude } = await resolveGps(modeRequiresGps(checkInMode));

      return punchAttendance({
        type,
        latitude,
        longitude,
        source: "Mobile QR",
        businessUnitId,
        locationId,
        qrPayload,
      });
    },
    onSuccess: (_, { type }) => {
      void queryClient.invalidateQueries({ queryKey: ["attendance"] });
      void queryClient.refetchQueries({ queryKey: ["attendance", "records"] });
      Alert.alert(
        "Success",
        type === "in"
          ? "You have punched in."
          : "You have punched out."
      );
    },
    onSettled: () => setPunching(null),
  });

  return {
    punch: mutation.mutateAsync,
    punching,
    isPunching: mutation.isPending,
  };
}
