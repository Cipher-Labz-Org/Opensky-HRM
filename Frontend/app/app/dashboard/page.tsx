"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { apiFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/date-utils";
import Link from "next/link";

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

function formatInt(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString();
}

function HorizontalCompareBars({ items }: { items: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  if (items.every((i) => i.value === 0)) {
    return <div className="py-8 text-center text-sm text-slate-400">No data for this view.</div>;
  }
  return (
    <div className="space-y-2.5">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="truncate text-slate-600">{item.label}</span>
            <span className="shrink-0 font-semibold tabular-nums text-slate-800">{formatInt(item.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div
              className="h-2 rounded-full transition-all"
              style={{
                width: `${Math.max(6, Math.round((item.value / max) * 100))}%`,
                backgroundColor: item.color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function WeeklyActivityBars({ data }: { data: { label: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  const barMaxPx = 88;
  return (
    <div className="flex h-[118px] items-end justify-between gap-1.5 px-0.5">
      {data.map((d) => {
        const px = Math.round((d.count / max) * barMaxPx);
        return (
          <div key={d.label} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <div
              className="w-full max-w-[26px] rounded-t-md bg-gradient-to-t from-blue-600 to-cyan-400 transition-all hover:opacity-90"
              style={{ height: `${d.count > 0 ? Math.max(6, px) : 2}px` }}
              title={`${d.count} event${d.count === 1 ? "" : "s"}`}
            />
            <span className="text-center text-[10px] font-medium leading-tight text-slate-500">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function DonutMixChart({ values }: { values: { label: string; value: number; color: string }[] }) {
  const total = values.reduce((s, v) => s + v.value, 0);
  if (total <= 0) {
    return <div className="py-10 text-center text-sm text-slate-400">No distribution data.</div>;
  }
  let cumulative = 0;
  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 42 42" className="h-36 w-36 -rotate-90">
        <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#e5e7eb" strokeWidth="6" />
        {values.map((item) => {
          const pct = (item.value / total) * 100;
          const dashArray = `${pct} ${100 - pct}`;
          const dashOffset = -cumulative;
          cumulative += pct;
          return (
            <circle
              key={item.label}
              cx="21"
              cy="21"
              r="15.915"
              fill="transparent"
              stroke={item.color}
              strokeWidth="6"
              strokeDasharray={dashArray}
              strokeDashoffset={dashOffset}
            />
          );
        })}
      </svg>
      <div className="space-y-1.5 text-sm">
        {values.map((v) => (
          <div key={v.label} className="flex items-center gap-2 text-slate-600">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: v.color }} />
            <span className="min-w-28">{v.label}</span>
            <strong className="text-slate-800">{formatInt(v.value)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [myTasks, setMyTasks] = useState<MyTask[]>([]);
  const [completing, setCompleting] = useState<string | null>(null);

  const [activeCount, setActiveCount] = useState<number | null>(null);
  const [terminatedCount, setTerminatedCount] = useState<number | null>(null);
  const [leaveDash, setLeaveDash] = useState<LeaveDashboardDto | null>(null);
  const [recruitDash, setRecruitDash] = useState<RecruitmentDashboardDto | null>(null);
  const [businessUnits, setBusinessUnits] = useState<BusinessUnitRow[]>([]);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [dashLoading, setDashLoading] = useState(true);

  const loadMyTasks = useCallback(async () => {
    try {
      const tasks = await apiFetch<MyTask[]>("/api/employee-tasks/my-tasks");
      setMyTasks(tasks);
    } catch {
      /* ignore */
    }
  }, []);

  const loadDashboardMetrics = useCallback(async () => {
    setDashLoading(true);
    try {
      const [activeRes, termRes, leave, recruit, bus, depts] = await Promise.all([
        apiFetch<{ totalCount: number }>("/api/employees?pageSize=1&excludeTerminated=true").catch(() => null),
        apiFetch<{ totalCount: number }>("/api/employees?pageSize=1&status=Terminated").catch(() => null),
        apiFetch<LeaveDashboardDto>("/api/leave/dashboard").catch(() => null),
        apiFetch<RecruitmentDashboardDto>("/api/recruitment/dashboard").catch(() => null),
        apiFetch<BusinessUnitRow[]>("/api/organization/business-units").catch(() => []),
        apiFetch<DepartmentRow[]>("/api/organization/departments").catch(() => []),
      ]);
      setActiveCount(activeRes?.totalCount ?? null);
      setTerminatedCount(termRes?.totalCount ?? null);
      setLeaveDash(leave);
      setRecruitDash(recruit);
      setBusinessUnits(Array.isArray(bus) ? bus : []);
      setDepartments(Array.isArray(depts) ? depts : []);
    } finally {
      setDashLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMyTasks();
  }, [loadMyTasks]);

  useEffect(() => {
    loadDashboardMetrics();
  }, [loadDashboardMetrics]);

  async function handleComplete(taskId: string) {
    setCompleting(taskId);
    try {
      await apiFetch(`/api/offboarding/tasks/${taskId}/complete`, { method: "POST" });
      setMyTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch {
      alert("Failed to complete task");
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
      items.push({
        at: a.performedAt,
        title: a.activityType || "Recruitment activity",
        body: a.description + (a.performedBy ? ` · ${a.performedBy}` : ""),
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
        sub:
          activeCount != null
            ? "Non-terminated headcount"
            : dashLoading
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
        sub:
          terminatedCount != null && activeCount != null && activeCount + terminatedCount > 0
            ? `${((terminatedCount / (activeCount + terminatedCount)) * 100).toFixed(1)}% of all employee records`
            : "Historical terminations in system",
      },
    ],
    [activeCount, terminatedCount, leaveDash, recruitDash, dashLoading]
  );

  const quickLinks = [
    { href: "/app/people", title: "People Hub", sub: "Employee records and profiles" },
    { href: "/app/org-structure", title: "Org structure", sub: "Departments and reporting hierarchy" },
    { href: "/app/leave", title: "Leave", sub: "Requests and approvals" },
    { href: "/app/recruitment", title: "Recruitment", sub: "Requisitions and pipeline" },
  ];

  const recruitPipelineBars = useMemo(() => {
    if (!recruitDash) return [];
    return [
      { label: "Open requisitions", value: recruitDash.openRequisitions, color: "#6366f1" },
      { label: "Candidates in pipeline", value: recruitDash.totalCandidates, color: "#8b5cf6" },
      { label: "Interviews (this week)", value: recruitDash.interviewsThisWeek, color: "#a855f7" },
      { label: "Offers extended", value: recruitDash.offersExtended, color: "#d946ef" },
      { label: "Hired this month", value: recruitDash.hiredThisMonth, color: "#22c55e" },
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
    const colorFor = (status: string) => {
      const u = status.toLowerCase();
      if (u.includes("pending")) return "#f59e0b";
      if (u.includes("approved")) return "#22c55e";
      if (u.includes("reject")) return "#ef4444";
      if (u.includes("cancel")) return "#94a3b8";
      return "#3b82f6";
    };
    return Array.from(tally.entries())
      .map(([label, value]) => ({ label, value, color: colorFor(label) }))
      .sort((a, b) => b.value - a.value);
  }, [leaveDash]);

  const activityLast7Days = useMemo(() => {
    const keys: string[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      keys.push(d.toISOString().slice(0, 10));
    }
    const counts = new Map<string, number>();
    for (const k of keys) counts.set(k, 0);
    leaveDash?.recentRequests?.forEach((r) => {
      const k = new Date(r.createdAt).toISOString().slice(0, 10);
      if (counts.has(k)) counts.set(k, (counts.get(k) ?? 0) + 1);
    });
    recruitDash?.recentActivities?.forEach((a) => {
      const k = new Date(a.performedAt).toISOString().slice(0, 10);
      if (counts.has(k)) counts.set(k, (counts.get(k) ?? 0) + 1);
    });
    return keys.map((key) => ({
      label: new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" }),
      count: counts.get(key) ?? 0,
    }));
  }, [leaveDash, recruitDash]);

  const headcountMix = useMemo(() => {
    const rows = [
      { label: "Active", value: activeCount ?? 0, color: "#22c55e" },
      { label: "Terminated (records)", value: terminatedCount ?? 0, color: "#94a3b8" },
    ].filter((r) => r.value > 0);
    return rows;
  }, [activeCount, terminatedCount]);

  return (
    <>
      <AppTopbar
        title="Command Center"
        subtitle="Live metrics from your OpenSky HRM data (where your role and licenses allow)."
      />

      {myTasks.length > 0 && (
        <div className="mb-6 overflow-hidden rounded-2xl border border-amber-200/70 bg-gradient-to-r from-amber-50 via-orange-50 to-rose-50 shadow-sm">
          <div className="flex items-center gap-3 border-b border-amber-200/70 px-6 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100/90">
              <svg className="h-5 w-5 text-amber-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-amber-900">My pending tasks</h3>
              <p className="text-xs text-amber-700">
                {myTasks.length} task{myTasks.length !== 1 ? "s" : ""} assigned to you
              </p>
            </div>
          </div>
          <div className="divide-y divide-amber-100/80">
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
                  className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-amber-400 text-amber-500 transition hover:bg-amber-400 hover:text-white"
                  title="Mark as complete"
                >
                  {completing === task.id ? (
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-amber-200 border-t-amber-600" />
                  ) : (
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium text-slate-800">{task.title}</span>
                  <div className="mt-0.5 flex items-center gap-2">
                    <a href={`/app/people/${task.employeeId}`} className="relative z-10 text-xs text-blue-600 hover:underline">
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
                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                  {task.category}
                </span>
                {task.assignmentType === "Supervisor" && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-200 bg-white/70 px-2 py-0.5 text-[10px] font-medium text-amber-700">
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

      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 px-7 py-8 text-slate-900 shadow-sm">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-sky-100/50 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 h-72 w-72 rounded-full bg-indigo-100/40 blur-3xl" />
        <div className="relative z-10">
          <div>
            <p className="mb-2 inline-flex rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
              Live workspace
            </p>
            <h2 className="text-2xl font-semibold leading-tight text-slate-900 lg:text-3xl">Workforce intelligence</h2>
            <p className="mt-3 max-w-2xl text-sm text-slate-600">
              KPIs and snapshots load from the API. Some tiles show &quot;—&quot; if a module is not licensed or your role cannot access that data (e.g. leave dashboard requires org-wide leave access).
            </p>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="text-xs font-medium uppercase tracking-wider text-slate-500">{kpi.label}</div>
            <div className="mt-2 text-3xl font-semibold leading-none text-slate-900">{dashLoading && kpi.value === "—" ? "..." : kpi.value}</div>
            <div className="mt-2 text-xs text-slate-600">{kpi.sub}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-800">Workforce distribution</h3>
            <span className="text-xs text-slate-500">{snapshotRows.title}</span>
          </div>
          {snapshotRows.rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">
              No headcount by unit or department yet.
            </p>
          ) : (
            <div className="space-y-2.5">
              {snapshotRows.rows.slice(0, 6).map((r) => {
                const max = Math.max(...snapshotRows.rows.map((x) => x.count), 1);
                const width = `${Math.max(8, Math.round((r.count / max) * 100))}%`;
                return (
                  <div key={r.label}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="truncate text-slate-600">{r.label}</span>
                      <span className="font-semibold text-slate-800">{r.count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600" style={{ width }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-800">Activity volume</h3>
            <span className="text-xs text-slate-500">Last 7 days</span>
          </div>
          <WeeklyActivityBars data={activityLast7Days} />
          <p className="mt-2 text-[11px] text-slate-500">
            Counts from recent leave requests and recruitment activities returned by the API.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-800">Headcount mix</h3>
            <span className="text-xs text-slate-500">Records</span>
          </div>
          {headcountMix.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">People counts not loaded.</p>
          ) : (
            <DonutMixChart values={headcountMix} />
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-800">Recruitment pipeline</h3>
            <span className="text-xs text-slate-500">Scale = largest metric</span>
          </div>
          {recruitPipelineBars.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Recruitment dashboard not available.</p>
          ) : (
            <HorizontalCompareBars items={recruitPipelineBars} />
          )}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-800">Recent leave by status</h3>
            <span className="text-xs text-slate-500">Sample</span>
          </div>
          {leaveStatusBars.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              No recent leave requests in the dashboard payload.
            </p>
          ) : (
            <HorizontalCompareBars items={leaveStatusBars} />
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Recent activity</h3>
              <p className="text-xs text-slate-500">Leave and recruitment updates</p>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
              {timelineItems.length} items
            </span>
          </div>
          {timelineItems.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">
              No recent leave requests or recruitment activities returned yet.
            </p>
          ) : (
            <div className="space-y-2.5">
              {timelineItems.map((ev, i) => {
                const isLeave = ev.title.toLowerCase().includes("leave");
                return (
                  <div
                    key={`${ev.at}-${i}`}
                    className="group grid grid-cols-[88px_1fr] items-start gap-3 rounded-xl border border-slate-200/90 px-3 py-2.5 transition hover:border-slate-300 hover:bg-slate-50/70"
                  >
                    <div className="pt-0.5 text-[11px] font-medium text-slate-500">
                      {formatDateTime(ev.at)}
                    </div>
                    <div className="min-w-0">
                      <div className="mb-0.5 flex items-center gap-2">
                        <span
                          className={`inline-flex h-2 w-2 shrink-0 rounded-full ${isLeave ? "bg-amber-400" : "bg-violet-500"}`}
                        />
                        <strong className="truncate text-sm text-slate-800">{ev.title}</strong>
                      </div>
                      <div className="line-clamp-2 text-sm text-slate-600">{ev.body}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-900">Quick actions</h3>
            <p className="text-xs text-slate-500">Navigate faster to high-traffic modules</p>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
            {quickLinks.map((link) => (
              <Link
                key={link.title}
                href={link.href}
                className="group rounded-xl border border-slate-200 bg-white px-3.5 py-3 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-800">{link.title}</div>
                    <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">{link.sub}</div>
                  </div>
                  <span className="mt-0.5 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700">→</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <p className="footer-note">
        Dashboard metrics come from live APIs. Figures may be hidden (—) when a module is off, or when your role cannot access org-wide leave analytics.
      </p>
    </>
  );
}
