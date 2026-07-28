import { Ionicons } from "@expo/vector-icons";
import { Text, View, type DimensionValue } from "react-native";
import type { AttendanceSummary } from "@/types/attendance";
import { LOGIN_THEME } from "@/theme/loginTheme";
import { dashboardCardStyle } from "./dashboardStyles";

interface AttendanceBar {
  label: string;
  value: number;
  color: string;
}

interface DashboardAttendanceCardProps {
  summary: AttendanceSummary;
  monthLabel: string;
}

function ProgressBar({ label, value, max, color }: AttendanceBar & { max: number }) {
  const width: DimensionValue = max > 0 ? `${Math.max(8, Math.round((value / max) * 100))}%` : "8%";

  return (
    <View className="mb-3">
      <View className="mb-1.5 flex-row items-center justify-between">
        <Text className="text-sm font-medium" style={{ color: LOGIN_THEME.navy }}>
          {label}
        </Text>
        <Text className="text-sm font-bold" style={{ color: LOGIN_THEME.skyBlue }}>
          {value}
        </Text>
      </View>
      <View className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: "#EEF4FA" }}>
        <View className="h-2 rounded-full" style={{ width, backgroundColor: color }} />
      </View>
    </View>
  );
}

export function DashboardAttendanceCard({ summary, monthLabel }: DashboardAttendanceCardProps) {
  const onTime = Math.max(0, summary.totalPresent - summary.totalLate);
  const bars: AttendanceBar[] = [
    { label: "On time", value: onTime, color: LOGIN_THEME.green },
    { label: "Late", value: summary.totalLate, color: LOGIN_THEME.skyBlue },
    { label: "Absent", value: summary.totalAbsent, color: "#D97706" },
    { label: "No record", value: summary.totalNoPunch, color: "#94A3B8" },
  ];
  const max = Math.max(...bars.map((bar) => bar.value), 1);

  return (
    <View className="overflow-hidden rounded-2xl border bg-white p-4" style={dashboardCardStyle}>
      <View className="mb-4 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2.5">
          <View className="rounded-xl p-2" style={{ backgroundColor: "#E8F6FC" }}>
            <Ionicons name="time-outline" size={18} color={LOGIN_THEME.skyBlue} />
          </View>
          <View>
            <Text className="text-base font-bold" style={{ color: LOGIN_THEME.navy }}>
              This month
            </Text>
            <Text className="text-xs" style={{ color: LOGIN_THEME.muted }}>
              Attendance summary
            </Text>
          </View>
        </View>
        <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: "#F4F8FC" }}>
          <Text className="text-[11px] font-semibold" style={{ color: LOGIN_THEME.muted }}>
            {monthLabel}
          </Text>
        </View>
      </View>

      {bars.map((bar) => (
        <ProgressBar key={bar.label} {...bar} max={max} />
      ))}

      <View
        className="mt-1 flex-row items-center justify-between rounded-xl px-3 py-2.5"
        style={{ backgroundColor: "#EEF6E4" }}
      >
        <Text className="text-xs font-medium" style={{ color: LOGIN_THEME.muted }}>
          Avg hours / day
        </Text>
        <Text className="text-sm font-bold" style={{ color: LOGIN_THEME.green }}>
          {summary.averageWorkHours.toFixed(1)}h
        </Text>
      </View>
    </View>
  );
}
