import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme/colors";
import type { AttendanceRecord } from "@/types/attendance";
import { formatTime } from "@/utils/format";

interface PunchActionCardProps {
  todayRecord?: AttendanceRecord;
  punching: "in" | "out" | null;
  onPunchIn: () => void;
  onPunchOut: () => void;
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

function TodayStatus({ record }: { record?: AttendanceRecord }) {
  if (!record) {
    return (
      <View
        className="flex-row items-center gap-2 rounded-full px-3 py-1.5"
        style={{ backgroundColor: colors.primaryLight }}
      >
        <View className="h-2 w-2 rounded-full bg-muted" />
        <Text className="text-xs font-medium text-muted">Not punched in today</Text>
      </View>
    );
  }

  const punchedIn = !!record.punchIn;
  const punchedOut = !!record.punchOut;

  if (punchedIn && !punchedOut) {
    return (
      <View
        className="flex-row items-center gap-2 rounded-full px-3 py-1.5"
        style={{ backgroundColor: colors.accentSoft }}
      >
        <View className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.accent }} />
        <Text className="text-xs font-semibold" style={{ color: colors.accent }}>
          Clocked in at {formatTime(record.punchIn)}
        </Text>
      </View>
    );
  }

  if (punchedIn && punchedOut) {
    return (
      <View
        className="flex-row items-center gap-2 rounded-full px-3 py-1.5"
        style={{ backgroundColor: colors.primaryLight }}
      >
        <Ionicons name="checkmark-circle" size={14} color={colors.navyMid} />
        <Text className="text-xs font-semibold" style={{ color: colors.navyMid }}>
          Done · {formatTime(record.punchIn)} – {formatTime(record.punchOut)}
        </Text>
      </View>
    );
  }

  return (
    <View
      className="flex-row items-center gap-2 rounded-full px-3 py-1.5"
      style={{ backgroundColor: colors.primaryLight }}
    >
      <Text className="text-xs font-medium text-muted">{record.status}</Text>
    </View>
  );
}

export function PunchActionCard({
  todayRecord,
  punching,
  onPunchIn,
  onPunchOut,
}: PunchActionCardProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <View
      className="mt-3 overflow-hidden rounded-3xl border border-border bg-surface"
      style={{
        shadowColor: colors.primaryDark,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
      }}
    >
      <View
        className="flex-row items-center gap-2 border-b border-border px-4 py-3"
        style={{ backgroundColor: colors.primaryLight }}
      >
        <Ionicons name="finger-print-outline" size={18} color={colors.accent} />
        <Text className="text-xs font-bold uppercase tracking-wide" style={{ color: colors.navy }}>
          Clock in / out
        </Text>
      </View>

      <View className="p-5">
        <View className="items-center">
          <Text className="text-4xl font-bold tracking-tight" style={{ color: colors.navy }}>
            {formatLiveClock(now)}
          </Text>
          <Text className="mt-1 text-sm text-muted">{formatLiveDate(now)}</Text>
          <View className="mt-3">
            <TodayStatus record={todayRecord} />
          </View>
        </View>

        <View className="mt-5 flex-row gap-3">
          <View className="min-h-[88px] flex-1">
            <Pressable
              onPress={onPunchIn}
              disabled={!!punching}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: 88,
                borderRadius: 16,
                overflow: "hidden",
                backgroundColor: colors.accent,
                opacity: pressed || punching ? 0.88 : 1,
              })}
            >
              <View className="flex-1 items-center justify-center px-3 py-4">
                {punching === "in" ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <View
                      className="mb-2 rounded-full p-2"
                      style={{ backgroundColor: "rgba(255,255,255,0.25)" }}
                    >
                      <Ionicons name="log-in-outline" size={24} color="#ffffff" />
                    </View>
                    <Text style={{ fontSize: 16, fontWeight: "700", color: "#ffffff" }}>
                      Clock in
                    </Text>
                  </>
                )}
              </View>
            </Pressable>
          </View>

          <View className="min-h-[88px] flex-1">
            <Pressable
              onPress={onPunchOut}
              disabled={!!punching}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: 88,
                borderRadius: 16,
                overflow: "hidden",
                backgroundColor: colors.surface,
                borderWidth: 2,
                borderColor: colors.navyMid,
                opacity: pressed || punching ? 0.88 : 1,
              })}
            >
              <View className="flex-1 items-center justify-center px-3 py-4">
                {punching === "out" ? (
                  <ActivityIndicator color={colors.navyMid} />
                ) : (
                  <>
                    <View
                      className="mb-2 rounded-full p-2"
                      style={{ backgroundColor: colors.primaryLight }}
                    >
                      <Ionicons name="log-out-outline" size={24} color={colors.navyMid} />
                    </View>
                    <Text style={{ fontSize: 16, fontWeight: "700", color: colors.navyMid }}>
                      Clock out
                    </Text>
                  </>
                )}
              </View>
            </Pressable>
          </View>
        </View>

        <View className="mt-4 flex-row items-center justify-center gap-1.5">
          <Ionicons name="location-outline" size={13} color={colors.muted} />
          <Text className="text-[11px] text-muted">Location captured when permitted</Text>
        </View>
      </View>
    </View>
  );
}
