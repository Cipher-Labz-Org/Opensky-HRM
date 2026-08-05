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
  style,
  ...props
}: AuthInputFieldProps) {
  const [focused, setFocused] = useState(false);
  // Password fields must start hidden when secureToggle is used.
  const [hidden, setHidden] = useState(secureToggle ? true : Boolean(secureTextEntry));

  return (
    <View style={{ alignSelf: "stretch", width: "100%", gap: 6 }}>
      <Text style={{ fontSize: 14, fontWeight: "600", color: LOGIN_THEME.navy }}>{label}</Text>
      <View
        style={{
          alignSelf: "stretch",
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: focused ? LOGIN_THEME.skyBlue : LOGIN_THEME.border,
          backgroundColor: LOGIN_THEME.fieldBg,
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
      >
        <Ionicons name={icon} size={20} color="#94A3B8" />
        <TextInput
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
          style={[
            {
              flex: 1,
              minWidth: 0,
              paddingVertical: 2,
              fontSize: 15,
              color: LOGIN_THEME.navy,
            },
            style,
          ]}
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
