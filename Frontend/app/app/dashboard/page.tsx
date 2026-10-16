"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { appAlert } from "@/components/ui/appDialogs";
import { apiFetch } from "@/lib/api";
import { formatBusinessDateTime } from "@/lib/date-utils";
import { formatLocalDateToIso, instantToLocalDateKey } from "@/lib/datePickerIso";
import { DonutMixChart, formatInt, HorizontalCompareBars, WeeklyActivityBars } from "@/lib/workspace-charts";
import Link from "next/link";
import { ROUTES } from "@/config/routes";
import { BirthdaysCompanyNoticesWidget } from "@/components/employee-profile/BirthdaysCompanyNoticesWidget";
import {
  DashboardBrandBadge,
  DashboardCardHeader,
  DashboardKpiGrid,
  DashboardPageHeader,
} from "@/components/dashboard/DashboardUi";
import { DASH_CHART, OPENSKY_THEME } from "@/lib/opensky-theme";
import { formatRecruitmentActivityDescription } from "@/lib/recruitment-activity";
import { useAuth } from "@/contexts/auth-context";

const DASH_METRIC_TIMEOUT_MS = 35_000;
const DASH_METRIC_RETRIES = 1;
const DASH_RETRY_DELAY_MS = 2_000;

async function fetchDashboardMetric<T>(endpoint: string): Promise<T | null> {
  for (let attempt = 0; attempt <= DASH_METRIC_RETRIES; attempt++) {
    try {
      return await apiFetch<T>(endpoint, { timeoutMs: DASH_METRIC_TIMEOUT_MS });
    } catch {
      if (attempt < DASH_METRIC_RETRIES) {
        await new Promise((resolve) => window.setTimeout(resolve, DASH_RETRY_DELAY_MS));
        continue;
      }
      return null;
    }
  }
  return null;
}

const T = OPENSKY_THEME;

const DASH_WORKFORCE_ROW_COLORS: string[] = [
  T.accent,
  T.action,
  T.navyMid,
  T.accent,
  T.action,
  T.muted,
];

const DASH_ACTIVITY_DAY_COLORS: [string, string][] = [
  [T.action, "#5BC4EB"],
  [T.action, "#5BC4EB"],
  [T.action, "#5BC4EB"],
  [T.action, "#5BC4EB"],
  [T.action, "#5BC4EB"],
  [T.action, "#5BC4EB"],
  [T.action, "#5BC4EB"],
];

const DASH_COMPARE_COLORS = DASH_CHART;

interface MyTask {
  id: string;
  title: string;
  category: string;
  isCompleted: boolean;
  dueDate: string | null;
  assignmentType: string;
  taskType: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
}

interface LeaveDashboardDto {
  totalRequests: number;
  pendingApprovals: number;
  approvedThisMonth: number;
  upcomingHolidays: number;
  activeLeaveTypes: number;
  recentRequests: Array<{
    id: string;
    employeeName: string;
    leaveTypeName: string;
    status: string;
    createdAt: string;
    startDate: string;
    endDate: string;
  }>;
}

interface RecruitmentDashboardDto {
  openRequisitions: number;
  totalCandidates: number;
  interviewsThisWeek: number;
  offersExtended: number;
  hiredThisMonth: number;
  recentActivities: Array<{
    description: string;
    activityType: string;
    candidateName?: string | null;
    performedBy: string | null;
    performedAt: string;
  }>;
}

interface BusinessUnitRow {
  id: string;
  name: string;
  employeeCount: number;
}

interface DepartmentRow {
  id: string;
  name: string;
  employeeCount: number;
}

