"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api";

interface Props { open: boolean; onClose: () => void; onCreated?: () => void }

export function CreatePayrollBatchModal({ open, onClose, onCreated }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      month: Number(fd.get("month")),
      year: Number(fd.get("year")),
      notes: fd.get("notes") || null,
    };
    try {
      await apiFetch("/api/payroll/batches", { method: "POST", body: JSON.stringify(payload) });
      onCreated?.();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create batch");
    } finally {
      setSubmitting(false);
    }
  }

  const now = new Date();
  const inputClass = "w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20";
  const labelClass = "mb-1 block text-xs font-medium text-[var(--text-muted)]";
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  return (
    <Modal open={open} onClose={onClose} title="Create Payroll Batch">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className={labelClass}>Month *</label>
            <select name="month" required className={inputClass} defaultValue={now.getMonth() + 1}>
              {months.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div><label className={labelClass}>Year *</label><input name="year" type="number" required className={inputClass} defaultValue={now.getFullYear()} /></div>
        </div>
        <div><label className={labelClass}>Notes</label><textarea name="notes" className={inputClass} rows={2} /></div>
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" disabled={submitting}>{submitting ? "Creating..." : "Create Batch"}</Button>
        </div>
      </form>
    </Modal>
  );
}
