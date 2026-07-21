import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Badge } from "@/components/ui/Badge";
import { colors } from "@/theme/colors";
import type { PayStatement } from "@/types/payroll";
import { formatCurrency, monthYearLabel } from "@/utils/format";
import { formatCompactCurrency, payslipStatusTone, shortMonthLabel } from "./payslipsUtils";

interface PayslipCardProps {
  statement: PayStatement;
  isLatest?: boolean;
  onPress: () => void;
}

export function PayslipCard({ statement, isLatest, onPress }: PayslipCardProps) {
  return (
    <Pressable
      onPress={onPress}
      className="mb-3 overflow-hidden rounded-2xl border"
      style={({ pressed }) => ({
        opacity: pressed ? 0.92 : 1,
        backgroundColor: colors.surface,
        borderColor: isLatest ? colors.accent : colors.border,
        borderWidth: isLatest ? 1.5 : 1,
        shadowColor: colors.primaryDark,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: isLatest ? 0.1 : 0.06,
        shadowRadius: 8,
        elevation: isLatest ? 4 : 2,
      })}
    >
      <View
        className="flex-row items-center border-b px-4 py-3"
        style={{ borderColor: colors.border, backgroundColor: colors.primaryLight }}
      >
        <View className="rounded-xl p-2" style={{ backgroundColor: colors.accentSoft }}>
          <Ionicons name="document-text-outline" size={18} color={colors.accent} />
        </View>
        <View className="ml-3 min-w-0 flex-1">
          <Text className="text-base font-bold" style={{ color: colors.navy }}>
            {monthYearLabel(statement.month, statement.year)}
          </Text>
          <Text className="text-xs text-muted">
            {shortMonthLabel(statement.month, statement.year)}
          </Text>
        </View>
        <View className="items-end gap-1">
          {isLatest ? <Badge label="Latest" tone="success" /> : null}
          <Badge label={statement.status} tone={payslipStatusTone(statement.status)} />
        </View>
      </View>

      <View className="flex-row items-center px-4 py-4">
        <View className="min-w-0 flex-1">
          <Text className="text-xs font-medium uppercase tracking-wide text-muted">Net pay</Text>
          <Text className="mt-0.5 text-2xl font-bold" style={{ color: colors.accent }}>
            {formatCurrency(statement.netPay)}
          </Text>
          <View className="mt-2 flex-row flex-wrap gap-x-3 gap-y-1">
            <Text className="text-xs text-muted">
              Gross{" "}
              <Text className="font-semibold" style={{ color: colors.navy }}>
                {formatCompactCurrency(statement.grossPay)}
              </Text>
            </Text>
            <Text className="text-xs text-muted">
              Deductions{" "}
              <Text className="font-semibold" style={{ color: colors.danger }}>
                {formatCompactCurrency(statement.totalDeductions)}
              </Text>
            </Text>
          </View>
        </View>
        <View className="ml-2 rounded-full p-2" style={{ backgroundColor: colors.primaryLight }}>
          <Ionicons name="chevron-forward" size={18} color={colors.navyMid} />
        </View>
      </View>
    </Pressable>
  );
}
