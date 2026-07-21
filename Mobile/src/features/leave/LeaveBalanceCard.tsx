import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { colors } from "@/theme/colors";
import type { LeaveBalance } from "@/types/leave";
import type { ComponentProps } from "react";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

const TYPE_ICONS: Record<string, IoniconName> = {
  annual: "sunny-outline",
  vacation: "sunny-outline",
  sick: "medkit-outline",
  medical: "medkit-outline",
  casual: "cafe-outline",
  maternity: "heart-outline",
  paternity: "heart-outline",
  unpaid: "remove-circle-outline",
};

const TYPE_COLORS: Record<string, { bar: string; bg: string; icon: string }> = {
  annual: { bar: colors.navyMid, bg: colors.primaryLight, icon: colors.navyMid },
  vacation: { bar: colors.navyMid, bg: colors.primaryLight, icon: colors.navyMid },
  sick: { bar: colors.warning, bg: colors.warningSoft, icon: colors.warning },
  medical: { bar: colors.warning, bg: colors.warningSoft, icon: colors.warning },
  casual: { bar: colors.accent, bg: colors.accentSoft, icon: colors.accent },
  default: { bar: colors.accent, bg: colors.accentSoft, icon: colors.accent },
};

function resolveTypeKey(name: string, code: string): string {
  const key = `${name} ${code}`.toLowerCase();
  for (const token of Object.keys(TYPE_ICONS)) {
    if (key.includes(token)) return token;
  }
  return "default";
}

interface LeaveBalanceCardProps {
  balance: LeaveBalance;
}

export function LeaveBalanceCard({ balance }: LeaveBalanceCardProps) {
  const typeKey = resolveTypeKey(balance.leaveTypeName, "");
  const palette = TYPE_COLORS[typeKey] ?? TYPE_COLORS.default;
  const icon = TYPE_ICONS[typeKey] ?? "leaf-outline";
  const entitled = Math.max(balance.entitled, 1);
  const usedPct = Math.min(100, Math.round((balance.used / entitled) * 100));
  const remainPct = Math.min(100, Math.round((balance.remaining / entitled) * 100));

  return (
    <View
      className="mb-3 overflow-hidden rounded-2xl border border-border bg-surface"
      style={{
        shadowColor: colors.primaryDark,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      <View className="flex-row items-center gap-3 p-4">
        <View className="rounded-2xl p-3" style={{ backgroundColor: palette.bg }}>
          <Ionicons name={icon} size={24} color={palette.icon} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-base font-bold text-ink" numberOfLines={1}>
            {balance.leaveTypeName}
          </Text>
          <Text className="mt-0.5 text-xs text-muted" numberOfLines={1}>
            {balance.periodLabel}
          </Text>
        </View>
        <View className="items-end">
          <Text className="text-2xl font-bold" style={{ color: colors.accent }}>
            {balance.remaining}
          </Text>
          <Text className="text-[11px] font-medium text-muted">remaining</Text>
        </View>
      </View>

      <View className="px-4 pb-4">
        <View className="h-2.5 overflow-hidden rounded-full bg-soft">
          <View className="h-full flex-row">
            <View style={{ width: `${remainPct}%`, backgroundColor: palette.bar }} />
            <View className="bg-border" style={{ width: `${usedPct}%` }} />
          </View>
        </View>
        <View className="mt-2 flex-row justify-between">
          <Text className="text-[11px] text-muted">
            Used: <Text className="font-semibold text-ink">{balance.used}</Text>
          </Text>
          <Text className="text-[11px] text-muted">
            Entitled: <Text className="font-semibold text-ink">{balance.entitled}</Text>
          </Text>
        </View>
      </View>
    </View>
  );
}
