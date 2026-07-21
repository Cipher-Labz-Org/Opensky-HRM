import { Ionicons } from "@expo/vector-icons";
import { Text, View, type DimensionValue } from "react-native";
import { colors } from "@/theme/colors";
import type { AttendanceSummary } from "@/types/attendance";
import { softCardShadow } from "./dashboardStyles";

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
        <Text className="text-sm font-medium" style={{ color: colors.navy }}>
          {label}
        </Text>
        <Text className="text-sm font-bold" style={{ color: colors.navyMid }}>
          {value}
        </Text>
      </View>
      <View className="h-2.5 overflow-hidden rounded-full" style={{ backgroundColor: colors.soft }}>
        <View className="h-2.5 rounded-full" style={{ width, backgroundColor: color }} />
      </View>
    </View>
  );
}

export function DashboardAttendanceCard({ summary, monthLabel }: DashboardAttendanceCardProps) {
  const onTime = Math.max(0, summary.totalPresent - summary.totalLate);
  const bars: AttendanceBar[] = [
    { label: "On time", value: onTime, color: colors.accent },
    { label: "Late", value: summary.totalLate, color: colors.teal },
    { label: "Absent", value: summary.totalAbsent, color: colors.warning },
    { label: "No record", value: summary.totalNoPunch, color: "#94A3B8" },
  ];
  const max = Math.max(...bars.map((bar) => bar.value), 1);

  return (
    <View
      className="overflow-hidden rounded-[24px] border border-border bg-surface p-4"
      style={softCardShadow}
    >
      <View className="mb-4 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <View className="rounded-xl p-2" style={{ backgroundColor: colors.tealSoft }}>
            <Ionicons name="time-outline" size={18} color={colors.teal} />
          </View>
          <View>
            <Text className="text-base font-bold" style={{ color: colors.navy }}>
              This month
            </Text>
            <Text className="text-xs" style={{ color: colors.muted }}>
              Attendance summary
            </Text>
          </View>
        </View>
        <Text className="text-[11px] font-medium" style={{ color: colors.muted }}>
          {monthLabel}
        </Text>
      </View>

      {bars.map((bar) => (
        <ProgressBar key={bar.label} {...bar} max={max} />
      ))}

      <View
        className="mt-1 flex-row items-center justify-between rounded-2xl px-3 py-2.5"
        style={{ backgroundColor: colors.primaryLight }}
      >
        <Text className="text-xs font-medium" style={{ color: colors.muted }}>
          Avg hours / day
        </Text>
        <Text className="text-sm font-bold" style={{ color: colors.navyMid }}>
          {summary.averageWorkHours.toFixed(1)}h
        </Text>
      </View>
    </View>
  );
}
