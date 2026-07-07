import { Text, View } from "react-native";

interface EmptyStateProps {
  title: string;
  description?: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <View className="items-center justify-center py-12 px-6">
      <Text className="text-base font-semibold text-ink">{title}</Text>
      {description ? (
        <Text className="mt-2 text-center text-sm text-muted">{description}</Text>
      ) : null}
    </View>
  );
}
