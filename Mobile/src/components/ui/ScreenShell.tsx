import type { ReactNode } from "react";
import { ScrollView, Text, View, type ScrollViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppBackground } from "@/components/ui/AppBackground";
import { LOGIN_THEME } from "@/theme/loginTheme";

interface ScreenShellProps extends ScrollViewProps {
  children: ReactNode;
  header?: ReactNode;
  edges?: ("top" | "left" | "right" | "bottom")[];
}

/** Shared scrollable screen wrapper with branded background. */
export function ScreenShell({
  children,
  header,
  edges = ["top", "left", "right"],
  contentContainerClassName,
  ...scrollProps
}: ScreenShellProps) {
  return (
    <AppBackground variant="page">
      <SafeAreaView className="flex-1" edges={edges}>
        <ScrollView
          className="flex-1"
          contentContainerClassName={contentContainerClassName ?? "pb-10"}
          showsVerticalScrollIndicator={false}
          {...scrollProps}
        >
          {header}
          {children}
        </ScrollView>
      </SafeAreaView>
    </AppBackground>
  );
}

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function PageHeader({ eyebrow, title, subtitle, action }: PageHeaderProps) {
  return (
    <View className="px-4 pb-3 pt-2">
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: LOGIN_THEME.skyBlue }}
          >
            {eyebrow}
          </Text>
          <Text className="mt-1 text-[26px] font-bold leading-8" style={{ color: LOGIN_THEME.navy }}>
            {title}
          </Text>
          {subtitle ? (
            <Text className="mt-1 text-sm leading-5" style={{ color: LOGIN_THEME.muted }} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {action}
      </View>
    </View>
  );
}
