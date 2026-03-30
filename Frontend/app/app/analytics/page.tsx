"use client";

import { Suspense } from "react";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { ExecutiveAnalyticsDashboard } from "@/components/analytics/ExecutiveAnalyticsDashboard";

function AnalyticsFallback() {
  return (
    <div className="flex items-center justify-center py-20 text-sm text-slate-500">
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

      <div className="mt-8 hris-card">
        <div className="section-title">
          <h3>Predictive roadmap</h3>
          <span>Explainable rules before ML (attrition risk, absence forecasting)</span>
        </div>
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

      <p className="footer-note mt-6">
        Aggregates are computed from live HR data (UTC). Row-level detail and exports use the linked standard reports.
      </p>
    </>
  );
}
