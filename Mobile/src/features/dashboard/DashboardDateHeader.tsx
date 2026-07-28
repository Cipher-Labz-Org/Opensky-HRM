import { Text, View } from "react-native";
import { formatTodayLabel, getTimeGreeting } from "@/utils/greeting";
import { LOGIN_THEME } from "@/theme/loginTheme";

export function DashboardDateHeader() {
  const greeting = getTimeGreeting();

  return (
    <View className="px-4 pb-3 pt-2">
      <Text className="text-xs font-semibold uppercase tracking-wide" style={{ color: LOGIN_THEME.skyBlue }}>
        {greeting}
      </Text>
      <Text className="mt-0.5 text-[22px] font-bold leading-7" style={{ color: LOGIN_THEME.navy }}>
        {formatTodayLabel()}
      </Text>
    </View>
  );
}
