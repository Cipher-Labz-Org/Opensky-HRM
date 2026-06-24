"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormErrorAlert } from "@/components/ui/FormErrorAlert";
import { apiFetch } from "@/lib/api";

interface Props { open: boolean; onClose: () => void; onCreated?: () => void }

export function CreateRoleModal({ open, onClose, onCreated }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: fd.get("name"),
      code: fd.get("code"),
      description: fd.get("description") || null,
    };
    try {
      await apiFetch("/api/auth/roles", { method: "POST", body: JSON.stringify(payload) });
      onCreated?.();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create role");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = "w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20";
  const labelClass = "mb-1 block text-xs font-medium text-[var(--text-muted)]";

  return (
    <Modal open={open} onClose={onClose} title="Create Security Role">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormErrorAlert message={error} onDismiss={() => setError("")} />
        <div><label className={labelClass}>Role Name *</label><input name="name" required className={inputClass} placeholder="HR Manager" /></div>
        <div><label className={labelClass}>Code *</label><input name="code" required className={inputClass} placeholder="HR_MGR" /></div>
        <div><label className={labelClass}>Description</label><textarea name="description" rows={2} className={inputClass} placeholder="Role permissions scope..." /></div>
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" disabled={submitting}>{submitting ? "Creating..." : "Create Role"}</Button>
        </div>
      </form>
    </Modal>
  );
}
