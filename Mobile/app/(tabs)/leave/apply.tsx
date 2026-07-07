import { useMemo, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Button, Field, LoadingState } from "@/components/ui";
import { DashboardCtaButton } from "@/features/dashboard";
import {
  DaysSummaryBanner,
  FormSection,
  LeavePageHeader,
  LeaveTypeOption,
} from "@/features/leave";
import {
  createLeaveRequest,
  createLeaveRequestWithDocument,
  getLeaveTypes,
} from "@/api/endpoints/leave";
import { useAuthStore } from "@/store/authStore";
import { getEmployeeId } from "@/utils/permissions";
import { daysBetweenInclusive } from "@/utils/format";
import { colors } from "@/theme/colors";

export default function ApplyLeaveScreen() {
  const employeeId = getEmployeeId(useAuthStore((s) => s.user));
  const queryClient = useQueryClient();

  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [coveragePerson, setCoveragePerson] = useState("");
  const [medicalFile, setMedicalFile] = useState<{ uri: string; name: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const typesQuery = useQuery({
    queryKey: ["leave", "types"],
    queryFn: getLeaveTypes,
    enabled: !!employeeId,
  });

  const selectedType = useMemo(
    () => typesQuery.data?.find((type) => type.id === leaveTypeId),
    [leaveTypeId, typesQuery.data]
  );

  const totalDays = useMemo(() => {
    if (!startDate || !endDate) return 0;
    try {
      return daysBetweenInclusive(startDate, endDate);
    } catch {
      return 0;
    }
  }, [startDate, endDate]);

  const requiresMedical = selectedType?.code?.toLowerCase().includes("sick") && totalDays > 2;

  const pickMedicalCertificate = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets[0]) {
      setMedicalFile({ uri: result.assets[0].uri, name: result.assets[0].name });
    }
  };

  const onSubmit = async () => {
    if (!employeeId || !leaveTypeId || !startDate || !endDate) {
      Alert.alert("Missing fields", "Select leave type and date range.");
      return;
    }
    if (totalDays <= 0) {
      Alert.alert("Invalid dates", "End date must be on or after start date.");
      return;
    }
    if (requiresMedical && !medicalFile) {
      Alert.alert("Medical certificate required", "Upload a PDF for sick leave over 2 days.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        employeeId,
        leaveTypeId,
        startDate,
        endDate,
        totalDays,
        reason: reason.trim() || undefined,
        coveragePerson: coveragePerson.trim() || undefined,
      };

      if (requiresMedical && medicalFile) {
        await createLeaveRequestWithDocument({
          ...payload,
          medicalCertificateUri: medicalFile.uri,
          medicalCertificateName: medicalFile.name,
        });
      } else {
        await createLeaveRequest(payload);
      }

      await queryClient.invalidateQueries({ queryKey: ["leave"] });
      Alert.alert("Submitted", "Your leave request has been submitted.");
      router.back();
    } catch (error) {
      Alert.alert("Submission failed", error instanceof Error ? error.message : "Could not submit leave.");
    } finally {
      setLoading(false);
    }
  };

  if (typesQuery.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <LeavePageHeader title="Apply for leave" subtitle="Submit a new request" />
        <LoadingState />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "left", "right"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-8"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <LeavePageHeader
          title="Apply for leave"
          subtitle="Fill in the details below and submit for approval"
        />

        <View className="px-4 pt-4">
          <FormSection title="Leave type" icon="list-outline">
            {typesQuery.data?.map((type) => (
              <LeaveTypeOption
                key={type.id}
                type={type}
                selected={leaveTypeId === type.id}
                onSelect={setLeaveTypeId}
              />
            ))}
          </FormSection>

          <FormSection title="Dates" icon="calendar-outline">
            <Field
              label="Start date"
              placeholder="YYYY-MM-DD"
              value={startDate}
              onChangeText={setStartDate}
            />
            <View className="mt-3">
              <Field
                label="End date"
                placeholder="YYYY-MM-DD"
                value={endDate}
                onChangeText={setEndDate}
              />
            </View>
            {totalDays > 0 ? (
              <DaysSummaryBanner days={totalDays} startDate={startDate} endDate={endDate} />
            ) : null}
          </FormSection>

          <FormSection title="Details" icon="document-text-outline">
            <Field label="Reason" value={reason} onChangeText={setReason} multiline />
            <View className="mt-3">
              <Field
                label="Coverage person"
                value={coveragePerson}
                onChangeText={setCoveragePerson}
                placeholder="Who covers your work?"
              />
            </View>
          </FormSection>

          {requiresMedical ? (
            <FormSection title="Medical certificate" icon="medkit-outline">
              <View className="rounded-2xl border border-warning/30 bg-warningSoft px-4 py-3">
                <Text className="text-sm text-warning">
                  Sick leave over 2 days requires a medical certificate (PDF).
                </Text>
              </View>
              <Button
                title={medicalFile ? medicalFile.name : "Upload PDF certificate"}
                variant="secondary"
                onPress={() => void pickMedicalCertificate()}
                className="mt-3"
              />
            </FormSection>
          ) : null}

          <View
            className="mt-2 flex-row items-center gap-2 rounded-2xl px-3 py-2.5"
            style={{ backgroundColor: colors.primaryLight }}
          >
            <Ionicons name="information-circle-outline" size={18} color={colors.navyMid} />
            <Text className="flex-1 text-xs text-muted">
              Your manager will be notified once submitted.
            </Text>
          </View>

          <View className="mt-5">
            <DashboardCtaButton
              title="Submit leave request"
              icon="paper-plane-outline"
              loading={loading}
              onPress={() => void onSubmit()}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
