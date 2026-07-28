import type { ComponentProps } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LOGIN_THEME } from "@/theme/loginTheme";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

interface DashboardCtaButtonProps {
  title: string;
  icon?: IoniconName;
  loading?: boolean;
  onPress?: () => void;
}

export function DashboardCtaButton({
  title,
  icon = "arrow-forward",
  loading,
  onPress,
}: DashboardCtaButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => ({
        minHeight: 52,
        borderRadius: 12,
        backgroundColor: LOGIN_THEME.green,
        opacity: pressed || loading ? 0.9 : 1,
        shadowColor: LOGIN_THEME.green,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 5,
      })}
    >
      <View className="min-h-[52px] flex-row items-center justify-center gap-2 px-6">
        {loading ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <>
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#ffffff" }}>{title}</Text>
            <Ionicons name={icon} size={18} color="#ffffff" />
          </>
        )}
      </View>
    </Pressable>
  );
}
