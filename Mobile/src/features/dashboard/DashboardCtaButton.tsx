import type { ComponentProps } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme/colors";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

interface DashboardCtaButtonProps {
  title: string;
  icon?: IoniconName;
  loading?: boolean;
  onPress?: () => void;
}

export function DashboardCtaButton({
  title,
  icon = "add-circle-outline",
  loading,
  onPress,
}: DashboardCtaButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => ({ opacity: pressed || loading ? 0.9 : 1 })}
    >
      <View
        className="overflow-hidden rounded-2xl"
        style={{
          shadowColor: colors.accent,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.3,
          shadowRadius: 10,
          elevation: 6,
        }}
      >
        <LinearGradient
          colors={["#5A9420", colors.accent, "#8BC34A"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ width: "100%" }}
        >
          <View className="flex-row items-center justify-center gap-2 px-5 py-4">
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <View className="rounded-full bg-white/20 p-1.5">
                  <Ionicons name={icon} size={20} color="#ffffff" />
                </View>
                <Text className="text-base font-bold text-white">{title}</Text>
              </>
            )}
          </View>
        </LinearGradient>
      </View>
    </Pressable>
  );
}
