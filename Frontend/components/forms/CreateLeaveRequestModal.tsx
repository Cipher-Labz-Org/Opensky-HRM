"use client";

import { useState, useEffect, useMemo, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { DatePickerField, FormErrorAlert } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { formatLocalDateToIso } from "@/lib/datePickerIso";
import {
  clampShortLeaveHours,
  computeLeaveTotalDays,
  DEFAULT_SHORT_LEAVE_HOURS,
  formatLeaveDays,
  isShortLeaveType,
  shortLeaveHourChoices,
  type LeaveDurationKind,
  type HalfDayPeriod,
} from "@/lib/leave-duration";

interface Lookup { id: string; name: string }
interface LeaveType {
  id: string;
  name: string;
  code: string;
  defaultDaysPerYear: number;
  allowHalfDay?: boolean;
  allowShortLeave?: boolean;
  shortLeaveHours?: number;
  minHours?: number | null;
  maxHours?: number | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export function CreateLeaveRequestModal({ open, onClose, onCreated }: Props) {
  const [employees, setEmployees] = useState<Lookup[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [durationKind, setDurationKind] = useState<LeaveDurationKind>("FullDay");
  const [halfDayPeriod, setHalfDayPeriod] = useState<HalfDayPeriod>("Morning");
  const [appliedShortLeaveHours, setAppliedShortLeaveHours] = useState(DEFAULT_SHORT_LEAVE_HOURS);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const todayMinDate = useMemo(() => formatLocalDateToIso(new Date()), []);
  const endMinDate = startDate && startDate > todayMinDate ? startDate : todayMinDate;
  const selectedType = leaveTypes.find((t) => t.id === leaveTypeId);
  const isShortLeaveSelected = isShortLeaveType(selectedType);
  const allowHalfDay = Boolean(selectedType?.allowHalfDay) && !isShortLeaveSelected;
  const typeShortLeaveHours = clampShortLeaveHours(selectedType?.shortLeaveHours ?? DEFAULT_SHORT_LEAVE_HOURS);
  const shortLeaveHourOptions = shortLeaveHourChoices(selectedType?.minHours, selectedType?.maxHours, typeShortLeaveHours);
  const effectiveShortLeaveHours = isShortLeaveSelected ? appliedShortLeaveHours : typeShortLeaveHours;
  const effectiveEnd = durationKind === "FullDay" ? endDate : startDate;
  const totalDays = computeLeaveTotalDays({
    durationKind,
    startDate,
    endDate: effectiveEnd,
    shortLeaveHours: effectiveShortLeaveHours,
  });

  useEffect(() => {
    if (!open) return;
    setLeaveTypeId("");
    setDurationKind("FullDay");
    setAppliedShortLeaveHours(DEFAULT_SHORT_LEAVE_HOURS);
    setHalfDayPeriod("Morning");
    setStartDate("");
    setEndDate("");
    setError("");
    Promise.all([
      apiFetch<{ items: { id: string; firstName: string; lastName: string }[] }>("/api/employees?pageSize=200"),
      apiFetch<LeaveType[]>("/api/leave/types"),
    ]).then(([empRes, types]) => {
      setEmployees(empRes.items.map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}` })));
      setLeaveTypes(types);
    });
  }, [open]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const fd = new FormData(e.currentTarget);
    const start = startDate || (fd.get("startDate") as string);
    const end = durationKind === "FullDay" ? (endDate || (fd.get("endDate") as string)) : start;
    if (!start || !end) {
      setError("Select both start and end dates.");
      setSubmitting(false);
      return;
    }
    if (start < todayMinDate || end < todayMinDate) {
      setError("Leave cannot be applied for past dates.");
      setSubmitting(false);
      return;
    }
    if (end < start) {
      setError("End date cannot be before start date.");
      setSubmitting(false);
      return;
    }

    const payload = {
      employeeId: fd.get("employeeId"),
      leaveTypeId,
      startDate: start,
      endDate: end,
      totalDays: computeLeaveTotalDays({
        durationKind,
        startDate: start,
        endDate: end,
        shortLeaveHours: effectiveShortLeaveHours,
      }),
      durationKind,
      halfDayPeriod: durationKind === "HalfDay" ? halfDayPeriod : null,
      shortLeaveHours: durationKind === "ShortLeave" ? effectiveShortLeaveHours : null,
      reason: fd.get("reason") || null,
      coveragePerson: fd.get("coveragePerson") || null,
    };

    try {
      await apiFetch("/api/leave/requests", { method: "POST", body: JSON.stringify(payload) });
      onCreated?.();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create leave request");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20";
  const labelClass = "mb-1 block text-xs font-medium text-[var(--text-muted)]";

  return (
    <Modal open={open} onClose={onClose} title="Create Leave Request">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormErrorAlert message={error} onDismiss={() => setError("")} />

        <div>
          <label className={labelClass}>Employee *</label>
          <select name="employeeId" required className={inputClass}>
            <option value="">Select employee...</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Leave Type *</label>
          <select
            name="leaveTypeId"
            required
            value={leaveTypeId}
            onChange={(e) => {
              setLeaveTypeId(e.target.value);
              const next = leaveTypes.find((t) => t.id === e.target.value);
              setDurationKind(isShortLeaveType(next) ? "ShortLeave" : "FullDay");
              setAppliedShortLeaveHours(clampShortLeaveHours(next?.shortLeaveHours ?? DEFAULT_SHORT_LEAVE_HOURS));
              setHalfDayPeriod("Morning");
            }}
            className={inputClass}
          >
            <option value="">Select type...</option>
            {leaveTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.name} ({t.defaultDaysPerYear} days/yr)</option>
            ))}
          </select>
        </div>

        {isShortLeaveSelected && (
          <div>
            <label className={labelClass}>Hours</label>
            <div className="mt-1 flex flex-wrap gap-2">
              {shortLeaveHourOptions.map((hours) => (
                <button
                  key={hours}
                  type="button"
                  onClick={() => setAppliedShortLeaveHours(hours)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                    appliedShortLeaveHours === hours
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50/50"
                  }`}
                >
                  {hours}h
                </button>
              ))}
            </div>
          </div>
        )}

        {allowHalfDay && (
          <div>
            <label className={labelClass}>Duration</label>
            <div className="mt-1 flex flex-wrap gap-2">
              {(
                [
                  { value: "FullDay" as const, label: "Full day" },
                  ...(allowHalfDay ? [{ value: "HalfDay" as const, label: "Half day" }] : []),
                ]
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setDurationKind(opt.value);
                    if (opt.value !== "FullDay" && startDate) setEndDate(startDate);
                  }}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                    durationKind === opt.value
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50/50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {durationKind === "HalfDay" && (
              <div className="mt-2 flex flex-wrap gap-2">
                {([
                  { value: "Morning" as const, label: "Morning" },
                  { value: "Afternoon" as const, label: "Afternoon" },
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setHalfDayPeriod(opt.value)}
                    className={`rounded-lg border px-3 py-1 text-xs font-medium transition ${
                      halfDayPeriod === opt.value
                        ? "border-sky-600 bg-sky-50 text-sky-800"
                        : "border-slate-200 bg-white text-slate-600 hover:border-sky-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
            {totalDays > 0 && (
              <p className="mt-2 text-xs text-slate-500">{formatLeaveDays(totalDays)} day(s)</p>
            )}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Start Date *</label>
            <DatePickerField
              name="startDate"
              required
              value={startDate}
              min={todayMinDate}
              onChange={(iso) => {
                setStartDate(iso);
                if (durationKind !== "FullDay") {
                  setEndDate(iso);
                  return;
                }
                if (iso && endDate && endDate < iso) setEndDate("");
              }}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>End Date *</label>
            <DatePickerField
              name="endDate"
              required
              value={durationKind === "FullDay" ? endDate : startDate}
              min={endMinDate}
              onChange={setEndDate}
              disabled={durationKind !== "FullDay"}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Reason</label>
          <textarea name="reason" rows={2} className={inputClass} placeholder="Optional reason..." />
        </div>

        <div>
          <label className={labelClass}>Coverage Person</label>
          <input name="coveragePerson" className={inputClass} placeholder="Who will cover?" />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit Request"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
