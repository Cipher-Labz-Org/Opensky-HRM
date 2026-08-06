import { useMemo } from "react";
import { RefreshControl, View } from "react-native";
import { router, type Href } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { LoadingState, ScreenShell } from "@/components/ui";
import { PunchActionCard, useTodayAttendanceRecord } from "@/features/attendance";
import {
  DashboardAttendanceCard,
  DashboardCtaButton,
  DashboardDateHeader,
  DashboardEmptyHint,
  DashboardLinkChip,
  DashboardListRow,
  DashboardQuickActionsRow,
  DashboardSectionTitle,
  DashboardSoftCard,
  DashboardWelcomeCard,
  QuickActionTile,
  formatLeaveActivityMeta,
} from "@/features/dashboard";
import { resolveJobTitle } from "@/features/profile";
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
import { LOGIN_THEME } from "@/theme/loginTheme";

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
    queryKey: ["leave", "requests", "recent", employeeId],
    queryFn: () => getMyLeaveRequests(employeeId!, { pageSize: 5 }),
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
  const jobSubtitle = profile ? resolveJobTitle(profile) : null;

  const totalRemaining =
    leaveBalancesQuery.data?.reduce((sum, item) => sum + item.remaining, 0) ?? 0;

  const unreadCount = unreadQuery.data?.unreadCount ?? 0;

  const todayRecordQuery = useTodayAttendanceRecord(employeeId);
  const todayRecord = todayRecordQuery.data;
  const isOpenSession = Boolean(todayRecord?.punchIn && !todayRecord?.punchOut);

  const welcomeStats = [
    ...(showLeave
      ? [
          {
            label: "Leave left",
            value: totalRemaining.toFixed(0),
            icon: "calendar-outline" as const,
            onPress: () => router.push("/(tabs)/leave"),
          },
        ]
      : []),
    ...(showAttendance
      ? [
          {
            label: "Present",
            value: attendanceSummaryQuery.data?.totalPresent ?? "—",
            icon: "time-outline" as const,
            onPress: () => router.push("/(tabs)/attendance"),
          },
        ]
      : []),
    {
      label: "Alerts",
      value: unreadCount,
      icon: "notifications-outline" as const,
      onPress: () => router.push("/(tabs)/notifications"),
    },
  ];

  const refreshing =
    profileQuery.isRefetching ||
    leaveBalancesQuery.isRefetching ||
    leaveRequestsQuery.isRefetching ||
    attendanceSummaryQuery.isRefetching ||
    todayRecordQuery.isRefetching ||
    pendingApprovalsQuery.isRefetching;

  const onRefresh = () => {
    void profileQuery.refetch();
    void leaveBalancesQuery.refetch();
    void leaveRequestsQuery.refetch();
    void attendanceSummaryQuery.refetch();
    void todayRecordQuery.refetch();
    void unreadQuery.refetch();
    void pendingApprovalsQuery.refetch();
  };

  return (
    <ScreenShell
      header={<DashboardDateHeader />}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={LOGIN_THEME.skyBlue}
          colors={[LOGIN_THEME.skyBlue]}
        />
      }
    >
      <View className="gap-5 px-4">
        <DashboardWelcomeCard
          displayName={displayName}
          companyName={companyName ?? "OpenSky HRM"}
          subtitle={jobSubtitle}
          employeeCode={profile?.employeeCode}
          photoUri={photoUri}
          stats={welcomeStats}
        />

        {showAttendance && employeeId ? (
          <View>
            <DashboardSectionTitle
              title="Punch in / out"
              action={
                <DashboardLinkChip
                  label="View all"
                  onPress={() => router.push("/(tabs)/attendance")}
                />
              }
            />
            <PunchActionCard
              todayRecord={todayRecord}
              onPunched={() => {
                void todayRecordQuery.refetch();
                void attendanceSummaryQuery.refetch();
              }}
            />
          </View>
        ) : null}

        <View>
          <DashboardSectionTitle title="Quick actions" />
          <DashboardQuickActionsRow>
            {showAttendance ? (
              <QuickActionTile
                label={isOpenSession ? "Scan to punch out" : "Scan to punch in"}
                icon={isOpenSession ? "log-out-outline" : "qr-code-outline"}
                tone={isOpenSession ? "navy" : "green"}
                onPress={() => router.push("/(tabs)/attendance/qr" as Href)}
              />
            ) : null}
            {showLeave ? (
              <QuickActionTile
                label="Apply leave"
                icon="airplane-outline"
                tone="green"
                onPress={() => router.push("/(tabs)/leave/apply")}
              />
            ) : null}
            {showAttendance ? (
              <QuickActionTile
                label="Attendance"
                icon="time-outline"
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
                badge={pendingApprovals.length}
              />
            ) : null}
            <QuickActionTile
              label="My profile"
              icon="person-outline"
              tone="navy"
              onPress={() => router.push("/(tabs)/profile")}
            />
            <QuickActionTile
              label="Alerts"
              icon="notifications-outline"
              tone="teal"
              badge={unreadCount}
              onPress={() => router.push("/(tabs)/notifications")}
            />
          </DashboardQuickActionsRow>
        </View>

        {showApprovals ? (
          <DashboardSoftCard
            title="Pending approvals"
            subtitle="Leave requests waiting on you"
            icon="shield-checkmark-outline"
            iconColor={LOGIN_THEME.skyBlue}
            iconBg="#E8F6FC"
            action={
              <DashboardLinkChip
                label="View all"
                onPress={() => router.push("/(tabs)/approvals")}
              />
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
                  iconColor={LOGIN_THEME.skyBlue}
                  iconBg="#E8F6FC"
                  onPress={() => router.push("/(tabs)/approvals")}
                  isLast={index === items.length - 1}
                />
              ))
            ) : (
              <DashboardEmptyHint
                icon="checkmark-done-outline"
                title="All caught up!"
                hint="No leave requests need your approval right now."
              />
            )}
          </DashboardSoftCard>
        ) : null}

        {showLeave ? (
          <DashboardSoftCard
            title="Recent leave"
            subtitle="Your latest time-off requests"
            icon="airplane-outline"
            iconColor={LOGIN_THEME.green}
            iconBg="#EEF6E4"
            action={
              <DashboardLinkChip label="View all" onPress={() => router.push("/(tabs)/leave")} />
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
                  iconColor={LOGIN_THEME.green}
                  iconBg="#EEF6E4"
                  onPress={() => router.push("/(tabs)/leave")}
                  isLast={index === items.length - 1}
                />
              ))
            ) : (
              <DashboardEmptyHint
                icon="airplane-outline"
                title="No leave requests yet"
                hint="Apply for time off when you need a break."
                actionLabel="Apply for leave"
                onAction={() => router.push("/(tabs)/leave/apply")}
              />
            )}
          </DashboardSoftCard>
        ) : null}

        {showAttendance && attendanceSummaryQuery.data ? (
          <DashboardAttendanceCard summary={attendanceSummaryQuery.data} monthLabel={monthLabel} />
        ) : null}

        {showLeave ? (
          <DashboardCtaButton
            title="Apply for leave"
            icon="arrow-forward"
            onPress={() => router.push("/(tabs)/leave/apply")}
          />
        ) : null}
      </View>
    </ScreenShell>
  );
}
