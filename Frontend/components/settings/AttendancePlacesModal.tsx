"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { appConfirm } from "@/components/ui/appDialogs";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormErrorAlert } from "@/components/ui/FormErrorAlert";
import { AttendanceQrPanel, type AttendanceQrKind } from "@/components/settings/AttendanceQrPanel";
import { AttendanceQrModal } from "@/components/settings/BusinessUnitAttendanceQrModal";
import { apiFetch } from "@/lib/api";

type LookupItem = { id: string; name: string; code: string; address?: string | null };

type AttendancePlaceItem = {
  id: string;
  name: string;
  code: string;
  kind: number;
  isActive: boolean;
  geofenceEnabled: boolean;
  geofenceRadiusMeters: number;
  latitude?: number | null;
  longitude?: number | null;
  locationId?: string | null;
  locationName?: string | null;
  locationAddress?: string | null;
  businessUnitId?: string | null;
  businessUnitName?: string | null;
  hasCoordinatesConfigured: boolean;
};

const KIND_LOCATION = 0;
const KIND_BUSINESS_UNIT = 1;

const inputClass =
  "w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20";
const labelClass = "mb-1 block text-xs font-medium text-[var(--text-muted)]";

type AttendancePlacesModalProps = {
  open: boolean;
  onClose: () => void;
};

