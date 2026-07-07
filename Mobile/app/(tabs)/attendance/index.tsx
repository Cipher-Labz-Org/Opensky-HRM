import { useState } from "react";
import { Alert, RefreshControl, ScrollView, View } from "react-native";
import * as Location from "expo-location";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmptyState, LoadingState } from "@/components/ui";
import { ActivityRow } from "@/features/dashboard";
import {
  AttendancePageHeader,
  AttendanceSectionTitle,
  AttendanceSummaryCard,
  AttendanceTopSection,
  PunchActionCard,
  attendanceStatusToBadgeTone,
  attendanceStatusToIcon,
  attendanceStatusToIconBg,
  findTodayRecord,
  formatAttendanceMeta,
} from "@/features/attendance";
import { getAttendanceRecords, getAttendanceSummary, punchAttendance } from "@/api/endpoints/attendance";
import { useAuthStore } from "@/store/authStore";
import { getEmployeeId } from "@/utils/permissions";
import { endOfMonthIso, formatDate, monthYearLabel, startOfMonthIso } from "@/utils/format";
import { colors } from "@/theme/colors";

export default function AttendanceScreen() {
  const employeeId = getEmployeeId(useAuthStore((s) => s.user));
  const queryClient = useQueryClient();
  const [punching, setPunching] = useState<"in" | "out" | null>(null);

  const now = new Date();
  const from = startOfMonthIso(now);
  const to = endOfMonthIso(now);
  const monthLabel = monthYearLabel(now.getMonth() + 1, now.getFullYear());

  const recordsQuery = useQuery({
    queryKey: ["attendance", "records", employeeId, from, to],
    queryFn: () => getAttendanceRecords({ employeeId: employeeId!, from, to, pageSize: 50 }),
    enabled: !!employeeId,
  });

  const summaryQuery = useQuery({
    queryKey: ["attendance", "summary", employeeId, from, to],
    queryFn: () => getAttendanceSummary({ employeeId: employeeId!, from, to }),
    enabled: !!employeeId,
  });

  const punchMutation = useMutation({
    mutationFn: async (type: "in" | "out") => {
      setPunching(type);
      let latitude: number | undefined;
      let longitude: number | undefined;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const location = await Location.getCurrentPositionAsync({});
        latitude = location.coords.latitude;
        longitude = location.coords.longitude;
      }
      return punchAttendance({ type, latitude, longitude, source: "Mobile" });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["attendance"] });
      Alert.alert("Success", "Attendance punch recorded.");
    },
    onError: (error) => {
      Alert.alert("Punch failed", error instanceof Error ? error.message : "Could not record punch.");
    },
    onSettled: () => setPunching(null),
  });

  const refreshing = recordsQuery.isRefetching || summaryQuery.isRefetching;
  const records = recordsQuery.data?.items ?? [];
  const todayRecord = findTodayRecord(records);

  if (!employeeId) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <AttendancePageHeader
          title="Attendance"
          subtitle="Clock in/out and view records"
          monthLabel={monthLabel}
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

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "left", "right"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-8"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void recordsQuery.refetch();
              void summaryQuery.refetch();
            }}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <AttendanceTopSection
          title="Attendance"
          subtitle="Clock in/out and track this month's presence"
          monthLabel={monthLabel}
        >
          <PunchActionCard
            todayRecord={todayRecord}
            punching={punching}
            onPunchIn={() => punchMutation.mutate("in")}
            onPunchOut={() => punchMutation.mutate("out")}
          />

          {summaryQuery.data ? (
            <View className="mt-4">
              <AttendanceSummaryCard summary={summaryQuery.data} />
            </View>
          ) : summaryQuery.isLoading ? (
            <View className="mt-4">
              <LoadingState />
            </View>
          ) : null}
        </AttendanceTopSection>

        <View className="mt-6 px-4">
          <AttendanceSectionTitle title="Recent records" />
          {recordsQuery.isLoading ? (
            <LoadingState />
          ) : records.length ? (
            records.map((record) => (
              <ActivityRow
                key={record.id}
                title={formatDate(record.date)}
                subtitle={formatAttendanceMeta(record)}
                status={record.status}
                statusTone={attendanceStatusToBadgeTone(record.status)}
                icon={attendanceStatusToIcon(record.status)}
                iconBgClass={attendanceStatusToIconBg(record.status)}
              />
            ))
          ) : (
            <View
              className="rounded-2xl border border-dashed px-4 py-8"
              style={{ borderColor: colors.border, backgroundColor: colors.primaryLight }}
            >
              <EmptyState
                title="No attendance records"
                description="Clock in above to start tracking your attendance."
              />
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
