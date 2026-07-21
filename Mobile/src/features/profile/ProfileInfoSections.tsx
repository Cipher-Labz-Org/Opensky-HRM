import { Image, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme/colors";
import { getInitials } from "@/utils/greeting";
import type { ComponentProps, ReactNode } from "react";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

interface ProfileSectionProps {
  title: string;
  icon: IoniconName;
  children: ReactNode;
}

export function ProfileSection({ title, icon, children }: ProfileSectionProps) {
  return (
    <View className="mb-5">
      <View className="mb-3 flex-row items-center gap-2">
        <View className="h-5 w-1 rounded-full" style={{ backgroundColor: colors.accent }} />
        <View className="rounded-lg p-1.5" style={{ backgroundColor: colors.accentSoft }}>
          <Ionicons name={icon} size={14} color={colors.accent} />
        </View>
        <Text className="text-sm font-bold uppercase tracking-wide" style={{ color: colors.navy }}>
          {title}
        </Text>
      </View>
      <View
        className="overflow-hidden rounded-2xl border border-border bg-surface"
        style={{
          shadowColor: colors.primaryDark,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 6,
          elevation: 2,
        }}
      >
        {children}
      </View>
    </View>
  );
}

interface ProfileInfoRowProps {
  icon: IoniconName;
  label: string;
  value: string;
  isLast?: boolean;
}

export function ProfileInfoRow({ icon, label, value, isLast }: ProfileInfoRowProps) {
  return (
    <View
      className={`flex-row items-center gap-3 px-4 py-3.5 ${isLast ? "" : "border-b border-border"}`}
    >
      <View className="rounded-xl p-2" style={{ backgroundColor: colors.primaryLight }}>
        <Ionicons name={icon} size={16} color={colors.navyMid} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</Text>
        <Text className="mt-0.5 text-sm font-semibold" style={{ color: colors.navy }} numberOfLines={2}>
          {value}
        </Text>
      </View>
    </View>
  );
}

interface ProfileActionRowProps {
  icon: IoniconName;
  label: string;
  subtitle?: string;
  tone?: "default" | "primary" | "danger";
  onPress: () => void;
  isLast?: boolean;
}

const actionToneStyles = {
  default: {
    icon: colors.navyMid,
    iconBg: colors.soft,
    textColor: colors.navy,
  },
  primary: {
    icon: colors.accent,
    iconBg: colors.accentSoft,
    textColor: colors.navyMid,
  },
  danger: {
    icon: colors.danger,
    iconBg: colors.dangerSoft,
    textColor: colors.danger,
  },
} as const;

export function ProfileActionRow({
  icon,
  label,
  subtitle,
  tone = "default",
  onPress,
  isLast,
}: ProfileActionRowProps) {
  const style = actionToneStyles[tone];

  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center gap-3 px-4 py-3.5 ${isLast ? "" : "border-b border-border"}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      <View className="rounded-xl p-2" style={{ backgroundColor: style.iconBg }}>
        <Ionicons name={icon} size={18} color={style.icon} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-sm font-semibold" style={{ color: style.textColor }}>
          {label}
        </Text>
        {subtitle ? (
          <Text className="mt-0.5 text-xs text-muted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.muted} />
    </Pressable>
  );
}

interface ProfileActionsCardProps {
  children: ReactNode;
}

export function ProfileActionsCard({ children }: ProfileActionsCardProps) {
  return (
    <View
      className="overflow-hidden rounded-2xl border border-border bg-surface"
      style={{
        shadowColor: colors.primaryDark,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
      }}
    >
      {children}
    </View>
  );
}

interface ProfilePhotoUploadCardProps {
  photoUri?: string | null;
  displayName: string;
  loading?: boolean;
  onPickPhoto: () => void;
}

export function ProfilePhotoUploadCard({
  photoUri,
  displayName,
  loading,
  onPickPhoto,
}: ProfilePhotoUploadCardProps) {
  return (
    <View
      className="overflow-hidden rounded-3xl border border-border bg-surface"
      style={{
        shadowColor: colors.primaryDark,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
      }}
    >
      <View
        className="flex-row items-center gap-2 border-b border-border px-4 py-3"
        style={{ backgroundColor: colors.primaryLight }}
      >
        <Ionicons name="camera-outline" size={18} color={colors.accent} />
        <Text className="text-xs font-bold uppercase tracking-wide" style={{ color: colors.navy }}>
          Profile photo
        </Text>
      </View>

      <View className="items-center px-5 py-5">
        <View
          className="h-24 w-24 overflow-hidden rounded-full border-4"
          style={{ borderColor: colors.accentSoft, backgroundColor: colors.primaryLight }}
        >
          {photoUri ? (
            <Image source={{ uri: photoUri }} className="h-full w-full" resizeMode="cover" />
          ) : (
            <View className="h-full w-full items-center justify-center">
              <Text className="text-2xl font-bold" style={{ color: colors.navyMid }}>
                {getInitials(displayName)}
              </Text>
            </View>
          )}
        </View>
        <Text className="mt-3 text-base font-bold" style={{ color: colors.navy }}>
          {displayName}
        </Text>
        <Text className="mt-1 text-center text-xs text-muted">Update your profile photo</Text>

        <View className="mt-4 min-h-[44px]">
          <Pressable
            onPress={onPickPhoto}
            disabled={loading}
            style={({ pressed }) => ({
              minHeight: 44,
              borderRadius: 9999,
              paddingHorizontal: 20,
              paddingVertical: 10,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              backgroundColor: colors.accent,
              opacity: pressed || loading ? 0.88 : 1,
            })}
          >
            <Ionicons name="camera-outline" size={16} color="#ffffff" />
            <Text style={{ fontSize: 14, fontWeight: "700", color: "#ffffff" }}>
              {loading ? "Uploading..." : "Choose photo"}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
