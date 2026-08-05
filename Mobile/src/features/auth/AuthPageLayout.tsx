import type { ComponentProps, ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  type ScrollViewProps,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppBackground } from "@/components/ui/AppBackground";
import { colors } from "@/theme/colors";
import { OPENSKY_HRM_LOGO } from "@/config/branding";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

const FEATURES = [
  { label: "People", icon: "people-outline" as const },
  { label: "Attendance", icon: "calendar-outline" as const },
  { label: "Payroll", icon: "wallet-outline" as const },
  { label: "Insights", icon: "bar-chart-outline" as const },
];

export function OpenSkyBrandLogo({ light = false }: { light?: boolean }) {
  return (
    <View className="items-center">
      <Image
        source={OPENSKY_HRM_LOGO}
        style={{ width: 220, height: 58 }}
        resizeMode="contain"
        accessibilityLabel="OpenSky HRM"
      />
      {light ? (
        <Text className="mt-3 text-center text-sm leading-5" style={{ color: "rgba(255,255,255,0.88)" }}>
          All-in-one platform to manage workforce and drive organizational success.
        </Text>
      ) : null}
    </View>
  );
}

function AuthBrandHero({ showTagline = true }: { showTagline?: boolean }) {
  return (
    <View className="px-5 pb-6 pt-2">
      <OpenSkyBrandLogo light={showTagline} />
      {showTagline ? (
        <>
          <Text className="mt-5 text-center text-[26px] font-bold leading-8" style={{ color: "#ffffff" }}>
            Empowering{" "}
            <Text style={{ color: colors.tealSoft }}>People.</Text>
            {"\n"}
            Elevating{" "}
            <Text style={{ color: colors.accentSoft }}>Performance.</Text>
          </Text>
          <View className="mt-5 flex-row flex-wrap justify-center gap-2">
            {FEATURES.map((feature) => (
              <View
                key={feature.label}
                className="flex-row items-center gap-1.5 rounded-full px-3 py-2"
                style={{ backgroundColor: "rgba(255,255,255,0.14)" }}
              >
                <Ionicons name={feature.icon} size={14} color="#ffffff" />
                <Text className="text-[11px] font-semibold text-white">{feature.label}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}
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
    <View className="mb-1">
      {showBrandLogo && !logoUri ? <OpenSkyBrandLogo /> : null}

      {logoUri ? (
        <View className="mb-4 items-center">
          <Text className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
            Your organization
          </Text>
          <View
            className="items-center justify-center overflow-hidden rounded-2xl border-2 p-2"
            style={{
              borderColor: colors.tealSoft,
              backgroundColor: colors.surface,
              width: 72,
              height: 72,
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
      <Text className="mt-1.5 text-[28px] font-bold leading-8" style={{ color: colors.navy }}>
        {title}
      </Text>
      {subtitle ? (
        <Text className="mt-1.5 text-sm leading-5 text-muted" numberOfLines={3}>
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
    // No elevation — nested Android elevation can paint child buttons invisible.
    <View
      style={{
        overflow: "hidden",
        borderRadius: 24,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          paddingHorizontal: 20,
          paddingVertical: 14,
          backgroundColor: colors.soft,
        }}
      >
        <View
          style={{
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 12,
            padding: 8,
            backgroundColor: colors.tealSoft,
          }}
        >
          <Ionicons name={icon} size={18} color={colors.skyBlue} />
        </View>
        <Text style={{ fontSize: 14, fontWeight: "700", color: colors.navy }}>{title}</Text>
      </View>
      <View style={{ gap: 16, padding: 20 }}>{children}</View>
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
        width: "100%",
        minHeight: 54,
        borderRadius: 12,
        backgroundColor: "#76B82A",
        borderWidth: 2,
        borderColor: "#5A8F1F",
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
          <Ionicons name={icon} size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={{ fontSize: 17, fontWeight: "800", color: "#FFFFFF" }}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
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
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => ({
        minHeight: 48,
        borderRadius: 16,
        backgroundColor: colors.surface,
        borderWidth: 1.5,
        borderColor: colors.border,
        opacity: pressed || isDisabled ? 0.88 : 1,
      })}
    >
      <View className="min-h-[48px] items-center justify-center px-4">
        {loading ? (
          <ActivityIndicator color={colors.navyMid} />
        ) : (
          <Text style={{ fontSize: 15, fontWeight: "600", color: colors.navyMid }}>{title}</Text>
        )}
      </View>
    </Pressable>
  );
}

interface AuthTextLinkProps {
  title: string;
  onPress?: () => void;
  color?: string;
}

export function AuthTextLink({ title, onPress, color = colors.skyBlue }: AuthTextLinkProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
      <Text className="text-center text-sm font-semibold" style={{ color }}>
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
      style={{
        alignSelf: "stretch",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.dangerSoft,
        backgroundColor: colors.dangerSoft,
        paddingHorizontal: 16,
        paddingVertical: 12,
      }}
    >
      <Text style={{ fontSize: 14, fontWeight: "500", color: colors.danger }}>{message}</Text>
      {hint ? (
        <Text style={{ marginTop: 8, fontSize: 12, lineHeight: 16, color: colors.muted }}>{hint}</Text>
      ) : null}
    </View>
  );
}

interface AuthScreenProps extends ScrollViewProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  logoUri?: string | null;
  showBrandLogo?: boolean;
  showBrandHero?: boolean;
  children: ReactNode;
}

export function AuthScreen({
  eyebrow,
  title,
  subtitle,
  logoUri,
  showBrandLogo = false,
  showBrandHero = true,
  children,
  ...scrollProps
}: AuthScreenProps) {
  return (
    <AppBackground variant="auth">
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right", "bottom"]}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          {...scrollProps}
        >
          {showBrandHero && !logoUri ? <AuthBrandHero /> : null}

          {/* No elevation on this shell — Android elevation can hide nested action buttons. */}
          <View
            style={{
              marginHorizontal: 16,
              marginTop: 8,
              gap: 16,
              borderRadius: 28,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              paddingHorizontal: 20,
              paddingTop: 24,
              paddingBottom: 24,
            }}
          >
            <AuthPageHeader
              eyebrow={eyebrow}
              title={title}
              subtitle={subtitle}
              logoUri={logoUri}
              showBrandLogo={showBrandLogo && !!logoUri}
            />
            {children}
          </View>

          <Text
            style={{
              marginTop: 24,
              textAlign: "center",
              fontSize: 12,
              color: colors.muted,
            }}
          >
            © 2026 OpenSky HRM. All rights reserved.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </AppBackground>
  );
}
