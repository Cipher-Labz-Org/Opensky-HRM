"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormErrorAlert } from "@/components/ui/FormErrorAlert";
import { DatePickerField, FormSelect, type FormSelectOption } from "@/components/ui";
import { apiFetch } from "@/lib/api";

interface Props { open: boolean; onClose: () => void; onCreated?: () => void }

interface PayrollSettings {
  salaryPeriodStartDay?: number;
  salaryPeriodEndDay?: number;
}

const PROCESS_TYPE_OPTS: FormSelectOption[] = [
  { value: "Salary", label: "Salary" },
  { value: "Bonus", label: "Bonus" },
  { value: "OtherTransactions", label: "Other Transactions" },
];

function clampDay(day: number | undefined, fallback: number): number {
  if (!Number.isFinite(day) || !day || day < 1) return fallback;
  return Math.min(31, Math.floor(day));
}

function monthDateRange(
  month: number,
  year: number,
  startDay = 1,
  endDay = 31,
): { from: string; to: string } {
  const start = clampDay(startDay, 1);
  const end = clampDay(endDay, 31);
  const iso = (y: number, m: number, d: number) => {
    const last = new Date(y, m, 0).getDate();
    const day = Math.min(d, last);
    return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };

  if (start <= end) {
    return { from: iso(year, month, start), to: iso(year, month, end) };
  }

  const prev = new Date(year, month - 1, 1);
  prev.setMonth(prev.getMonth() - 1);
  return {
    from: iso(prev.getFullYear(), prev.getMonth() + 1, start),
    to: iso(year, month, end),
  };
}

export function CreatePayrollBatchModal({ open, onClose, onCreated }: Props) {
  const now = new Date();
  const initialMonth = now.getMonth() + 1;
  const initialYear = now.getFullYear();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [processType, setProcessType] = useState("Salary");
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);
  const [periodStartDay, setPeriodStartDay] = useState(1);
  const [periodEndDay, setPeriodEndDay] = useState(31);
  const [effectiveFrom, setEffectiveFrom] = useState(() => monthDateRange(initialMonth, initialYear).from);
  const [effectiveTo, setEffectiveTo] = useState(() => monthDateRange(initialMonth, initialYear).to);

  useEffect(() => {
    if (!open) return;
    apiFetch<PayrollSettings>("/api/payroll/settings")
      .then((s) => {
        setPeriodStartDay(clampDay(s.salaryPeriodStartDay, 1));
        setPeriodEndDay(clampDay(s.salaryPeriodEndDay, 31));
      })
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    const range = monthDateRange(month, year, periodStartDay, periodEndDay);
    setEffectiveFrom(range.from);
    setEffectiveTo(range.to);
  }, [month, year, periodStartDay, periodEndDay]);

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
        <FormErrorAlert message={error} onDismiss={() => setError("")} />
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
