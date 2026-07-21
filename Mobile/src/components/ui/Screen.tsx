import { ScrollView, Text, View, type ScrollViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface ScreenProps extends ScrollViewProps {
  title?: string;
  subtitle?: string;
  scrollable?: boolean;
  rightAction?: React.ReactNode;
  children: React.ReactNode;
}

export function Screen({
  title,
  subtitle,
  scrollable = true,
  rightAction,
  children,
  ...scrollProps
}: ScreenProps) {
  const header = title ? (
    <View className="mb-4 flex-row items-start justify-between gap-3">
      <View className="flex-1">
        <Text className="text-2xl font-bold text-ink">{title}</Text>
        {subtitle ? <Text className="mt-1 text-sm text-muted">{subtitle}</Text> : null}
      </View>
      {rightAction}
    </View>
  ) : null;

  if (!scrollable) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top", "left", "right"]}>
        <View className="flex-1 px-4 pt-2">
          {header}
          {children}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "left", "right"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pt-2 pb-8"
        keyboardShouldPersistTaps="handled"
        {...scrollProps}
      >
        {header}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
