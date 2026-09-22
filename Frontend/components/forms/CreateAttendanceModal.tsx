"use client";

import { useState, useEffect, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormErrorAlert } from "@/components/ui/FormErrorAlert";
import { DatePickerField, FormSelect, TimePickerField, type FormSelectOption } from "@/components/ui";
import { EmployeeSearchCombobox } from "@/components/workforce/EmployeeSearchCombobox";
import { apiFetch } from "@/lib/api";
import { formatLocalDateToIso } from "@/lib/datePickerIso";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

const ATTENDANCE_TYPE_OPTIONS: FormSelectOption[] = [
  { value: "Present", label: "Present" },
  { value: "Absent", label: "Absent" },
  { value: "Late", label: "Late" },
  { value: "Half Day", label: "Half Day" },
  { value: "On Leave", label: "On Leave" },
];

export function CreateAttendanceModal({ open, onClose, onCreated }: Props) {
  const [formKey, setFormKey] = useState(0);
  const [employeeId, setEmployeeId] = useState("");
  const [attendanceType, setAttendanceType] = useState("Present");
  const [punchInTime, setPunchInTime] = useState("");
  const [punchOutTime, setPunchOutTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setFormKey((k) => k + 1);
    setEmployeeId("");
    setAttendanceType("Present");
    setPunchInTime("");
    setPunchOutTime("");
    setError("");
  }, [open]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!employeeId) {
      setError("Select an employee from the suggestions list.");
      return;
    }

    setSubmitting(true);

    const fd = new FormData(e.currentTarget);
    const dateStr = fd.get("date") as string;

    const payload = {
      employeeId,
      date: dateStr,
      punchIn: punchInTime ? `${dateStr}T${punchInTime}:00` : null,
      punchOut: punchOutTime ? `${dateStr}T${punchOutTime}:00` : null,
      status: attendanceType,
      remarks: fd.get("remarks") || null,
      source: "Manual",
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
        <FormErrorAlert message={error} onDismiss={() => setError("")} />

        <div>
          <label className={labelClass}>Employee *</label>
          <EmployeeSearchCombobox
            key={formKey}
            value={employeeId}
            placeholder="Type name or employee code…"
            onPick={(emp) => setEmployeeId(emp?.id ?? "")}
          />
          <p className="mt-1 text-xs text-slate-500">Start typing to search; pick a name from the list.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Type *</label>
            <FormSelect
              value={attendanceType}
              onValueChange={setAttendanceType}
              options={ATTENDANCE_TYPE_OPTIONS}
              placeholder="Select type…"
            />
          </div>
          <div>
            <label className={labelClass}>Date *</label>
            <DatePickerField name="date" required defaultValue={formatLocalDateToIso(new Date())} className={inputClass} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Punch In</label>
            <TimePickerField value={punchInTime} onChange={setPunchInTime} placeholder="Select time" />
          </div>
          <div>
            <label className={labelClass}>Punch Out</label>
            <TimePickerField value={punchOutTime} onChange={setPunchOutTime} placeholder="Select time" />
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
