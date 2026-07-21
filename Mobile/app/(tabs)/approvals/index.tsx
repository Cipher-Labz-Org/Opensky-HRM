import { useMemo, useState } from "react";

import { Alert, RefreshControl, ScrollView, View } from "react-native";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState, LoadingState } from "@/components/ui";

import {

  ApprovalRequestCard,

  ApprovalsSectionTitle,

  ApprovalsTopSection,

  countByApprovalLevel,

} from "@/features/approvals";

import {

  approveLeaveRequest,

  getTeamPendingLeaveRequests,

  rejectLeaveRequest,

} from "@/api/endpoints/leave";

import { useAuthStore } from "@/store/authStore";

import { getEmployeeId } from "@/utils/permissions";

import { colors } from "@/theme/colors";



export default function ApprovalsScreen() {

  const employeeId = getEmployeeId(useAuthStore((s) => s.user));

  const queryClient = useQueryClient();

  const [remarksById, setRemarksById] = useState<Record<string, string>>({});

  const [actingId, setActingId] = useState<string | null>(null);



  const pendingQuery = useQuery({

    queryKey: ["approvals", "leave", "pending"],

    queryFn: async () => {

      const [level1, level2] = await Promise.all([

        getTeamPendingLeaveRequests("Pending"),

        getTeamPendingLeaveRequests("PendingLevel2"),

      ]);

      return [...level1.items, ...level2.items];

    },

    enabled: !!employeeId,

  });



  const myInbox = useMemo(

    () =>

      (pendingQuery.data ?? []).filter(

        (request) => request.responsibleEmployeeId === employeeId

      ),

    [employeeId, pendingQuery.data]

  );



  const summary = useMemo(() => countByApprovalLevel(myInbox), [myInbox]);



  const actionMutation = useMutation({

    mutationFn: async ({ id, action }: { id: string; action: "approve" | "reject" }) => {

      setActingId(id);

      const remarks = remarksById[id]?.trim();

      if (action === "approve") {

        return approveLeaveRequest(id, { remarks });

      }

      return rejectLeaveRequest(id, { remarks });

    },

    onSuccess: async () => {

      await queryClient.invalidateQueries({ queryKey: ["approvals"] });

      await queryClient.invalidateQueries({ queryKey: ["leave"] });

      Alert.alert("Updated", "Leave request has been processed.");

    },

    onError: (error) => {

      Alert.alert(

        "Action failed",

        error instanceof Error ? error.message : "Could not process request."

      );

    },

    onSettled: () => setActingId(null),

  });



  return (

    <SafeAreaView className="flex-1 bg-background" edges={["top", "left", "right"]}>

      <ScrollView

        className="flex-1"

        contentContainerClassName="pb-8"

        refreshControl={

          <RefreshControl

            refreshing={pendingQuery.isRefetching}

            onRefresh={() => void pendingQuery.refetch()}

          />

        }

        showsVerticalScrollIndicator={false}

      >

        <ApprovalsTopSection

          title="Leave approvals"

          subtitle="Review and action team leave requests"

          total={summary.total}

          level1={summary.level1}

          level2={summary.level2}

        />



        <View className="mt-6 px-4">

          <ApprovalsSectionTitle title="Awaiting your action" />



          {pendingQuery.isLoading ? (

            <LoadingState />

          ) : myInbox.length ? (

            myInbox.map((request) => (

              <ApprovalRequestCard

                key={request.id}

                request={request}

                remarks={remarksById[request.id] ?? ""}

                acting={actingId === request.id}

                onRemarksChange={(value) =>

                  setRemarksById((current) => ({ ...current, [request.id]: value }))

                }

                onApprove={() => actionMutation.mutate({ id: request.id, action: "approve" })}

                onReject={() => actionMutation.mutate({ id: request.id, action: "reject" })}

              />

            ))

          ) : (

            <View

              className="rounded-2xl border border-dashed px-4 py-10"

              style={{ borderColor: colors.border, backgroundColor: colors.primaryLight }}

            >

              <EmptyState

                title="No pending approvals"

                description="You're all caught up. New requests will appear here."

              />

            </View>

          )}

        </View>

      </ScrollView>

    </SafeAreaView>

  );

}

