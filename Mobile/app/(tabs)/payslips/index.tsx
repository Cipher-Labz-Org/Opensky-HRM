import { useMemo } from "react";

import { RefreshControl, ScrollView, View } from "react-native";

import { router } from "expo-router";

import { useQuery } from "@tanstack/react-query";

import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState, LoadingState } from "@/components/ui";

import {

  PayslipCard,

  PayslipsSectionTitle,

  PayslipsTopSection,

  sortPayslipsByDate,

  summarizePayslips,

} from "@/features/payslips";

import { getEmployeePayStatements } from "@/api/endpoints/payroll";

import { useAuthStore } from "@/store/authStore";

import { getEmployeeId } from "@/utils/permissions";

import { colors } from "@/theme/colors";



export default function PayslipsScreen() {

  const employeeId = getEmployeeId(useAuthStore((s) => s.user));



  const payslipsQuery = useQuery({

    queryKey: ["payslips", employeeId],

    queryFn: () => getEmployeePayStatements(employeeId!),

    enabled: !!employeeId,

  });



  const statements = useMemo(

    () => sortPayslipsByDate(payslipsQuery.data ?? []),

    [payslipsQuery.data]

  );

  const summary = useMemo(() => summarizePayslips(statements), [statements]);



  if (!employeeId) {

    return (

      <SafeAreaView className="flex-1 bg-background">

        <PayslipsTopSection title="Payslips" subtitle="Your salary statements" />

        <View className="px-4 pt-6">

          <EmptyState

            title="No employee profile"

            description="Your account is not linked to an employee record."

          />

        </View>

      </SafeAreaView>

    );

  }



  return (

    <SafeAreaView className="flex-1 bg-background" edges={["top", "left", "right"]}>

      <ScrollView

        className="flex-1"

        contentContainerClassName="pb-8"

        refreshControl={

          <RefreshControl

            refreshing={payslipsQuery.isRefetching}

            onRefresh={() => void payslipsQuery.refetch()}

          />

        }

        showsVerticalScrollIndicator={false}

      >

        <PayslipsTopSection

          title="Payslips"

          subtitle="View your salary statements"

          summary={

            statements.length

              ? {

                  latestNetPay: summary.latestNetPay,

                  latestLabel: summary.latestLabel,

                  count: summary.count,

                  ytdNetPay: summary.ytdNetPay,

                }

              : undefined

          }

        />



        <View className="mt-6 px-4">

          <PayslipsSectionTitle title="Your statements" />



          {payslipsQuery.isLoading ? (

            <LoadingState />

          ) : statements.length ? (

            statements.map((statement, index) => (

              <PayslipCard

                key={statement.id}

                statement={statement}

                isLatest={index === 0}

                onPress={() => router.push(`/(tabs)/payslips/${statement.id}`)}

              />

            ))

          ) : (

            <View

              className="rounded-2xl border border-dashed px-4 py-10"

              style={{ borderColor: colors.border, backgroundColor: colors.primaryLight }}

            >

              <EmptyState

                title="No payslips yet"

                description="Published payslips will appear here once payroll is processed."

              />

            </View>

          )}

        </View>

      </ScrollView>

    </SafeAreaView>

  );

}

