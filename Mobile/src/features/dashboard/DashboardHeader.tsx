import { LinearGradient } from "expo-linear-gradient";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme/colors";

export function DashboardHeader() {
  return (
    <View className="overflow-hidden">
      <LinearGradient
        colors={[colors.primaryDark, colors.primary, "#4a9ad4"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ width: "100%" }}
      >
        <View className="px-4 pb-20 pt-2">
          <View className="flex-row items-center justify-between">
            <View>
              <View className="flex-row items-center gap-2">
                <View className="rounded-lg bg-white/20 p-1.5">
                  <Ionicons name="sparkles" size={14} color="#ffffff" />
                </View>
                <Text className="text-xs font-semibold uppercase tracking-widest text-white/80">
                  OpenSky HRM
                </Text>
              </View>
              <Text className="mt-1.5 text-2xl font-bold text-white">Dashboard</Text>
            </View>
            <View className="rounded-full bg-white/20 px-3.5 py-2">
              <Text className="text-xs font-bold text-white">Employee</Text>
            </View>
          </View>

          <View className="absolute -bottom-10 -right-4 h-36 w-36 rounded-full bg-white/10" />
          <View className="absolute bottom-2 right-16 h-20 w-20 rounded-full bg-white/10" />
          <View className="absolute -bottom-6 left-4 h-24 w-24 rounded-full bg-white/10" />
        </View>
      </LinearGradient>
    </View>
  );
}
