import { RefreshControl, ScrollView, Text, View } from "react-native";
import { Link, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { LoadingState } from "@/components/ui";
import {
  ActivityRow,
  DashboardBrandBar,
  DashboardCtaButton,
  DashboardOverviewCard,
  DashboardSectionTitle,
  QuickActionTile,
  formatLeaveActivityMeta,
} from "@/features/dashboard";
import { getEmployee } from "@/api/endpoints/employees";
import { getLeaveBalances, getMyLeaveRequests } from "@/api/endpoints/leave";
import { getUnreadCount } from "@/api/endpoints/notifications";
import { getAttendanceSummary } from "@/api/endpoints/attendance";
import { useAuthStore } from "@/store/authStore";
import { useConfigStore } from "@/store/configStore";
import { buildAssetUrl } from "@/utils/connect";
import { getEmployeeId, hasLicensedModule, canApproveLeave } from "@/utils/permissions";
import { LICENSED_MODULES } from "@/config/constants";
import { endOfMonthIso, startOfMonthIso } from "@/utils/format";
import { colors } from "@/theme/colors";

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const companyName = useConfigStore((s) => s.companyName);
  const apiBaseUrl = useConfigStore((s) => s.apiBaseUrl);
  const employeeId = getEmployeeId(user);

  const showLeave = hasLicensedModule(user, LICENSED_MODULES.LEAVE);
  const showAttendance = hasLicensedModule(user, LICENSED_MODULES.ATTENDANCE);
  const showApprovals = showLeave && canApproveLeave(user);

  const profileQuery = useQuery({
    queryKey: ["profile", employeeId],
    queryFn: () => getEmployee(employeeId!),
    enabled: !!employeeId,
  });

  const leaveBalancesQuery = useQuery({
    queryKey: ["leave", "balances", employeeId],
    queryFn: () => getLeaveBalances(employeeId!),
    enabled: !!employeeId && showLeave,
  });

  const leaveRequestsQuery = useQuery({
    queryKey: ["leave", "requests", "recent"],
    queryFn: () => getMyLeaveRequests({ pageSize: 5 }),
    enabled: !!employeeId && showLeave,
  });

  const attendanceSummaryQuery = useQuery({
    queryKey: ["attendance", "summary", employeeId],
    queryFn: () =>
      getAttendanceSummary({
        employeeId: employeeId!,
        from: startOfMonthIso(),
        to: endOfMonthIso(),
      }),
    enabled: !!employeeId && showAttendance,
  });

  const unreadQuery = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: getUnreadCount,
  });

  const profile = profileQuery.data;
  const displayName = profile?.fullName ?? user?.employeeName ?? user?.username ?? "there";
  const photoUri = buildAssetUrl(
    apiBaseUrl ?? "",
    profile?.profileImageUrl ?? user?.profileImageUrl
  );
  const jobSubtitle =
    profile?.jobTitleName ?? profile?.positionTitle ?? profile?.departmentName ?? null;

  const totalRemaining =
    leaveBalancesQuery.data?.reduce((sum, item) => sum + item.remaining, 0) ?? 0;

  const overviewStats = [
    ...(showLeave
      ? [{ label: "Leave left", value: totalRemaining.toFixed(0), icon: "calendar-outline" as const }]
      : []),
    ...(showAttendance
      ? [
          {
            label: "Present",
            value: attendanceSummaryQuery.data?.totalPresent ?? "—",
            icon: "time-outline" as const,
          },
        ]
      : []),
    {
      label: "Alerts",
      value: unreadQuery.data?.unreadCount ?? 0,
      icon: "notifications-outline" as const,
    },
  ];

  const refreshing =
    profileQuery.isRefetching ||
    leaveBalancesQuery.isRefetching ||
    leaveRequestsQuery.isRefetching ||
    attendanceSummaryQuery.isRefetching;

  const onRefresh = () => {
    void profileQuery.refetch();
    void leaveBalancesQuery.refetch();
    void leaveRequestsQuery.refetch();
    void attendanceSummaryQuery.refetch();
    void unreadQuery.refetch();
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "left", "right"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-8"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <DashboardBrandBar />

        <View className="px-4">
          <DashboardOverviewCard
            displayName={displayName}
            companyName={companyName}
            subtitle={jobSubtitle}
            employeeCode={profile?.employeeCode}
            photoUri={photoUri}
            stats={overviewStats}
          />
        </View>

        {showLeave ? (
          <View className="mt-6 px-4">
            <DashboardSectionTitle
              title="Recent leave"
              action={
                <Link href="/(tabs)/leave" asChild>
                  <Text className="text-xs font-bold" style={{ color: colors.navyMid }}>
                    View all →
                  </Text>
                </Link>
              }
            />

            {leaveRequestsQuery.isLoading ? (
              <LoadingState />
            ) : leaveRequestsQuery.data?.items.length ? (
              leaveRequestsQuery.data.items.map((item) => (
                <ActivityRow
                  key={item.id}
                  title={item.leaveTypeName}
                  subtitle={item.status}
                  meta={formatLeaveActivityMeta(item.startDate, item.endDate, item.totalDays)}
                  status={item.status}
                  icon="airplane-outline"
                  iconBgClass={
                    item.status.toLowerCase().includes("pending")
                      ? "bg-warning"
                      : item.status.toLowerCase().includes("approve")
                        ? "bg-success"
                        : "bg-primary"
                  }
                />
              ))
            ) : (
              <View
                className="rounded-2xl border border-dashed px-4 py-6"
                style={{ borderColor: colors.border, backgroundColor: colors.primaryLight }}
              >
                <Text className="text-center text-sm font-medium" style={{ color: colors.navyMid }}>
                  No leave requests yet.
                </Text>
              </View>
            )}

            <View className="mt-4">
              <DashboardCtaButton
                title="Apply for leave"
                onPress={() => router.push("/(tabs)/leave/apply")}
              />
            </View>
          </View>
        ) : null}

        <View className="mt-6 px-4">
          <DashboardSectionTitle title="Quick actions" />
          <View className="flex-row flex-wrap gap-3">
            {showAttendance ? (
              <QuickActionTile
                label="Clock in/out"
                icon="finger-print-outline"
                tone="primary"
                onPress={() => router.push("/(tabs)/attendance")}
              />
            ) : null}
            {showApprovals ? (
              <QuickActionTile
                label="Approvals"
                icon="checkmark-done-outline"
                tone="success"
                onPress={() => router.push("/(tabs)/approvals")}
              />
            ) : null}
            <QuickActionTile
              label="My profile"
              icon="person-outline"
              tone="soft"
              onPress={() => router.push("/(tabs)/profile")}
            />
            {(unreadQuery.data?.unreadCount ?? 0) > 0 ? (
              <QuickActionTile
                label="Notifications"
                icon="notifications-outline"
                tone="accent"
                onPress={() => router.push("/(tabs)/notifications")}
              />
            ) : null}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
