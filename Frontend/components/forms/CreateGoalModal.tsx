"use client";

import { useState, useEffect, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormErrorAlert } from "@/components/ui/FormErrorAlert";
import { DatePickerField } from "@/components/ui";
import { apiFetch } from "@/lib/api";

interface Lookup { id: string; name: string }
interface Props { open: boolean; onClose: () => void; onCreated?: () => void }

export function CreateGoalModal({ open, onClose, onCreated }: Props) {
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
    const payload = {
      title: fd.get("title"),
      description: fd.get("description") || null,
      weight: Number(fd.get("weight")) || 25,
      dueDate: fd.get("dueDate") || null,
      employeeId: fd.get("employeeId"),
    };
    try {
      await apiFetch("/api/performance/goals", { method: "POST", body: JSON.stringify(payload) });
      onCreated?.();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create goal");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = "w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20";
  const labelClass = "mb-1 block text-xs font-medium text-[var(--text-muted)]";

  return (
    <Modal open={open} onClose={onClose} title="Create Goal">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormErrorAlert message={error} onDismiss={() => setError("")} />
        <div><label className={labelClass}>Employee *</label>
          <select name="employeeId" required className={inputClass}>
            <option value="">Select employee...</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        <div><label className={labelClass}>Goal Title *</label><input name="title" required className={inputClass} placeholder="Month-end close accuracy" /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className={labelClass}>Weight (%)</label><input name="weight" type="number" min={1} max={100} defaultValue={25} className={inputClass} /></div>
          <div><label className={labelClass}>Due Date</label><DatePickerField name="dueDate" className={inputClass} /></div>
        </div>
        <div><label className={labelClass}>Description</label><textarea name="description" rows={2} className={inputClass} placeholder="Goal details..." /></div>
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" disabled={submitting}>{submitting ? "Creating..." : "Create Goal"}</Button>
        </div>
      </form>
    </Modal>
  );
}