export default function DashboardPage() {
  const { token, isLoading: authLoading } = useAuth();
  const [myTasks, setMyTasks] = useState<MyTask[]>([]);
  const [completing, setCompleting] = useState<string | null>(null);

  const [activeCount, setActiveCount] = useState<number | null>(null);
  const [terminatedCount, setTerminatedCount] = useState<number | null>(null);
  const [activeCountLoading, setActiveCountLoading] = useState(true);
  const [terminatedCountLoading, setTerminatedCountLoading] = useState(true);
  const [leaveDash, setLeaveDash] = useState<LeaveDashboardDto | null>(null);
  const [recruitDash, setRecruitDash] = useState<RecruitmentDashboardDto | null>(null);
  const [businessUnits, setBusinessUnits] = useState<BusinessUnitRow[]>([]);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);

  const loadMyTasks = useCallback(async () => {
    try {
      const tasks = await apiFetch<MyTask[]>("/api/employee-tasks/my-tasks");
      setMyTasks(tasks);
    } catch {
      /* ignore */
    }
  }, []);

  const loadDashboardMetrics = useCallback(() => {
    if (!token) return;

    setActiveCountLoading(true);
    setTerminatedCountLoading(true);

    void fetchDashboardMetric<{ totalCount: number }>("/api/employees?pageSize=1&excludeTerminated=true")
      .then((activeRes) => setActiveCount(activeRes?.totalCount ?? null))
      .finally(() => setActiveCountLoading(false));

    void fetchDashboardMetric<{ totalCount: number }>("/api/employees?pageSize=1&status=Terminated")
      .then((termRes) => setTerminatedCount(termRes?.totalCount ?? null))
      .finally(() => setTerminatedCountLoading(false));

    void fetchDashboardMetric<LeaveDashboardDto>("/api/leave/dashboard").then(setLeaveDash);
    void fetchDashboardMetric<RecruitmentDashboardDto>("/api/recruitment/dashboard").then(setRecruitDash);

    void fetchDashboardMetric<BusinessUnitRow[]>("/api/organization/business-units").then((bus) =>
      setBusinessUnits(Array.isArray(bus) ? bus : []),
    );
    void fetchDashboardMetric<DepartmentRow[]>("/api/organization/departments").then((depts) =>
      setDepartments(Array.isArray(depts) ? depts : []),
    );
  }, [token]);

  useEffect(() => {
    if (authLoading || !token) return;
    loadMyTasks();
  }, [authLoading, token, loadMyTasks]);

  useEffect(() => {
    if (authLoading || !token) return;
    loadDashboardMetrics();
  }, [authLoading, token, loadDashboardMetrics]);

  useEffect(() => {
    function scrollToBirthdays() {
      if (window.location.hash !== "#dashboard-birthdays") return;
      window.setTimeout(() => {
        document.getElementById("dashboard-birthdays")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
    scrollToBirthdays();
    window.addEventListener("hashchange", scrollToBirthdays);
    return () => window.removeEventListener("hashchange", scrollToBirthdays);
  }, []);

  async function handleComplete(taskId: string) {
    setCompleting(taskId);
    try {
      await apiFetch(`/api/offboarding/tasks/${taskId}/complete`, { method: "POST" });
      setMyTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch {
      await appAlert("Failed to complete task");
    }
    setCompleting(null);
  }

  const attentionCount = myTasks.length + (leaveDash?.pendingApprovals ?? 0);

  const snapshotRows = useMemo(() => {
    const buRows = businessUnits
      .filter((b) => b.employeeCount > 0)
      .map((b) => ({ label: b.name, count: b.employeeCount }))
      .sort((a, b) => b.count - a.count);
    if (buRows.length > 0) return { title: "By business unit", rows: buRows.slice(0, 8) };
    const dRows = departments
      .filter((d) => d.employeeCount > 0)
      .map((d) => ({ label: d.name, count: d.employeeCount }))
      .sort((a, b) => b.count - a.count);
    return { title: "By department", rows: dRows.slice(0, 8) };
  }, [businessUnits, departments]);

  const timelineItems = useMemo(() => {
    type Item = { at: string; title: string; body: string };
    const items: Item[] = [];
    recruitDash?.recentActivities?.forEach((a) => {
      const body = formatRecruitmentActivityDescription(a);
      items.push({
        at: a.performedAt,
        title: a.activityType || "Recruitment activity",
        body: body + (a.performedBy ? ` · ${a.performedBy}` : ""),
      });
    });
    leaveDash?.recentRequests?.forEach((r) => {
      items.push({
        at: r.createdAt,
        title: `Leave · ${r.leaveTypeName}`,
        body: `${r.employeeName} — ${r.status}`,
      });
    });
    items.sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime());
    return items.slice(0, 8);
  }, [leaveDash, recruitDash]);

  const kpis = useMemo(
    () => [
      {
        label: "Active employees",
        value: formatInt(activeCount),
        loading: activeCountLoading,
        sub:
          activeCount != null
            ? "Non-terminated headcount"
            : activeCountLoading
              ? "Loading..."
              : "Unable to load (check People access)",
      },
      {
        label: "Open requisitions",
        value: formatInt(recruitDash?.openRequisitions),
        sub:
          recruitDash != null
            ? `${formatInt(recruitDash.totalCandidates)} candidates in pipeline`
            : "Recruitment module or access unavailable",
      },
      {
        label: "Pending leave approvals",
        value: formatInt(leaveDash?.pendingApprovals),
        sub:
          leaveDash != null
            ? `${formatInt(leaveDash.approvedThisMonth)} approved this month`
            : "Leave admin dashboard unavailable for this user",
      },
      {
        label: "Terminated (records)",
        value: formatInt(terminatedCount),
        loading: terminatedCountLoading,
        sub:
          terminatedCount != null && activeCount != null && activeCount + terminatedCount > 0
            ? `${((terminatedCount / (activeCount + terminatedCount)) * 100).toFixed(1)}% of all employee records`
            : "Historical terminations in system",
      },
    ],
    [activeCount, terminatedCount, activeCountLoading, terminatedCountLoading, leaveDash, recruitDash]
  );

  const quickLinks = [
    { href: "/app/people", title: "People Hub", sub: "Employee records and profiles" },
    { href: "/app/org-structure", title: "Org structure", sub: "Departments and reporting hierarchy" },
    { href: ROUTES.approvals, title: "Approvals", sub: "Leave and overtime sign-off" },
    { href: "/app/leave", title: "Leave", sub: "Balances, policies, and requests" },
    { href: "/app/recruitment", title: "Recruitment", sub: "Requisitions and pipeline" },
  ];

  const recruitPipelineBars = useMemo(() => {
    if (!recruitDash) return [];
    return [
      { label: "Open requisitions", value: recruitDash.openRequisitions, color: DASH_COMPARE_COLORS.primary },
      { label: "Candidates in pipeline", value: recruitDash.totalCandidates, color: DASH_COMPARE_COLORS.secondary },
      { label: "Interviews (this week)", value: recruitDash.interviewsThisWeek, color: DASH_COMPARE_COLORS.warning },
      { label: "Offers extended", value: recruitDash.offersExtended, color: DASH_COMPARE_COLORS.success },
      { label: "Hired this month", value: recruitDash.hiredThisMonth, color: DASH_COMPARE_COLORS.danger },
    ];
  }, [recruitDash]);

  const leaveStatusBars = useMemo(() => {
    const requests = leaveDash?.recentRequests ?? [];
    if (requests.length === 0) return [];
    const tally = new Map<string, number>();
    for (const r of requests) {
      const s = r.status || "Unknown";
      tally.set(s, (tally.get(s) ?? 0) + 1);
    }
    const colorFor = (status: string): { color: string } => {
      const u = status.toLowerCase();
      if (u.includes("pending")) return { color: DASH_COMPARE_COLORS.warning };
      if (u.includes("approved")) return { color: DASH_COMPARE_COLORS.success };
      if (u.includes("reject")) return { color: DASH_COMPARE_COLORS.danger };
      if (u.includes("cancel")) return { color: DASH_COMPARE_COLORS.muted };
      return { color: DASH_COMPARE_COLORS.primary };
    };
    return Array.from(tally.entries())
      .map(([label, value]) => ({ label, value, ...colorFor(label) }))
      .sort((a, b) => b.value - a.value);
  }, [leaveDash]);

  const activityLast7Days = useMemo(() => {
    const keys: string[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      keys.push(formatLocalDateToIso(d));
    }
    const counts = new Map<string, number>();
    for (const k of keys) counts.set(k, 0);
    leaveDash?.recentRequests?.forEach((r) => {
      const k = instantToLocalDateKey(r.createdAt);
      if (counts.has(k)) counts.set(k, (counts.get(k) ?? 0) + 1);
    });
    recruitDash?.recentActivities?.forEach((a) => {
      const k = instantToLocalDateKey(a.performedAt);
      if (counts.has(k)) counts.set(k, (counts.get(k) ?? 0) + 1);
    });
    return keys.map((key) => ({
      label: new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" }),
      count: counts.get(key) ?? 0,
    }));
  }, [leaveDash, recruitDash]);

  const headcountMix = useMemo(() => {
    const rows = [
      { label: "Active", value: activeCount ?? 0, color: T.accent },
      { label: "Terminated (records)", value: terminatedCount ?? 0, color: T.action },
    ].filter((r) => r.value > 0);
    return rows;
  }, [activeCount, terminatedCount]);

  return (
    <>
      <div className="mb-6">
        <div className="app-page-hero">
          <DashboardPageHeader
          title="Dashboard"
          subtitle={
            <>
              Overview of workforce metrics, pending actions, and recent activity
              {attentionCount > 0 ? (
                <>
                  {" "}
                  ·{" "}
                  <span className="font-semibold" style={{ color: T.accent }}>
                    {attentionCount} need attention
                  </span>
                </>
              ) : null}
            </>
          }
          badge={<DashboardBrandBadge />}
        />
        <DashboardKpiGrid items={kpis} />
        </div>
      </div>

      <div id="dashboard-birthdays" className="mb-6 scroll-mt-28">
        <BirthdaysCompanyNoticesWidget />
      </div>

      {myTasks.length > 0 && (
        <div className="opensky-dashboard-card mb-6 overflow-hidden !p-0">
          <DashboardCardHeader
            title="My pending tasks"
            subtitle={`${myTasks.length} task${myTasks.length !== 1 ? "s" : ""} assigned to you`}
            iconBg={T.accentSoft}
            iconColor={T.accent}
            icon={
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z"
                />
              </svg>
            }
          />
          <div className="divide-y" style={{ borderColor: T.border }}>
            {myTasks.map((task) => (
              <div key={task.id} className="flex items-center gap-3 px-6 py-3.5 backdrop-blur-[2px]">
                <button
                  type="button"
                  disabled={completing === task.id}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleComplete(task.id);
                  }}
                  className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-[#76B82A]/50 text-[#76B82A] transition hover:border-[#76B82A] hover:bg-[#76B82A] hover:text-white"
                  title="Mark as complete"
                >
                  {completing === task.id ? (
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-200 border-t-[#76B82A]" />
                  ) : (
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium text-slate-800">{task.title}</span>
                  <div className="mt-0.5 flex items-center gap-2">
                    <a
                      href={`/app/people/${task.employeeId}`}
                      className="relative z-10 text-xs font-medium text-[#1E3A8A] underline-offset-2 transition hover:text-[#76B82A] hover:underline"
                    >
                      {task.employeeName}
                    </a>
                    <span className="text-xs text-slate-400">({task.employeeCode})</span>
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${task.taskType === "Onboarding" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                >
                  {task.taskType}
                </span>
                <span className="shrink-0 rounded-full bg-[#E8EEF7] px-2 py-0.5 text-[10px] font-medium text-[#1E3A8A]">
                  {task.category}
                </span>
                {task.assignmentType === "Supervisor" && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#D4DEE8] bg-white px-2 py-0.5 text-[10px] font-medium text-[#1E3A8A]">
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0"
                      />
                    </svg>
                    Supervisor
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 grid min-w-0 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
        <div className="opensky-dashboard-card overflow-hidden !p-0">
          <DashboardCardHeader
            title="Workforce distribution"
            subtitle={snapshotRows.title}
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            }
          />
          <div className="p-5 pt-0">
          {snapshotRows.rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">
              No headcount by unit or department yet.
            </p>
          ) : (
            <div className="space-y-2.5">
              {snapshotRows.rows.slice(0, 6).map((r, rowIdx) => {
                const max = Math.max(...snapshotRows.rows.map((x) => x.count), 1);
                const width = `${Math.max(8, Math.round((r.count / max) * 100))}%`;
                const c0 = DASH_WORKFORCE_ROW_COLORS[rowIdx % DASH_WORKFORCE_ROW_COLORS.length];
                return (
                  <div key={r.label}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="truncate" style={{ color: T.muted }}>{r.label}</span>
                      <span className="font-semibold" style={{ color: T.navy }}>{r.count}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full" style={{ backgroundColor: T.soft }}>
                      <div
                        className="h-2.5 rounded-full transition-all duration-300"
                        style={{ width, backgroundColor: c0 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </div>
        </div>

        <div className="opensky-dashboard-card overflow-hidden !p-0">
          <DashboardCardHeader
            title="Activity volume"
            subtitle="Last 7 days"
            iconBg={T.actionSoft}
            iconColor={T.action}
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            }
          />
          <div className="p-5 pt-0">
          <WeeklyActivityBars data={activityLast7Days} barGradients={DASH_ACTIVITY_DAY_COLORS} />
          <p className="mt-2 text-[11px]" style={{ color: T.muted }}>
            Counts from recent leave requests and recruitment activities returned by the API.
          </p>
          </div>
        </div>

        <div className="opensky-dashboard-card overflow-hidden !p-0">
          <DashboardCardHeader
            title="Headcount mix"
            subtitle="Active vs terminated records"
            iconBg={T.accentSoft}
            iconColor={T.accent}
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" />
              </svg>
            }
          />
          <div className="p-5 pt-0">
          {headcountMix.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">People counts not loaded.</p>
          ) : (
            <DonutMixChart values={headcountMix} />
          )}
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
        <div className="opensky-dashboard-card flex h-[min(400px,42vh)] min-h-[320px] flex-col overflow-hidden !p-0">
          <DashboardCardHeader
            title="Recruitment pipeline"
            subtitle="Scale = largest metric"
            iconBg={T.primaryLight}
            iconColor={T.navyMid}
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 .414-.336.75-.75.75h-4.5a.75.75 0 01-.75-.75v-4.25m13.5 0h-15m13.5 0V6.375c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v7.775M6 10.5h.008v.008H6V10.5z" />
              </svg>
            }
          />
          <div className="flex min-h-0 flex-1 flex-col justify-center p-5 pt-0">
          {recruitPipelineBars.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Recruitment dashboard not available.</p>
          ) : (
            <HorizontalCompareBars items={recruitPipelineBars} />
          )}
          </div>
        </div>
        <div className="opensky-dashboard-card flex h-[min(400px,42vh)] min-h-[320px] flex-col overflow-hidden !p-0">
          <DashboardCardHeader
            title="Recent leave by status"
            subtitle="From latest dashboard sample"
            iconBg={T.actionSoft}
            iconColor={T.action}
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            }
          />
          <div className="flex min-h-0 flex-1 flex-col justify-center p-5 pt-0">
          {leaveStatusBars.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              No recent leave requests in the dashboard payload.
            </p>
          ) : (
            <HorizontalCompareBars items={leaveStatusBars} />
          )}
          </div>
        </div>

        <div className="opensky-dashboard-card flex h-[min(400px,42vh)] min-h-[320px] flex-col overflow-hidden !p-0">
          <DashboardCardHeader
            title="Recent activity"
            subtitle="Leave and recruitment updates"
            iconBg={T.accentSoft}
            iconColor={T.accent}
            trailing={
              <span
                className="rounded-full border px-2.5 py-1 text-[11px] font-medium"
                style={{ borderColor: T.border, backgroundColor: T.accentSoft, color: T.navyMid }}
              >
                {timelineItems.length} items
              </span>
            }
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <div className="min-h-0 flex-1 overflow-hidden p-5 pt-0">
          {timelineItems.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">
              No recent leave requests or recruitment activities returned yet.
            </p>
          ) : (
            <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain pr-2 [scrollbar-gutter:stable] scroll-smooth [scrollbar-width:thin] [scrollbar-color:rgb(203_213_225)_rgb(241_245_249)] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-slate-100">
              {timelineItems.map((ev, i) => {
                const isLeave = ev.title.toLowerCase().includes("leave");
                return (
                  <div
                    key={`${ev.at}-${i}`}
                    className="opensky-dashboard-timeline-row group grid grid-cols-[88px_1fr] items-start gap-3 rounded-xl border px-3 py-2.5"
                    style={{ borderColor: T.border }}
                  >
                    <div className="pt-0.5 text-[11px] font-medium" style={{ color: T.muted }}>
                      {formatBusinessDateTime(ev.at)}
                    </div>
                    <div className="min-w-0">
                      <div className="mb-0.5 flex items-center gap-2">
                        <span
                          className="inline-flex h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: isLeave ? T.warning : T.accent }}
                        />
                        <strong className="truncate text-sm" style={{ color: T.navy }}>{ev.title}</strong>
                      </div>
                      <div className="line-clamp-2 text-sm" style={{ color: T.muted }}>{ev.body}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </div>
        </div>

        <div className="opensky-dashboard-card flex h-[min(400px,42vh)] min-h-[320px] flex-col overflow-hidden !p-0">
          <DashboardCardHeader
            title="Quick actions"
            subtitle="Navigate faster to high-traffic modules"
            iconBg={T.actionSoft}
            iconColor={T.action}
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            }
          />
          <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-2 gap-2.5 p-5 pt-0">
            {quickLinks.slice(0, 4).map((link) => (
              <Link key={link.title} href={link.href} className="opensky-dashboard-quicklink group flex h-full min-h-0 flex-col justify-center">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold" style={{ color: T.navy }}>{link.title}</div>
                    <p className="mt-0.5 line-clamp-2 text-xs" style={{ color: T.muted }}>{link.sub}</p>
                  </div>
                  <span className="opensky-quicklink-chev mt-0.5 shrink-0" style={{ color: T.action }}>
                    →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

    </>
  );
}
