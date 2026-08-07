"use client";

import { appConfirm } from "@/components/ui/appDialogs";
import { useState, useEffect, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormErrorAlert } from "@/components/ui/FormErrorAlert";
import { apiFetch } from "@/lib/api";

interface Item {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  level?: number;
  [key: string]: unknown;
}

interface FieldDef {
  key: string;
  label: string;
  type?: "text" | "number" | "textarea" | "checkbox";
  required?: boolean;
  placeholder?: string;
  /** Helper text shown under the label (e.g. geofence guidance). */
  hint?: string;
  /** When adding a row and `defaults` is undefined, used as initial checkbox checked / fallback. */
  defaultForAdd?: boolean;
  /** Initial value for text/number fields when adding a row. */
  defaultValue?: string | number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  apiBase: string;
  fields: FieldDef[];
  /** Second column header in the list table (default &quot;Code&quot;). */
  codeColumnHeader?: string;
  /** maps API item → flat form-ready object */
  toForm?: (item: Item) => Record<string, string | number | boolean>;
  /** maps form data → API payload */
  toPayload?: (fd: FormData) => Record<string, unknown>;
  /** When set, shows a QR action that opens attendance QR for the row. */
  onShowAttendanceQr?: (item: Item) => void;
}

export function MasterDataEditorModal({
  open,
  onClose,
  title,
  apiBase,
  fields,
  codeColumnHeader = "Code",
  toForm,
  toPayload,
  onShowAttendanceQr,
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
      if (f.type === "checkbox") {
        obj[f.key] = fd.get(f.key) === "on";
        continue;
      }
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
    if (!(await appConfirm("Are you sure you want to delete this item?"))) return;
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
    defaults?: Record<string, string | number | boolean>,
    submitLabel = "Save",
    onCancel?: () => void,
    formKey?: string
  ) {
    return (
      <form key={formKey} onSubmit={onSubmit} className="mb-4 rounded-xl border border-blue-100 bg-blue-50/30 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.key} className={f.type === "textarea" || f.type === "checkbox" ? "sm:col-span-2" : ""}>
              {f.type === "checkbox" ? (
                <div className="pt-1">
                  <label className="flex cursor-pointer items-center gap-2.5">
                    <input
                      type="checkbox"
                      name={f.key}
                      defaultChecked={
                        defaults?.[f.key] !== undefined
                          ? Boolean(defaults[f.key])
                          : Boolean(f.defaultForAdd)
                      }
                      className="h-4 w-4 rounded border border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]/20"
                    />
                    <span className="text-sm font-medium text-[var(--text)]">
                      {f.label}{f.required !== false ? " *" : ""}
                    </span>
                  </label>
                  {f.hint ? (
                    <p className="mt-1 pl-6 text-xs text-[var(--text-muted)]">{f.hint}</p>
                  ) : null}
                </div>
              ) : (
                <>
                  <label className={labelClass}>{f.label}{f.required !== false ? " *" : ""}</label>
                  {f.hint ? (
                    <p className="mb-1 text-xs text-[var(--text-muted)]">{f.hint}</p>
                  ) : null}
                  {f.type === "textarea" ? (
                    <textarea
                      name={f.key}
                      rows={2}
                      className={inputClass}
                      defaultValue={String(defaults?.[f.key] ?? f.defaultValue ?? "")}
                      placeholder={f.placeholder}
                    />
                  ) : (
                    <input
                      name={f.key}
                      type={f.type ?? "text"}
                      required={f.required !== false}
                      step={f.type === "number" ? "any" : undefined}
                      className={inputClass}
                      defaultValue={
                        defaults?.[f.key] !== undefined
                          ? String(defaults[f.key])
                          : f.defaultValue !== undefined
                            ? String(f.defaultValue)
                            : ""
                      }
                      placeholder={f.placeholder}
                    />
                  )}
                </>
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
      <FormErrorAlert message={error} onDismiss={() => setError("")} className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600" />

      {!showAdd && !editingId && (
        <div className="mb-4">
          <Button onClick={() => setShowAdd(true)}>+ Add New</Button>
        </div>
      )}

      {showAdd && renderForm(handleAdd, undefined, "Create", () => setShowAdd(false), "add-new")}

      {editingId && editingItem && renderForm(
        handleUpdate,
        toForm ? toForm(editingItem) : {
          name: editingItem.name,
          code: editingItem.code,
          description: editingItem.description ?? "",
          ...(editingItem.level !== undefined ? { level: editingItem.level } : {}),
        },
        "Update",
        () => setEditingId(null),
        `edit-${editingId}`
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
                <th>{codeColumnHeader}</th>
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
                    {onShowAttendanceQr ? (
                      <button
                        type="button"
                        onClick={() => onShowAttendanceQr(item)}
                        className="mr-2 text-xs font-medium text-[var(--primary)] hover:underline"
                      >
                        QR
                      </button>
                    ) : null}
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
