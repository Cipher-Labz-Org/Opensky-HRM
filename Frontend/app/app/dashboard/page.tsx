"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { appAlert } from "@/components/ui/appDialogs";
import { apiFetch } from "@/lib/api";
import { formatLocalDateToIso, instantToLocalDateKey } from "@/lib/datePickerIso";
import { CommandCenterView } from "@/components/dashboard/CommandCenterView";
import { DASH_CHART } from "@/lib/opensky-theme";
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

  return (
    <CommandCenterView
      attentionCount={attentionCount}
      activeCount={activeCount}
      terminatedCount={terminatedCount}
      activeCountLoading={activeCountLoading}
      leaveDash={leaveDash}
      recruitDash={recruitDash}
      snapshotRows={snapshotRows}
      activityLast7Days={activityLast7Days}
      leaveStatusBars={leaveStatusBars}
      timelineItems={timelineItems}
      myTasks={myTasks}
      completing={completing}
      onCompleteTask={(id) => void handleComplete(id)}
    />
  );
}
