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
  const [now, setNow] = React.useState(() => new Date());

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

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!isAttendanceLicensed(licensedModules)) return null;

  const pad = (n: number) => String(n).padStart(2, "0");
  const clock = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const openShift = records.find((r) => r.punchIn && !r.punchOut);
  let state: string;
  if (checkedIn && openShift?.punchIn) {
    const secs = Math.max(0, Math.floor((now.getTime() - new Date(openShift.punchIn).getTime()) / 1000));
    state = `On shift · ${pad(Math.floor(secs / 3600))}:${pad(Math.floor(secs / 60) % 60)}`;
  } else if (checkedIn) {
    state = "On shift";
  } else {
    state = `${now.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })} · Not clocked in`;
  }

  const hint = canPunch
    ? checkedIn
      ? "Punch out"
      : "Punch in"
    : "Link this login to an employee in User Management to punch.";

  return (
    <div className="flex flex-col items-end" style={{ opacity: canPunch ? 1 : 0.6 }}>
      <div className={`osky-punch${checkedIn ? " on" : ""}`} title={hint}>
        <span className="ci" aria-hidden>
          <svg fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="8" />
            <path strokeLinecap="round" d="M12 8v4.5l3 1.5" />
          </svg>
        </span>
        <span className="ctx">
          <span className="t">{clock}</span>
          <span className="s">{state}</span>
        </span>
        <button
          type="button"
          className="osky-sw"
          aria-pressed={checkedIn}
          aria-label={hint}
          title={hint}
          disabled={!canPunch || punching}
          onClick={() => void punch()}
        />
      </div>
      {error ? (
        <p className="mt-0.5 max-w-[11rem] truncate text-[10px] leading-tight text-red-600" title={error}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
