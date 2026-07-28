import { Pressable, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LOGIN_THEME } from "@/theme/loginTheme";

interface DashboardLinkChipProps {
  label: string;
  onPress?: () => void;
}

export function DashboardLinkChip({ label, onPress }: DashboardLinkChipProps) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-1 rounded-full px-3 py-1.5"
      style={({ pressed }) => ({
        backgroundColor: "#E8F6FC",
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text className="text-xs font-bold" style={{ color: LOGIN_THEME.skyBlue }}>{label}</Text>
      <Ionicons name="arrow-forward" size={12} color={LOGIN_THEME.skyBlue} />
    </Pressable>
  );
}
