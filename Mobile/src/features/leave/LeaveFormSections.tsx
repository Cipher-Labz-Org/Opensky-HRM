import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { colors } from "@/theme/colors";
import type { ReactNode, ComponentProps } from "react";
import type { LeaveType } from "@/types/leave";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

function iconForType(type: LeaveType): IoniconName {
  const key = `${type.name} ${type.code}`.toLowerCase();
  if (key.includes("sick") || key.includes("medical")) return "medkit-outline";
  if (key.includes("annual") || key.includes("vacation")) return "sunny-outline";
  if (key.includes("casual")) return "cafe-outline";
  return "calendar-outline";
}

interface LeaveTypeOptionProps {
  type: LeaveType;
  selected: boolean;
  onSelect: (id: string) => void;
}

export function LeaveTypeOption({ type, selected, onSelect }: LeaveTypeOptionProps) {
  return (
    <Pressable
      onPress={() => onSelect(type.id)}
      className={`mb-2 flex-row items-center gap-3 rounded-2xl border px-4 py-3 ${
        selected ? "border-primary bg-primary-light" : "border-border bg-surface"
      }`}
      style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}
    >
      <View
        className="rounded-xl p-2.5"
        style={{ backgroundColor: selected ? colors.navyMid : colors.soft }}
      >
        <Ionicons
          name={iconForType(type)}
          size={20}
          color={selected ? "#ffffff" : colors.navyMid}
        />
      </View>
      <View className="min-w-0 flex-1">
        <Text
          className="font-semibold"
          style={{ color: selected ? colors.navyMid : colors.text }}
        >
          {type.name}
        </Text>
        {type.description ? (
          <Text className="mt-0.5 text-xs text-muted" numberOfLines={1}>
            {type.description}
          </Text>
        ) : null}
      </View>
      {selected ? (
        <Ionicons name="checkmark-circle" size={22} color={colors.accent} />
      ) : (
        <View className="h-5 w-5 rounded-full border-2 border-border" />
      )}
    </Pressable>
  );
}

interface FormSectionProps {
  title: string;
  icon: IoniconName;
  children: ReactNode;
}

export function FormSection({ title, icon, children }: FormSectionProps) {
  return (
    <View className="mb-5">
      <View className="mb-3 flex-row items-center gap-2">
        <View className="rounded-lg p-1.5" style={{ backgroundColor: colors.accentSoft }}>
          <Ionicons name={icon} size={16} color={colors.accent} />
        </View>
        <Text className="text-sm font-bold uppercase tracking-wide" style={{ color: colors.navy }}>
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

interface DaysSummaryBannerProps {
  days: number;
  startDate: string;
  endDate: string;
}

export function DaysSummaryBanner({ days, startDate, endDate }: DaysSummaryBannerProps) {
  return (
    <View
      className="mb-4 mt-3 flex-row items-center gap-3 rounded-2xl border px-4 py-3"
      style={{ borderColor: colors.accentSoft, backgroundColor: colors.accentSoft }}
    >
      <View className="rounded-full px-3 py-2" style={{ backgroundColor: colors.accent }}>
        <Text className="text-lg font-bold text-white">{days}</Text>
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-sm font-semibold" style={{ color: colors.navy }}>
          {days} day{days === 1 ? "" : "s"} requested
        </Text>
        <Text className="mt-0.5 text-xs text-muted">
          {startDate} → {endDate}
        </Text>
      </View>
    </View>
  );
}
