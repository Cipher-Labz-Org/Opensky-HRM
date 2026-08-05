import { Tabs, Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform } from "react-native";
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

  if (user?.mustChangePassword) {
    return <Redirect href="/(auth)/change-password" />;
  }

  const showLeave = hasLicensedModule(user, LICENSED_MODULES.LEAVE);
  const showAttendance = hasLicensedModule(user, LICENSED_MODULES.ATTENDANCE);
  const showApprovals = showLeave && canApproveLeave(user);
  const showPayslips = hasLicensedModule(user, LICENSED_MODULES.PAYROLL);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandGreen,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          height: Platform.OS === "ios" ? 84 : 72,
          paddingBottom: Platform.OS === "ios" ? 24 : 10,
          paddingTop: 8,
          backgroundColor: "#FFFFFF",
          borderTopWidth: 0,
          elevation: 16,
          shadowColor: colors.brandNavy,
          shadowOffset: { width: 0, height: -6 },
          shadowOpacity: 0.08,
          shadowRadius: 16,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
          marginTop: 2,
        },
        tabBarBadgeStyle: {
          backgroundColor: colors.brandGreen,
          fontSize: 10,
          fontWeight: "700",
          minWidth: 18,
          height: 18,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "home" : "home-outline"} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="leave"
        options={{
          href: showLeave ? undefined : null,
          title: "Leave",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "calendar" : "calendar-outline"} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          href: showAttendance ? undefined : null,
          title: "Attendance",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "time" : "time-outline"} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="approvals"
        options={{
          href: showApprovals ? undefined : null,
          title: "Approvals",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "checkmark-done" : "checkmark-done-outline"}
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Alerts",
          tabBarBadge: unread?.unreadCount ? unread.unreadCount : undefined,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "notifications" : "notifications-outline"}
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="payslips"
        options={{
          href: showPayslips ? undefined : null,
          title: "Payslips",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "wallet" : "wallet-outline"} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "person" : "person-outline"} color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
