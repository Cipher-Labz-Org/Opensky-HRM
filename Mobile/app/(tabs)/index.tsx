import { useMemo } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { Link, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { LoadingState } from "@/components/ui";
import {
  DashboardAttendanceCard,
  DashboardBrandBar,
  DashboardCtaButton,
  DashboardListRow,
  DashboardSectionTitle,
  DashboardSoftCard,
  DashboardWelcomeCard,
  QuickActionTile,
  formatLeaveActivityMeta,
} from "@/features/dashboard";
import { getEmployee } from "@/api/endpoints/employees";
import {
  getLeaveBalances,
  getMyLeaveRequests,
  getTeamPendingLeaveRequests,
} from "@/api/endpoints/leave";
import { getUnreadCount } from "@/api/endpoints/notifications";
import { getAttendanceSummary } from "@/api/endpoints/attendance";
import { useAuthStore } from "@/store/authStore";
import { useConfigStore } from "@/store/configStore";
import { buildAssetUrl } from "@/utils/connect";
import { getEmployeeId, hasLicensedModule, canApproveLeave } from "@/utils/permissions";
import { LICENSED_MODULES } from "@/config/constants";
import { endOfMonthIso, monthYearLabel, startOfMonthIso } from "@/utils/format";
import { colors } from "@/theme/colors";

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const companyName = useConfigStore((s) => s.companyName);
  const apiBaseUrl = useConfigStore((s) => s.apiBaseUrl);
  const employeeId = getEmployeeId(user);
  const monthLabel = monthYearLabel(new Date().getMonth() + 1, new Date().getFullYear());

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

  const pendingApprovalsQuery = useQuery({
    queryKey: ["approvals", "leave", "pending", "dashboard"],
    queryFn: async () => {
      const [level1, level2] = await Promise.all([
        getTeamPendingLeaveRequests("Pending"),
        getTeamPendingLeaveRequests("PendingLevel2"),
      ]);
      return [...level1.items, ...level2.items];
    },
    enabled: !!employeeId && showApprovals,
  });

  const pendingApprovals = useMemo(
    () =>
      (pendingApprovalsQuery.data ?? [])
        .filter((request) => request.responsibleEmployeeId === employeeId)
        .slice(0, 4),
    [employeeId, pendingApprovalsQuery.data]
  );

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

  const welcomeStats = [
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
    attendanceSummaryQuery.isRefetching ||
    pendingApprovalsQuery.isRefetching;

  const onRefresh = () => {
    void profileQuery.refetch();
    void leaveBalancesQuery.refetch();
    void leaveRequestsQuery.refetch();
    void attendanceSummaryQuery.refetch();
    void unreadQuery.refetch();
    void pendingApprovalsQuery.refetch();
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }} edges={["top", "left", "right"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-8"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <DashboardBrandBar />

        <View className="gap-4 px-4">
          <DashboardWelcomeCard
            displayName={displayName}
            companyName={companyName ?? "OpenSky HRM"}
            subtitle={jobSubtitle}
            employeeCode={profile?.employeeCode}
            photoUri={photoUri}
            stats={welcomeStats}
          />

          {showAttendance && attendanceSummaryQuery.data ? (
            <DashboardAttendanceCard summary={attendanceSummaryQuery.data} monthLabel={monthLabel} />
          ) : null}

          {showApprovals ? (
            <DashboardSoftCard
              title="Pending approvals"
              subtitle="Leave requests waiting on you"
              icon="shield-checkmark-outline"
              iconColor={colors.teal}
              iconBg={colors.tealSoft}
              action={
                <Link href="/(tabs)/approvals" asChild>
                  <Text className="text-xs font-bold" style={{ color: colors.teal }}>
                    View all
                  </Text>
                </Link>
              }
            >
              {pendingApprovalsQuery.isLoading ? (
                <View className="py-6">
                  <LoadingState />
                </View>
              ) : pendingApprovals.length ? (
                pendingApprovals.map((item, index, items) => (
                  <DashboardListRow
                    key={item.id}
                    title={item.employeeName}
                    subtitle={item.leaveTypeName}
                    meta={formatLeaveActivityMeta(item.startDate, item.endDate, item.totalDays)}
                    status={item.status}
                    icon="document-text-outline"
                    iconColor={colors.teal}
                    iconBg={colors.tealSoft}
                    onPress={() => router.push("/(tabs)/approvals")}
                    isLast={index === items.length - 1}
                  />
                ))
              ) : (
                <View className="px-4 py-6">
                  <Text className="text-center text-sm" style={{ color: colors.muted }}>
                    No pending approvals right now.
                  </Text>
                </View>
              )}
            </DashboardSoftCard>
          ) : null}

          {showLeave ? (
            <DashboardSoftCard
              title="Recent leave"
              subtitle="Your latest time-off requests"
              icon="airplane-outline"
              iconColor={colors.accent}
              iconBg={colors.accentSoft}
              action={
                <Link href="/(tabs)/leave" asChild>
                  <Text className="text-xs font-bold" style={{ color: colors.teal }}>
                    View all
                  </Text>
                </Link>
              }
            >
              {leaveRequestsQuery.isLoading ? (
                <View className="py-6">
                  <LoadingState />
                </View>
              ) : leaveRequestsQuery.data?.items.length ? (
                leaveRequestsQuery.data.items.map((item, index, items) => (
                  <DashboardListRow
                    key={item.id}
                    title={item.leaveTypeName}
                    subtitle={item.status}
                    meta={formatLeaveActivityMeta(item.startDate, item.endDate, item.totalDays)}
                    status={item.status}
                    icon="airplane-outline"
                    iconColor={colors.accent}
                    iconBg={colors.accentSoft}
                    onPress={() => router.push("/(tabs)/leave")}
                    isLast={index === items.length - 1}
                  />
                ))
              ) : (
                <View className="px-4 py-6">
                  <Text className="text-center text-sm" style={{ color: colors.muted }}>
                    No leave requests yet.
                  </Text>
                </View>
              )}
            </DashboardSoftCard>
          ) : null}

          <View>
            <DashboardSectionTitle title="Quick actions" />
            <View className="flex-row flex-wrap gap-3">
              {showAttendance ? (
                <QuickActionTile
                  label="Clock in/out"
                  icon="finger-print-outline"
                  tone="teal"
                  onPress={() => router.push("/(tabs)/attendance")}
                />
              ) : null}
              {showApprovals ? (
                <QuickActionTile
                  label="Approvals"
                  icon="checkmark-done-outline"
                  tone="green"
                  onPress={() => router.push("/(tabs)/approvals")}
                />
              ) : null}
              <QuickActionTile
                label="My profile"
                icon="person-outline"
                tone="navy"
                onPress={() => router.push("/(tabs)/profile")}
              />
              {(unreadQuery.data?.unreadCount ?? 0) > 0 ? (
                <QuickActionTile
                  label="Alerts"
                  icon="notifications-outline"
                  tone="teal"
                  onPress={() => router.push("/(tabs)/notifications")}
                />
              ) : null}
            </View>
          </View>

          {showLeave ? (
            <DashboardCtaButton
              title="Apply for leave"
              icon="arrow-forward"
              onPress={() => router.push("/(tabs)/leave/apply")}
            />
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
