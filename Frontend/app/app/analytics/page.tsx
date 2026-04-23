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

const roadmapCard =
  "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";

export default function AnalyticsPage() {
  return (
    <>
      <AppTopbar
        title="Reporting & Workforce Analytics"
        subtitle="Cross-module executive KPIs, workforce health, and drill-down into standard reports."
      />

      <section className="relative mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 px-6 py-7 text-slate-900 shadow-sm sm:px-7">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-sky-100/50 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-indigo-100/40 blur-3xl" />
        <div className="relative z-10">
          <p className="mb-2 inline-flex rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
            Analytics workspace
          </p>
          <h2 className="text-xl font-semibold leading-tight text-slate-900 sm:text-2xl">Executive workforce intelligence</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Executive tiles, trend bars, and report drill-downs load from the analytics API. Use standard reports for row-level detail and CSV export.
          </p>
        </div>
      </section>

      <Suspense fallback={<AnalyticsFallback />}>
        <ExecutiveAnalyticsDashboard />
      </Suspense>

      <div className={`mt-8 ${roadmapCard}`}>
        <div className="mb-4 flex flex-col gap-1 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-base font-semibold text-slate-800">Predictive roadmap</h3>
          <span className="text-xs text-slate-500">Explainable rules before ML (attrition risk, absence forecasting)</span>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-100">
        <table className="hris-table">
          <thead>
            <tr>
              <th>Use case</th>
              <th>Inputs</th>
              <th>Outcome</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Attrition risk</td>
              <td>Tenure, manager changes, overtime, salary position</td>
              <td>Retention shortlist</td>
            </tr>
            <tr>
              <td>Absence forecasting</td>
              <td>Seasonality, roster, leave trends</td>
              <td>Staffing alerts</td>
            </tr>
            <tr>
              <td>Skill gap heatmap</td>
              <td>Roles, learning completion, assessments</td>
              <td>Training priorities</td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>

      <p className="footer-note">
        Aggregates are computed from live HR data (UTC). Row-level detail and exports use the linked standard reports.
      </p>
    </>
  );
}
