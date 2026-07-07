import { RefreshControl, ScrollView, View } from "react-native";

import { router } from "expo-router";

import { useQuery } from "@tanstack/react-query";

import { SafeAreaView } from "react-native-safe-area-context";

import { LoadingState } from "@/components/ui";

import {

  ProfileAccountCard,

  ProfileActionRow,

  ProfileActionsCard,

  ProfileHeroCard,

  ProfileInfoRow,

  ProfileSection,

  ProfileSectionTitle,

  ProfileTopSection,

  formatAddress,

  resolveJobTitle,

} from "@/features/profile";

import { getEmployee } from "@/api/endpoints/employees";

import { useAuthStore } from "@/store/authStore";

import { useConfigStore } from "@/store/configStore";

import { getEmployeeId } from "@/utils/permissions";

import { buildAssetUrl } from "@/utils/connect";

import { formatDate } from "@/utils/format";



export default function ProfileScreen() {

  const user = useAuthStore((s) => s.user);

  const logout = useAuthStore((s) => s.logout);

  const companyName = useConfigStore((s) => s.companyName);

  const apiBaseUrl = useConfigStore((s) => s.apiBaseUrl);

  const employeeId = getEmployeeId(user);



  const profileQuery = useQuery({

    queryKey: ["profile", employeeId],

    queryFn: () => getEmployee(employeeId!),

    enabled: !!employeeId,

  });



  const profile = profileQuery.data;

  const photoUri = buildAssetUrl(apiBaseUrl ?? "", profile?.profileImageUrl ?? user?.profileImageUrl);



  const onLogout = async () => {

    await logout(false);

    router.replace("/(auth)/login");

  };



  const renderActions = () => (

    <View className="mt-2">

      <ProfileSectionTitle title="Actions" />

      <ProfileActionsCard>

        {employeeId ? (

          <ProfileActionRow

            icon="create-outline"

            label="Edit profile"

            subtitle="Update contact details and photo"

            tone="primary"

            onPress={() => router.push("/(tabs)/profile/edit")}

          />

        ) : null}

        <ProfileActionRow

          icon="key-outline"

          label="Change password"

          subtitle="Update your login credentials"

          onPress={() => router.push("/(auth)/change-password")}

        />

        <ProfileActionRow

          icon="log-out-outline"

          label="Sign out"

          tone="danger"

          onPress={() => void onLogout()}

          isLast

        />

      </ProfileActionsCard>

    </View>

  );



  if (!employeeId) {

    return (

      <SafeAreaView className="flex-1 bg-background" edges={["top", "left", "right"]}>

        <ScrollView className="flex-1" contentContainerClassName="pb-8" showsVerticalScrollIndicator={false}>

          <ProfileTopSection title="Profile" subtitle="Your account settings">

            <ProfileAccountCard username={user?.username ?? "User"} email={user?.email} />

          </ProfileTopSection>

          <View className="mt-6 px-4">{renderActions()}</View>

        </ScrollView>

      </SafeAreaView>

    );

  }



  const address = profile ? formatAddress(profile) : null;

  const additionalItems = profile

    ? [

        profile.gradeName

          ? { icon: "layers-outline" as const, label: "Grade", value: profile.gradeName }

          : null,

        profile.shiftPatternName

          ? { icon: "time-outline" as const, label: "Shift", value: profile.shiftPatternName }

          : null,

        profile.nationality

          ? { icon: "flag-outline" as const, label: "Nationality", value: profile.nationality }

          : null,

      ].filter((item): item is { icon: "layers-outline" | "time-outline" | "flag-outline"; label: string; value: string } => item !== null)

    : [];



  return (

    <SafeAreaView className="flex-1 bg-background" edges={["top", "left", "right"]}>

      <ScrollView

        className="flex-1"

        contentContainerClassName="pb-8"

        refreshControl={

          <RefreshControl

            refreshing={profileQuery.isRefetching}

            onRefresh={() => void profileQuery.refetch()}

          />

        }

        showsVerticalScrollIndicator={false}

      >

        {profileQuery.isLoading || !profile ? (

          <>

            <ProfileTopSection title="My profile" subtitle="Personal and work information" />

            <View className="px-4 pt-6">

              <LoadingState />

            </View>

          </>

        ) : (

          <>

            <ProfileTopSection title="My profile" subtitle="Personal and work information">

              <ProfileHeroCard

                profile={profile}

                photoUri={photoUri}

                companyName={companyName}

              />

            </ProfileTopSection>



            <View className="mt-6 px-4">

              <ProfileSection title="Work" icon="briefcase-outline">

                <ProfileInfoRow icon="ribbon-outline" label="Job title" value={resolveJobTitle(profile)} />

                <ProfileInfoRow

                  icon="business-outline"

                  label="Department"

                  value={profile.departmentName ?? "—"}

                />

                <ProfileInfoRow

                  icon="location-outline"

                  label="Location"

                  value={profile.locationName ?? "—"}

                />

                {profile.managerName ? (

                  <ProfileInfoRow

                    icon="people-outline"

                    label="Manager"

                    value={profile.managerName}

                    isLast

                  />

                ) : (

                  <ProfileInfoRow

                    icon="calendar-outline"

                    label="Joined"

                    value={formatDate(profile.joinDate)}

                    isLast

                  />

                )}

              </ProfileSection>



              <ProfileSection title="Contact" icon="mail-outline">

                <ProfileInfoRow icon="at-outline" label="Email" value={profile.email} />

                <ProfileInfoRow

                  icon="call-outline"

                  label="Phone"

                  value={profile.phone ?? "—"}

                />

                {address ? (

                  <ProfileInfoRow icon="home-outline" label="Address" value={address} isLast />

                ) : (

                  <ProfileInfoRow

                    icon="globe-outline"

                    label="Country"

                    value={profile.country ?? "—"}

                    isLast

                  />

                )}

              </ProfileSection>



              {(profile.gradeName || profile.shiftPatternName || profile.nationality) && (

                <ProfileSection title="Additional" icon="information-circle-outline">

                  {additionalItems.map((item, index) => (

                    <ProfileInfoRow

                      key={item.label}

                      icon={item.icon}

                      label={item.label}

                      value={item.value}

                      isLast={index === additionalItems.length - 1}

                    />

                  ))}

                </ProfileSection>

              )}



              {renderActions()}

            </View>

          </>

        )}

      </ScrollView>

    </SafeAreaView>

  );

}

