import { useQuery } from "@tanstack/react-query";
import { getAttendanceRecords } from "@/api/endpoints/attendance";
import { findTodayRecord, todayIsoDate } from "./attendanceUtils";

export function useTodayAttendanceRecord(employeeId: string | null | undefined) {
  const today = todayIsoDate();

  return useQuery({
    queryKey: ["attendance", "records", employeeId, "today", today],
    queryFn: async () => {
      const result = await getAttendanceRecords({
        employeeId: employeeId!,
        from: today,
        to: today,
        pageSize: 10,
      });
      return findTodayRecord(result.items);
    },
    enabled: !!employeeId,
    refetchInterval: 60_000,
  });
}
