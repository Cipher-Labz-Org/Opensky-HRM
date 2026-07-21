import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme/colors";
import { softCardShadow } from "./dashboardStyles";
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
  iconColor = colors.teal,
  iconBg = colors.tealSoft,
  action,
  children,
}: DashboardSoftCardProps) {
  return (
    <View
      className="overflow-hidden rounded-[24px] border border-border bg-surface"
      style={softCardShadow}
    >
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3.5">
        <View className="min-w-0 flex-1 flex-row items-center gap-2.5">
          <View className="rounded-xl p-2" style={{ backgroundColor: iconBg }}>
            <Ionicons name={icon} size={18} color={iconColor} />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-base font-bold" style={{ color: colors.navy }}>
              {title}
            </Text>
            {subtitle ? (
              <Text className="text-xs" style={{ color: colors.muted }} numberOfLines={1}>
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
