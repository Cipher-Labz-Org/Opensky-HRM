"use client";

import { useState, useEffect, useMemo, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api";
import type { OrgChartDepartment } from "@/components/org/DepartmentOrgChart";

interface DeptLookup {
  id: string;
  name: string;
  parentDepartmentId: string | null;
}
interface BusinessUnitLookup {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called after a successful create or update */
  onCreated?: () => void;
  /** When set, saves with PUT instead of POST (edit mode). */
  editingDepartment?: OrgChartDepartment | null;
}

function descendantIdsOf(
  rootId: string,
  all: DeptLookup[]
): Set<string> {
  const blocked = new Set<string>();
  function walk(id: string) {
    for (const d of all) {
      if (d.parentDepartmentId === id) {
        blocked.add(d.id);
        walk(d.id);
      }
    }
  }
  walk(rootId);
  return blocked;
}

export function CreateDepartmentModal({ open, onClose, onCreated, editingDepartment }: Props) {
  const [departments, setDepartments] = useState<DeptLookup[]>([]);
  const [businessUnits, setBusinessUnits] = useState<BusinessUnitLookup[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isEdit = !!editingDepartment;

  const parentOptions = useMemo(() => {
    if (!editingDepartment) return departments;
    const skip = descendantIdsOf(editingDepartment.id, departments);
    skip.add(editingDepartment.id);
    return departments.filter((d) => !skip.has(d.id));
  }, [departments, editingDepartment]);

  useEffect(() => {
    if (!open) return;
    Promise.all([
      apiFetch<DeptLookup[]>("/api/organization/departments").catch(() => []),
      apiFetch<BusinessUnitLookup[]>("/api/organization/business-units").catch(() => []),
    ]).then(([depts, bus]) => {
      setDepartments(Array.isArray(depts) ? depts : []);
      setBusinessUnits(Array.isArray(bus) ? bus : []);
    });
  }, [open]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const bu = fd.get("businessUnitId");
    const payload = {
      name: String(fd.get("name") ?? "").trim(),
      code: String(fd.get("code") ?? "").trim(),
      description: (() => {
        const d = fd.get("description");
        const s = d != null ? String(d).trim() : "";
        return s.length > 0 ? s : null;
      })(),
      parentDepartmentId: (() => {
        const p = fd.get("parentDepartmentId");
        const s = p != null ? String(p).trim() : "";
        return s.length > 0 ? s : null;
      })(),
      businessUnitId: bu && String(bu).length > 0 ? String(bu) : null,
    };
    try {
      if (isEdit && editingDepartment) {
        await apiFetch(`/api/organization/departments/${editingDepartment.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/api/organization/departments", { method: "POST", body: JSON.stringify(payload) });
      }
      onCreated?.();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : isEdit ? "Failed to update department" : "Failed to create department");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = "w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20";
  const labelClass = "mb-1 block text-xs font-medium text-[var(--text-muted)]";

  const formKey = isEdit ? `edit-${editingDepartment!.id}` : "create";

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit department" : "Create Department"}>
      <form key={formKey} onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
        <div>
          <label className={labelClass}>Department Name *</label>
          <input
            name="name"
            required
            className={inputClass}
            placeholder="Marketing"
            defaultValue={editingDepartment?.name ?? ""}
          />
        </div>
        <div>
          <label className={labelClass}>Code *</label>
          <input
            name="code"
            required
            className={inputClass}
            placeholder="MKT"
            defaultValue={editingDepartment?.code ?? ""}
          />
        </div>
        <div>
          <label className={labelClass}>Description</label>
          <textarea
            name="description"
            rows={2}
            className={inputClass}
            placeholder="Department description..."
            defaultValue={editingDepartment?.description ?? ""}
          />
        </div>
        <div>
          <label className={labelClass}>Business unit</label>
          <select
            name="businessUnitId"
            className={inputClass}
            defaultValue={editingDepartment?.businessUnitId ?? ""}
          >
            <option value="">None (shows under &quot;without a business unit&quot; on chart)</option>
            {businessUnits.filter((b) => b.isActive !== false).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.code})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Parent Department</label>
          <select
            name="parentDepartmentId"
            className={inputClass}
            defaultValue={editingDepartment?.parentDepartmentId ?? ""}
          >
            <option value="">None (top-level)</option>
            {parentOptions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? (isEdit ? "Saving…" : "Creating…") : isEdit ? "Save changes" : "Create Department"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
