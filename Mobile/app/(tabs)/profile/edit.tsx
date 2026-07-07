import { useEffect, useState } from "react";

import { Alert, ScrollView, View } from "react-native";

import * as ImagePicker from "expo-image-picker";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { router } from "expo-router";

import { SafeAreaView } from "react-native-safe-area-context";

import { Button, Field, LoadingState } from "@/components/ui";

import { FormSection } from "@/features/leave";

import {

  ProfileEditHeader,

  ProfilePhotoUploadCard,

} from "@/features/profile";

import { getEmployee, updateEmployee, uploadEmployeePhoto } from "@/api/endpoints/employees";

import { useAuthStore } from "@/store/authStore";

import { useConfigStore } from "@/store/configStore";

import { getEmployeeId } from "@/utils/permissions";

import { buildAssetUrl } from "@/utils/connect";



export default function EditProfileScreen() {

  const employeeId = getEmployeeId(useAuthStore((s) => s.user));

  const refreshProfile = useAuthStore((s) => s.refreshProfile);

  const apiBaseUrl = useConfigStore((s) => s.apiBaseUrl);

  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(false);



  const profileQuery = useQuery({

    queryKey: ["profile", employeeId],

    queryFn: () => getEmployee(employeeId!),

    enabled: !!employeeId,

  });



  const [phone, setPhone] = useState("");

  const [email, setEmail] = useState("");

  const [city, setCity] = useState("");

  const [country, setCountry] = useState("");



  useEffect(() => {

    if (profileQuery.data) {

      setPhone(profileQuery.data.phone ?? "");

      setEmail(profileQuery.data.email);

      setCity(profileQuery.data.city ?? "");

      setCountry(profileQuery.data.country ?? "");

    }

  }, [profileQuery.data]);



  const profile = profileQuery.data;

  const photoUri = buildAssetUrl(apiBaseUrl ?? "", profile?.profileImageUrl ?? null);



  const onSave = async () => {

    if (!employeeId) return;

    setLoading(true);

    try {

      await updateEmployee(employeeId, { phone, email, city, country });

      await queryClient.invalidateQueries({ queryKey: ["profile", employeeId] });

      await refreshProfile();

      Alert.alert("Saved", "Profile updated.");

      router.back();

    } catch (error) {

      Alert.alert("Save failed", error instanceof Error ? error.message : "Could not update profile.");

    } finally {

      setLoading(false);

    }

  };



  const onPickPhoto = async () => {

    if (!employeeId) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {

      Alert.alert("Permission required", "Allow photo library access to upload a profile photo.");

      return;

    }

    const result = await ImagePicker.launchImageLibraryAsync({

      mediaTypes: ImagePicker.MediaTypeOptions.Images,

      quality: 0.8,

    });

    if (result.canceled || !result.assets[0]) return;



    setLoading(true);

    try {

      await uploadEmployeePhoto(employeeId, result.assets[0].uri, "profile.jpg");

      await queryClient.invalidateQueries({ queryKey: ["profile", employeeId] });

      await refreshProfile();

      Alert.alert("Uploaded", "Profile photo updated.");

    } catch (error) {

      Alert.alert("Upload failed", error instanceof Error ? error.message : "Could not upload photo.");

    } finally {

      setLoading(false);

    }

  };



  return (

    <SafeAreaView className="flex-1 bg-background" edges={["top", "left", "right"]}>

      <ScrollView className="flex-1" contentContainerClassName="pb-8" showsVerticalScrollIndicator={false}>

        <ProfileEditHeader

          title="Edit profile"

          subtitle="Update contact details visible on your employee profile"

          onBack={() => router.back()}

        />



        {profileQuery.isLoading || !profile ? (

          <View className="px-4 pt-6">

            <LoadingState />

          </View>

        ) : (

          <View className="px-4">

            <View className="mt-3">

              <ProfilePhotoUploadCard

                photoUri={photoUri}

                displayName={profile.fullName}

                loading={loading}

                onPickPhoto={() => void onPickPhoto()}

              />

            </View>



            <View className="mt-6">

              <FormSection title="Contact details" icon="mail-outline">

                <Field

                  label="Email"

                  autoCapitalize="none"

                  keyboardType="email-address"

                  value={email}

                  onChangeText={setEmail}

                />

                <Field label="Phone" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />

              </FormSection>



              <FormSection title="Location" icon="location-outline">

                <Field label="City" value={city} onChangeText={setCity} />

                <Field label="Country" value={country} onChangeText={setCountry} />

              </FormSection>



              <Button title="Save changes" loading={loading} onPress={() => void onSave()} />

            </View>

          </View>

        )}

      </ScrollView>

    </SafeAreaView>

  );

}

