import { useState } from "react";
import { Alert } from "react-native";
import * as Location from "expo-location";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { punchAttendance } from "@/api/endpoints/attendance";

export type PunchWithQrInput = {
  type: "in" | "out";
  businessUnitId: string;
  qrPayload: string;
};

export function useAttendancePunch() {
  const queryClient = useQueryClient();
  const [punching, setPunching] = useState<"in" | "out" | null>(null);

  const mutation = useMutation({
    mutationFn: async ({ type, businessUnitId, qrPayload }: PunchWithQrInput) => {
      setPunching(type);
      let latitude: number | undefined;
      let longitude: number | undefined;

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          latitude = location.coords.latitude;
          longitude = location.coords.longitude;
        }
      } catch {
        // Location is optional for punch
      }

      return punchAttendance({
        type,
        latitude,
        longitude,
        source: "Mobile QR",
        businessUnitId,
        qrPayload,
      });
    },
    onSuccess: (_, { type }) => {
      void queryClient.invalidateQueries({ queryKey: ["attendance"] });
      Alert.alert(
        "Success",
        type === "in" ? "You have punched in." : "You have punched out."
      );
    },
    onError: (error) => {
      Alert.alert(
        "Punch failed",
        error instanceof Error ? error.message : "Could not record punch."
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
