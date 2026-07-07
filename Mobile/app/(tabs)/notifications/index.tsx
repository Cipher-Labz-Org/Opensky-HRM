import { useMemo } from "react";

import { RefreshControl, ScrollView, View } from "react-native";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState, LoadingState } from "@/components/ui";

import {

  NotificationRow,

  NotificationsSectionTitle,

  NotificationsTopSection,

  countNotifications,

  groupNotificationsByDate,

} from "@/features/notifications";

import { getNotifications, markNotificationRead } from "@/api/endpoints/notifications";

import { colors } from "@/theme/colors";



export default function NotificationsScreen() {

  const queryClient = useQueryClient();



  const inboxQuery = useQuery({

    queryKey: ["notifications", "inbox"],

    queryFn: () => getNotifications(50),

    refetchInterval: 60_000,

  });



  const items = inboxQuery.data?.items ?? [];

  const summary = useMemo(() => {

    if (inboxQuery.data) {

      return {

        total: items.length,

        unread: inboxQuery.data.unreadCount,

        read: Math.max(0, items.length - inboxQuery.data.unreadCount),

      };

    }

    return countNotifications(items);

  }, [inboxQuery.data, items]);



  const groups = useMemo(() => groupNotificationsByDate(items), [items]);



  const markReadMutation = useMutation({

    mutationFn: markNotificationRead,

    onMutate: async (id) => {

      await queryClient.cancelQueries({ queryKey: ["notifications"] });

      const previous = queryClient.getQueryData<Awaited<ReturnType<typeof getNotifications>>>([

        "notifications",

        "inbox",

      ]);

      if (previous) {

        queryClient.setQueryData(["notifications", "inbox"], {

          ...previous,

          unreadCount: Math.max(0, previous.unreadCount - 1),

          items: previous.items.map((item) =>

            item.id === id ? { ...item, readAt: new Date().toISOString() } : item

          ),

        });

      }

      return { previous };

    },

    onError: (_error, _id, context) => {

      if (context?.previous) {

        queryClient.setQueryData(["notifications", "inbox"], context.previous);

      }

    },

    onSettled: async () => {

      await queryClient.invalidateQueries({ queryKey: ["notifications"] });

    },

  });



  return (

    <SafeAreaView className="flex-1 bg-background" edges={["top", "left", "right"]}>

      <ScrollView

        className="flex-1"

        contentContainerClassName="pb-8"

        refreshControl={

          <RefreshControl

            refreshing={inboxQuery.isRefetching}

            onRefresh={() => void inboxQuery.refetch()}

          />

        }

        showsVerticalScrollIndicator={false}

      >

        <NotificationsTopSection

          title="Alerts"

          subtitle="Updates, reminders, and team messages"

          unread={summary.unread}

          total={summary.total}

          read={summary.read}

        />



        <View className="mt-6 px-4">

          {inboxQuery.isLoading ? (

            <LoadingState />

          ) : groups.length ? (

            groups.map((group) => (

              <View key={group.key} className="mb-2">

                <NotificationsSectionTitle title={group.label} />

                {group.items.map((item) => (

                  <NotificationRow

                    key={item.id}

                    item={item}

                    onPress={() => {

                      if (!item.readAt) {

                        markReadMutation.mutate(item.id);

                      }

                    }}

                  />

                ))}

              </View>

            ))

          ) : (

            <View

              className="rounded-2xl border border-dashed px-4 py-10"

              style={{ borderColor: colors.border, backgroundColor: colors.primaryLight }}

            >

              <EmptyState

                title="No alerts"

                description="You're all caught up. New alerts will show up here."

              />

            </View>

          )}

        </View>

      </ScrollView>

    </SafeAreaView>

  );

}

