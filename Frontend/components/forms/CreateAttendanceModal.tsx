"use client";

import { useState, useEffect, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { DatePickerField } from "@/components/ui";
import { apiFetch } from "@/lib/api";

interface Lookup { id: string; name: string }

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export function CreateAttendanceModal({ open, onClose, onCreated }: Props) {
  const [employees, setEmployees] = useState<Lookup[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    apiFetch<{ items: { id: string; firstName: string; lastName: string }[] }>("/api/employees?pageSize=200")
      .then((res) => setEmployees(res.items.map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}` }))));
  }, [open]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const fd = new FormData(e.currentTarget);
    const dateStr = fd.get("date") as string;
    const punchInTime = fd.get("punchInTime") as string;
    const punchOutTime = fd.get("punchOutTime") as string;

    const payload = {
      employeeId: fd.get("employeeId"),
      date: dateStr,
      punchIn: punchInTime ? `${dateStr}T${punchInTime}:00` : null,
      punchOut: punchOutTime ? `${dateStr}T${punchOutTime}:00` : null,
      status: fd.get("status"),
      remarks: fd.get("remarks") || null,
      source: "Web",
    };

    try {
      await apiFetch("/api/attendance", { method: "POST", body: JSON.stringify(payload) });
      onCreated?.();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create record");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20";
  const labelClass = "mb-1 block text-xs font-medium text-[var(--text-muted)]";

  return (
    <Modal open={open} onClose={onClose} title="Log Attendance Record">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

        <div>
          <label className={labelClass}>Employee *</label>
          <select name="employeeId" required className={inputClass}>
            <option value="">Select employee...</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Date *</label>
            <DatePickerField name="date" required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Status *</label>
            <select name="status" required className={inputClass}>
              <option value="Present">Present</option>
              <option value="Absent">Absent</option>
              <option value="Late">Late</option>
              <option value="Half Day">Half Day</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Punch In</label>
            <input name="punchInTime" type="time" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Punch Out</label>
            <input name="punchOutTime" type="time" className={inputClass} />
          </div>
        </div>

        <div>
          <label className={labelClass}>Remarks</label>
          <input name="remarks" className={inputClass} placeholder="Optional remarks..." />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : "Save Record"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
