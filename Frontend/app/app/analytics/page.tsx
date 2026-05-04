"use client";

import { Suspense } from "react";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { ExecutiveAnalyticsDashboard } from "@/components/analytics/ExecutiveAnalyticsDashboard";

function AnalyticsFallback() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-500 shadow-sm">
      Loading dashboard…
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <>
      <AppTopbar
        title="Reporting & Workforce Analytics"
        subtitle="Cross-module executive KPIs, workforce health, and drill-down into standard reports."
      />

      <Suspense fallback={<AnalyticsFallback />}>
        <ExecutiveAnalyticsDashboard />
      </Suspense>

    </>
  );
}
