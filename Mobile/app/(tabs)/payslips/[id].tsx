import { ScrollView, View } from "react-native";

import { router, useLocalSearchParams } from "expo-router";

import { useQuery } from "@tanstack/react-query";

import { SafeAreaView } from "react-native-safe-area-context";

import { LoadingState } from "@/components/ui";

import {

  PayslipDetailHeader,

  PayslipDetailShell,

  PayslipEmployeeBanner,

  PayslipLineSection,

  PayslipNetPayCard,

  groupPayLines,

} from "@/features/payslips";

import { getPayStatement } from "@/api/endpoints/payroll";

import { monthYearLabel } from "@/utils/format";



export default function PayslipDetailScreen() {

  const { id } = useLocalSearchParams<{ id: string }>();



  const statementQuery = useQuery({

    queryKey: ["payslips", "detail", id],

    queryFn: () => getPayStatement(id),

    enabled: !!id,

  });



  const statement = statementQuery.data;

  const { earnings, deductions } = groupPayLines(statement?.lines ?? []);



  return (

    <SafeAreaView className="flex-1 bg-background" edges={["top", "left", "right"]}>

      <ScrollView className="flex-1" contentContainerClassName="pb-8" showsVerticalScrollIndicator={false}>

        <PayslipDetailHeader

          title={statement ? monthYearLabel(statement.month, statement.year) : "Payslip"}

          subtitle={statement?.employeeName}

          onBack={() => router.back()}

        />



        {statementQuery.isLoading || !statement ? (

          <View className="px-4 pt-6">

            <LoadingState />

          </View>

        ) : (

          <PayslipDetailShell>

            <View className="mt-3">

              <PayslipNetPayCard statement={statement} />

            </View>

            <PayslipEmployeeBanner statement={statement} />

            <PayslipLineSection

              title="Earnings"

              icon="trending-up-outline"

              tone="success"

              total={statement.totalEarnings}

              lines={earnings}

            />

            <PayslipLineSection

              title="Deductions"

              icon="trending-down-outline"

              tone="danger"

              total={statement.totalDeductions}

              lines={deductions}

            />

          </PayslipDetailShell>

        )}

      </ScrollView>

    </SafeAreaView>

  );

}

