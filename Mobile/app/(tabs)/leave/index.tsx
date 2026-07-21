import { RefreshControl, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmptyState, LoadingState } from "@/components/ui";
import { ActivityRow, DashboardCtaButton, formatLeaveActivityMeta } from "@/features/dashboard";
import {
  LeaveBalanceCard,
  LeavePageHeader,
  LeaveSectionTitle,
  LeaveTopSection,
} from "@/features/leave";
import { getLeaveBalances, getMyLeaveRequests } from "@/api/endpoints/leave";
import { useAuthStore } from "@/store/authStore";
import { getEmployeeId } from "@/utils/permissions";
import { colors } from "@/theme/colors";

export default function LeaveScreen() {
  const employeeId = getEmployeeId(useAuthStore((s) => s.user));

  const balancesQuery = useQuery({
    queryKey: ["leave", "balances", employeeId],
    queryFn: () => getLeaveBalances(employeeId!),
    enabled: !!employeeId,
  });

  const requestsQuery = useQuery({
    queryKey: ["leave", "requests"],
    queryFn: () => getMyLeaveRequests({ pageSize: 50 }),
    enabled: !!employeeId,
  });

  const refreshing = balancesQuery.isRefetching || requestsQuery.isRefetching;
  const balances = balancesQuery.data ?? [];
  const requests = requestsQuery.data?.items ?? [];
  const totalRemaining = balances.reduce((sum, item) => sum + item.remaining, 0);
  const pendingCount = requests.filter((r) =>
    r.status.toLowerCase().includes("pending")
  ).length;

  const summaryStats = [
    { label: "Days left", value: totalRemaining.toFixed(0), icon: "calendar-outline" as const, tone: "accent" as const },
    { label: "Leave types", value: balances.length, icon: "layers-outline" as const, tone: "navy" as const },
    { label: "Pending", value: pendingCount, icon: "hourglass-outline" as const, tone: "warning" as const },
  ];

  if (!employeeId) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <LeavePageHeader title="Leave" subtitle="Your time off" />
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
              void balancesQuery.refetch();
              void requestsQuery.refetch();
            }}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <LeaveTopSection
          title="Leave"
          subtitle="Balances, requests & apply for time off"
          stats={summaryStats}
          onApply={() => router.push("/(tabs)/leave/apply")}
        />

        <View className="mt-6 px-4">
          <LeaveSectionTitle title="Your balances" />
          {balancesQuery.isLoading ? (
            <LoadingState />
          ) : balances.length ? (
            balances.map((balance) => (
              <LeaveBalanceCard key={balance.id} balance={balance} />
            ))
          ) : (
            <View
              className="rounded-2xl border border-dashed px-4 py-8"
              style={{ borderColor: colors.border, backgroundColor: colors.primaryLight }}
            >
              <EmptyState title="No leave balances" description="Contact HR to set up entitlements." />
            </View>
          )}
        </View>

        <View className="mt-6 px-4">
          <LeaveSectionTitle title="Request history" />
          {requestsQuery.isLoading ? (
            <LoadingState />
          ) : requests.length ? (
            requests.map((request) => (
              <ActivityRow
                key={request.id}
                title={request.leaveTypeName}
                subtitle={request.reason?.trim() || "No reason provided"}
                meta={formatLeaveActivityMeta(
                  request.startDate,
                  request.endDate,
                  request.totalDays
                )}
                status={request.status}
                icon="airplane-outline"
                iconBgClass={
                  request.status.toLowerCase().includes("pending")
                    ? "bg-warning"
                    : request.status.toLowerCase().includes("approve")
                      ? "bg-success"
                      : request.status.toLowerCase().includes("reject")
                        ? "bg-danger"
                        : "bg-primary"
                }
              />
            ))
          ) : (
            <View
              className="rounded-2xl border border-dashed px-4 py-8"
              style={{ borderColor: colors.border, backgroundColor: colors.primaryLight }}
            >
              <EmptyState
                title="No requests yet"
                description="Tap Apply above when you need time off."
              />
            </View>
          )}

          <View className="mt-4">
            <DashboardCtaButton
              title="Apply for leave"
              onPress={() => router.push("/(tabs)/leave/apply")}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
