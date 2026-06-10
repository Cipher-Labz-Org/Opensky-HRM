"use client";

import { appConfirm } from "@/components/ui/appDialogs";
import { useState, useEffect, useCallback, useMemo, useRef, type FormEvent } from "react";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { DatePickerField, DateTimePickerField, FormSelect, TablePagination, type FormSelectOption } from "@/components/ui";
import { useClientPagination } from "@/lib/use-client-pagination";
import { CreateAttendanceModal } from "@/components/forms/CreateAttendanceModal";
import { apiFetch } from "@/lib/api";
import { formatBusinessTime, formatDate, formatDateTime } from "@/lib/date-utils";
import { formatLocalDateToIso } from "@/lib/datePickerIso";
import { DonutMixChart, formatInt, HorizontalCompareBars, WeeklyActivityBars } from "@/lib/workspace-charts";
import { useApplyFilter } from "@/lib/use-apply-filter";

// ──────────────────────────── Tabs ────────────────────────────

type PageTab = "dashboard" | "shifts" | "roster" | "attendance" | "devices" | "ot-nopay";

const PAGE_TABS: { key: PageTab; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "shifts", label: "Shifts" },
  { key: "roster", label: "Roster" },
  { key: "attendance", label: "Attendance" },
  { key: "devices", label: "Devices" },
  { key: "ot-nopay", label: "OT / No-Pay" },
];

interface AttendanceSummary {
  totalPresent: number;
  totalAbsent: number;
  totalLate: number;
  totalNoPunch: number;
  averageWorkHours: number;
}

interface AttendanceDailySummary {
  date: string;
  totalPresent: number;
  totalAbsent: number;
  totalLate: number;
  totalNoPunch: number;
}

const labelClass = "mb-1 block text-xs font-medium text-slate-500";
const inputClass = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20";

// ──────────────────────────── Shared types ────────────────────────────

interface ShiftItem {
  id: string;
  name: string;
  code: string;
  shiftType: string;
  startTime: string;
  endTime: string;
  breakHours: number;
  isNightShift: boolean;
  session2StartTime: string | null;
  session2EndTime: string | null;
  flexiWindowStart: string | null;
  flexiWindowEnd: string | null;
  minimumWorkHours: number | null;
  lateGraceMinutes: number;
  earlyDepartureGraceMinutes: number;
  halfDayHours: number;
  appliesOnMonday: boolean;
  appliesOnTuesday: boolean;
  appliesOnWednesday: boolean;
  appliesOnThursday: boolean;
  appliesOnFriday: boolean;
  appliesOnSaturday: boolean;
  appliesOnSunday: boolean;
  mondayStartTime: string | null;
  mondayEndTime: string | null;
  tuesdayStartTime: string | null;
  tuesdayEndTime: string | null;
  wednesdayStartTime: string | null;
  wednesdayEndTime: string | null;
  thursdayStartTime: string | null;
  thursdayEndTime: string | null;
  fridayStartTime: string | null;
  fridayEndTime: string | null;
  saturdayStartTime: string | null;
  saturdayEndTime: string | null;
  sundayStartTime: string | null;
  sundayEndTime: string | null;
  isActive: boolean;
}

const SHIFT_TYPES = ["Regular", "Split", "Flexi", "Rotational", "Open"] as const;

interface EmployeeLookup {
  id: string;
  fullName: string;
  employeeCode: string;
  departmentId: string | null;
  departmentName: string | null;
  locationId: string | null;
  locationName: string | null;
}

function timeSpanToInput(value: string): string {
  if (!value) return "";
  const part = value.split(":").slice(0, 2).join(":");
  return part.length <= 5 ? part : part.substring(0, 5);
}

function timeInputToSpan(hhmm: string): string {
  if (!hhmm) return "00:00:00";
  const [h, m] = hhmm.split(":").map(Number);
  return `${String(h ?? 0).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")}:00`;
}

function timeOrNull(hhmm: string): string | null {
  const t = (hhmm || "").trim();
  if (!t) return null;
  return timeInputToSpan(t);
}

function dateOnlyForInput(iso: string): string {
  if (!iso) return "";
  return iso.includes("T") ? (iso.split("T")[0] ?? "") : iso.slice(0, 10);
}

function fmtTime(iso: string | null): string {
  return formatBusinessTime(iso);
}

function fmtDate(iso: string | null): string {
  return formatDate(iso);
}

function fmtTimeSpan(ts: string | null): string {
  if (!ts) return "—";
  return ts.split(":").slice(0, 2).join(":");
}

function todayLocalIso(date: Date = new Date()): string {
  return formatLocalDateToIso(date);
}

// ──────────────────────────── Page ────────────────────────────

