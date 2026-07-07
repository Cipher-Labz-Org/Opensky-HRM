import { Image, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Badge } from "@/components/ui/Badge";
import { colors } from "@/theme/colors";
import type { Employee } from "@/types/employee";
import { formatDate } from "@/utils/format";
import { getInitials } from "@/utils/greeting";
import {
  employmentStatusTone,
  formatTenure,
  resolveJobTitle,
} from "./profileUtils";

interface ProfileHeroCardProps {
  profile: Employee;
  photoUri?: string | null;
  companyName?: string | null;
}

export function ProfileHeroCard({ profile, photoUri, companyName }: ProfileHeroCardProps) {
  const jobTitle = resolveJobTitle(profile);

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
        <Ionicons name="person-outline" size={18} color={colors.accent} />
        <Text className="text-xs font-bold uppercase tracking-wide" style={{ color: colors.navy }}>
          Employee profile
        </Text>
      </View>

      <View className="items-center px-5 pb-4 pt-5">
        <View
          className="overflow-hidden rounded-full border-4"
          style={{
            width: 96,
            height: 96,
            borderColor: colors.accentSoft,
            backgroundColor: colors.primaryLight,
          }}
        >
          {photoUri ? (
            <Image source={{ uri: photoUri }} className="h-full w-full" resizeMode="cover" />
          ) : (
            <View className="h-full w-full items-center justify-center">
              <Text className="text-3xl font-bold" style={{ color: colors.navyMid }}>
                {getInitials(profile.fullName)}
              </Text>
            </View>
          )}
        </View>

        <Text className="mt-3 text-center text-xl font-bold" style={{ color: colors.navy }}>
          {profile.fullName}
        </Text>
        <Text className="mt-1 text-center text-sm font-medium" style={{ color: colors.navyMid }}>
          {jobTitle}
        </Text>
        {companyName ? (
          <Text className="mt-0.5 text-center text-xs text-muted">{companyName}</Text>
        ) : null}

        <View className="mt-3 flex-row flex-wrap items-center justify-center gap-2">
          <Badge label={profile.status} tone={employmentStatusTone(profile.status)} />
          {profile.employeeCode ? (
            <View
              className="rounded-full px-2.5 py-1"
              style={{ backgroundColor: colors.primaryLight }}
            >
              <Text className="text-xs font-semibold" style={{ color: colors.navyMid }}>
                #{profile.employeeCode}
              </Text>
            </View>
          ) : null}
          {profile.employmentType ? (
            <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: colors.soft }}>
              <Text className="text-xs font-medium text-muted">{profile.employmentType}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View className="flex-row border-t border-border" style={{ backgroundColor: colors.soft }}>
        <View className="flex-1 items-center border-r border-border px-3 py-3">
          <Text className="text-xs text-muted">Joined</Text>
          <Text className="mt-0.5 text-xs font-bold" style={{ color: colors.navy }}>
            {formatDate(profile.joinDate)}
          </Text>
        </View>
        <View className="flex-1 items-center border-r border-border px-3 py-3">
          <Text className="text-xs text-muted">Tenure</Text>
          <Text className="mt-0.5 text-xs font-bold" style={{ color: colors.accent }}>
            {formatTenure(profile.joinDate)}
          </Text>
        </View>
        <View className="flex-1 items-center px-3 py-3">
          <Text className="text-xs text-muted">Department</Text>
          <Text className="mt-0.5 text-xs font-bold" style={{ color: colors.navy }} numberOfLines={1}>
            {profile.departmentName ?? "—"}
          </Text>
        </View>
      </View>
    </View>
  );
}

interface ProfileAccountCardProps {
  username: string;
  email?: string | null;
}

export function ProfileAccountCard({ username, email }: ProfileAccountCardProps) {
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
        <Ionicons name="person-circle-outline" size={18} color={colors.accent} />
        <Text className="text-xs font-bold uppercase tracking-wide" style={{ color: colors.navy }}>
          Account
        </Text>
      </View>

      <View className="items-center px-5 py-5">
        <View
          className="h-24 w-24 items-center justify-center rounded-full border-4"
          style={{ borderColor: colors.accentSoft, backgroundColor: colors.primaryLight }}
        >
          <Text className="text-3xl font-bold" style={{ color: colors.navyMid }}>
            {username.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text className="mt-3 text-xl font-bold" style={{ color: colors.navy }}>
          {username}
        </Text>
        {email ? <Text className="mt-1 text-sm text-muted">{email}</Text> : null}
        <View
          className="mt-3 rounded-full px-3 py-1"
          style={{ backgroundColor: colors.warningSoft }}
        >
          <Text className="text-xs font-medium" style={{ color: colors.warning }}>
            No employee profile linked
          </Text>
        </View>
      </View>
    </View>
  );
}
