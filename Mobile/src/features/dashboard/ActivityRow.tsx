import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { Badge, statusToBadgeTone, type BadgeProps } from "@/components/ui/Badge";
import { formatDate } from "@/utils/format";
import type { ComponentProps } from "react";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

interface ActivityRowProps {
  title: string;
  subtitle: string;
  meta?: string;
  status?: string;
  statusTone?: BadgeProps["tone"];
  icon?: IoniconName;
  iconBgClass?: string;
}

export function ActivityRow({
  title,
  subtitle,
  meta,
  status,
  statusTone,
  icon = "calendar-outline",
  iconBgClass = "bg-primary",
}: ActivityRowProps) {
  return (
    <View
      className="mb-3 flex-row overflow-hidden rounded-2xl border border-border bg-surface"
      style={{
        shadowColor: "#0f172a",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
      }}
    >
      <View className={`w-14 items-center justify-center ${iconBgClass}`}>
        <Ionicons name={icon} size={22} color="#ffffff" />
      </View>
      <View className="min-w-0 flex-1 justify-center px-3 py-3">
        <View className="flex-row items-start justify-between gap-2">
          <Text className="flex-1 text-sm font-semibold text-ink" numberOfLines={1}>
            {title}
          </Text>
          {status ? (
            <Badge label={status} tone={statusTone ?? statusToBadgeTone(status)} />
          ) : null}
        </View>
        <Text className="mt-0.5 text-xs text-muted" numberOfLines={1}>
          {subtitle}
        </Text>
        {meta ? (
          <Text className="mt-1 text-[11px] text-muted" numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function formatLeaveActivityMeta(startDate: string, endDate: string, totalDays: number): string {
  return `${formatDate(startDate)} – ${formatDate(endDate)} · ${totalDays} day${totalDays === 1 ? "" : "s"}`;
}
