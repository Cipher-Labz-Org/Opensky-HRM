"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/date-utils";
import { ROUTES } from "@/config/routes";

interface RosterAssignmentRow {
  id: string;
  rosterTemplateName: string;
  defaultShiftPatternName: string | null;
  workHoursPerDay: number | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  notes: string | null;
}

interface AttendanceRow {
  date: string;
  workedHours: number | null;
  shiftName: string | null;
}

type AssignmentStatus = "Active" | "Past" | "Upcoming";

function todayLocalIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("T")[0].split("-").map(Number);
  return new Date(y, m - 1, d);
}

function assignmentStatus(from: string, to: string | null): AssignmentStatus {
  const today = parseLocalDate(todayLocalIso());
  const fromDate = parseLocalDate(from);
  const toDate = to ? parseLocalDate(to) : null;
  if (fromDate > today) return "Upcoming";
  if (toDate && toDate < today) return "Past";
  return "Active";
}

function formatHours(total: number): string {
  if (total <= 0) return "0h";
  const h = Math.floor(total);
  const m = Math.round((total - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function weekStartIso(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthStartIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

const statusStyles: Record<AssignmentStatus, string> = {
  Active: "bg-emerald-100 text-emerald-700",
  Past: "bg-slate-100 text-slate-600",
  Upcoming: "bg-sky-100 text-sky-700",
};

export function EmployeeTimesheetsWidget({
  employeeId,
  shiftPatternName,
  shiftPatternCode,
}: {
  employeeId: string;
  shiftPatternName?: string | null;
  shiftPatternCode?: string | null;
}) {
  const [assignments, setAssignments] = useState<RosterAssignmentRow[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const monthFrom = monthStartIso();
      const today = todayLocalIso();
      const [assignRes, attRes] = await Promise.all([
        apiFetch<RosterAssignmentRow[]>(`/api/roster/assignments?employeeId=${employeeId}`).catch(() => []),
        apiFetch<{ items: AttendanceRow[] }>(
          `/api/attendance?employeeId=${employeeId}&from=${monthFrom}&to=${today}&page=1&pageSize=100`
        ).catch(() => ({ items: [] })),
      ]);
      setAssignments(Array.isArray(assignRes) ? assignRes : []);
      setAttendance(attRes.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load shift data");
      setAssignments([]);
      setAttendance([]);
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    load();
  }, [load]);

  const activeAssignment = useMemo(
    () => assignments.find((a) => assignmentStatus(a.effectiveFrom, a.effectiveTo) === "Active"),
    [assignments]
  );

  const currentShiftLabel = useMemo(() => {
    if (activeAssignment?.defaultShiftPatternName) return activeAssignment.defaultShiftPatternName;
    if (shiftPatternName) return shiftPatternName;
    return "Not assigned";
  }, [activeAssignment, shiftPatternName]);

  const todayHours = useMemo(() => {
    const today = todayLocalIso();
    return attendance
      .filter((a) => a.date.split("T")[0] === today)
      .reduce((sum, a) => sum + (a.workedHours ?? 0), 0);
  }, [attendance]);

  const weekHours = useMemo(() => {
    const from = weekStartIso();
    return attendance
      .filter((a) => {
        const d = a.date.split("T")[0];
        return d >= from && d <= todayLocalIso();
      })
      .reduce((sum, a) => sum + (a.workedHours ?? 0), 0);
  }, [attendance]);

  const monthHours = useMemo(() => {
    return attendance.reduce((sum, a) => sum + (a.workedHours ?? 0), 0);
  }, [attendance]);

  const weekDaysLogged = useMemo(() => {
    const from = weekStartIso();
    const days = new Set(
      attendance
        .filter((a) => {
          const d = a.date.split("T")[0];
          return d >= from && d <= todayLocalIso() && (a.workedHours ?? 0) > 0;
        })
        .map((a) => a.date.split("T")[0])
    );
    return days.size;
  }, [attendance]);

  const monthTargetHours = useMemo(() => {
    if (activeAssignment?.workHoursPerDay) return Math.round(activeAssignment.workHoursPerDay * 20);
    return 160;
  }, [activeAssignment]);

  const summaryCards = [
    {
      label: "Today",
      value: formatHours(todayHours),
      sub: currentShiftLabel !== "Not assigned" ? currentShiftLabel : "No shift",
    },
    {
      label: "This Week",
      value: formatHours(weekHours),
      sub: `${weekDaysLogged} day${weekDaysLogged === 1 ? "" : "s"} logged`,
    },
    {
      label: "This Month",
      value: formatHours(monthHours),
      sub: `Target: ${monthTargetHours}h`,
    },
  ];

  const visibleAssignments = showAll ? assignments : assignments.slice(0, 5);

  return (
    <div className="p-4">
      {loading ? (
        <div className="flex items-center justify-center py-8 text-sm text-slate-400">Loading shift data…</div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {summaryCards.map((ts) => (
              <div key={ts.label} className="rounded-xl bg-slate-50 px-2 py-2.5 text-center">
                <div className="text-[9px] font-medium uppercase tracking-wider text-slate-400">{ts.label}</div>
                <div className="mt-0.5 text-base font-extrabold text-slate-800">{ts.value}</div>
                <div className="truncate text-[9px] text-slate-400" title={ts.sub}>
                  {ts.sub}
                </div>
              </div>
            ))}
          </div>

          {(activeAssignment || shiftPatternName) && (
            <div className="mt-3 rounded-lg border border-teal-100 bg-teal-50/60 px-3 py-2 text-xs text-teal-900">
              <span className="font-semibold">Assigned shift: </span>
              {currentShiftLabel}
              {shiftPatternCode ? ` (${shiftPatternCode})` : ""}
              {activeAssignment ? (
                <span className="text-teal-700"> · Roster: {activeAssignment.rosterTemplateName}</span>
              ) : null}
            </div>
          )}

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Shift assignment history</h3>
              {assignments.length > 0 && (
                <span className="text-[10px] text-slate-400">{assignments.length} total</span>
              )}
            </div>

            {assignments.length === 0 ? (
              <p className="rounded-lg bg-slate-50 px-3 py-4 text-center text-xs text-slate-400">
                No roster assignments yet.
                {shiftPatternName ? ` Direct shift: ${shiftPatternName}.` : ""}
              </p>
            ) : (
              <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-200 pr-1">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-2 py-2 font-semibold">Roster</th>
                      <th className="px-2 py-2 font-semibold">Shift</th>
                      <th className="px-2 py-2 font-semibold">Period</th>
                      <th className="px-2 py-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visibleAssignments.map((a) => {
                      const status = assignmentStatus(a.effectiveFrom, a.effectiveTo);
                      return (
                        <tr key={a.id} className="hover:bg-slate-50/80">
                          <td className="px-2 py-2 font-medium text-slate-700">{a.rosterTemplateName}</td>
                          <td className="px-2 py-2 text-slate-500">{a.defaultShiftPatternName ?? "—"}</td>
                          <td className="whitespace-nowrap px-2 py-2 text-slate-500">
                            {formatDate(a.effectiveFrom)}
                            {a.effectiveTo ? ` – ${formatDate(a.effectiveTo)}` : " – ongoing"}
                          </td>
                          <td className="px-2 py-2">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusStyles[status]}`}>
                              {status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {assignments.length > 5 && !showAll && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="mt-2 w-full text-center text-[11px] font-semibold text-[#1a92d5] hover:underline"
              >
                Show all {assignments.length} assignments
              </button>
            )}
          </div>
        </>
      )}

      <Link
        href={ROUTES.attendance}
        className="mt-3 flex w-full items-center justify-center rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-50"
      >
        View Full Timesheets
      </Link>
    </div>
  );
}
