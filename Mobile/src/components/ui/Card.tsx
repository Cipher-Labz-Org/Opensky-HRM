import { View, type ViewProps } from "react-native";

interface CardProps extends ViewProps {
  className?: string;
}

export function Card({ children, className, ...props }: CardProps) {
  return (
    <View className={`rounded-2xl border border-border bg-surface p-4 ${className ?? ""}`} {...props}>
      {children}
    </View>
  );
}
