import { useState, type ComponentProps } from "react";
import {
  Pressable,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LOGIN_THEME } from "@/theme/loginTheme";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

interface AuthInputFieldProps extends TextInputProps {
  label: string;
  icon: IoniconName;
  secureToggle?: boolean;
}

export function AuthInputField({
  label,
  icon,
  secureToggle,
  secureTextEntry,
  onFocus,
  onBlur,
  ...props
}: AuthInputFieldProps) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(secureTextEntry ?? false);

  return (
    <View className="gap-1.5">
      <Text className="text-sm font-semibold" style={{ color: LOGIN_THEME.navy }}>
        {label}
      </Text>
      <View
        className="flex-row items-center gap-3 rounded-xl border px-4 py-3"
        style={{
          borderColor: focused ? LOGIN_THEME.skyBlue : LOGIN_THEME.border,
          backgroundColor: LOGIN_THEME.fieldBg,
        }}
      >
        <Ionicons name={icon} size={20} color="#94A3B8" />
        <TextInput
          className="flex-1 py-0.5 text-[15px]"
          placeholderTextColor="#94A3B8"
          secureTextEntry={secureToggle ? hidden : secureTextEntry}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={{ color: LOGIN_THEME.navy }}
          {...props}
        />
        {secureToggle ? (
          <Pressable
            onPress={() => setHidden((value) => !value)}
            hitSlop={8}
            accessibilityLabel={hidden ? "Show password" : "Hide password"}
          >
            <Ionicons
              name={hidden ? "eye-outline" : "eye-off-outline"}
              size={20}
              color="#94A3B8"
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
