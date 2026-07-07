import { Tabs, Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";
import { canApproveLeave, hasLicensedModule } from "@/utils/permissions";
import { LICENSED_MODULES } from "@/config/constants";
import { getUnreadCount } from "@/api/endpoints/notifications";
import { colors } from "@/theme/colors";
export default function TabsLayout() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);

  const { data: unread } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: getUnreadCount,
    enabled: !!token,
    refetchInterval: 60_000,
  });

  if (!token) {
    return <Redirect href="/(auth)/login" />;
  }

  const showLeave = hasLicensedModule(user, LICENSED_MODULES.LEAVE);
  const showAttendance = hasLicensedModule(user, LICENSED_MODULES.ATTENDANCE);
  const showApprovals = showLeave && canApproveLeave(user);
  const showPayslips = hasLicensedModule(user, LICENSED_MODULES.PAYROLL);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          height: 72,
          paddingBottom: 10,
          paddingTop: 8,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
          marginTop: 2,
        },
        tabBarBadgeStyle: { backgroundColor: colors.accent },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="leave"
        options={{
          href: showLeave ? undefined : null,
          title: "Leave",
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          href: showAttendance ? undefined : null,
          title: "Attendance",
          tabBarIcon: ({ color, size }) => <Ionicons name="time-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="approvals"
        options={{
          href: showApprovals ? undefined : null,
          title: "Approvals",
          tabBarIcon: ({ color, size }) => <Ionicons name="checkmark-done-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Alerts",
          tabBarBadge: unread?.unreadCount ? unread.unreadCount : undefined,
          tabBarIcon: ({ color, size }) => <Ionicons name="notifications-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="payslips"
        options={{
          href: showPayslips ? undefined : null,
          title: "Payslips",
          tabBarIcon: ({ color, size }) => <Ionicons name="wallet-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
