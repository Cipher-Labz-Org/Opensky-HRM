import { ActivityIndicator, Pressable, Text, type PressableProps } from "react-native";
import { colors } from "@/theme/colors";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

interface ButtonProps extends PressableProps {
  title: string;
  loading?: boolean;
  variant?: ButtonVariant;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-primary",
  secondary: "bg-soft",
  danger: "bg-danger",
  ghost: "bg-transparent border border-border",
};

const textClasses: Record<ButtonVariant, string> = {
  primary: "text-white",
  secondary: "text-ink",
  danger: "text-white",
  ghost: "text-ink",
};

export function Button({
  title,
  loading = false,
  variant = "primary",
  disabled,
  className,
  ...props
}: ButtonProps & { className?: string }) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      className={`rounded-xl px-4 py-3 items-center justify-center ${variantClasses[variant]} ${isDisabled ? "opacity-50" : ""} ${className ?? ""}`}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "secondary" || variant === "ghost" ? colors.text : colors.surface}
        />
      ) : (
        <Text className={`text-sm font-semibold ${textClasses[variant]}`}>{title}</Text>
      )}
    </Pressable>
  );
}
