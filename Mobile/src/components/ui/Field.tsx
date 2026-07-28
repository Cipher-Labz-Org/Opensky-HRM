import { Text, TextInput, View, type TextInputProps } from "react-native";
import { useState } from "react";
import { colors } from "@/theme/colors";

interface FieldProps extends TextInputProps {
  label: string;
  error?: string;
  containerClassName?: string;
}

export function Field({ label, error, containerClassName, onFocus, onBlur, ...props }: FieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View className={`gap-1.5 ${containerClassName ?? ""}`}>
      <Text className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</Text>
      <TextInput
        className="rounded-2xl border bg-surface px-4 py-3.5 text-[15px] text-ink"
        placeholderTextColor={colors.muted}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={{
          borderColor: error ? colors.danger : focused ? colors.skyBlue : colors.border,
          backgroundColor: focused ? colors.surface : colors.soft,
        }}
        {...props}
      />
      {error ? <Text className="text-xs text-danger">{error}</Text> : null}
    </View>
  );
}
