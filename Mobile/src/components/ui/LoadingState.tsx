import { ActivityIndicator, View } from "react-native";
import { colors } from "@/theme/colors";

export function LoadingState() {
  return (
    <View className="flex-1 items-center justify-center py-16">
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}