export function AttendancePlacesModal({ open, onClose }: AttendancePlacesModalProps) {
  const [items, setItems] = useState<AttendancePlaceItem[]>([]);
  const [locations, setLocations] = useState<LookupItem[]>([]);
  const [businessUnits, setBusinessUnits] = useState<LookupItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formKind, setFormKind] = useState<number>(KIND_LOCATION);
  const [linkedLocationId, setLinkedLocationId] = useState("");
  const [linkedBusinessUnitId, setLinkedBusinessUnitId] = useState("");
  const [qrItem, setQrItem] = useState<{
    kind: AttendanceQrKind;
    id: string;
    name: string;
    code: string;
  } | null>(null);

  const selectedBusinessUnit = useMemo(
    () => businessUnits.find((b) => b.id === linkedBusinessUnitId),
    [businessUnits, linkedBusinessUnitId]
  );

  const selectedLocation = useMemo(
    () => locations.find((l) => l.id === linkedLocationId),
    [locations, linkedLocationId]
  );

  async function loadAll() {
    setLoading(true);
    try {
      const [places, locs, bus] = await Promise.all([
        apiFetch<AttendancePlaceItem[]>("/api/attendance/places"),
        apiFetch<LookupItem[]>("/api/organization/locations"),
        apiFetch<LookupItem[]>("/api/organization/business-units"),
      ]);
      setItems(places);
      setLocations(locs);
      setBusinessUnits(bus);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) {
      void loadAll();
      setShowAdd(false);
      setEditingId(null);
      setError("");
    }
  }, [open]);

  function resetFormDefaults(kind = KIND_LOCATION) {
    setFormKind(kind);
    setLinkedLocationId("");
    setLinkedBusinessUnitId("");
  }

  function beginEdit(item: AttendancePlaceItem) {
    setEditingId(item.id);
    setShowAdd(false);
    setFormKind(item.kind);
    setLinkedLocationId(item.locationId ?? "");
    setLinkedBusinessUnitId(item.businessUnitId ?? "");
  }

  function buildPayload(fd: FormData) {
    const kind = Number(fd.get("kind") ?? KIND_LOCATION);
    const radiusRaw = String(fd.get("geofenceRadiusMeters") ?? "").trim();
    const latRaw = String(fd.get("latitude") ?? "").trim();
    const lngRaw = String(fd.get("longitude") ?? "").trim();
    const locationId = String(fd.get("locationId") ?? "").trim();
    const businessUnitId = String(fd.get("businessUnitId") ?? "").trim();

    return {
      name: String(fd.get("name") ?? "").trim() || null,
      code: String(fd.get("code") ?? "").trim() || null,
      kind,
      isActive: fd.get("isActive") === "on",
      geofenceEnabled: fd.get("geofenceEnabled") === "on",
      geofenceRadiusMeters: radiusRaw ? Number(radiusRaw) : 20,
      latitude: latRaw ? Number(latRaw) : null,
      longitude: lngRaw ? Number(lngRaw) : null,
      locationId: kind === KIND_LOCATION && locationId ? locationId : null,
      businessUnitId: kind === KIND_BUSINESS_UNIT && businessUnitId ? businessUnitId : null,
    };
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>, isEdit: boolean) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const payload = buildPayload(new FormData(e.currentTarget));
      if (isEdit && editingId) {
        await apiFetch(`/api/attendance/places/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setEditingId(null);
      } else {
        await apiFetch("/api/attendance/places", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setShowAdd(false);
      }
      await loadAll();
      resetFormDefaults();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save attendance place");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!(await appConfirm("Delete this attendance place?"))) return;
    try {
      await apiFetch(`/api/attendance/places/${id}`, { method: "DELETE" });
      await loadAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  function renderForm(isEdit: boolean, item?: AttendancePlaceItem) {
    const kind = isEdit ? item!.kind : formKind;
    const locationId = isEdit ? (item!.locationId ?? "") : linkedLocationId;
    const businessUnitId = isEdit ? (item!.businessUnitId ?? "") : linkedBusinessUnitId;
    const locationHint = isEdit
      ? item!.locationAddress
      : selectedLocation?.address;

    const qrEntityId = kind === KIND_LOCATION ? locationId : businessUnitId;
    const qrKind: AttendanceQrKind = kind === KIND_LOCATION ? "location" : "businessUnit";
    const qrEntityName = kind === KIND_LOCATION
      ? (isEdit ? item!.locationName ?? undefined : selectedLocation?.name)
      : (isEdit ? item!.businessUnitName ?? undefined : selectedBusinessUnit?.name);
    const qrEntityCode = kind === KIND_LOCATION
      ? (locations.find((l) => l.id === locationId)?.code ?? selectedLocation?.code)
      : (businessUnits.find((b) => b.id === businessUnitId)?.code ?? selectedBusinessUnit?.code);

    const formTitle = isEdit
      ? item?.name || (kind === KIND_LOCATION ? item?.locationName : item?.businessUnitName) || "Attendance place"
      : "New attendance place";
    const formSubtitle = isEdit
      ? `${kind === KIND_LOCATION ? "Location" : "Business unit"} place`
      : "Configure geofence and QR for check-in";

    return (
      <form
        key={isEdit ? `edit-${item!.id}` : "add"}
        onSubmit={(e) => void handleSubmit(e, isEdit)}
        className="mb-4 overflow-hidden rounded-xl border border-blue-100 bg-blue-50/30"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-100/80 bg-white px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--text)]">{formTitle}</p>
            <p className="text-xs text-[var(--text-muted)]">{formSubtitle}</p>
          </div>
          <label className="inline-flex shrink-0 cursor-pointer items-center gap-2.5 rounded-full border border-[var(--border)] bg-gray-50/80 py-1.5 pl-3 pr-2.5 transition hover:border-emerald-200 hover:bg-white">
            <span className="text-xs font-medium text-[var(--text-muted)]">Status</span>
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={item?.isActive ?? true}
              className="peer sr-only"
            />
            <span className="relative inline-flex h-6 w-11 shrink-0 rounded-full bg-gray-200 transition-colors peer-checked:bg-emerald-500 after:pointer-events-none after:absolute after:left-0.5 after:top-0.5 after:block after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-5" />
            <span className="min-w-[3.25rem] text-xs font-semibold text-[var(--text-muted)] peer-checked:hidden">
              Inactive
            </span>
            <span className="hidden min-w-[3.25rem] text-xs font-semibold text-emerald-700 peer-checked:inline">
              Active
            </span>
          </label>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Kind *</label>
            <select
              name="kind"
              className={inputClass}
              value={kind}
              disabled={isEdit}
              onChange={(e) => {
                const next = Number(e.target.value);
                setFormKind(next);
                setLinkedLocationId("");
                setLinkedBusinessUnitId("");
              }}
            >
              <option value={KIND_LOCATION}>Location</option>
              <option value={KIND_BUSINESS_UNIT}>Business Unit</option>
            </select>
            {isEdit ? <input type="hidden" name="kind" value={kind} /> : null}
          </div>

          {kind === KIND_LOCATION ? (
            <div>
              <label className={labelClass}>Linked Location *</label>
              {isEdit ? (
                <>
                  <input type="hidden" name="locationId" value={locationId} />
                  <div className={`${inputClass} bg-gray-50 text-[var(--text-muted)]`}>
                    {item?.locationName ?? "—"}
                  </div>
                </>
              ) : (
                <select
                  name="locationId"
                  className={inputClass}
                  required
                  value={locationId}
                  onChange={(e) => setLinkedLocationId(e.target.value)}
                >
                  <option value="">Select location…</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.code})
                    </option>
                  ))}
                </select>
              )}
              {locationHint ? (
                <p className="mt-1 text-xs text-[var(--text-muted)]">Address: {locationHint}</p>
              ) : null}
            </div>
          ) : (
            <div>
              <label className={labelClass}>Linked Business Unit *</label>
              {isEdit ? (
                <>
                  <input type="hidden" name="businessUnitId" value={businessUnitId} />
                  <div className={`${inputClass} bg-gray-50 text-[var(--text-muted)]`}>
                    {item?.businessUnitName ?? "—"}
                  </div>
                </>
              ) : (
                <select
                  name="businessUnitId"
                  className={inputClass}
                  required
                  value={businessUnitId}
                  onChange={(e) => setLinkedBusinessUnitId(e.target.value)}
                >
                  <option value="">Select business unit…</option>
                  {businessUnits.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div>
            <label className={labelClass}>Display Name</label>
            <input
              name="name"
              className={inputClass}
              defaultValue={item?.name ?? ""}
              placeholder="Defaults from linked entity"
            />
          </div>
          <div>
            <label className={labelClass}>Code</label>
            <input
              name="code"
              className={inputClass}
              defaultValue={item?.code ?? ""}
              placeholder="Defaults from linked entity"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                name="geofenceEnabled"
                defaultChecked={item?.geofenceEnabled ?? false}
                className="h-4 w-4 rounded border border-[var(--border)] text-[var(--primary)]"
              />
              <span className="text-sm font-medium text-[var(--text)]">Geofence enabled</span>
            </label>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              When enabled, check-ins must include GPS within the radius of the coordinates below.
            </p>
          </div>

          <div>
            <label className={labelClass}>Latitude</label>
            <input
              name="latitude"
              type="number"
              step="any"
              className={inputClass}
              defaultValue={item?.latitude != null ? String(item.latitude) : ""}
              placeholder="6.9271"
            />
          </div>
          <div>
            <label className={labelClass}>Longitude</label>
            <input
              name="longitude"
              type="number"
              step="any"
              className={inputClass}
              defaultValue={item?.longitude != null ? String(item.longitude) : ""}
              placeholder="79.8612"
            />
          </div>
          <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2 sm:items-start">
            <div>
              <label className={labelClass}>Geofence radius (meters)</label>
              <input
                name="geofenceRadiusMeters"
                type="number"
                className={inputClass}
                defaultValue={item?.geofenceRadiusMeters ?? 20}
                placeholder="20"
              />
            </div>
            <div>
              <label className={labelClass}>Attendance QR</label>
              <AttendanceQrPanel
                kind={qrKind}
                entityId={qrEntityId || null}
                entityName={qrEntityName}
                entityCode={qrEntityCode}
                inline
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-blue-100/80 bg-white/60 px-4 py-3">
          <Button
            variant="secondary"
            type="button"
            onClick={() => {
              if (isEdit) setEditingId(null);
              else setShowAdd(false);
              resetFormDefaults();
            }}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : isEdit ? "Update" : "Create"}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Attendance Places" wide>
      <FormErrorAlert
        message={error}
        onDismiss={() => setError("")}
        className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600"
      />

      <p className="mb-4 text-sm text-[var(--text-muted)]">
        Configure geofence coordinates for location-based or business-unit-based check-in. Coordinates are stored here only — not on Location or Business Unit master records.
      </p>

      {!showAdd && !editingId && (
        <div className="mb-4">
          <Button
            onClick={() => {
              resetFormDefaults();
              setShowAdd(true);
            }}
          >
            + Add Place
          </Button>
        </div>
      )}

      {showAdd && renderForm(false)}
      {editingId && items.find((i) => i.id === editingId) && renderForm(true, items.find((i) => i.id === editingId)!)}

      {loading ? (
        <p className="py-6 text-center text-sm text-[var(--text-muted)]">Loading...</p>
      ) : items.length === 0 ? (
        <p className="py-6 text-center text-sm text-[var(--text-muted)]">No attendance places yet.</p>
      ) : (
        <div className="max-h-[50vh] overflow-y-auto">
          <table className="hris-table w-full">
            <thead>
              <tr>
                <th>Name</th>
                <th>Kind</th>
                <th>Linked</th>
                <th>Geo</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className={editingId === item.id ? "bg-blue-50" : ""}>
                  <td>
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs font-mono text-[var(--text-muted)]">{item.code}</div>
                  </td>
                  <td>{item.kind === KIND_LOCATION ? "Location" : "Business Unit"}</td>
                  <td className="text-sm">
                    {item.kind === KIND_LOCATION ? item.locationName : item.businessUnitName}
                  </td>
                  <td className="text-xs">
                    {item.hasCoordinatesConfigured
                      ? `${item.latitude}, ${item.longitude} (${item.geofenceRadiusMeters}m)`
                      : "Not configured"}
                  </td>
                  <td className="text-right">
                    {(item.kind === KIND_BUSINESS_UNIT && item.businessUnitId) ||
                    (item.kind === KIND_LOCATION && item.locationId) ? (
                      <button
                        type="button"
                        onClick={() =>
                          setQrItem({
                            kind: item.kind === KIND_LOCATION ? "location" : "businessUnit",
                            id: (item.kind === KIND_LOCATION ? item.locationId : item.businessUnitId)!,
                            name:
                              item.kind === KIND_LOCATION
                                ? item.locationName ?? item.name
                                : item.businessUnitName ?? item.name,
                            code: item.code,
                          })
                        }
                        className="mr-2 text-xs font-medium text-[var(--primary)] hover:underline"
                      >
                        QR
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => beginEdit(item)}
                      className="mr-2 text-xs font-medium text-[var(--primary)] hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(item.id)}
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
      <AttendanceQrModal
        open={!!qrItem}
        onClose={() => setQrItem(null)}
        kind={qrItem?.kind ?? "businessUnit"}
        entityId={qrItem?.id ?? null}
        entityName={qrItem?.name}
        entityCode={qrItem?.code}
      />
    </Modal>
  );
}
