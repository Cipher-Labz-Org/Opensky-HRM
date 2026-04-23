"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { API_BASE_URL } from "@/config/constants";
import { ROUTES } from "@/config/routes";
import { reportsPageDrillUrl } from "@/lib/analytics-drilldown";

async function downloadReportCsv(category: string, reportKey: string) {
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  const res = await fetch(
    `${API_BASE_URL}/api/reports/${encodeURIComponent(category)}/${encodeURIComponent(reportKey)}/csv`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} }
  );
  if (!res.ok) {
    throw new Error(`CSV export failed (${res.status})`);
  }
  const blob = await res.blob();
  const dispo = res.headers.get("Content-Disposition");
  let filename = `${category}_${reportKey}_${new Date().toISOString().slice(0, 10)}.csv`;
  if (dispo) {
    const m = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(dispo);
    if (m?.[1]) filename = decodeURIComponent(m[1].replace(/"/g, ""));
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

interface HeadcountDto {
  totalEmployees: number;
  activeEmployees: number;
  onLeave: number;
  terminated: number;
  probation: number;
  byDepartment: Record<string, number>;
}

interface DriverDto {
  metricId: string;
  label: string;
  adverseWeight: number;
  valueLabel?: string | null;
}

interface WorkforceHealthDto {
  score: number;
  topDrivers: DriverDto[];
}

interface ComplianceBucketDto {
  bucketId: string;
  label: string;
  count: number;
}

interface ComplianceDebtDto {
  totalItems: number;
  immigrationExpiryBuckets: ComplianceBucketDto[];
  overdueOnboardingTasks: number;
  pendingLeaveApprovals: number;
}

interface TalentVelocityDto {
  openRequisitions: number;
  averageDaysOpenForOpenReqs: number | null;
  activeCandidatesInPipeline: number;
  averageDaysToFillClosedReqs: number | null;
}

interface PayrollMonthDto {
  year: number;
  month: number;
  periodLabel: string;
  totalNetPay: number;
  statementCount: number;
}

interface MovementDto {
  year: number;
  month: number;
  periodLabel: string;
  joiners: number;
  terminations: number;
}

interface AttendancePulseDto {
  absentMarkedDaysLast14: number;
  activeEmployeesBaseline: number;
}

interface DrillDownDto {
  kpiId: string;
  label: string;
  reportCategory: string;
  reportKey: string;
  queryHint?: string | null;
}

interface ExecutiveDashboardDto {
  generatedAtUtc: string;
  snapshotCapturedAtUtc?: string | null;
  headcount: HeadcountDto;
  workforceHealth: WorkforceHealthDto;
  complianceDebt: ComplianceDebtDto;
  talentVelocity: TalentVelocityDto;
  payrollLastMonths: PayrollMonthDto[];
  headcountMovementTrend: MovementDto[];
  attendancePulse: AttendancePulseDto;
  drillDown: DrillDownDto[];
}

const kpiTileClass =
  "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md";
const contentCard = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";

function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="mb-2">
      <div className="mb-0.5 flex justify-between text-[11px] text-slate-600">
        <span>{label}</span>
        <span className="font-medium tabular-nums text-slate-800">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function ExecutiveAnalyticsDashboard() {
  const [data, setData] = useState<ExecutiveDashboardDto | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [csvBusy, setCsvBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    apiFetch<ExecutiveDashboardDto>("/api/analytics/executive-dashboard")
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load analytics");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-500 shadow-sm">
        Loading workforce analytics…
      </div>
    );
  }

  if (error) {
    const licensingHint = /not licensed|MODULE_NOT_LICENSED/i.test(error);
    const routeHint = /404|no route for/i.test(error);
    return (
      <div className="rounded-2xl border border-rose-200/90 bg-rose-50 px-4 py-4 text-sm text-rose-900 shadow-sm">
        {error}
        <p className="mt-2 text-xs text-rose-800/90">
          {licensingHint ? (
            <>Ask an administrator to enable the Analytics module for this instance.</>
          ) : routeHint ? (
            <>
              This usually means the API binary is out of date: stop and restart <code className="text-[11px]">OpenSkyHRM.Api</code>, or fix{" "}
              <code className="text-[11px]">NEXT_PUBLIC_API_URL</code> (see <code className="text-[11px]">{API_BASE_URL}</code>).
            </>
          ) : (
            <>
              Cached snapshot (after nightly Hangfire run):{" "}
              <code className="text-[11px]">GET /api/analytics/executive-dashboard/snapshot</code>.
            </>
          )}
        </p>
      </div>
    );
  }

  if (!data) return null;

  const hc = data.headcount;
  const maxDept = Math.max(1, ...Object.values(hc.byDepartment));
  const movement = data.headcountMovementTrend;
  const maxMove = Math.max(1, ...movement.flatMap((m) => [m.joiners, m.terminations]));
  const maxImm = Math.max(1, ...data.complianceDebt.immigrationExpiryBuckets.map((b) => b.count));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-xs text-slate-600 shadow-sm">
        <span>
          Generated {new Date(data.generatedAtUtc).toLocaleString()}
          {data.snapshotCapturedAtUtc && (
            <> · Snapshot {new Date(data.snapshotCapturedAtUtc).toLocaleString()}</>
          )}
        </span>
        <Link href={ROUTES.reports} className="font-medium text-indigo-600 hover:underline">
          Open all reports
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className={kpiTileClass}>
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500">Workforce health index</div>
          <div className="mt-2 text-3xl font-semibold leading-none text-slate-900">{data.workforceHealth.score}</div>
          <div className="mt-2 text-xs text-slate-600">0–100 composite (higher is healthier)</div>
        </div>
        <div className={kpiTileClass}>
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500">Active headcount</div>
          <div className="mt-2 text-3xl font-semibold leading-none text-slate-900">{hc.activeEmployees}</div>
          <div className="mt-2 text-xs text-slate-600">{hc.onLeave} on approved leave today</div>
        </div>
        <div className={kpiTileClass}>
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500">Open requisitions</div>
          <div className="mt-2 text-3xl font-semibold leading-none text-slate-900">{data.talentVelocity.openRequisitions}</div>
          <div className="mt-2 text-xs text-slate-600">
            {data.talentVelocity.averageDaysOpenForOpenReqs != null
              ? `Avg ${data.talentVelocity.averageDaysOpenForOpenReqs.toFixed(0)}d open`
              : "Pipeline hiring"}
          </div>
        </div>
        <div className={kpiTileClass}>
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500">Compliance debt signals</div>
          <div className="mt-2 text-3xl font-semibold leading-none text-slate-900">{data.complianceDebt.totalItems}</div>
          <div className="mt-2 text-xs text-slate-600">Immigration + onboarding + pending approvals</div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className={contentCard}>
          <div className="mb-4 flex flex-col gap-1 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-base font-semibold text-slate-800">Workforce health drivers</h3>
            <span className="text-xs text-slate-500">Largest contributors to operational risk (normalized)</span>
          </div>
          <ul className="space-y-3">
            {data.workforceHealth.topDrivers.map((d) => (
              <li key={d.metricId} className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="font-medium text-slate-800">{d.label}</span>
                  <span className="text-xs text-amber-800">{(d.adverseWeight * 100).toFixed(0)} pts strain</span>
                </div>
                {d.valueLabel && <div className="mt-1 text-xs text-slate-500">{d.valueLabel}</div>}
              </li>
            ))}
          </ul>
        </div>

        <div className={contentCard}>
          <div className="mb-4 flex flex-col gap-1 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-base font-semibold text-slate-800">Compliance debt</h3>
            <span className="text-xs text-slate-500">Immigration window + onboarding backlog</span>
          </div>
          <div className="space-y-2 text-sm">
            <p className="text-xs text-slate-600">
              Pending leave approvals: <strong className="text-slate-800">{data.complianceDebt.pendingLeaveApprovals}</strong> · Overdue
              onboarding tasks: <strong className="text-slate-800">{data.complianceDebt.overdueOnboardingTasks}</strong>
            </p>
            {data.complianceDebt.immigrationExpiryBuckets.map((b) => (
              <BarRow key={b.bucketId} label={b.label} value={b.count} max={maxImm} />
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className={contentCard}>
          <div className="mb-4 flex flex-col gap-1 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-base font-semibold text-slate-800">Headcount by department (active)</h3>
            <span className="text-xs text-slate-500">Top groups by roster</span>
          </div>
          <div className="max-h-64 overflow-y-auto pr-1">
            {Object.entries(hc.byDepartment)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 12)
              .map(([name, count]) => (
                <BarRow key={name} label={name} value={count} max={maxDept} />
              ))}
          </div>
        </div>

        <div className={contentCard}>
          <div className="mb-4 flex flex-col gap-1 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-base font-semibold text-slate-800">Joiners vs terminations</h3>
            <span className="text-xs text-slate-500">Last six months (UTC)</span>
          </div>
          {movement.map((m) => (
            <div key={m.periodLabel} className="mb-3">
              <div className="text-[11px] font-medium text-slate-600 mb-1">{m.periodLabel}</div>
              <BarRow label="Joiners" value={m.joiners} max={maxMove} />
              <BarRow label="Terminations" value={m.terminations} max={maxMove} />
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className={contentCard}>
          <div className="mb-4 flex flex-col gap-1 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-base font-semibold text-slate-800">Talent velocity</h3>
            <span className="text-xs text-slate-500">Recruitment pulse</span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="hris-table text-sm">
            <tbody>
              <tr>
                <td>Pipeline candidates (excl. hired/rejected)</td>
                <td className="text-right font-medium">{data.talentVelocity.activeCandidatesInPipeline}</td>
              </tr>
              <tr>
                <td>Avg days to fill (closed reqs)</td>
                <td className="text-right font-medium">
                  {data.talentVelocity.averageDaysToFillClosedReqs != null
                    ? `${data.talentVelocity.averageDaysToFillClosedReqs.toFixed(1)}d`
                    : "—"}
                </td>
              </tr>
              <tr>
                <td>Probation hires (Workforce)</td>
                <td className="text-right font-medium">{hc.probation}</td>
              </tr>
            </tbody>
            </table>
          </div>
        </div>

        <div className={contentCard}>
          <div className="mb-4 flex flex-col gap-1 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-base font-semibold text-slate-800">Payroll & attendance pulse</h3>
            <span className="text-xs text-slate-500">Finalized pay months + absence markers</span>
          </div>
          <p className="mb-2 text-xs text-slate-600">
            Absent day rows (14d): <strong className="text-slate-800">{data.attendancePulse.absentMarkedDaysLast14}</strong>{" "}
            (organization-wide attendance records)
          </p>
          {data.payrollLastMonths.length === 0 ? (
            <p className="text-sm text-slate-500">No finalized pay months yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="hris-table text-sm">
              <thead>
                <tr>
                  <th>Period</th>
                  <th className="text-right">Statements</th>
                  <th className="text-right">Net pay</th>
                </tr>
              </thead>
              <tbody>
                {data.payrollLastMonths.map((p) => (
                  <tr key={p.periodLabel}>
                    <td>{p.periodLabel}</td>
                    <td className="text-right">{p.statementCount}</td>
                    <td className="text-right font-mono">{p.totalNetPay.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className={contentCard}>
        <div className="mb-4 flex flex-col gap-1 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-base font-semibold text-slate-800">Drill-down to operational reports</h3>
          <span className="text-xs text-slate-500">Opens report with data; export CSV when the report viewer loads</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {data.drillDown.map((d) => (
            <div
              key={d.kpiId}
              className="flex flex-col rounded-xl border border-slate-200/90 bg-slate-50/70 p-3 text-sm transition hover:border-slate-300 hover:bg-white"
            >
              <span className="font-medium text-slate-800">{d.label}</span>
              <span className="mt-0.5 text-[10px] text-slate-500">
                {d.reportCategory}/{d.reportKey}
              </span>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link
                  href={reportsPageDrillUrl(d.reportCategory, d.reportKey, d.queryHint)}
                  className="text-xs font-medium text-indigo-600 hover:underline"
                >
                  Run report
                </Link>
                <button
                  type="button"
                  disabled={!!csvBusy}
                  onClick={() => {
                    const id = `${d.reportCategory}/${d.reportKey}`;
                    setCsvBusy(id);
                    downloadReportCsv(d.reportCategory, d.reportKey)
                      .catch(() => alert("CSV download failed"))
                      .finally(() => setCsvBusy(null));
                  }}
                  className="text-xs font-medium text-slate-600 hover:text-indigo-600 hover:underline disabled:opacity-50"
                >
                  {csvBusy === `${d.reportCategory}/${d.reportKey}` ? "Downloading…" : "Download CSV"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
