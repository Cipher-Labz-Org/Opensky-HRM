import { useQuery } from "@tanstack/react-query";
import { getAttendanceCheckInMode } from "@/api/endpoints/attendance";
import { normalizeCheckInMode, type AttendanceCheckInMode } from "./attendanceCheckInMode";

export function useCheckInMode() {
  return useQuery({
    queryKey: ["attendance", "check-in-mode"],
    queryFn: async (): Promise<AttendanceCheckInMode> => {
      const result = await getAttendanceCheckInMode();
      return normalizeCheckInMode(result.mode);
    },
    staleTime: 60_000,
  });
}
