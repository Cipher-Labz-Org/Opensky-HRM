import { RefreshControl, ScrollView, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
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
  formatAttendanceMeta,
  useAttendancePunch,
  useTodayAttendanceRecord,
} from "@/features/attendance";
import { getAttendanceRecords, getAttendanceSummary } from "@/api/endpoints/attendance";
import { useAuthStore } from "@/store/authStore";
import { getEmployeeId } from "@/utils/permissions";
import { endOfMonthIso, formatDate, monthYearLabel, startOfMonthIso } from "@/utils/format";
import { colors } from "@/theme/colors";

export default function AttendanceScreen() {
  const employeeId = getEmployeeId(useAuthStore((s) => s.user));
  const { punch, punching } = useAttendancePunch();

  const now = new Date();
  const from = startOfMonthIso(now);
  const to = endOfMonthIso(now);
  const monthLabel = monthYearLabel(now.getMonth() + 1, now.getFullYear());

  const todayRecordQuery = useTodayAttendanceRecord(employeeId);

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

  const refreshing =
    recordsQuery.isRefetching || summaryQuery.isRefetching || todayRecordQuery.isRefetching;
  const records = recordsQuery.data?.items ?? [];
  const todayRecord = todayRecordQuery.data;

  if (!employeeId) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <AttendancePageHeader
          title="Attendance"
          subtitle="Punch in/out and view records"
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
              void todayRecordQuery.refetch();
            }}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <AttendanceTopSection
          title="Attendance"
          subtitle="Punch in/out and track this month's presence"
          monthLabel={monthLabel}
        >
          <PunchActionCard
            todayRecord={todayRecord}
            punching={punching}
            onPunchIn={() => punch("in")}
            onPunchOut={() => punch("out")}
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
                description="Punch in above to start tracking your attendance."
              />
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
