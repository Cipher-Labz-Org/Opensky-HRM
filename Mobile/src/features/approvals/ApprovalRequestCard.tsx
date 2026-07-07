import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Badge } from "@/components/ui/Badge";
import { colors } from "@/theme/colors";
import type { LeaveRequest } from "@/types/leave";
import {
  approvalLevelLabel,
  employeeInitials,
  formatApprovalDateRange,
} from "./approvalsUtils";

interface ApprovalRequestCardProps {
  request: LeaveRequest;
  remarks: string;
  acting: boolean;
  onRemarksChange: (value: string) => void;
  onApprove: () => void;
  onReject: () => void;
}

export function ApprovalRequestCard({
  request,
  remarks,
  acting,
  onRemarksChange,
  onApprove,
  onReject,
}: ApprovalRequestCardProps) {
  const levelLabel = approvalLevelLabel(request.status, request.currentApprovalLevel);

  return (
    <View
      className="mb-4 overflow-hidden rounded-3xl border border-border bg-surface"
      style={{
        shadowColor: colors.primaryDark,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 4,
      }}
    >
      <View
        className="flex-row items-center gap-3 border-b border-border px-4 py-4"
        style={{ backgroundColor: colors.primaryLight }}
      >
        <View
          className="h-12 w-12 items-center justify-center rounded-2xl"
          style={{ backgroundColor: colors.navyMid }}
        >
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#ffffff" }}>
            {employeeInitials(request.employeeName)}
          </Text>
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-base font-bold" style={{ color: colors.navy }} numberOfLines={1}>
            {request.employeeName}
          </Text>
          <Text className="mt-0.5 text-xs text-muted">
            {request.employeeCode ? `#${request.employeeCode}` : "Employee"}
          </Text>
        </View>
        <Badge label={request.status} tone="warning" />
      </View>

      <View className="px-4 pt-4">
        <View className="flex-row items-center gap-2">
          <View className="rounded-lg p-1.5" style={{ backgroundColor: colors.accentSoft }}>
            <Ionicons name="airplane-outline" size={16} color={colors.accent} />
          </View>
          <Text className="text-sm font-semibold" style={{ color: colors.navy }}>
            {request.leaveTypeName}
          </Text>
          <View
            className="ml-auto rounded-full px-2.5 py-1"
            style={{ backgroundColor: colors.warningSoft }}
          >
            <Text className="text-[10px] font-bold uppercase" style={{ color: colors.warning }}>
              {levelLabel}
            </Text>
          </View>
        </View>

        <View
          className="mt-3 flex-row items-center gap-3 rounded-2xl border px-4 py-3"
          style={{ borderColor: colors.border, backgroundColor: colors.accentSoft }}
        >
          <View className="rounded-full px-3 py-2" style={{ backgroundColor: colors.accent }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#ffffff" }}>
              {request.totalDays}
            </Text>
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-sm font-semibold" style={{ color: colors.navyMid }}>
              {request.totalDays} day{request.totalDays === 1 ? "" : "s"} requested
            </Text>
            <Text className="mt-0.5 text-xs text-muted">{formatApprovalDateRange(request)}</Text>
          </View>
        </View>

        {request.reason?.trim() ? (
          <View
            className="mt-3 rounded-2xl border px-3 py-3"
            style={{ borderColor: colors.border, backgroundColor: colors.soft }}
          >
            <View className="mb-1 flex-row items-center gap-1.5">
              <Ionicons name="chatbubble-outline" size={13} color={colors.muted} />
              <Text className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                Reason
              </Text>
            </View>
            <Text className="text-sm leading-5" style={{ color: colors.navy }}>
              {request.reason.trim()}
            </Text>
          </View>
        ) : null}

        {request.coveragePerson?.trim() ? (
          <View className="mt-2 flex-row items-center gap-2">
            <Ionicons name="people-outline" size={14} color={colors.muted} />
            <Text className="text-xs text-muted">
              Coverage:{" "}
              <Text className="font-medium" style={{ color: colors.navy }}>
                {request.coveragePerson.trim()}
              </Text>
            </Text>
          </View>
        ) : null}

        {request.medicalCertificateUrl ? (
          <View
            className="mt-2 flex-row items-center gap-2 rounded-xl px-3 py-2"
            style={{ backgroundColor: colors.warningSoft }}
          >
            <Ionicons name="document-attach-outline" size={14} color={colors.warning} />
            <Text className="text-xs font-medium" style={{ color: colors.warning }}>
              Medical certificate attached
            </Text>
          </View>
        ) : null}

        <View className="mt-4 gap-1.5">
          <Text className="text-xs font-medium text-muted">Remarks (optional)</Text>
          <TextInput
            className="rounded-xl border border-border bg-surface px-3 py-3 text-sm"
            style={{ color: colors.navy }}
            placeholder="Add a note for the employee..."
            placeholderTextColor={colors.muted}
            value={remarks}
            onChangeText={onRemarksChange}
            editable={!acting}
            multiline
          />
        </View>

        <View className="mt-4 flex-row gap-3 pb-4">
          <View className="min-h-[48px] flex-1">
            <Pressable
              onPress={onApprove}
              disabled={acting}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: 48,
                borderRadius: 16,
                overflow: "hidden",
                backgroundColor: colors.accent,
                opacity: pressed || acting ? 0.88 : 1,
              })}
            >
              <View className="flex-1 flex-row items-center justify-center gap-2 px-3 py-3.5">
                {acting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={20} color="#ffffff" />
                    <Text style={{ fontSize: 14, fontWeight: "700", color: "#ffffff" }}>
                      Approve
                    </Text>
                  </>
                )}
              </View>
            </Pressable>
          </View>

          <View className="min-h-[48px] flex-1">
            <Pressable
              onPress={onReject}
              disabled={acting}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: 48,
                borderRadius: 16,
                overflow: "hidden",
                backgroundColor: colors.surface,
                borderWidth: 2,
                borderColor: colors.danger,
                opacity: pressed || acting ? 0.88 : 1,
              })}
            >
              <View className="flex-1 flex-row items-center justify-center gap-2 px-3 py-3.5">
                {acting ? (
                  <ActivityIndicator color={colors.danger} />
                ) : (
                  <>
                    <Ionicons name="close-circle-outline" size={20} color={colors.danger} />
                    <Text style={{ fontSize: 14, fontWeight: "700", color: colors.danger }}>
                      Reject
                    </Text>
                  </>
                )}
              </View>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}
