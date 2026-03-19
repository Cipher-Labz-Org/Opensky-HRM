"use client";

import { useState, useEffect, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api";

interface Item {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  level?: number;
}

interface FieldDef {
  key: string;
  label: string;
  type?: "text" | "number" | "textarea";
  required?: boolean;
  placeholder?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  apiBase: string;
  fields: FieldDef[];
  /** maps API item → flat form-ready object */
  toForm?: (item: Item) => Record<string, string | number>;
  /** maps form data → API payload */
  toPayload?: (fd: FormData) => Record<string, unknown>;
}

export function MasterDataEditorModal({
  open,
  onClose,
  title,
  apiBase,
  fields,
  toForm,
  toPayload,
}: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function loadItems() {
    setLoading(true);
    try {
      const data = await apiFetch<Item[]>(apiBase);
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) {
      loadItems();
      setEditingId(null);
      setShowAdd(false);
      setError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function buildPayload(fd: FormData): Record<string, unknown> {
    if (toPayload) return toPayload(fd);
    const obj: Record<string, unknown> = {};
    for (const f of fields) {
      const val = fd.get(f.key);
      obj[f.key] = f.type === "number" ? Number(val) : (val || null);
    }
    return obj;
  }

  async function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const payload = buildPayload(new FormData(e.currentTarget));
      await apiFetch(apiBase, { method: "POST", body: JSON.stringify(payload) });
      await loadItems();
      setShowAdd(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const payload = buildPayload(new FormData(e.currentTarget));
      await apiFetch(`${apiBase}/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
      await loadItems();
      setEditingId(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this item?")) return;
    try {
      await apiFetch(`${apiBase}/${id}`, { method: "DELETE" });
      await loadItems();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  const inputClass =
    "w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20";
  const labelClass = "mb-1 block text-xs font-medium text-[var(--text-muted)]";

  function renderForm(
    onSubmit: (e: FormEvent<HTMLFormElement>) => void,
    defaults?: Record<string, string | number>,
    submitLabel = "Save",
    onCancel?: () => void
  ) {
    return (
      <form onSubmit={onSubmit} className="mb-4 rounded-xl border border-blue-100 bg-blue-50/30 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
              <label className={labelClass}>{f.label}{f.required !== false ? " *" : ""}</label>
              {f.type === "textarea" ? (
                <textarea
                  name={f.key}
                  rows={2}
                  className={inputClass}
                  defaultValue={defaults?.[f.key] ?? ""}
                  placeholder={f.placeholder}
                />
              ) : (
                <input
                  name={f.key}
                  type={f.type ?? "text"}
                  required={f.required !== false}
                  className={inputClass}
                  defaultValue={defaults?.[f.key] ?? ""}
                  placeholder={f.placeholder}
                />
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-end gap-2">
          {onCancel && (
            <Button variant="secondary" type="button" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : submitLabel}
          </Button>
        </div>
      </form>
    );
  }

  const editingItem = items.find((i) => i.id === editingId);

  return (
    <Modal open={open} onClose={onClose} title={title} wide>
      {error && (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      {!showAdd && !editingId && (
        <div className="mb-4">
          <Button onClick={() => setShowAdd(true)}>+ Add New</Button>
        </div>
      )}

      {showAdd && renderForm(handleAdd, undefined, "Create", () => setShowAdd(false))}

      {editingId && editingItem && renderForm(
        handleUpdate,
        toForm ? toForm(editingItem) : {
          name: editingItem.name,
          code: editingItem.code,
          description: editingItem.description ?? "",
          ...(editingItem.level !== undefined ? { level: editingItem.level } : {}),
        },
        "Update",
        () => setEditingId(null)
      )}

      {loading ? (
        <p className="py-6 text-center text-sm text-[var(--text-muted)]">Loading...</p>
      ) : items.length === 0 ? (
        <p className="py-6 text-center text-sm text-[var(--text-muted)]">No items yet.</p>
      ) : (
        <div className="max-h-[50vh] overflow-y-auto">
          <table className="hris-table w-full">
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className={editingId === item.id ? "bg-blue-50" : ""}>
                  <td>
                    <div className="font-medium">{item.name}</div>
                    {item.description && (
                      <div className="text-xs text-[var(--text-muted)]">{item.description}</div>
                    )}
                  </td>
                  <td><span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-mono">{item.code}</span></td>
                  <td className="text-right">
                    <button
                      onClick={() => { setEditingId(item.id); setShowAdd(false); }}
                      className="mr-2 text-xs font-medium text-[var(--primary)] hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="text-xs font-medium text-red-500 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
