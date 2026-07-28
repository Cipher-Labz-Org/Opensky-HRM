import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Badge, statusToBadgeTone, type BadgeProps } from "@/components/ui/Badge";
import { LOGIN_THEME } from "@/theme/loginTheme";
import type { ComponentProps } from "react";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

interface DashboardListRowProps {
  title: string;
  subtitle: string;
  meta?: string;
  status?: string;
  statusTone?: BadgeProps["tone"];
  icon?: IoniconName;
  iconColor?: string;
  iconBg?: string;
  onPress?: () => void;
  isLast?: boolean;
}

export function DashboardListRow({
  title,
  subtitle,
  meta,
  status,
  statusTone,
  icon = "document-text-outline",
  iconColor = LOGIN_THEME.skyBlue,
  iconBg = "#E8F6FC",
  onPress,
  isLast,
}: DashboardListRowProps) {
  const content = (
    <>
      <View className="rounded-xl p-2.5" style={{ backgroundColor: iconBg }}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View className="min-w-0 flex-1 px-3">
        <View className="flex-row items-start justify-between gap-2">
          <Text
            className="flex-1 text-[15px] font-semibold"
            style={{ color: LOGIN_THEME.navy }}
            numberOfLines={1}
          >
            {title}
          </Text>
          {status ? <Badge label={status} tone={statusTone ?? statusToBadgeTone(status)} /> : null}
        </View>
        <Text className="mt-0.5 text-xs" style={{ color: LOGIN_THEME.muted }} numberOfLines={1}>
          {subtitle}
        </Text>
        {meta ? (
          <Text className="mt-0.5 text-[11px]" style={{ color: LOGIN_THEME.muted }} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
      <View className="rounded-full p-1" style={{ backgroundColor: "#F4F8FC" }}>
        <Ionicons name="chevron-forward" size={16} color={LOGIN_THEME.skyBlue} />
      </View>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        className={`flex-row items-center px-4 py-3.5 ${isLast ? "" : "border-b"}`}
        style={({ pressed }) => ({
          opacity: pressed ? 0.92 : 1,
          backgroundColor: pressed ? "#F8FBFE" : "#FFFFFF",
          borderColor: LOGIN_THEME.border,
        })}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View
      className={`flex-row items-center px-4 py-3.5 ${isLast ? "" : "border-b"}`}
      style={{ borderColor: LOGIN_THEME.border }}
    >
      {content}
    </View>
  );
}
