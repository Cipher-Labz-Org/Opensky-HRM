import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LOGIN_THEME } from "@/theme/loginTheme";
import { dashboardCardStyle } from "./dashboardStyles";
import type { ComponentProps, ReactNode } from "react";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

interface DashboardSoftCardProps {
  title: string;
  subtitle?: string;
  icon?: IoniconName;
  iconColor?: string;
  iconBg?: string;
  action?: ReactNode;
  children: ReactNode;
}

export function DashboardSoftCard({
  title,
  subtitle,
  icon = "layers-outline",
  iconColor = LOGIN_THEME.skyBlue,
  iconBg = "#E8F6FC",
  action,
  children,
}: DashboardSoftCardProps) {
  return (
    <View className="overflow-hidden rounded-2xl border bg-surface" style={dashboardCardStyle}>
      <View
        className="flex-row items-center justify-between border-b px-4 py-3.5"
        style={{ borderColor: LOGIN_THEME.border }}
      >
        <View className="min-w-0 flex-1 flex-row items-center gap-2.5">
          <View className="rounded-xl p-2" style={{ backgroundColor: iconBg }}>
            <Ionicons name={icon} size={18} color={iconColor} />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-base font-bold" style={{ color: LOGIN_THEME.navy }}>
              {title}
            </Text>
            {subtitle ? (
              <Text className="text-xs" style={{ color: LOGIN_THEME.muted }} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>
        {action}
      </View>
      {children}
    </View>
  );
}
