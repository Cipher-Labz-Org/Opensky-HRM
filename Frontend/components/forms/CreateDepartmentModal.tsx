"use client";

import { useState, useEffect, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api";

interface Lookup { id: string; name: string }
interface Props { open: boolean; onClose: () => void; onCreated?: () => void }

export function CreateDepartmentModal({ open, onClose, onCreated }: Props) {
  const [departments, setDepartments] = useState<Lookup[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    apiFetch<Lookup[]>("/api/organization/departments")
      .then(setDepartments)
      .catch(() => setDepartments([]));
  }, [open]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: fd.get("name"),
      code: fd.get("code"),
      description: fd.get("description") || null,
      parentDepartmentId: fd.get("parentDepartmentId") || null,
    };
    try {
      await apiFetch("/api/organization/departments", { method: "POST", body: JSON.stringify(payload) });
      onCreated?.();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create department");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = "w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20";
  const labelClass = "mb-1 block text-xs font-medium text-[var(--text-muted)]";

  return (
    <Modal open={open} onClose={onClose} title="Create Department">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
        <div><label className={labelClass}>Department Name *</label><input name="name" required className={inputClass} placeholder="Marketing" /></div>
        <div><label className={labelClass}>Code *</label><input name="code" required className={inputClass} placeholder="MKT" /></div>
        <div><label className={labelClass}>Description</label><textarea name="description" rows={2} className={inputClass} placeholder="Department description..." /></div>
        <div><label className={labelClass}>Parent Department</label>
          <select name="parentDepartmentId" className={inputClass}>
            <option value="">None (top-level)</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" disabled={submitting}>{submitting ? "Creating..." : "Create Department"}</Button>
        </div>
      </form>
    </Modal>
  );
}
