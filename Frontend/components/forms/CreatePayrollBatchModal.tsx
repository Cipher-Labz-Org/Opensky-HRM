"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { DatePickerField, FormSelect, type FormSelectOption } from "@/components/ui";
import { apiFetch } from "@/lib/api";

interface Props { open: boolean; onClose: () => void; onCreated?: () => void }

const PROCESS_TYPE_OPTS: FormSelectOption[] = [
  { value: "Salary", label: "Salary" },
  { value: "Bonus", label: "Bonus" },
  { value: "OtherTransactions", label: "Other Transactions" },
];

function monthDateRange(month: number, year: number): { from: string; to: string } {
  const lastDay = new Date(year, month, 0).getDate();
  const mm = String(month).padStart(2, "0");
  return {
    from: `${year}-${mm}-01`,
    to: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function CreatePayrollBatchModal({ open, onClose, onCreated }: Props) {
  const now = new Date();
  const initialMonth = now.getMonth() + 1;
  const initialYear = now.getFullYear();
  const initialRange = monthDateRange(initialMonth, initialYear);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [processType, setProcessType] = useState("Salary");
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);
  const [effectiveFrom, setEffectiveFrom] = useState(initialRange.from);
  const [effectiveTo, setEffectiveTo] = useState(initialRange.to);

  useEffect(() => {
    const range = monthDateRange(month, year);
    setEffectiveFrom(range.from);
    setEffectiveTo(range.to);
  }, [month, year]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    if (!effectiveFrom || !effectiveTo) {
      setError("Effective date range is required");
      setSubmitting(false);
      return;
    }
    if (effectiveFrom > effectiveTo) {
      setError("Effective end date must be on or after the start date");
      setSubmitting(false);
      return;
    }
    const payload = {
      processType,
      month,
      year,
      effectiveFrom,
      effectiveTo,
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

  const inputClass = "w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20";
  const labelClass = "mb-1 block text-xs font-medium text-[var(--text-muted)]";
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  return (
    <Modal open={open} onClose={onClose} title="Create Payroll Batch">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
        <div><label className={labelClass}>Process Type *</label>
          <FormSelect
            value={processType}
            onValueChange={setProcessType}
            options={PROCESS_TYPE_OPTS}
            placeholder="Process Type"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className={labelClass}>Month *</label>
            <select name="month" required className={inputClass} value={month} onChange={e => setMonth(Number(e.target.value))}>
              {months.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div><label className={labelClass}>Year *</label>
            <input name="year" type="number" required className={inputClass} value={year} onChange={e => setYear(Number(e.target.value))} />
          </div>
        </div>
        <div>
          <label className={labelClass}>Effective Date Range *</label>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className="mb-1 block text-[11px] text-[var(--text-muted)]">From</span>
              <DatePickerField className={inputClass} value={effectiveFrom} onChange={setEffectiveFrom} />
            </div>
            <div>
              <span className="mb-1 block text-[11px] text-[var(--text-muted)]">To</span>
              <DatePickerField className={inputClass} value={effectiveTo} onChange={setEffectiveTo} />
            </div>
          </div>
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
