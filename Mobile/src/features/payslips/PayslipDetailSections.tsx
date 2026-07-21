import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Badge } from "@/components/ui/Badge";
import { colors } from "@/theme/colors";
import type { PayStatement, PayStatementLine } from "@/types/payroll";
import { formatCurrency, monthYearLabel } from "@/utils/format";
import { payslipStatusTone } from "./payslipsUtils";
import type { ComponentProps, ReactNode } from "react";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

interface PayslipDetailHeaderProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
}

export function PayslipDetailHeader({ title, subtitle, onBack }: PayslipDetailHeaderProps) {
  return (
    <View className="px-4 pb-2 pt-2">
      <Pressable
        onPress={onBack}
        className="mb-3 flex-row items-center gap-1 self-start rounded-full border px-3 py-1.5"
        style={({ pressed }) => ({
          opacity: pressed ? 0.85 : 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        })}
      >
        <Ionicons name="chevron-back" size={18} color={colors.navyMid} />
        <Text className="text-sm font-semibold" style={{ color: colors.navyMid }}>
          Back
        </Text>
      </Pressable>

      <View className="flex-row items-center gap-2">
        <View className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.accent }} />
        <Text className="text-xs font-semibold uppercase tracking-widest text-muted">
          Payslip detail
        </Text>
      </View>
      <Text className="mt-1.5 text-2xl font-bold" style={{ color: colors.navy }}>
        {title}
      </Text>
      {subtitle ? (
        <Text className="mt-1 text-sm text-muted" numberOfLines={2}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

interface PayslipNetPayCardProps {
  statement: PayStatement;
}

export function PayslipNetPayCard({ statement }: PayslipNetPayCardProps) {
  return (
    <View
      className="overflow-hidden rounded-3xl border border-border bg-surface"
      style={{
        shadowColor: colors.primaryDark,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
      }}
    >
      <View
        className="flex-row items-center gap-2 border-b border-border px-4 py-3"
        style={{ backgroundColor: colors.primaryLight }}
      >
        <Ionicons name="wallet-outline" size={18} color={colors.accent} />
        <Text className="text-xs font-bold uppercase tracking-wide" style={{ color: colors.navy }}>
          Take home pay
        </Text>
      </View>

      <View className="items-center px-5 py-5">
        <Text className="text-4xl font-bold" style={{ color: colors.accent }}>
          {formatCurrency(statement.netPay)}
        </Text>
        <View className="mt-3">
          <Badge label={statement.status} tone={payslipStatusTone(statement.status)} />
        </View>
      </View>

      <View className="flex-row border-t border-border" style={{ backgroundColor: colors.soft }}>
        <View className="flex-1 items-center border-r border-border px-3 py-3">
          <Text className="text-xs text-muted">Gross</Text>
          <Text className="mt-0.5 text-sm font-bold" style={{ color: colors.navy }}>
            {formatCurrency(statement.grossPay)}
          </Text>
        </View>
        <View className="flex-1 items-center border-r border-border px-3 py-3">
          <Text className="text-xs text-muted">Deductions</Text>
          <Text className="mt-0.5 text-sm font-bold" style={{ color: colors.danger }}>
            {formatCurrency(statement.totalDeductions)}
          </Text>
        </View>
        <View className="flex-1 items-center px-3 py-3">
          <Text className="text-xs text-muted">Basic</Text>
          <Text className="mt-0.5 text-sm font-bold" style={{ color: colors.navyMid }}>
            {formatCurrency(statement.basicPay)}
          </Text>
        </View>
      </View>
    </View>
  );
}

interface PayslipEmployeeBannerProps {
  statement: PayStatement;
}

export function PayslipEmployeeBanner({ statement }: PayslipEmployeeBannerProps) {
  return (
    <View
      className="mt-5 rounded-2xl border px-4 py-3"
      style={{ borderColor: colors.border, backgroundColor: colors.surface }}
    >
      <Text className="text-sm font-bold" style={{ color: colors.navy }}>
        {statement.employeeName}
      </Text>
      <View className="mt-1 flex-row flex-wrap gap-x-3">
        {statement.employeeCode ? (
          <Text className="text-xs text-muted">#{statement.employeeCode}</Text>
        ) : null}
        {statement.department ? (
          <Text className="text-xs text-muted">{statement.department}</Text>
        ) : null}
        <Text className="text-xs text-muted">
          {monthYearLabel(statement.month, statement.year)}
        </Text>
      </View>
    </View>
  );
}

interface PayslipLineSectionProps {
  title: string;
  icon: IoniconName;
  tone: "success" | "danger";
  total: number;
  lines: PayStatementLine[];
}

function tonePalette(tone: "success" | "danger") {
  return tone === "success"
    ? {
        iconBg: colors.accentSoft,
        iconColor: colors.accent,
        amountColor: colors.accent,
      }
    : {
        iconBg: colors.dangerSoft,
        iconColor: colors.danger,
        amountColor: colors.danger,
      };
}

export function PayslipLineSection({ title, icon, tone, total, lines }: PayslipLineSectionProps) {
  if (!lines.length) return null;
  const palette = tonePalette(tone);

  return (
    <View className="mt-5">
      <View className="mb-3 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <View className="rounded-lg p-1.5" style={{ backgroundColor: palette.iconBg }}>
            <Ionicons name={icon} size={16} color={palette.iconColor} />
          </View>
          <Text className="text-sm font-bold uppercase tracking-wide" style={{ color: colors.navy }}>
            {title}
          </Text>
        </View>
        <Text className="text-sm font-bold" style={{ color: palette.amountColor }}>
          {formatCurrency(total)}
        </Text>
      </View>

      <View className="overflow-hidden rounded-2xl border border-border bg-surface">
        {lines.map((line, index) => (
          <View
            key={line.id}
            className={`flex-row items-center justify-between px-4 py-3 ${
              index < lines.length - 1 ? "border-b border-border" : ""
            }`}
          >
            <View className="min-w-0 flex-1 pr-3">
              <Text className="text-sm font-medium" style={{ color: colors.navy }} numberOfLines={1}>
                {line.componentName}
              </Text>
              {line.componentCode ? (
                <Text className="mt-0.5 text-[11px] text-muted">{line.componentCode}</Text>
              ) : null}
            </View>
            <Text className="text-sm font-bold" style={{ color: palette.amountColor }}>
              {formatCurrency(line.amount)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function PayslipDetailSectionTitle({ title }: { title: string }) {
  return (
    <View className="mb-3 flex-row items-center gap-2">
      <View className="h-5 w-1 rounded-full" style={{ backgroundColor: colors.accent }} />
      <Text className="text-sm font-bold uppercase tracking-wide" style={{ color: colors.navy }}>
        {title}
      </Text>
    </View>
  );
}

interface PayslipDetailShellProps {
  children: ReactNode;
}

export function PayslipDetailShell({ children }: PayslipDetailShellProps) {
  return <View className="px-4">{children}</View>;
}