export default function AttendancePage() {
  const [pageTab, setPageTab] = useState<PageTab>("dashboard");
  const [showCreate, setShowCreate] = useState(false);
  const [dashRefresh, setDashRefresh] = useState(0);

  return (
    <>
      <AppTopbar
        title="Time & Attendance"
        subtitle="Shift patterns, rosters, mobile/web punch, biometrics integration, overtime, and anomaly detection."
      />

      <div className="mt-6 mb-6 flex flex-wrap items-center gap-2">
        {PAGE_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setPageTab(t.key)}
            className={`rounded-xl border px-3.5 py-2.5 text-xs font-semibold transition sm:px-4 sm:text-sm ${
              pageTab === t.key
                ? "border-slate-300 bg-white text-slate-900 shadow-sm"
                : "border-slate-200/90 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <CreateAttendanceModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => {
          setShowCreate(false);
          setDashRefresh((k) => k + 1);
        }}
      />

      {pageTab === "dashboard" && (
        <DashboardTab
          key={dashRefresh}
          onOpenTab={setPageTab}
          onLogAttendance={() => setShowCreate(true)}
        />
      )}

      {pageTab === "shifts" && <ShiftsTab />}
      {pageTab === "roster" && <RosterTab />}
      {pageTab === "attendance" && <AttendanceListTab />}
      {pageTab === "devices" && <DevicesTab />}
      {pageTab === "ot-nopay" && <OtNopayTab />}
    </>
  );
}

// ──────────────────────────── Dashboard ────────────────────────────

function DashboardTab({
  onOpenTab,
  onLogAttendance,
}: {
  onOpenTab: (tab: PageTab) => void;
  onLogAttendance: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [weekActivity, setWeekActivity] = useState<{ label: string; count: number }[]>([]);
  const [recentRows, setRecentRows] = useState<
    { id: string; employeeName: string; status: string; punchIn: string | null; punchOut: string | null; date: string }[]
  >([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const today = todayLocalIso();
      const weekFrom = todayLocalIso(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));
      try {
        const [todaySummary, dailySummaries, recentRes] = await Promise.all([
          apiFetch<AttendanceSummary>(`/api/attendance/summary?from=${today}&to=${today}`).catch(() => null),
          apiFetch<AttendanceDailySummary[]>(`/api/attendance/summary/daily?from=${weekFrom}&to=${today}`).catch(() => []),
          apiFetch<{ items: AttendanceRecord[] }>(`/api/attendance?pageSize=8&from=${today}&to=${today}`).catch(() => ({
            items: [] as AttendanceRecord[],
          })),
        ]);
        if (cancelled) return;
        setSummary(todaySummary);
        const byDate = new Map(
          (dailySummaries ?? []).map((s) => [s.date.split("T")[0], s.totalPresent])
        );
        const dayKeys: string[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          dayKeys.push(todayLocalIso(d));
        }
        setWeekActivity(
          dayKeys.map((d) => ({
            label: new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" }),
            count: byDate.get(d) ?? 0,
          }))
        );
        const items = recentRes.items ?? [];
        setRecentRows(
          [...items]
            .sort((a, b) => {
              const ta = a.punchIn ? new Date(a.punchIn).getTime() : 0;
              const tb = b.punchIn ? new Date(b.punchIn).getTime() : 0;
              return tb - ta;
            })
            .slice(0, 8)
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const statusBars = useMemo(() => {
    if (!summary) return [];
    const onTime = Math.max(0, summary.totalPresent - summary.totalLate);
    return [
      { label: "On time / present", value: onTime, color: "#22c55e" },
      { label: "Late", value: summary.totalLate, color: "#f59e0b" },
      { label: "Absent", value: summary.totalAbsent, color: "#ef4444" },
      { label: "No punch", value: summary.totalNoPunch, color: "#94a3b8" },
    ];
  }, [summary]);

  const donutValues = useMemo(() => statusBars.filter((x) => x.value > 0), [statusBars]);

  const kpis = useMemo(() => {
    if (!summary) return [];
    const avg =
      summary.averageWorkHours != null && Number.isFinite(summary.averageWorkHours)
        ? summary.averageWorkHours.toFixed(1)
        : "—";
    const denom = Math.max(1, summary.totalPresent + summary.totalAbsent);
    const presentRate = Math.round((summary.totalPresent / denom) * 100);
    return [
      {
        label: "Present (incl. late)",
        value: formatInt(summary.totalPresent),
        sub: `${presentRate}% of present + absent records today`,
      },
      {
        label: "Late arrivals",
        value: formatInt(summary.totalLate),
        sub: "Marked late for today’s window",
      },
      {
        label: "Absent",
        value: formatInt(summary.totalAbsent),
        sub: "No check-in for scheduled work",
      },
      {
        label: "Avg. work hours",
        value: avg,
        sub: "Mean recorded hours where punches exist",
      },
    ];
  }, [summary]);

  const quickLinks: { tab: PageTab; title: string; sub: string }[] = [
    { tab: "shifts", title: "Shifts", sub: "Shift patterns and timings" },
    { tab: "roster", title: "Roster", sub: "Assignments and coverage" },
    { tab: "attendance", title: "Attendance log", sub: "Punch history and corrections" },
    { tab: "devices", title: "Devices", sub: "Biometric and integration endpoints" },
    { tab: "ot-nopay", title: "OT / No-pay", sub: "Overtime and unpaid time rules" },
  ];

  const timelineItems = useMemo(
    () =>
      recentRows.map((r) => ({
        at: r.punchIn ?? r.date,
        title: `${r.employeeName} · ${r.status}`,
        body: `${fmtDate(r.date)} · In ${fmtTime(r.punchIn)}${r.punchOut ? ` · Out ${fmtTime(r.punchOut)}` : ""}`,
      })),
    [recentRows]
  );

  if (loading) {
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" />
        ))}
      </div>
    );
  }

  if (!summary) {
    return (
      <p className="rounded-2xl border border-slate-200 bg-white py-12 text-center text-sm text-slate-500 shadow-sm">
        Unable to load attendance summary. Check your connection and Attendance module access.
      </p>
    );
  }

  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="text-xs font-medium uppercase tracking-wider text-slate-500">{kpi.label}</div>
            <div className="mt-2 text-3xl font-semibold leading-none text-slate-900">{kpi.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-800">Check-in volume</h3>
            <span className="text-xs text-slate-500">Last 7 days</span>
          </div>
          <WeeklyActivityBars data={weekActivity} />
          <p className="mt-2 text-[11px] text-slate-500">Daily count of present + late records from the attendance summary API.</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-800">Today’s mix</h3>
            <span className="text-xs text-slate-500">By status</span>
          </div>
          {statusBars.every((x) => x.value === 0) ? (
            <p className="py-8 text-center text-sm text-slate-500">No attendance rows for today yet.</p>
          ) : (
            <HorizontalCompareBars items={statusBars} />
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-800">Status distribution</h3>
            <span className="text-xs text-slate-500">Today</span>
          </div>
          {donutValues.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No distribution data.</p>
          ) : (
            <DonutMixChart values={donutValues} />
          )}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800">Capture channels</h3>
          <span className="text-xs text-slate-500">Supported</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["Biometric devices", "Fingerprint / face terminals"],
            ["Mobile geo-punch", "Field and remote workers"],
            ["Web punch", "Desk and back office"],
          ].map(([t, s]) => (
            <div
              key={t}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/90 px-3 py-2.5 text-slate-700"
            >
              <div>
                <div className="font-semibold text-slate-800">{t}</div>
                <div className="text-xs text-slate-500">{s}</div>
              </div>
              <span className="shrink-0 text-emerald-600">✓</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Recent punches</h3>
              <p className="text-xs text-slate-500">Latest activity for today (where available)</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                {timelineItems.length} shown
              </span>
              <Button
                variant="secondary"
                className="min-h-0 rounded-lg px-3 py-1.5 text-xs"
                onClick={() => onOpenTab("attendance")}
              >
                Full log
              </Button>
              <Button className="min-h-0 rounded-lg px-3 py-1.5 text-xs" onClick={onLogAttendance}>
                + Log attendance
              </Button>
            </div>
          </div>
          {timelineItems.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">No punch rows returned for today yet.</p>
          ) : (
            <div className="space-y-2.5">
              {timelineItems.map((ev, i) => (
                <div
                  key={`${ev.at}-${i}`}
                  className="group grid grid-cols-[88px_1fr] items-start gap-3 rounded-xl border border-slate-200/90 px-3 py-2.5 transition hover:border-slate-300 hover:bg-slate-50/70"
                >
                  <div className="pt-0.5 text-[11px] font-medium text-slate-500">{formatDateTime(ev.at)}</div>
                  <div className="min-w-0">
                    <div className="mb-0.5 flex items-center gap-2">
                      <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-cyan-500" />
                      <strong className="truncate text-sm text-slate-800">{ev.title}</strong>
                    </div>
                    <div className="line-clamp-2 text-sm text-slate-600">{ev.body}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-900">Quick actions</h3>
            <p className="text-xs text-slate-500">Jump to time and attendance workflows</p>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
            {quickLinks.map((link) => (
              <button
                key={link.title}
                type="button"
                onClick={() => onOpenTab(link.tab)}
                className="group rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-800">{link.title}</div>
                  </div>
                  <span className="mt-0.5 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700">
                    →
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="footer-note">
        Summary and charts use today’s date in your browser timezone. Weekly bars call the attendance summary API per day;
        open Attendance for filtered history and exports.
      </p>
    </>
  );
}

// ──────────────────────────── Attendance List Tab ────────────────────────────

interface AttendanceRecord {
  id: string;
  employeeName: string;
  employeeCode: string | null;
  employeeId: string;
  date: string;
  punchIn: string | null;
  punchOut: string | null;
  workedHours: number | null;
  status: string;
  remarks: string | null;
  source: string | null;
  shiftName: string | null;
  shiftType: string | null;
  expectedStart: string | null;
  expectedEnd: string | null;
  isLate: boolean;
  lateMins: number;
  isEarlyDeparture: boolean;
  earlyDepartureMins: number;
  isShortHours: boolean;
  isOnLeave: boolean;
  latitude: number | null;
  longitude: number | null;
}

function AttendanceListTab() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [filterEmployee, setFilterEmployee] = useState("");
  const employeeSearchFilter = useApplyFilter();
  const [filterFrom, setFilterFrom] = useState(() => todayLocalIso());
  const [filterTo, setFilterTo] = useState(() => todayLocalIso());
  const [employees, setEmployees] = useState<EmployeeLookup[]>([]);
  const [employeesLoaded, setEmployeesLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editModal, setEditModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const employeeOptions = useMemo(
    () =>
      employees.map((emp) => ({
        id: emp.id,
        label: `${emp.fullName}${emp.employeeCode ? ` (${emp.employeeCode})` : ""}`,
      })),
    [employees]
  );

  const loadEmployees = useCallback(() => {
    if (employeesLoaded) return;
    apiFetch<{ items: EmployeeLookup[] }>("/api/employees?pageSize=200")
      .then((r) => {
        setEmployees(r.items ?? []);
        setEmployeesLoaded(true);
      })
      .catch(() => {});
  }, [employeesLoaded]);

  const load = useCallback(
    (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (filterEmployee) params.set("employeeId", filterEmployee);
      if (filterFrom) params.set("from", filterFrom);
      if (filterTo) params.set("to", filterTo);
      apiFetch<{ items: AttendanceRecord[]; totalCount: number }>(`/api/attendance?${params}`)
        .then((r) => {
          setRecords(r.items ?? []);
          setTotalCount(r.totalCount ?? 0);
          setLastRefreshedAt(new Date());
        })
        .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
        .finally(() => {
          if (silent) setRefreshing(false);
          else setLoading(false);
        });
    },
    [page, filterEmployee, filterFrom, filterTo]
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => load({ silent: true }), 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  function openEdit(rec: AttendanceRecord) { setEditingRecord(rec); setEditModal(true); }

  async function handleEditSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingRecord) return;
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    try {
      await apiFetch(`/api/attendance/${editingRecord.id}`, {
        method: "PUT",
        body: JSON.stringify({
          punchIn: (fd.get("punchIn") as string) || null,
          punchOut: (fd.get("punchOut") as string) || null,
          status: (fd.get("status") as string) || null,
          remarks: (fd.get("remarks") as string) || null,
        }),
      });
      setEditModal(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally { setSaving(false); }
  }

  async function handleDelete(rec: AttendanceRecord) {
    if (!(await appConfirm(`Delete attendance record for ${rec.employeeName} on ${fmtDate(rec.date)}?`))) return;
    try {
      await apiFetch(`/api/attendance/${rec.id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  const totalPages = Math.ceil(totalCount / pageSize);

  function applyEmployeeFilter() {
    const q = employeeSearchFilter.apply().toLowerCase();
    if (!q) {
      setFilterEmployee("");
      setPage(1);
      return;
    }
    const matched =
      employeeOptions.find((opt) => opt.label.toLowerCase() === q) ??
      employeeOptions.find((opt) => opt.label.toLowerCase().includes(q));
    setFilterEmployee(matched?.id ?? "");
    setPage(1);
  }

  const activeEmployeeLabel = filterEmployee
    ? employeeOptions.find((opt) => opt.id === filterEmployee)?.label
    : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className={labelClass}>Employee</label>
          <input
            value={employeeSearchFilter.input}
            onFocus={loadEmployees}
            onChange={(e) => employeeSearchFilter.setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyEmployeeFilter();
            }}
            list="attendance-employee-filter-options"
            placeholder="Name or code… (Enter)"
            className={`${inputClass} w-56`}
          />
          <datalist id="attendance-employee-filter-options">
            {employeeOptions.map((opt) => (
              <option key={opt.id} value={opt.label} />
            ))}
          </datalist>
          {activeEmployeeLabel && (
            <p className="mt-1 text-xs text-slate-500">
              Filtering: <span className="font-medium text-slate-700">{activeEmployeeLabel}</span>
            </p>
          )}
        </div>
        <div>
          <label className={labelClass}>From</label>
          <DatePickerField value={filterFrom} onChange={(v) => { setFilterFrom(v); setPage(1); }} className={`${inputClass} w-40`} />
        </div>
        <div>
          <label className={labelClass}>To</label>
          <DatePickerField value={filterTo} onChange={(v) => { setFilterTo(v); setPage(1); }} className={`${inputClass} w-40`} />
        </div>
        <Button variant="secondary" onClick={() => { employeeSearchFilter.clear(); setFilterEmployee(""); setFilterFrom(""); setFilterTo(""); setPage(1); }}>Clear</Button>
        <Button variant="secondary" onClick={() => load()} disabled={loading || refreshing}>
          Refresh
        </Button>
        <div className="ml-auto flex items-center gap-3">
          {lastRefreshedAt && (
            <span className="text-xs text-slate-400">
              Updated {lastRefreshedAt.toLocaleTimeString("en-LK", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              {refreshing ? " · syncing…" : " · auto 30s"}
            </span>
          )}
          <Button onClick={() => setShowCreate(true)}>+ Log Attendance</Button>
        </div>
      </div>
      <p className="text-xs text-slate-500 -mt-2">
        Biometric rows show earliest punch as <strong>Punch In</strong> and latest as <strong>Punch Out</strong> for the day. New device punches can take up to a minute to appear.
      </p>

      <CreateAttendanceModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />

      {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-4 py-2.5 font-semibold text-slate-600">Employee</th>
                <th className="px-3 py-2.5 font-semibold text-slate-600">Date</th>
                <th className="px-3 py-2.5 font-semibold text-slate-600">Punch In</th>
                <th className="px-3 py-2.5 font-semibold text-slate-600">Punch Out</th>
                <th className="px-3 py-2.5 font-semibold text-slate-600">Hours</th>
                <th className="px-3 py-2.5 font-semibold text-slate-600">Status</th>
                <th className="px-3 py-2.5 font-semibold text-slate-600">Source</th>
                <th className="px-3 py-2.5 font-semibold text-slate-600">Shift</th>
                <th className="px-3 py-2.5 font-semibold text-slate-600">Flags</th>
                <th className="px-3 py-2.5 font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y divide-slate-100 ${refreshing ? "opacity-80" : ""}`}>
              {loading && <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-400">Loading...</td></tr>}
              {!loading && records.length === 0 && <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-400">No attendance records found.</td></tr>}
              {!loading && records.map((r) => (
                <tr key={r.id && r.id !== "00000000-0000-0000-0000-000000000000" ? String(r.id) : `${r.employeeId}-${r.date}`} className="hover:bg-slate-50/50">
                  <td className="px-4 py-2.5 font-medium text-slate-700">
                    {r.employeeName}
                    {r.employeeCode && <span className="ml-1 text-xs text-slate-400">({r.employeeCode})</span>}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{fmtDate(r.date)}</td>
                  <td className="px-3 py-2.5 text-slate-600">{fmtTime(r.punchIn)}</td>
                  <td className="px-3 py-2.5 text-slate-600">{fmtTime(r.punchOut)}</td>
                  <td className="px-3 py-2.5 text-slate-600">{r.workedHours != null ? r.workedHours.toFixed(1) : "—"}</td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${r.status === "Present" ? "bg-green-100 text-green-700" : r.status === "Late" ? "bg-amber-100 text-amber-700" : r.status === "Absent" ? "bg-red-100 text-red-700" : r.status === "On Leave" ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-600"}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-500 text-xs">{r.source ?? "—"}</td>
                  <td className="px-3 py-2.5 text-slate-500 text-xs">{r.shiftName ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {r.isOnLeave && <span className="inline-block rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">On leave</span>}
                      {!r.isOnLeave && r.isLate && <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Late {r.lateMins}m</span>}
                      {!r.isOnLeave && r.isEarlyDeparture && <span className="inline-block rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">Early {r.earlyDepartureMins}m</span>}
                      {!r.isOnLeave && r.isShortHours && <span className="inline-block rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">Short hrs</span>}
                      {!r.isOnLeave && !r.isLate && !r.isEarlyDeparture && !r.isShortHours && "—"}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    {r.id && r.id !== "00000000-0000-0000-0000-000000000000" ? (
                      <div className="flex gap-1">
                        <button type="button" onClick={() => openEdit(r)} className="rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100">Edit</button>
                        <button type="button" onClick={() => handleDelete(r)} className="rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100">Del</button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
            <span className="text-xs text-slate-500">Page {page} of {totalPages} ({totalCount} records)</span>
            <div className="flex gap-2">
              <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      <Modal open={editModal} onClose={() => setEditModal(false)} title="Edit Attendance Record">
        {editingRecord && (
          <form key={editingRecord.id} onSubmit={handleEditSubmit} className="space-y-4">
            <div className="text-sm text-slate-600">
              <strong>{editingRecord.employeeName}</strong> — {fmtDate(editingRecord.date)}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Punch In</label>
                <DateTimePickerField
                  name="punchIn"
                  defaultValue={editingRecord.punchIn ? editingRecord.punchIn.slice(0, 16) : ""}
                  className={inputClass}
                  rowClassName="sm:col-span-1"
                />
              </div>
              <div>
                <label className={labelClass}>Punch Out</label>
                <DateTimePickerField
                  name="punchOut"
                  defaultValue={editingRecord.punchOut ? editingRecord.punchOut.slice(0, 16) : ""}
                  className={inputClass}
                  rowClassName="sm:col-span-1"
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select name="status" defaultValue={editingRecord.status} className={inputClass}>
                <option value="Present">Present</option>
                <option value="Late">Late</option>
                <option value="Absent">Absent</option>
                <option value="HalfDay">Half Day</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Remarks</label>
              <textarea name="remarks" rows={2} defaultValue={editingRecord.remarks ?? ""} className={inputClass} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => setEditModal(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Update"}</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

// ──────────────────────────── Devices Tab (Phase 4) ────────────────────────────

interface BiometricDevice {
  id: string;
  name: string;
  serialNumber: string;
  location: string | null;
  deviceType: string;
  isActive: boolean;
  lastSyncAt: string | null;
}

interface ImportBatch {
  id: string;
  fileName: string;
  importedAt: string;
  totalRecords: number;
  successCount: number;
  failCount: number;
  status: string;
  errorDetails: string | null;
  deviceId: string;
  deviceName: string | null;
}

function DevicesTab() {
  const [devices, setDevices] = useState<BiometricDevice[]>([]);
  const [history, setHistory] = useState<ImportBatch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deviceModal, setDeviceModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState<BiometricDevice | null>(null);
  const [savingDevice, setSavingDevice] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [importDeviceId, setImportDeviceId] = useState("");
  const [importData, setImportData] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportBatch | null>(null);

  const loadDevices = useCallback(() => {
    apiFetch<BiometricDevice[]>("/api/biometric/devices").then(setDevices).catch((e) => setError(e instanceof Error ? e.message : "Failed to load devices"));
  }, []);

  const loadHistory = useCallback(() => {
    apiFetch<ImportBatch[]>("/api/biometric/import-history").then(setHistory).catch(() => {});
  }, []);

  useEffect(() => { loadDevices(); loadHistory(); }, [loadDevices, loadHistory]);

  async function submitDevice(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingDevice(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: fd.get("name") as string,
      serialNumber: fd.get("serialNumber") as string,
      location: (fd.get("location") as string) || null,
      deviceType: (fd.get("deviceType") as string) || "Fingerprint",
      isActive: fd.get("isActive") === "on",
    };
    try {
      if (editingDevice) {
        await apiFetch(`/api/biometric/devices/${editingDevice.id}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await apiFetch("/api/biometric/devices", { method: "POST", body: JSON.stringify(payload) });
      }
      setDeviceModal(false);
      loadDevices();
    } catch (err) { setError(err instanceof Error ? err.message : "Save failed"); }
    finally { setSavingDevice(false); }
  }

  async function deleteDevice(d: BiometricDevice) {
    if (!(await appConfirm(`Delete device "${d.name}"?`))) return;
    try { await apiFetch(`/api/biometric/devices/${d.id}`, { method: "DELETE" }); loadDevices(); }
    catch (err) { setError(err instanceof Error ? err.message : "Delete failed"); }
  }

  async function handleImport(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!importDeviceId || !importData.trim()) return;
    setImporting(true);
    setError(null);
    setImportResult(null);
    try {
      const lines = importData.trim().split("\n");
      const rows = lines.map((line) => {
        const parts = line.split(",").map((s) => s.trim());
        return {
          employeeCode: parts[0] ?? "",
          punchTime: parts[1] ?? "",
          direction: parts[2] ?? undefined,
        };
      });
      const result = await apiFetch<ImportBatch>("/api/biometric/import", {
        method: "POST",
        body: JSON.stringify({ deviceId: importDeviceId, fileName: `manual_import_${new Date().toISOString().slice(0, 10)}.csv`, rows }),
      });
      setImportResult(result);
      loadHistory();
    } catch (err) { setError(err instanceof Error ? err.message : "Import failed"); }
    finally { setImporting(false); }
  }

  return (
    <div className="space-y-6">
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-700">Biometric Devices</h2>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => { setImportModal(true); setImportResult(null); setImportData(""); }}>Import Punches</Button>
          <Button onClick={() => { setEditingDevice(null); setDeviceModal(true); }}>+ Add Device</Button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 text-left">
              <th className="px-4 py-2.5 font-semibold text-slate-600">Name</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Serial</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Location</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Type</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Active</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Last Sync</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {devices.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No devices registered.</td></tr>}
              {devices.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium text-slate-700">{d.name}</td>
                  <td className="px-4 py-3 text-slate-600">{d.serialNumber}</td>
                  <td className="px-4 py-3 text-slate-600">{d.location ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{d.deviceType}</td>
                  <td className="px-4 py-3">{d.isActive ? <span className="text-green-600">Active</span> : <span className="text-slate-400">Inactive</span>}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{d.lastSyncAt ? formatDateTime(d.lastSyncAt) : "Never"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => { setEditingDevice(d); setDeviceModal(true); }} className="rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100">Edit</button>
                      <button type="button" onClick={() => deleteDevice(d)} className="rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {history.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-4">
            <h3 className="text-[15px] font-bold text-slate-700">Import History</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50 text-left">
                <th className="px-4 py-2.5 font-semibold text-slate-600">File</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Device</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Date</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Total</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Success</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Failed</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Status</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-slate-700">{h.fileName}</td>
                    <td className="px-4 py-3 text-slate-600">{h.deviceName ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{formatDateTime(h.importedAt)}</td>
                    <td className="px-4 py-3 text-slate-600">{h.totalRecords}</td>
                    <td className="px-4 py-3 text-green-600">{h.successCount}</td>
                    <td className="px-4 py-3 text-red-600">{h.failCount}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${h.status === "Completed" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>{h.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={deviceModal} onClose={() => setDeviceModal(false)} title={editingDevice ? "Edit Device" : "Add Device"}>
        <form key={editingDevice?.id ?? "new-dev"} onSubmit={submitDevice} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className={labelClass}>Name *</label><input name="name" required defaultValue={editingDevice?.name ?? ""} className={inputClass} /></div>
            <div><label className={labelClass}>Serial Number *</label><input name="serialNumber" required defaultValue={editingDevice?.serialNumber ?? ""} className={inputClass} /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className={labelClass}>Location</label><input name="location" defaultValue={editingDevice?.location ?? ""} className={inputClass} /></div>
            <div>
              <label className={labelClass}>Device Type</label>
              <select name="deviceType" defaultValue={editingDevice?.deviceType ?? "Fingerprint"} className={inputClass}>
                <option value="Fingerprint">Fingerprint</option>
                <option value="Face">Face Recognition</option>
                <option value="Card">Card Reader</option>
                <option value="Iris">Iris Scanner</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input name="isActive" type="checkbox" defaultChecked={editingDevice?.isActive ?? true} className="h-4 w-4 rounded border-slate-300" />
            Active
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setDeviceModal(false)}>Cancel</Button>
            <Button type="submit" disabled={savingDevice}>{savingDevice ? "Saving..." : editingDevice ? "Update" : "Create"}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={importModal} onClose={() => setImportModal(false)} title="Import Punch Data">
        <form onSubmit={handleImport} className="space-y-4">
          <div>
            <label className={labelClass}>Device *</label>
            <select value={importDeviceId} onChange={(e) => setImportDeviceId(e.target.value)} className={inputClass} required>
              <option value="">Select device</option>
              {devices.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.serialNumber})</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Punch Data (CSV: EmployeeCode, DateTime, Direction)</label>
            <textarea
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              rows={6}
              placeholder={"EMP001, 2026-03-16T08:30:00, in\nEMP001, 2026-03-16T17:00:00, out\nEMP002, 2026-03-16T09:00:00, in"}
              className={inputClass}
              required
            />
            <p className="mt-1 text-xs text-slate-400">One punch per line. Format: EmployeeCode, PunchDateTime, Direction (in/out)</p>
          </div>
          {importResult && (
            <div className={`rounded-xl border px-4 py-3 text-sm ${importResult.failCount > 0 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-green-200 bg-green-50 text-green-700"}`}>
              Import complete: {importResult.successCount} success, {importResult.failCount} failed of {importResult.totalRecords} total.
              {importResult.errorDetails && <pre className="mt-2 text-xs whitespace-pre-wrap">{importResult.errorDetails}</pre>}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setImportModal(false)}>Close</Button>
            <Button type="submit" disabled={importing}>{importing ? "Importing..." : "Import"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ──────────────────────────── OT / No-Pay Tab (Phase 5) ────────────────────────────

interface OtNopayResult {
  employeeId: string;
  employeeName: string;
  employeeCode: string | null;
  totalWorkedHours: number;
  expectedHours: number;
  overtimeHours: number;
  nopayDays: number;
  nopayHours: number;
  lateDays: number;
  presentDays: number;
  absentDays: number;
}

function OtNopayTab() {
  const [results, setResults] = useState<OtNopayResult[]>([]);
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [toDate, setToDate] = useState(() => todayLocalIso());
  const [filterEmployee, setFilterEmployee] = useState("");
  const [employees, setEmployees] = useState<EmployeeLookup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ items: EmployeeLookup[] }>("/api/employees?pageSize=500")
      .then((r) => setEmployees(r.items ?? []))
      .catch(() => {});
  }, []);

  const calculate = useCallback(() => {
    if (!fromDate || !toDate) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ from: fromDate, to: toDate });
    if (filterEmployee) params.set("employeeId", filterEmployee);
    apiFetch<OtNopayResult[]>(`/api/attendance/overtime-nopay?${params}`)
      .then(setResults)
      .catch((e) => setError(e instanceof Error ? e.message : "Calculation failed"))
      .finally(() => setLoading(false));
  }, [fromDate, toDate, filterEmployee]);

  const resultsPager = useClientPagination(results, 15);

  const totals = results.reduce(
    (acc, r) => ({
      worked: acc.worked + r.totalWorkedHours,
      expected: acc.expected + r.expectedHours,
      ot: acc.ot + r.overtimeHours,
      nopayDays: acc.nopayDays + r.nopayDays,
      nopayHours: acc.nopayHours + r.nopayHours,
    }),
    { worked: 0, expected: 0, ot: 0, nopayDays: 0, nopayHours: 0 },
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className={labelClass}>From *</label>
          <DatePickerField value={fromDate} onChange={setFromDate} className={`${inputClass} w-40`} />
        </div>
        <div>
          <label className={labelClass}>To *</label>
          <DatePickerField value={toDate} onChange={setToDate} className={`${inputClass} w-40`} />
        </div>
        <div>
          <label className={labelClass}>Employee</label>
          <select value={filterEmployee} onChange={(e) => setFilterEmployee(e.target.value)} className={`${inputClass} w-48`}>
            <option value="">All</option>
            {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.fullName}</option>)}
          </select>
        </div>
        <Button onClick={calculate}>Calculate</Button>
      </div>

      {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 text-left">
              <th className="px-4 py-2.5 font-semibold text-slate-600">Employee</th>
              <th className="px-3 py-2.5 font-semibold text-slate-600 text-right">Present</th>
              <th className="px-3 py-2.5 font-semibold text-slate-600 text-right">Absent</th>
              <th className="px-3 py-2.5 font-semibold text-slate-600 text-right">Late Days</th>
              <th className="px-3 py-2.5 font-semibold text-slate-600 text-right">Expected Hrs</th>
              <th className="px-3 py-2.5 font-semibold text-slate-600 text-right">Worked Hrs</th>
              <th className="px-3 py-2.5 font-semibold text-slate-600 text-right">OT Hrs</th>
              <th className="px-3 py-2.5 font-semibold text-slate-600 text-right">No-Pay Days</th>
              <th className="px-3 py-2.5 font-semibold text-slate-600 text-right">No-Pay Hrs</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {loading && <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400">Calculating...</td></tr>}
              {!loading && results.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400">No data. Select a date range and click Calculate.</td></tr>}
              {!loading && resultsPager.pageItems.map((r) => (
                <tr key={r.employeeId} className="hover:bg-slate-50/50">
                  <td className="px-4 py-2.5 font-medium text-slate-700">
                    {r.employeeName}
                    {r.employeeCode && <span className="ml-1 text-xs text-slate-400">({r.employeeCode})</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right text-slate-600">{r.presentDays}</td>
                  <td className="px-3 py-2.5 text-right text-red-600">{r.absentDays}</td>
                  <td className="px-3 py-2.5 text-right text-amber-600">{r.lateDays}</td>
                  <td className="px-3 py-2.5 text-right text-slate-600">{r.expectedHours.toFixed(1)}</td>
                  <td className="px-3 py-2.5 text-right text-slate-700 font-medium">{r.totalWorkedHours.toFixed(1)}</td>
                  <td className="px-3 py-2.5 text-right font-medium text-blue-600">{r.overtimeHours.toFixed(1)}</td>
                  <td className="px-3 py-2.5 text-right text-red-600">{r.nopayDays}</td>
                  <td className="px-3 py-2.5 text-right text-red-600">{r.nopayHours.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
            {!loading && results.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 font-semibold">
                  <td className="px-4 py-2.5 text-slate-700">Totals ({results.length} employees)</td>
                  <td className="px-3 py-2.5 text-right" colSpan={3}></td>
                  <td className="px-3 py-2.5 text-right text-slate-700">{totals.expected.toFixed(1)}</td>
                  <td className="px-3 py-2.5 text-right text-slate-700">{totals.worked.toFixed(1)}</td>
                  <td className="px-3 py-2.5 text-right text-blue-600">{totals.ot.toFixed(1)}</td>
                  <td className="px-3 py-2.5 text-right text-red-600">{totals.nopayDays}</td>
                  <td className="px-3 py-2.5 text-right text-red-600">{totals.nopayHours.toFixed(1)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <TablePagination page={resultsPager.page} totalPages={resultsPager.totalPages} totalCount={resultsPager.totalCount} pageSize={resultsPager.pageSize} onPageChange={resultsPager.setPage} />
      </div>
    </div>
  );
}

// ──────────────────────────── Shifts Tab ────────────────────────────

function ShiftsTab() {
  const [items, setItems] = useState<ShiftItem[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ShiftItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formShiftType, setFormShiftType] = useState("Regular");
  const editingIdRef = useRef<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    apiFetch<ShiftItem[]>(`/api/shift?includeInactive=${includeInactive}`)
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load shifts"));
  }, [includeInactive]);
  useEffect(() => { load(); }, [load]);
  const itemsPager = useClientPagination(items);

  function openAdd() {
    editingIdRef.current = null;
    setEditing(null);
    setFormShiftType("Regular");
    setError(null);
    setShowModal(true);
  }
  function openEdit(item: ShiftItem) {
    editingIdRef.current = item.id;
    setEditing(item);
    setFormShiftType(item.shiftType || "Regular");
    setError(null);
    setShowModal(true);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const st = (fd.get("shiftType") as string) || "Regular";
    const payload: Record<string, unknown> = {
      name: fd.get("name") as string,
      code: fd.get("code") as string,
      shiftType: st,
      startTime: timeInputToSpan((fd.get("startTime") as string) || "00:00"),
      endTime: timeInputToSpan((fd.get("endTime") as string) || "00:00"),
      breakHours: Number(fd.get("breakHours")) || 0,
      isNightShift: fd.get("isNightShift") === "on",
      isActive: fd.get("isActive") === "on",
      lateGraceMinutes: Number(fd.get("lateGraceMinutes")) || 5,
      earlyDepartureGraceMinutes: Number(fd.get("earlyDepartureGraceMinutes")) || 5,
      halfDayHours: Number(fd.get("halfDayHours")) || 4,
      appliesOnMonday: fd.get("appliesOnMonday") === "on",
      appliesOnTuesday: fd.get("appliesOnTuesday") === "on",
      appliesOnWednesday: fd.get("appliesOnWednesday") === "on",
      appliesOnThursday: fd.get("appliesOnThursday") === "on",
      appliesOnFriday: fd.get("appliesOnFriday") === "on",
      appliesOnSaturday: fd.get("appliesOnSaturday") === "on",
      appliesOnSunday: fd.get("appliesOnSunday") === "on",
      mondayStartTime: timeOrNull((fd.get("mondayStartTime") as string) || ""),
      mondayEndTime: timeOrNull((fd.get("mondayEndTime") as string) || ""),
      tuesdayStartTime: timeOrNull((fd.get("tuesdayStartTime") as string) || ""),
      tuesdayEndTime: timeOrNull((fd.get("tuesdayEndTime") as string) || ""),
      wednesdayStartTime: timeOrNull((fd.get("wednesdayStartTime") as string) || ""),
      wednesdayEndTime: timeOrNull((fd.get("wednesdayEndTime") as string) || ""),
      thursdayStartTime: timeOrNull((fd.get("thursdayStartTime") as string) || ""),
      thursdayEndTime: timeOrNull((fd.get("thursdayEndTime") as string) || ""),
      fridayStartTime: timeOrNull((fd.get("fridayStartTime") as string) || ""),
      fridayEndTime: timeOrNull((fd.get("fridayEndTime") as string) || ""),
      saturdayStartTime: timeOrNull((fd.get("saturdayStartTime") as string) || ""),
      saturdayEndTime: timeOrNull((fd.get("saturdayEndTime") as string) || ""),
      sundayStartTime: timeOrNull((fd.get("sundayStartTime") as string) || ""),
      sundayEndTime: timeOrNull((fd.get("sundayEndTime") as string) || ""),
      session2StartTime: null as string | null,
      session2EndTime: null as string | null,
      flexiWindowStart: null as string | null,
      flexiWindowEnd: null as string | null,
      minimumWorkHours: null as number | null,
    };
    if (st === "Split") {
      payload.session2StartTime = timeInputToSpan((fd.get("session2StartTime") as string) || "");
      payload.session2EndTime = timeInputToSpan((fd.get("session2EndTime") as string) || "");
    }
    if (st === "Flexi") {
      payload.flexiWindowStart = timeInputToSpan((fd.get("flexiWindowStart") as string) || "07:00");
      payload.flexiWindowEnd = timeInputToSpan((fd.get("flexiWindowEnd") as string) || "20:00");
      payload.minimumWorkHours = Number(fd.get("minimumWorkHours")) || 8;
    }
    const isEdit = editingIdRef.current != null;
    const editId = editingIdRef.current;
    try {
      if (isEdit && editId) {
        await apiFetch(`/api/shift/${editId}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await apiFetch("/api/shift", { method: "POST", body: JSON.stringify(payload) });
      }
      editingIdRef.current = null;
      setShowModal(false);
      setEditing(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: ShiftItem) {
    if (!(await appConfirm(`Delete shift "${item.name}"? This will fail if any employee is assigned to it.`))) return;
    setError(null);
    try {
      await apiFetch(`/api/shift/${item.id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  const typeBadgeClass = (t: string) => {
    switch (t) {
      case "Split": return "bg-purple-100 text-purple-700";
      case "Flexi": return "bg-cyan-100 text-cyan-700";
      case "Rotational": return "bg-indigo-100 text-indigo-700";
      case "Open": return "bg-slate-200 text-slate-600";
      default: return "bg-blue-100 text-blue-700";
    }
  };

  function formatApplicableDays(s: ShiftItem): string {
    const dayData = [
      { applies: s.appliesOnMonday, start: s.mondayStartTime, end: s.mondayEndTime, abbr: "Mon" },
      { applies: s.appliesOnTuesday, start: s.tuesdayStartTime, end: s.tuesdayEndTime, abbr: "Tue" },
      { applies: s.appliesOnWednesday, start: s.wednesdayStartTime, end: s.wednesdayEndTime, abbr: "Wed" },
      { applies: s.appliesOnThursday, start: s.thursdayStartTime, end: s.thursdayEndTime, abbr: "Thu" },
      { applies: s.appliesOnFriday, start: s.fridayStartTime, end: s.fridayEndTime, abbr: "Fri" },
      { applies: s.appliesOnSaturday, start: s.saturdayStartTime, end: s.saturdayEndTime, abbr: "Sat" },
      { applies: s.appliesOnSunday, start: s.sundayStartTime, end: s.sundayEndTime, abbr: "Sun" },
    ];
    const applicable = dayData.filter((d) => d.applies);
    if (applicable.length === 0) return "—";
    const parts = applicable.map((d) => {
      if (d.start && d.end) return `${d.abbr} ${timeSpanToInput(d.start)}-${timeSpanToInput(d.end)}`;
      return d.abbr;
    });
    return parts.join(", ");
  }

  const showTimes = formShiftType !== "Open";
  const showSession2 = formShiftType === "Split";
  const showFlexi = formShiftType === "Flexi";
  const showNight = formShiftType === "Regular" || formShiftType === "Rotational" || formShiftType === "Split";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
          Include inactive
        </label>
        <Button onClick={openAdd}>+ Add Shift</Button>
      </div>
      {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-[15px] font-bold text-slate-700">Shift Patterns</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 text-left">
              <th className="px-6 py-2.5 font-semibold text-slate-600">Name</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Code</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Type</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Times</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Days</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Break</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Grace</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Active</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 && <tr><td colSpan={9} className="px-6 py-8 text-center text-slate-400">No shifts defined. Add a shift to get started.</td></tr>}
              {itemsPager.pageItems.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-3 font-medium text-slate-700">{s.name}</td>
                  <td className="px-4 py-3 text-slate-600">{s.code}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${typeBadgeClass(s.shiftType)}`}>{s.shiftType}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs">
                    {s.shiftType === "Flexi" ? (
                      <span>{s.flexiWindowStart ? timeSpanToInput(s.flexiWindowStart) : "07:00"} - {s.flexiWindowEnd ? timeSpanToInput(s.flexiWindowEnd) : "20:00"} (min {s.minimumWorkHours ?? 8}h)</span>
                    ) : s.shiftType === "Open" ? (
                      <span className="text-slate-400">No fixed times</span>
                    ) : (
                      <>
                        <span>{timeSpanToInput(s.startTime)} - {timeSpanToInput(s.endTime)}</span>
                        {s.shiftType === "Split" && s.session2StartTime && s.session2EndTime && (
                          <span className="ml-1 text-slate-400">+ {timeSpanToInput(s.session2StartTime)} - {timeSpanToInput(s.session2EndTime)}</span>
                        )}
                        {s.isNightShift && <span className="ml-1 text-indigo-500">(Night)</span>}
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs">
                    <span>{formatApplicableDays(s)}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{s.breakHours}h</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    <span>Late: {s.lateGraceMinutes}m</span>
                    <span className="ml-2">Early: {s.earlyDepartureGraceMinutes}m</span>
                  </td>
                  <td className="px-4 py-3">{s.isActive ? <span className="text-green-600">Active</span> : <span className="text-slate-400">Inactive</span>}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => openEdit(s)} className="rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100">Edit</button>
                      <button type="button" onClick={() => handleDelete(s)} className="rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TablePagination page={itemsPager.page} totalPages={itemsPager.totalPages} totalCount={itemsPager.totalCount} pageSize={itemsPager.pageSize} onPageChange={itemsPager.setPage} />
      </div>

      <Modal
          open={showModal}
          onClose={() => {
            editingIdRef.current = null;
            setEditing(null);
            setShowModal(false);
          }}
          title={editing ? "Edit Shift" : "Add Shift"}
          wide
        >
        <form key={editing?.id ?? "new-shift"} onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div><label className={labelClass}>Name *</label><input name="name" required defaultValue={editing?.name ?? ""} className={inputClass} /></div>
            <div><label className={labelClass}>Code *</label><input name="code" required defaultValue={editing?.code ?? ""} className={inputClass} /></div>
            <div>
              <label className={labelClass}>Shift Type *</label>
              <select name="shiftType" value={formShiftType} onChange={(e) => setFormShiftType(e.target.value)} className={inputClass}>
                {SHIFT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {showTimes && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className={labelClass}>{showFlexi ? "Window Start" : "Start time"} *</label><input name={showFlexi ? "flexiWindowStart" : "startTime"} type="time" required defaultValue={showFlexi ? (editing?.flexiWindowStart ? timeSpanToInput(editing.flexiWindowStart) : "07:00") : (editing ? timeSpanToInput(editing.startTime) : "09:00")} className={inputClass} /></div>
              <div><label className={labelClass}>{showFlexi ? "Window End" : "End time"} *</label><input name={showFlexi ? "flexiWindowEnd" : "endTime"} type="time" required defaultValue={showFlexi ? (editing?.flexiWindowEnd ? timeSpanToInput(editing.flexiWindowEnd) : "20:00") : (editing ? timeSpanToInput(editing.endTime) : "17:00")} className={inputClass} /></div>
            </div>
          )}

          {showFlexi && (
            <div><label className={labelClass}>Minimum Work Hours *</label><input name="minimumWorkHours" type="number" min={0} step={0.5} required defaultValue={editing?.minimumWorkHours ?? 8} className={inputClass} /></div>
          )}

          {showSession2 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className={labelClass}>Session 2 Start *</label><input name="session2StartTime" type="time" required defaultValue={editing?.session2StartTime ? timeSpanToInput(editing.session2StartTime) : "14:00"} className={inputClass} /></div>
              <div><label className={labelClass}>Session 2 End *</label><input name="session2EndTime" type="time" required defaultValue={editing?.session2EndTime ? timeSpanToInput(editing.session2EndTime) : "18:00"} className={inputClass} /></div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className={labelClass}>Break (hours)</label><input name="breakHours" type="number" min={0} step={0.5} defaultValue={editing?.breakHours ?? 1} className={inputClass} /></div>
            <div className="flex flex-wrap items-center gap-4 pt-6">
              {showNight && (
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input name="isNightShift" type="checkbox" defaultChecked={editing?.isNightShift ?? false} className="h-4 w-4 rounded border-slate-300" />
                  Night shift
                </label>
              )}
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input name="isActive" type="checkbox" defaultChecked={editing?.isActive ?? true} className="h-4 w-4 rounded border-slate-300" />
                Active
              </label>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h4 className="mb-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Attendance Rules</h4>
            <div className="grid gap-4 sm:grid-cols-3">
              <div><label className={labelClass}>Late Grace (mins)</label><input name="lateGraceMinutes" type="number" min={0} defaultValue={editing?.lateGraceMinutes ?? 5} className={inputClass} /></div>
              <div><label className={labelClass}>Early Departure Grace (mins)</label><input name="earlyDepartureGraceMinutes" type="number" min={0} defaultValue={editing?.earlyDepartureGraceMinutes ?? 5} className={inputClass} /></div>
              <div><label className={labelClass}>Half-Day Hours</label><input name="halfDayHours" type="number" min={0} defaultValue={editing?.halfDayHours ?? 4} className={inputClass} /></div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h4 className="mb-2 text-xs font-semibold text-slate-600 uppercase tracking-wide">Applicable Days</h4>
            <p className="mb-3 text-xs text-slate-500">Select which days this shift applies. Optionally set custom start/end times per day (e.g. 7h or 4h); leave blank to use default times above.</p>
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Day</th>
                    <th className="w-14 px-2 py-2.5 text-center font-semibold text-slate-600">Apply</th>
                    <th className="w-28 px-2 py-2.5 text-left font-semibold text-slate-600">Start</th>
                    <th className="w-28 px-2 py-2.5 text-left font-semibold text-slate-600">End</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    { day: "Monday", key: "monday", defaultApplies: true },
                    { day: "Tuesday", key: "tuesday", defaultApplies: true },
                    { day: "Wednesday", key: "wednesday", defaultApplies: true },
                    { day: "Thursday", key: "thursday", defaultApplies: true },
                    { day: "Friday", key: "friday", defaultApplies: true },
                    { day: "Saturday", key: "saturday", defaultApplies: false },
                    { day: "Sunday", key: "sunday", defaultApplies: false },
                  ].map(({ day, key, defaultApplies }) => {
                    const appliesKey = `appliesOn${key.charAt(0).toUpperCase() + key.slice(1)}` as keyof ShiftItem;
                    const startKey = `${key}StartTime` as keyof ShiftItem;
                    const endKey = `${key}EndTime` as keyof ShiftItem;
                    const appliesChecked = editing ? (editing[appliesKey] as boolean) : defaultApplies;
                    const startVal = editing ? (editing[startKey] as string | null) ?? "" : "";
                    const endVal = editing ? (editing[endKey] as string | null) ?? "" : "";
                    const appliesId = `applies-${key}`;
                    return (
                      <tr key={key} className="hover:bg-slate-50/50">
                        <td className="px-4 py-2 font-medium text-slate-700">{day}</td>
                        <td className="px-2 py-2 text-center">
                          <label className="inline-flex cursor-pointer items-center justify-center">
                            <input
                              type="checkbox"
                              id={appliesId}
                              name={`appliesOn${key.charAt(0).toUpperCase() + key.slice(1)}`}
                              defaultChecked={appliesChecked}
                              className="h-4 w-4 rounded border-slate-300"
                            />
                          </label>
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="time"
                            name={`${key}StartTime`}
                            defaultValue={timeSpanToInput(startVal || "")}
                            className="w-full min-w-0 rounded border border-slate-200 px-2 py-1.5 text-sm text-slate-700"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="time"
                            name={`${key}EndTime`}
                            defaultValue={timeSpanToInput(endVal || "")}
                            className="w-full min-w-0 rounded border border-slate-200 px-2 py-1.5 text-sm text-slate-700"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => {
                editingIdRef.current = null;
                setEditing(null);
                setShowModal(false);
              }}
              type="button"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : editing ? "Update" : "Create"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ──────────────────────────── Roster (templates + assignments) ────────────────────────────

interface RosterTemplateItem {
  id: string;
  name: string;
  description: string | null;
  defaultStartTime: string;
  defaultEndTime: string;
  workHoursPerDay: number;
  isActive: boolean;
  defaultShiftPatternId: string | null;
  defaultShiftPatternName: string | null;
}

interface RosterAssignmentItem {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string | null;
  rosterTemplateId: string;
  rosterTemplateName: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  notes: string | null;
}

function RosterTab() {
  const [templates, setTemplates] = useState<RosterTemplateItem[]>([]);
  const [assignments, setAssignments] = useState<RosterAssignmentItem[]>([]);
  const [shifts, setShifts] = useState<ShiftItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeLookup[]>([]);
  const [includeInactiveTemplates, setIncludeInactiveTemplates] = useState(false);
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>("");
  const [filterDeptId, setFilterDeptId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [tplModal, setTplModal] = useState(false);
  const [editingTpl, setEditingTpl] = useState<RosterTemplateItem | null>(null);
  const [editingAssign, setEditingAssign] = useState<RosterAssignmentItem | null>(null);
  const [editAssignModal, setEditAssignModal] = useState(false);
  const [savingTpl, setSavingTpl] = useState(false);
  const [savingAssign, setSavingAssign] = useState(false);

  // Roster template form: when a shift is selected, times are taken from the shift (read-only)
  const [tplShiftId, setTplShiftId] = useState("");
  const [tplStart, setTplStart] = useState("09:00");
  const [tplEnd, setTplEnd] = useState("17:00");
  const [tplHours, setTplHours] = useState(8);

  // Bulk assign state
  const [bulkModal, setBulkModal] = useState(false);
  const [bulkStep, setBulkStep] = useState<1 | 2>(1);
  const [bulkTemplateId, setBulkTemplateId] = useState("");
  const [bulkFrom, setBulkFrom] = useState("");
  const [bulkTo, setBulkTo] = useState("");
  const [bulkNotes, setBulkNotes] = useState("");
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeptFilter, setBulkDeptFilter] = useState("");
  const [bulkLocFilter, setBulkLocFilter] = useState("");
  const bulkSearchFilter = useApplyFilter();
  const [bulkSaving, setBulkSaving] = useState(false);

  const departments = (() => {
    const map = new Map<string, string>();
    employees.forEach((e) => { if (e.departmentId && e.departmentName) map.set(e.departmentId, e.departmentName); });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  })();

  const locations = (() => {
    const map = new Map<string, string>();
    employees.forEach((e) => { if (e.locationId && e.locationName) map.set(e.locationId, e.locationName); });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  })();

  const loadTemplates = useCallback(() => {
    setError(null);
    apiFetch<RosterTemplateItem[]>(`/api/roster/templates?includeInactive=${includeInactiveTemplates}`)
      .then(setTemplates)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load roster templates"));
  }, [includeInactiveTemplates]);

  const loadAssignments = useCallback(() => {
    setError(null);
    const params = new URLSearchParams();
    if (filterEmployeeId) params.set("employeeId", filterEmployeeId);
    const q = params.toString();
    apiFetch<RosterAssignmentItem[]>(`/api/roster/assignments${q ? `?${q}` : ""}`)
      .then(setAssignments)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load assignments"));
  }, [filterEmployeeId]);

  const loadLookups = useCallback(() => {
    apiFetch<ShiftItem[]>("/api/shift?includeInactive=true").then(setShifts).catch(() => setShifts([]));
    apiFetch<{ items: EmployeeLookup[] }>("/api/employees?pageSize=500")
      .then((r) => setEmployees(r.items ?? []))
      .catch(() => setEmployees([]));
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);
  useEffect(() => { loadAssignments(); }, [loadAssignments]);
  useEffect(() => { loadLookups(); }, [loadLookups]);

  function openTplAdd() {
    setEditingTpl(null);
    setError(null);
    setTplShiftId("");
    setTplStart("09:00");
    setTplEnd("17:00");
    setTplHours(8);
    setTplModal(true);
  }
  function openTplEdit(t: RosterTemplateItem) {
    setEditingTpl(t);
    setError(null);
    setTplShiftId(t.defaultShiftPatternId ?? "");
    setTplStart(timeSpanToInput(t.defaultStartTime));
    setTplEnd(timeSpanToInput(t.defaultEndTime));
    setTplHours(t.workHoursPerDay);
    setTplModal(true);
  }

  function getWorkHoursFromShift(s: ShiftItem): number {
    const toMins = (t: string) => {
      const parts = (t || "00:00").split(":").map(Number);
      return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
    };
    const startM = toMins(s.startTime);
    const endM = toMins(s.endTime);
    const spanHours = Math.max(0, (endM - startM) / 60) - (s.breakHours ?? 0);
    return Math.max(0, Math.round(spanHours * 100) / 100);
  }

  function handleTplShiftChange(shiftId: string) {
    setTplShiftId(shiftId);
    if (shiftId) {
      const s = shifts.find((x) => x.id === shiftId);
      if (s) {
        setTplStart(timeSpanToInput(s.startTime));
        setTplEnd(timeSpanToInput(s.endTime));
        setTplHours(getWorkHoursFromShift(s));
      }
    }
  }

  async function submitTemplate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingTpl(true);
    setError(null);
    if (!tplShiftId && (!tplStart?.trim() || !tplEnd?.trim())) {
      setError("Default start and end are required when no shift pattern is selected.");
      setSavingTpl(false);
      return;
    }
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: (fd.get("name") as string) || "",
      description: (fd.get("description") as string) || null,
      defaultStartTime: timeInputToSpan(tplStart || "09:00"),
      defaultEndTime: timeInputToSpan(tplEnd || "17:00"),
      workHoursPerDay: tplHours || 8,
      isActive: fd.get("isActive") === "on",
      defaultShiftPatternId: tplShiftId || null,
    };
    try {
      if (editingTpl) {
        await apiFetch(`/api/roster/templates/${editingTpl.id}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await apiFetch("/api/roster/templates", { method: "POST", body: JSON.stringify(payload) });
      }
      setTplModal(false);
      loadTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save template failed");
    } finally { setSavingTpl(false); }
  }

  async function deleteTemplate(t: RosterTemplateItem) {
    if (!(await appConfirm(`Delete roster template "${t.name}"?`))) return;
    setError(null);
    try { await apiFetch(`/api/roster/templates/${t.id}`, { method: "DELETE" }); loadTemplates(); }
    catch (err) { setError(err instanceof Error ? err.message : "Delete failed"); }
  }

  function openAssignEdit(a: RosterAssignmentItem) { setEditingAssign(a); setError(null); setEditAssignModal(true); }

  async function submitEditAssignment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingAssign) return;
    setSavingAssign(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const from = (fd.get("effectiveFrom") as string) || "";
    const toRaw = (fd.get("effectiveTo") as string) || "";
    const notes = (fd.get("notes") as string) || null;
    try {
      await apiFetch(`/api/roster/assignments/${editingAssign.id}`, { method: "PUT", body: JSON.stringify({ effectiveFrom: from, effectiveTo: toRaw || null, notes }) });
      setEditAssignModal(false);
      loadAssignments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save assignment failed");
    } finally { setSavingAssign(false); }
  }

  async function deleteAssignment(a: RosterAssignmentItem) {
    if (!(await appConfirm(`Remove roster assignment for ${a.employeeName}?`))) return;
    setError(null);
    try { await apiFetch(`/api/roster/assignments/${a.id}`, { method: "DELETE" }); loadAssignments(); }
    catch (err) { setError(err instanceof Error ? err.message : "Delete failed"); }
  }

  // ── Bulk assign helpers ──

  function openBulkModal(prefilledTemplateId?: string) {
    setBulkStep(1);
    setBulkTemplateId(prefilledTemplateId ?? "");
    setBulkFrom("");
    setBulkTo("");
    setBulkNotes("");
    setBulkSelectedIds(new Set());
    setBulkDeptFilter("");
    setBulkLocFilter("");
    bulkSearchFilter.clear();
    setError(null);
    setSuccessMsg(null);
    setBulkModal(true);
  }

  const alreadyAssignedIds = new Set(assignments.map((a) => a.employeeId));

  const bulkVisibleEmployees = employees.filter((emp) => {
    if (bulkDeptFilter && emp.departmentId !== bulkDeptFilter) return false;
    if (bulkLocFilter && emp.locationId !== bulkLocFilter) return false;
    if (bulkSearchFilter.applied) {
      const q = bulkSearchFilter.applied.toLowerCase();
      const match = emp.fullName.toLowerCase().includes(q) || (emp.employeeCode?.toLowerCase().includes(q) ?? false);
      if (!match) return false;
    }
    return true;
  });

  function toggleBulkEmployee(id: string) {
    setBulkSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleBulkSelectAll() {
    const selectableIds = bulkVisibleEmployees.filter((e) => !alreadyAssignedIds.has(e.id)).map((e) => e.id);
    const allSelected = selectableIds.length > 0 && selectableIds.every((id) => bulkSelectedIds.has(id));
    if (allSelected) {
      setBulkSelectedIds((prev) => {
        const next = new Set(prev);
        selectableIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setBulkSelectedIds((prev) => {
        const next = new Set(prev);
        selectableIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }

  function handleBulkDeptChange(deptId: string) {
    setBulkDeptFilter(deptId);
    if (deptId) {
      const deptEmpIds = employees.filter((e) => e.departmentId === deptId && !alreadyAssignedIds.has(e.id)).map((e) => e.id);
      setBulkSelectedIds((prev) => {
        const next = new Set(prev);
        deptEmpIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }

  async function submitBulkAssign() {
    if (bulkSelectedIds.size === 0) return;
    setBulkSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const result = await apiFetch<{ created: number; skipped: number; errors: string[] }>("/api/roster/assignments/bulk", {
        method: "POST",
        body: JSON.stringify({
          employeeIds: Array.from(bulkSelectedIds),
          rosterTemplateId: bulkTemplateId,
          effectiveFrom: bulkFrom,
          effectiveTo: bulkTo || null,
          notes: bulkNotes || null,
        }),
      });
      setBulkModal(false);
      loadAssignments();
      const parts: string[] = [];
      if (result.created > 0) parts.push(`${result.created} assignment(s) created`);
      if (result.skipped > 0) parts.push(`${result.skipped} skipped`);
      setSuccessMsg(parts.join(", ") + (result.errors.length > 0 ? `. Issues: ${result.errors.join("; ")}` : ""));
      setTimeout(() => setSuccessMsg(null), 8000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk assign failed");
    } finally { setBulkSaving(false); }
  }

  // ── Assignments filtered by department on the client side ──
  const filteredAssignments = filterDeptId
    ? assignments.filter((a) => {
        const emp = employees.find((e) => e.id === a.employeeId);
        return emp?.departmentId === filterDeptId;
      })
    : assignments;

  const rosterEmployeeFilterOpts = useMemo<FormSelectOption[]>(
    () => [
      { value: "", label: "All employees" },
      ...employees.map((emp) => ({
        value: emp.id,
        label: `${emp.fullName}${emp.employeeCode ? ` (${emp.employeeCode})` : ""}`,
      })),
    ],
    [employees],
  );

  const rosterDeptFilterOpts = useMemo<FormSelectOption[]>(
    () => [
      { value: "", label: "All departments" },
      ...departments.map(([id, name]) => ({ value: id, label: name })),
    ],
    [departments],
  );

  const rosterTemplateOpts = useMemo<FormSelectOption[]>(
    () => templates.map((t) => ({ value: t.id, label: t.name })),
    [templates],
  );

  const bulkDeptFilterOpts = useMemo<FormSelectOption[]>(
    () => [
      { value: "", label: "All departments" },
      ...departments.map(([id, name]) => ({ value: id, label: name })),
    ],
    [departments],
  );

  const bulkLocFilterOpts = useMemo<FormSelectOption[]>(
    () => [
      { value: "", label: "All locations" },
      ...locations.map(([id, name]) => ({ value: id, label: name })),
    ],
    [locations],
  );

  const selectableVisibleCount = bulkVisibleEmployees.filter((e) => !alreadyAssignedIds.has(e.id)).length;
  const allVisibleSelected = selectableVisibleCount > 0 && bulkVisibleEmployees.filter((e) => !alreadyAssignedIds.has(e.id)).every((e) => bulkSelectedIds.has(e.id));

  return (
    <div className="space-y-8">
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {successMsg && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{successMsg}</div>}

      {/* ── Templates section ── */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={includeInactiveTemplates} onChange={(e) => setIncludeInactiveTemplates(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
            Include inactive templates
          </label>
          <Button onClick={openTplAdd}>+ Add template</Button>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-[15px] font-bold text-slate-700">Roster templates</h2>
            <p className="mt-1 text-xs text-slate-500">Default times, hours per day, optional link to a shift pattern.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50 text-left">
                <th className="px-6 py-2.5 font-semibold text-slate-600">Name</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Start</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">End</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Hours/day</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Shift</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Active</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {templates.length === 0 && <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-400">No roster templates yet.</td></tr>}
                {templates.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-3 font-medium text-slate-700">{t.name}</td>
                    <td className="px-4 py-3 text-slate-600">{timeSpanToInput(t.defaultStartTime)}</td>
                    <td className="px-4 py-3 text-slate-600">{timeSpanToInput(t.defaultEndTime)}</td>
                    <td className="px-4 py-3 text-slate-600">{t.workHoursPerDay}</td>
                    <td className="px-4 py-3 text-slate-600">{t.defaultShiftPatternName ?? "—"}</td>
                    <td className="px-4 py-3">{t.isActive ? <span className="text-green-600">Yes</span> : <span className="text-slate-400">No</span>}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button type="button" onClick={() => openBulkModal(t.id)} className="rounded bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100">Assign</button>
                        <button type="button" onClick={() => openTplEdit(t)} className="rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100">Edit</button>
                        <button type="button" onClick={() => deleteTemplate(t)} className="rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Assignments section ── */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="shrink-0 text-sm text-slate-600">Employee</label>
              <FormSelect
                value={filterEmployeeId}
                onValueChange={setFilterEmployeeId}
                options={rosterEmployeeFilterOpts}
                placeholder="All employees"
                className="max-w-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="shrink-0 text-sm text-slate-600">Department</label>
              <FormSelect
                value={filterDeptId}
                onValueChange={setFilterDeptId}
                options={rosterDeptFilterOpts}
                placeholder="All departments"
                className="max-w-xs"
              />
            </div>
          </div>
          <Button onClick={() => openBulkModal()}>+ Assign roster</Button>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-[15px] font-bold text-slate-700">Roster assignments</h2>
            <p className="mt-1 text-xs text-slate-500">Date ranges must not overlap for the same employee.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50 text-left">
                <th className="px-6 py-2.5 font-semibold text-slate-600">Employee</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Department</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Template</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">From</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">To</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Notes</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAssignments.length === 0 && <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-400">No assignments yet.</td></tr>}
                {filteredAssignments.map((a) => {
                  const emp = employees.find((e) => e.id === a.employeeId);
                  return (
                    <tr key={a.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-3 font-medium text-slate-700">{a.employeeName}{a.employeeCode ? <span className="ml-1 text-xs text-slate-500">({a.employeeCode})</span> : null}</td>
                      <td className="px-4 py-3 text-slate-600">{emp?.departmentName ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-600">{a.rosterTemplateName}</td>
                      <td className="px-4 py-3 text-slate-600">{dateOnlyForInput(a.effectiveFrom)}</td>
                      <td className="px-4 py-3 text-slate-600">{a.effectiveTo ? dateOnlyForInput(a.effectiveTo) : "—"}</td>
                      <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate" title={a.notes ?? undefined}>{a.notes ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button type="button" onClick={() => openAssignEdit(a)} className="rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100">Edit</button>
                          <button type="button" onClick={() => deleteAssignment(a)} className="rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100">Remove</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Template add/edit modal ── */}
      <Modal open={tplModal} onClose={() => setTplModal(false)} title={editingTpl ? "Edit roster template" : "Add roster template"}>
        <form key={editingTpl?.id ?? "new"} onSubmit={submitTemplate} className="space-y-4">
          <div><label className={labelClass}>Name *</label><input name="name" required defaultValue={editingTpl?.name ?? ""} className={inputClass} /></div>
          <div><label className={labelClass}>Description</label><textarea name="description" rows={2} defaultValue={editingTpl?.description ?? ""} className={inputClass} /></div>
          <div>
            <label className={labelClass}>Default shift pattern</label>
            <select value={tplShiftId} onChange={(e) => handleTplShiftChange(e.target.value)} className={inputClass}>
              <option value="">None</option>
              {shifts.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
            </select>
            <p className="mt-1 text-xs text-slate-500">When set, start/end times and work hours are taken from the shift.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>{tplShiftId ? "Default start" : "Default start *"}</label>
              <input type="time" value={tplStart} onChange={(e) => setTplStart(e.target.value)} readOnly={!!tplShiftId} className={inputClass} />
              {tplShiftId && <p className="mt-0.5 text-xs text-slate-500">From selected shift</p>}
            </div>
            <div>
              <label className={labelClass}>{tplShiftId ? "Default end" : "Default end *"}</label>
              <input type="time" value={tplEnd} onChange={(e) => setTplEnd(e.target.value)} readOnly={!!tplShiftId} className={inputClass} />
              {tplShiftId && <p className="mt-0.5 text-xs text-slate-500">From selected shift</p>}
            </div>
          </div>
          <div>
            <label className={labelClass}>Work hours per day</label>
            <input type="number" min={0} step={0.25} value={tplHours} onChange={(e) => setTplHours(Number(e.target.value) || 0)} readOnly={!!tplShiftId} className={inputClass} />
            {tplShiftId && <p className="mt-0.5 text-xs text-slate-500">From selected shift</p>}
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600"><input name="isActive" type="checkbox" defaultChecked={editingTpl?.isActive ?? true} className="h-4 w-4 rounded border-slate-300" /> Active</label>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setTplModal(false)}>Cancel</Button>
            <Button type="submit" disabled={savingTpl}>{savingTpl ? "Saving..." : editingTpl ? "Update" : "Create"}</Button>
          </div>
        </form>
      </Modal>

      {/* ── Edit single assignment modal ── */}
      <Modal open={editAssignModal} onClose={() => setEditAssignModal(false)} title="Edit assignment">
        {editingAssign && (
          <form key={editingAssign.id} onSubmit={submitEditAssignment} className="space-y-4">
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <span className="font-medium">{editingAssign.employeeName}</span> &mdash; {editingAssign.rosterTemplateName}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className={labelClass}>Effective from *</label><DatePickerField name="effectiveFrom" required defaultValue={dateOnlyForInput(editingAssign.effectiveFrom)} className={inputClass} /></div>
              <div><label className={labelClass}>Effective to</label><DatePickerField name="effectiveTo" defaultValue={editingAssign.effectiveTo ? dateOnlyForInput(editingAssign.effectiveTo) : ""} className={inputClass} /></div>
            </div>
            <div><label className={labelClass}>Notes</label><textarea name="notes" rows={2} defaultValue={editingAssign.notes ?? ""} className={inputClass} /></div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => setEditAssignModal(false)}>Cancel</Button>
              <Button type="submit" disabled={savingAssign}>{savingAssign ? "Saving..." : "Update"}</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* ── Bulk assign modal ── */}
      <Modal open={bulkModal} onClose={() => setBulkModal(false)} title="Assign Roster to Employees">
        <div className="space-y-5">
          {/* Step indicator */}
          <div className="flex items-center gap-3">
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${bulkStep === 1 ? "bg-blue-600 text-white" : "bg-green-100 text-green-700"}`}>1</div>
            <div className={`text-sm font-medium ${bulkStep === 1 ? "text-blue-700" : "text-green-700"}`}>Template &amp; Dates</div>
            <div className="h-px flex-1 bg-slate-200" />
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${bulkStep === 2 ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"}`}>2</div>
            <div className={`text-sm font-medium ${bulkStep === 2 ? "text-blue-700" : "text-slate-400"}`}>Select Employees</div>
          </div>

          {bulkStep === 1 && (
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Roster template *</label>
                <FormSelect
                  value={bulkTemplateId}
                  onValueChange={setBulkTemplateId}
                  options={rosterTemplateOpts}
                  placeholder="Select template"
                  required
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div><label className={labelClass}>Effective from *</label><DatePickerField value={bulkFrom} onChange={setBulkFrom} className={inputClass} /></div>
                <div><label className={labelClass}>Effective to</label><DatePickerField value={bulkTo} onChange={setBulkTo} className={inputClass} /></div>
              </div>
              <div><label className={labelClass}>Notes</label><textarea rows={2} value={bulkNotes} onChange={(e) => setBulkNotes(e.target.value)} className={inputClass} /></div>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="secondary" type="button" onClick={() => setBulkModal(false)}>Cancel</Button>
                <Button type="button" disabled={!bulkTemplateId || !bulkFrom} onClick={() => setBulkStep(2)}>Next &rarr;</Button>
              </div>
            </div>
          )}

          {bulkStep === 2 && (
            <div className="space-y-3">
              {/* Filters row */}
              <div className="flex flex-wrap items-center gap-2">
                <FormSelect
                  value={bulkDeptFilter}
                  onValueChange={handleBulkDeptChange}
                  options={bulkDeptFilterOpts}
                  placeholder="All departments"
                  className="max-w-[180px]"
                />
                <FormSelect
                  value={bulkLocFilter}
                  onValueChange={setBulkLocFilter}
                  options={bulkLocFilterOpts}
                  placeholder="All locations"
                  className="max-w-[180px]"
                />
                <input
                  type="text"
                  placeholder="Search name or code… (Enter)"
                  value={bulkSearchFilter.input}
                  onChange={(e) => bulkSearchFilter.setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") bulkSearchFilter.apply();
                  }}
                  className={`${inputClass} max-w-[200px]`}
                />
              </div>

              {/* Select all toggle */}
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input type="checkbox" checked={allVisibleSelected} onChange={toggleBulkSelectAll} className="h-4 w-4 rounded border-slate-300" />
                Select all visible ({selectableVisibleCount})
              </label>

              {/* Employee list */}
              <div className="max-h-[320px] overflow-y-auto rounded-lg border border-slate-200">
                {bulkVisibleEmployees.length === 0 && <div className="px-4 py-6 text-center text-sm text-slate-400">No employees match filters.</div>}
                {bulkVisibleEmployees.map((emp) => {
                  const assigned = alreadyAssignedIds.has(emp.id);
                  const checked = bulkSelectedIds.has(emp.id);
                  return (
                    <label key={emp.id} className={`flex items-center gap-3 border-b border-slate-100 px-4 py-2.5 last:border-0 ${assigned ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-slate-50"}`}>
                      <input type="checkbox" checked={checked} disabled={assigned} onChange={() => toggleBulkEmployee(emp.id)} className="h-4 w-4 rounded border-slate-300" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-slate-700">{emp.fullName}</span>
                        {emp.employeeCode && <span className="ml-2 text-xs text-slate-400">({emp.employeeCode})</span>}
                        {emp.departmentName && <span className="ml-2 text-xs text-slate-500">{emp.departmentName}</span>}
                      </div>
                      {assigned && <span className="shrink-0 rounded bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-600">already assigned</span>}
                    </label>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-2">
                <div className="text-sm text-slate-600 font-medium">{bulkSelectedIds.size} employee(s) selected</div>
                <div className="flex gap-3">
                  <Button variant="secondary" type="button" onClick={() => setBulkStep(1)}>&larr; Back</Button>
                  <Button type="button" disabled={bulkSelectedIds.size === 0 || bulkSaving} onClick={submitBulkAssign}>
                    {bulkSaving ? "Assigning..." : `Assign ${bulkSelectedIds.size} employee(s)`}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
