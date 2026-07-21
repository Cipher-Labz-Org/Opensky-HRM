import type { ComponentProps, ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
  type ScrollViewProps,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/theme/colors";
import { OPENSKY_HRM_LOGO } from "@/config/branding";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

export function OpenSkyBrandLogo() {
  return (
    <View className="mb-5 items-center">
      <Image
        source={OPENSKY_HRM_LOGO}
        style={{ width: 240, height: 64 }}
        resizeMode="contain"
        accessibilityLabel="OpenSky HRM"
      />
    </View>
  );
}

interface AuthPageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  logoUri?: string | null;
  showBrandLogo?: boolean;
}

export function AuthPageHeader({
  eyebrow = "OpenSky HRM",
  title,
  subtitle,
  logoUri,
  showBrandLogo = false,
}: AuthPageHeaderProps) {
  return (
    <View className="px-4 pb-2 pt-4">
      {showBrandLogo ? <OpenSkyBrandLogo /> : null}

      {logoUri ? (
        <View className="mb-4 items-center">
          <Text className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
            Your organization
          </Text>
          <View
            className="items-center justify-center overflow-hidden rounded-2xl border p-2"
            style={{
              borderColor: colors.border,
              backgroundColor: colors.surface,
              width: 64,
              height: 64,
            }}
          >
            <Image source={{ uri: logoUri }} className="h-full w-full" resizeMode="contain" />
          </View>
        </View>
      ) : null}

      <View className="flex-row items-center gap-2">
        <View className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.accent }} />
        <Text className="text-xs font-semibold uppercase tracking-widest text-muted">{eyebrow}</Text>
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

interface AuthFormCardProps {
  title: string;
  icon?: IoniconName;
  children: ReactNode;
}

export function AuthFormCard({ title, icon = "shield-checkmark-outline", children }: AuthFormCardProps) {
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
        <Ionicons name={icon} size={18} color={colors.accent} />
        <Text className="text-xs font-bold uppercase tracking-wide" style={{ color: colors.navy }}>
          {title}
        </Text>
      </View>
      <View className="gap-4 p-5">{children}</View>
    </View>
  );
}

interface AuthPrimaryButtonProps {
  title: string;
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  icon?: IoniconName;
}

export function AuthPrimaryButton({
  title,
  loading,
  disabled,
  onPress,
  icon = "log-in-outline",
}: AuthPrimaryButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <View className="min-h-[48px]">
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        style={({ pressed }) => ({
          minHeight: 48,
          borderRadius: 16,
          overflow: "hidden",
          backgroundColor: colors.accent,
          opacity: pressed || isDisabled ? 0.88 : 1,
        })}
      >
        <View className="min-h-[48px] flex-row items-center justify-center gap-2 px-4 py-3">
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Ionicons name={icon} size={18} color="#ffffff" />
              <Text style={{ fontSize: 15, fontWeight: "700", color: "#ffffff" }}>{title}</Text>
            </>
          )}
        </View>
      </Pressable>
    </View>
  );
}

interface AuthSecondaryButtonProps {
  title: string;
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}

export function AuthSecondaryButton({ title, loading, disabled, onPress }: AuthSecondaryButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <View className="min-h-[48px]">
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        style={({ pressed }) => ({
          minHeight: 48,
          borderRadius: 16,
          overflow: "hidden",
          backgroundColor: colors.surface,
          borderWidth: 2,
          borderColor: colors.navyMid,
          opacity: pressed || isDisabled ? 0.88 : 1,
        })}
      >
        <View className="min-h-[48px] items-center justify-center px-4 py-3">
          {loading ? (
            <ActivityIndicator color={colors.navyMid} />
          ) : (
            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.navyMid }}>{title}</Text>
          )}
        </View>
      </Pressable>
    </View>
  );
}

interface AuthTextLinkProps {
  title: string;
  onPress?: () => void;
}

export function AuthTextLink({ title, onPress }: AuthTextLinkProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
      <Text className="text-center text-sm font-semibold" style={{ color: colors.navyMid }}>
        {title}
      </Text>
    </Pressable>
  );
}

interface AuthErrorBannerProps {
  message: string;
  hint?: string;
}

export function AuthErrorBanner({ message, hint }: AuthErrorBannerProps) {
  return (
    <View
      className="rounded-xl border px-3 py-3"
      style={{ borderColor: colors.dangerSoft, backgroundColor: colors.dangerSoft }}
    >
      <Text className="text-sm" style={{ color: colors.danger }}>
        {message}
      </Text>
      {hint ? <Text className="mt-2 text-xs text-muted">{hint}</Text> : null}
    </View>
  );
}

interface AuthScreenProps extends ScrollViewProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  logoUri?: string | null;
  showBrandLogo?: boolean;
  children: ReactNode;
}

export function AuthScreen({
  eyebrow,
  title,
  subtitle,
  logoUri,
  showBrandLogo = false,
  children,
  ...scrollProps
}: AuthScreenProps) {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "left", "right"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-8"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        {...scrollProps}
      >
        <AuthPageHeader
          eyebrow={eyebrow}
          title={title}
          subtitle={subtitle}
          logoUri={logoUri}
          showBrandLogo={showBrandLogo}
        />
        <View className="mt-3 px-4">{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}
