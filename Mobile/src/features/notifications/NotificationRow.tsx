import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Badge } from "@/components/ui/Badge";
import { colors } from "@/theme/colors";
import type { NotificationItem } from "@/types/notifications";
import { formatRelativeTime, notificationCategoryStyle } from "./notificationsUtils";

interface NotificationRowProps {
  item: NotificationItem;
  onPress: () => void;
}

export function NotificationRow({ item, onPress }: NotificationRowProps) {
  const unread = !item.readAt;
  const style = notificationCategoryStyle(item.category);

  return (
    <Pressable
      onPress={onPress}
      className="mb-3 overflow-hidden rounded-2xl border"
      style={({ pressed }) => ({
        opacity: pressed ? 0.92 : unread ? 1 : 0.92,
        backgroundColor: unread ? colors.accentSoft : colors.surface,
        borderColor: unread ? colors.accent : colors.border,
        borderWidth: 1,
        shadowColor: colors.primaryDark,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: unread ? 0.08 : 0.04,
        shadowRadius: 6,
        elevation: unread ? 3 : 1,
      })}
    >
      <View className="flex-row">
        <View
          className="w-14 items-center justify-center py-4"
          style={{ backgroundColor: unread ? colors.primaryLight : colors.soft }}
        >
          <View className="rounded-2xl p-2.5" style={{ backgroundColor: style.iconBgColor }}>
            <Ionicons name={style.icon} size={22} color={style.iconColor} />
          </View>
          {unread ? (
            <View
              className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: colors.accent }}
            />
          ) : null}
        </View>

        <View className="min-w-0 flex-1 justify-center px-3 py-3">
          <View className="flex-row items-start justify-between gap-2">
            <Text
              className={`flex-1 text-sm ${unread ? "font-bold" : "font-semibold"}`}
              style={{ color: colors.navy }}
              numberOfLines={2}
            >
              {item.title}
            </Text>
            {unread ? <Badge label="New" tone="warning" /> : null}
          </View>

          <Text className="mt-1 text-xs leading-4 text-muted" numberOfLines={3}>
            {item.body}
          </Text>

          <View className="mt-2 flex-row items-center gap-2">
            <Ionicons name="time-outline" size={12} color={colors.muted} />
            <Text className="text-[11px] text-muted">{formatRelativeTime(item.createdAt)}</Text>
            <Text className="text-[11px] text-muted">·</Text>
            <Text className="text-[11px] font-medium" style={{ color: colors.navyMid }}>
              {style.label}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
