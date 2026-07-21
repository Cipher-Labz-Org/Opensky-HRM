import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme/colors";
import type { ReactNode } from "react";

interface ProfilePageHeaderProps {
  title: string;
  subtitle?: string;
}

export function ProfilePageHeader({ title, subtitle }: ProfilePageHeaderProps) {
  return (
    <View className="px-4 pb-2 pt-2">
      <View className="flex-row items-center gap-2">
        <View className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.accent }} />
        <Text className="text-xs font-semibold uppercase tracking-widest text-muted">
          Account
        </Text>
      </View>
      <Text className="mt-1.5 text-2xl font-bold" style={{ color: colors.navy }}>
        {title}
      </Text>
      {subtitle ? (
        <Text className="mt-1 text-sm text-muted" numberOfLines={2}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

interface ProfileTopSectionProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}

export function ProfileTopSection({ title, subtitle, children }: ProfileTopSectionProps) {
  return (
    <View className="px-4">
      <ProfilePageHeader title={title} subtitle={subtitle} />
      {children ? <View className="mt-3">{children}</View> : null}
    </View>
  );
}

export function ProfileSectionTitle({ title }: { title: string }) {
  return (
    <View className="mb-3 flex-row items-center gap-2">
      <View className="h-5 w-1 rounded-full" style={{ backgroundColor: colors.accent }} />
      <Text className="text-sm font-bold uppercase tracking-wide" style={{ color: colors.navy }}>
        {title}
      </Text>
    </View>
  );
}

interface ProfileEditHeaderProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
}

export function ProfileEditHeader({ title, subtitle, onBack }: ProfileEditHeaderProps) {
  return (
    <View className="px-4 pb-2 pt-2">
      <Pressable
        onPress={onBack}
        className="mb-3 flex-row items-center gap-1 self-start rounded-full border px-3 py-1.5"
        style={({ pressed }) => ({
          opacity: pressed ? 0.85 : 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        })}
      >
        <Ionicons name="chevron-back" size={18} color={colors.navyMid} />
        <Text className="text-sm font-semibold" style={{ color: colors.navyMid }}>
          Back
        </Text>
      </Pressable>

      <View className="flex-row items-center gap-2">
        <View className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.accent }} />
        <Text className="text-xs font-semibold uppercase tracking-widest text-muted">
          Edit profile
        </Text>
      </View>
      <Text className="mt-1.5 text-2xl font-bold" style={{ color: colors.navy }}>
        {title}
      </Text>
      {subtitle ? (
        <Text className="mt-1 text-sm text-muted" numberOfLines={2}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
