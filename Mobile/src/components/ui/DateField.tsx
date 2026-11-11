import { useState } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme/colors";

interface DateFieldProps {
  label: string;
  /** YYYY-MM-DD, or empty when not chosen. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minimumDate?: Date;
  containerClassName?: string;
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fromIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function DateField({
  label,
  value,
  onChange,
  placeholder = "Select date",
  minimumDate,
  containerClassName,
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(new Date());

  const current = fromIsoDate(value);

  const openPicker = () => {
    const initial = current ?? minimumDate ?? new Date();
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: initial,
        mode: "date",
        minimumDate,
        onChange: (event, date) => {
          if (event.type === "set" && date) onChange(toIsoDate(date));
        },
      });
      return;
    }
    setDraft(initial);
    setOpen(true);
  };

  return (
    <View className={`gap-1.5 ${containerClassName ?? ""}`}>
      <Text className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</Text>
      <Pressable
        onPress={openPicker}
        className="flex-row items-center justify-between rounded-2xl border px-4 py-3.5"
        style={{ borderColor: open ? colors.skyBlue : colors.border, backgroundColor: colors.soft }}
      >
        <Text className="text-[15px]" style={{ color: current ? colors.navy : colors.muted }}>
          {current
            ? current.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })
            : placeholder}
        </Text>
        <Ionicons name="calendar-outline" size={18} color={colors.muted} />
      </Pressable>

      {Platform.OS !== "android" ? (
        <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <Pressable
            onPress={() => setOpen(false)}
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 16 }}
          >
            <Pressable
              onPress={() => {}}
              style={{ backgroundColor: "#ffffff", borderRadius: 16, padding: 12 }}
            >
              <DateTimePicker
                value={draft}
                mode="date"
                display="inline"
                minimumDate={minimumDate}
                themeVariant="light"
                onChange={(_, date) => date && setDraft(date)}
              />
              <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 20, padding: 8 }}>
                <Pressable onPress={() => setOpen(false)}>
                  <Text style={{ fontSize: 16, color: colors.muted }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    onChange(toIsoDate(draft));
                    setOpen(false);
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: "700", color: colors.skyBlue }}>Done</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}
