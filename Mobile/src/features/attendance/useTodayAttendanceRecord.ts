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
        pageSize: 50,
        sortBy: "punchIn",
        sortDir: "desc",
      });
      return findTodayRecord(result.items) ?? null;
    },
    enabled: !!employeeId,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
    retry: 2,
  });
}
