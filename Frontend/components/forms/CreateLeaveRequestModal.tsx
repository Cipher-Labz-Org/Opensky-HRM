"use client";

import { useState, useEffect, useMemo, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { DatePickerField, FormErrorAlert } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { formatLocalDateToIso } from "@/lib/datePickerIso";

interface Lookup { id: string; name: string }
interface LeaveType { id: string; name: string; code: string; defaultDaysPerYear: number }

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export function CreateLeaveRequestModal({ open, onClose, onCreated }: Props) {
  const [employees, setEmployees] = useState<Lookup[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const todayMinDate = useMemo(() => formatLocalDateToIso(new Date()), []);
  const endMinDate = startDate && startDate > todayMinDate ? startDate : todayMinDate;

  useEffect(() => {
    if (!open) return;
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
    const end = endDate || (fd.get("endDate") as string);
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
    const diffMs = new Date(end).getTime() - new Date(start).getTime();
    const totalDays = Math.max(1, Math.ceil(diffMs / 86400000) + 1);

    const payload = {
      employeeId: fd.get("employeeId"),
      leaveTypeId: fd.get("leaveTypeId"),
      startDate: start,
      endDate: end,
      totalDays,
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
          <select name="leaveTypeId" required className={inputClass}>
            <option value="">Select type...</option>
            {leaveTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.name} ({t.defaultDaysPerYear} days/yr)</option>
            ))}
          </select>
        </div>

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
              value={endDate}
              min={endMinDate}
              onChange={setEndDate}
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
