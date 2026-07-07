import { Text, View } from "react-native";

export interface BadgeProps {
  label: string;
  tone?: "default" | "success" | "warning" | "danger";
}

const toneClasses = {
  default: "bg-soft text-ink",
  success: "bg-successSoft text-success",
  warning: "bg-warningSoft text-warning",
  danger: "bg-dangerSoft text-danger",
};

export function Badge({ label, tone = "default" }: BadgeProps) {
  return (
    <View className={`self-start rounded-full px-2.5 py-1 ${toneClasses[tone].split(" ")[0]}`}>
      <Text className={`text-xs font-semibold ${toneClasses[tone].split(" ")[1]}`}>{label}</Text>
    </View>
  );
}

export function statusToBadgeTone(status: string): BadgeProps["tone"] {
  const normalized = status.toLowerCase();
  if (normalized.includes("approve")) return "success";
  if (normalized.includes("reject") || normalized.includes("cancel")) return "danger";
  if (normalized.includes("pending")) return "warning";
  return "default";
}
