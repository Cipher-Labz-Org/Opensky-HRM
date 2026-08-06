import type { ComponentProps } from "react";
import { ActivityIndicator, Platform, Text, TouchableOpacity } from "react-native";
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

/** Re-export compatible API — implementation lives with stretch-safe TouchableOpacity. */
export function LoginPrimaryButton({
  title,
  loading,
  disabled,
  onPress,
  icon,
  variant = "sky",
}: LoginPrimaryButtonProps) {
  const backgroundColor = variant === "green" ? "#76B82A" : "#28A9E0";
  const borderColor = variant === "green" ? "#5A8F1F" : "#1E8AB8";
  const isLoading = Boolean(loading);
  const isDisabled = Boolean(disabled) || isLoading;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: isDisabled }}
      style={{
        alignSelf: "stretch",
        minHeight: 54,
        borderRadius: 12,
        backgroundColor,
        borderWidth: 2,
        borderColor,
        opacity: isDisabled ? 0.65 : 1,
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "row",
        paddingHorizontal: 16,
        ...Platform.select({
          android: { elevation: 0 },
          default: {},
        }),
      }}
    >
      {isLoading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={20} color="#FFFFFF" style={{ marginRight: 8 }} /> : null}
          <Text style={{ fontSize: 17, fontWeight: "800", color: "#FFFFFF" }}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

interface LoginSecondaryButtonProps {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
}

export function LoginSecondaryButton({ title, onPress, disabled }: LoginSecondaryButtonProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={{
        alignSelf: "stretch",
        minHeight: 48,
        borderRadius: 12,
        backgroundColor: LOGIN_THEME.fieldBg,
        borderWidth: 1,
        borderColor: LOGIN_THEME.border,
        opacity: disabled ? 0.7 : 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 16,
      }}
    >
      <Text style={{ fontSize: 15, fontWeight: "600", color: LOGIN_THEME.navy }}>{title}</Text>
    </TouchableOpacity>
  );
}
