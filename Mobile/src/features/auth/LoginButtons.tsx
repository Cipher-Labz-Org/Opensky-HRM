import type { ComponentProps } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LOGIN_THEME } from "@/theme/loginTheme";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

interface LoginPrimaryButtonProps {
  title: string;
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  icon?: IoniconName;
  variant?: "sky" | "green";
}

export function LoginPrimaryButton({
  title,
  loading,
  disabled,
  onPress,
  icon,
  variant = "sky",
}: LoginPrimaryButtonProps) {
  const backgroundColor = variant === "green" ? LOGIN_THEME.green : LOGIN_THEME.skyBlue;
  const isLoading = Boolean(loading);
  const isInactive = Boolean(disabled) && !isLoading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isLoading}
      accessibilityRole="button"
      accessibilityState={{ disabled: isLoading }}
      style={({ pressed }) => ({
        minHeight: 52,
        borderRadius: 12,
        backgroundColor: isInactive ? "#7EC4E8" : backgroundColor,
        opacity: pressed && !isLoading ? 0.92 : 1,
        shadowColor: backgroundColor,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: isInactive ? 0.15 : 0.35,
        shadowRadius: 10,
        elevation: isInactive ? 2 : 4,
      })}
    >
      <View className="min-h-[52px] flex-row items-center justify-center px-4">
        {isLoading ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <>
            {icon ? <Ionicons name={icon} size={18} color="#ffffff" style={{ marginRight: 8 }} /> : null}
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#ffffff" }}>{title}</Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

interface LoginSecondaryButtonProps {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
}

export function LoginSecondaryButton({ title, onPress, disabled }: LoginSecondaryButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        minHeight: 48,
        borderRadius: 12,
        backgroundColor: LOGIN_THEME.fieldBg,
        borderWidth: 1,
        borderColor: LOGIN_THEME.border,
        opacity: pressed || disabled ? 0.7 : 1,
      })}
    >
      <View className="min-h-[48px] items-center justify-center px-4">
        <Text style={{ fontSize: 15, fontWeight: "600", color: LOGIN_THEME.navy }}>{title}</Text>
      </View>
    </Pressable>
  );
}
