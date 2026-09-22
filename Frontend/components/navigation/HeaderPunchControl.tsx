"use client";

import * as React from "react";
import { apiFetch } from "@/lib/api";

const ATTENDANCE_PUNCHED_EVENT = "opensky:attendance-punched";

type TodayRecord = {
  id: string;
  punchIn: string | null;
  punchOut: string | null;
};

type HeaderPunchControlProps = {
  employeeId: string | null;
  licensedModules?: string[];
};

function isAttendanceLicensed(modules?: string[]): boolean {
  if (modules == null || modules.length === 0) return true;
  return modules.includes("Attendance");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string {
  return value == null ? "" : String(value);
}

function asNullableString(value: unknown): string | null {
  if (value == null || value === "") return null;
  return String(value);
}

function normalizeTodayRecords(data: unknown): TodayRecord[] {
  const d = asRecord(data);
  const raw = d.items ?? d.Items;
  if (!Array.isArray(raw)) return [];
  const emptyId = "00000000-0000-0000-0000-000000000000";
  const out: TodayRecord[] = [];
  for (const row of raw) {
    const r = asRecord(row);
    const id = asString(r.id ?? r.Id);
    if (!id || id === emptyId) continue;
    out.push({
      id,
      punchIn: asNullableString(r.punchIn ?? r.PunchIn),
      punchOut: asNullableString(r.punchOut ?? r.PunchOut),
    });
  }
  return out;
}

function isCheckedIn(records: TodayRecord[]): boolean {
  return records.some((r) => r.punchIn && !r.punchOut);
}

export function HeaderPunchControl({ employeeId, licensedModules }: HeaderPunchControlProps) {
  const [records, setRecords] = React.useState<TodayRecord[]>([]);
  const [optimisticOn, setOptimisticOn] = React.useState<boolean | null>(null);
  const [punching, setPunching] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const canPunch = Boolean(employeeId);
  const serverOn = isCheckedIn(records);
  const checkedIn = optimisticOn ?? serverOn;

  const loadToday = React.useCallback(async () => {
    if (!employeeId) {
      setRecords([]);
      return;
    }
    try {
      const data = await apiFetch<unknown>("/api/attendance/my-today");
      setRecords(normalizeTodayRecords(data));
    } catch {
      /* keep last known state */
    }
  }, [employeeId]);

  React.useEffect(() => {
    void loadToday();
    const id = window.setInterval(() => void loadToday(), 60_000);
    return () => window.clearInterval(id);
  }, [loadToday]);

  React.useEffect(() => {
    function onPunched() {
      void loadToday();
    }
    window.addEventListener(ATTENDANCE_PUNCHED_EVENT, onPunched);
    return () => window.removeEventListener(ATTENDANCE_PUNCHED_EVENT, onPunched);
  }, [loadToday]);

  async function punch() {
    if (!canPunch || punching) return;
    const nextOn = !checkedIn;
    setPunching(true);
    setError(null);
    setOptimisticOn(nextOn);
    try {
      await apiFetch("/api/attendance/punch", {
        method: "POST",
        body: JSON.stringify({
          type: nextOn ? "in" : "out",
          source: "Web",
        }),
      });
      await loadToday();
      setOptimisticOn(null);
      window.dispatchEvent(new Event(ATTENDANCE_PUNCHED_EVENT));
    } catch (e) {
      setOptimisticOn(null);
      setError(e instanceof Error ? e.message : "Punch failed.");
    } finally {
      setPunching(false);
    }
  }

  if (!isAttendanceLicensed(licensedModules)) return null;

  const label = checkedIn ? "Punch out" : "Punch in";
  const hint = canPunch
    ? label
    : "Link this login to an employee in User Management to punch.";

  return (
    <div className="mx-1 flex max-w-[14rem] flex-col items-end">
      <div
        className="flex items-center gap-2 rounded-full border px-2.5 py-1"
        style={{ borderColor: "#D4DEE8", opacity: canPunch ? 1 : 0.55 }}
        title={hint}
      >
        <span className="whitespace-nowrap text-[13px] font-semibold" style={{ color: "#081F3E" }}>
          {label}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={checkedIn}
          aria-label={hint}
          title={hint}
          disabled={!canPunch || punching}
          onClick={() => void punch()}
          className="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border outline-none transition-colors duration-200 ease-in-out focus-visible:ring-2 focus-visible:ring-[var(--action)]/30 disabled:cursor-not-allowed"
          style={{
            backgroundColor: checkedIn ? "#76D62A" : "#C4C4C4",
            borderColor: checkedIn ? "#5BB21F" : "#A3A3A3",
          }}
        >
          <span
            className={`pointer-events-none inline-block h-[22px] w-[22px] rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-in-out ${
              checkedIn ? "translate-x-[26px]" : "translate-x-[3px]"
            }`}
          />
        </button>
      </div>
      {error ? (
        <p className="mt-0.5 max-w-[11rem] truncate text-[10px] leading-tight text-red-600" title={error}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
