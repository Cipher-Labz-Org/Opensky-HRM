import { Text, TextInput, View, type TextInputProps } from "react-native";
import { colors } from "@/theme/colors";

interface FieldProps extends TextInputProps {
  label: string;
  error?: string;
  containerClassName?: string;
}

export function Field({ label, error, containerClassName, ...props }: FieldProps) {
  return (
    <View className={`gap-1.5 ${containerClassName ?? ""}`}>
      <Text className="text-xs font-medium text-muted">{label}</Text>
      <TextInput
        className="rounded-xl border border-border bg-surface px-3 py-3 text-sm text-ink"
        placeholderTextColor={colors.muted}
        {...props}
      />
      {error ? <Text className="text-xs text-danger">{error}</Text> : null}
    </View>
  );
}
