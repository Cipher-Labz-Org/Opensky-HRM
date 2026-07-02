"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormErrorAlert } from "@/components/ui/FormErrorAlert";
import { FormSelect, type FormSelectOption } from "@/components/ui";
import { apiFetch } from "@/lib/api";

const COURSE_CATEGORY_OPTIONS: FormSelectOption[] = [
  { value: "Leadership", label: "Leadership" },
  { value: "Compliance", label: "Compliance" },
  { value: "Technical", label: "Technical" },
  { value: "Soft Skills", label: "Soft Skills" },
  { value: "Role Skills", label: "Role Skills" },
];

const MANDATORY_OPTIONS: FormSelectOption[] = [
  { value: "false", label: "No" },
  { value: "true", label: "Yes" },
];

interface Props { open: boolean; onClose: () => void; onCreated?: () => void }

export function CreateCourseModal({ open, onClose, onCreated }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      title: fd.get("title"),
      code: fd.get("code"),
      description: fd.get("description") || null,
      provider: fd.get("provider") || null,
      durationHours: Number(fd.get("durationHours")) || 1,
      category: fd.get("category") || null,
      isMandatory: fd.get("isMandatory") === "true",
    };
    try {
      await apiFetch("/api/learning/courses", { method: "POST", body: JSON.stringify(payload) });
      onCreated?.();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create course");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = "w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20";
  const labelClass = "mb-1 block text-xs font-medium text-[var(--text-muted)]";

  return (
    <Modal open={open} onClose={onClose} title="Create Course" wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormErrorAlert message={error} onDismiss={() => setError("")} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className={labelClass}>Course Title *</label><input name="title" required className={inputClass} placeholder="Leadership Fundamentals" /></div>
          <div><label className={labelClass}>Code *</label><input name="code" required className={inputClass} placeholder="LDR-101" /></div>
        </div>
        <div><label className={labelClass}>Description</label><textarea name="description" rows={2} className={inputClass} placeholder="Course overview..." /></div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div><label className={labelClass}>Provider</label><input name="provider" className={inputClass} placeholder="Internal / LinkedIn" /></div>
          <div><label className={labelClass}>Duration (hours)</label><input name="durationHours" type="number" min={1} defaultValue={8} className={inputClass} /></div>
          <div><label className={labelClass}>Category</label>
            <FormSelect name="category" defaultValue="" options={COURSE_CATEGORY_OPTIONS} placeholder="Select..." />
          </div>
        </div>
        <div><label className={labelClass}>Mandatory?</label>
          <FormSelect name="isMandatory" defaultValue="false" options={MANDATORY_OPTIONS} />
        </div>
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" disabled={submitting}>{submitting ? "Creating..." : "Create Course"}</Button>
        </div>
      </form>
    </Modal>
  );
}
