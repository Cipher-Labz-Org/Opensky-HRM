"use client";

import { useState, useEffect, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api";

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
    const start = fd.get("startDate") as string;
    const end = fd.get("endDate") as string;
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
        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        )}

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
            <input name="startDate" type="date" required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>End Date *</label>
            <input name="endDate" type="date" required className={inputClass} />
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
