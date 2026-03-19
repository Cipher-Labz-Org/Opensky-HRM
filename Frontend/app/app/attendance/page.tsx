"use client";

import { useState, useEffect, useCallback, type FormEvent } from "react";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { CreateAttendanceModal } from "@/components/forms/CreateAttendanceModal";
import { apiFetch } from "@/lib/api";

// ──────────────────────────── Tabs ────────────────────────────

type PageTab = "dashboard" | "shifts" | "roster" | "attendance" | "devices" | "ot-nopay";

const PAGE_TABS: { key: PageTab; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "shifts", label: "Shifts" },
  { key: "roster", label: "Roster" },
  { key: "attendance", label: "Attendance" },
  { key: "devices", label: "Devices" },
  { key: "ot-nopay", label: "OT / No-Pay" },
];

const labelClass = "mb-1 block text-xs font-medium text-slate-500";
const inputClass = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20";

// ──────────────────────────── Shared types ────────────────────────────

interface ShiftItem {
  id: string;
  name: string;
  code: string;
  shiftType: string;
  startTime: string;
  endTime: string;
  breakHours: number;
  isNightShift: boolean;
  session2StartTime: string | null;
  session2EndTime: string | null;
  flexiWindowStart: string | null;
  flexiWindowEnd: string | null;
  minimumWorkHours: number | null;
  lateGraceMinutes: number;
  earlyDepartureGraceMinutes: number;
  halfDayHours: number;
  isActive: boolean;
}

const SHIFT_TYPES = ["Regular", "Split", "Flexi", "Rotational", "Open"] as const;

interface EmployeeLookup {
  id: string;
  fullName: string;
  employeeCode: string;
  departmentId: string | null;
  departmentName: string | null;
  locationId: string | null;
  locationName: string | null;
}

function timeSpanToInput(value: string): string {
  if (!value) return "";
  const part = value.split(":").slice(0, 2).join(":");
  return part.length <= 5 ? part : part.substring(0, 5);
}

function timeInputToSpan(hhmm: string): string {
  if (!hhmm) return "00:00:00";
  const [h, m] = hhmm.split(":").map(Number);
  return `${String(h ?? 0).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")}:00`;
}

function dateOnlyForInput(iso: string): string {
  if (!iso) return "";
  return iso.includes("T") ? (iso.split("T")[0] ?? "") : iso.slice(0, 10);
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

function fmtTimeSpan(ts: string | null): string {
  if (!ts) return "—";
  return ts.split(":").slice(0, 2).join(":");
}

// ──────────────────────────── Page ────────────────────────────

export default function AttendancePage() {
  const [pageTab, setPageTab] = useState<PageTab>("dashboard");
  const [showCreate, setShowCreate] = useState(false);

  return (
    <>
      <AppTopbar
        title="Time & Attendance"
        subtitle="Shift patterns, rosters, mobile/web punch, biometrics integration, overtime, and anomaly detection."
      />

      <div className="mb-5 flex items-center gap-2 flex-wrap">
        {PAGE_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setPageTab(t.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${pageTab === t.key ? "bg-blue-600 text-white shadow" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {pageTab === "dashboard" && (
        <>
          <div className="mb-6 flex items-center justify-between">
            <div />
            <Button onClick={() => setShowCreate(true)}>+ Log Attendance</Button>
          </div>
          <CreateAttendanceModal
            open={showCreate}
            onClose={() => setShowCreate(false)}
            onCreated={() => window.location.reload()}
          />
          <DashboardTab />
        </>
      )}

      {pageTab === "shifts" && <ShiftsTab />}
      {pageTab === "roster" && <RosterTab />}
      {pageTab === "attendance" && <AttendanceListTab />}
      {pageTab === "devices" && <DevicesTab />}
      {pageTab === "ot-nopay" && <OtNopayTab />}
    </>
  );
}

// ──────────────────────────── Dashboard ────────────────────────────

function DashboardTab() {
  const [summary, setSummary] = useState<{
    totalPresent: number; totalAbsent: number; totalLate: number; totalNoPunch: number; averageWorkHours: number;
  } | null>(null);

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    apiFetch<{ totalPresent: number; totalAbsent: number; totalLate: number; totalNoPunch: number; averageWorkHours: number }>(
      `/api/attendance/summary?from=${today}&to=${today}`
    ).then(setSummary).catch(() => {});
  }, []);

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="hris-card">
          <div className="section-title"><h3>Today Attendance</h3><span>Live status</span></div>
          <div className="hris-list">
            <div className="hris-list-item">
              <div><strong>Present</strong><small>{summary ? `${summary.totalPresent} employees` : "Loading..."}</small></div>
              <span className="badge badge-green">{summary ? `${summary.totalPresent > 0 ? Math.round((summary.totalPresent / Math.max(1, summary.totalPresent + summary.totalAbsent)) * 100) : 0}%` : "—"}</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Late Punches</strong><small>{summary ? `${summary.totalLate} employees` : "Loading..."}</small></div>
              <span className="badge badge-orange">Watch</span>
            </div>
            <div className="hris-list-item">
              <div><strong>No Punch</strong><small>{summary ? `${summary.totalNoPunch} employees` : "Loading..."}</small></div>
              <span className="badge badge-red">Action</span>
            </div>
          </div>
        </div>
        <div className="hris-card">
          <div className="section-title"><h3>Average Work Hours</h3><span>Today</span></div>
          <div className="flex items-center justify-center py-6">
            <span className="text-4xl font-bold text-blue-600">{summary ? summary.averageWorkHours.toFixed(1) : "—"}</span>
            <span className="ml-2 text-sm text-slate-500">hrs</span>
          </div>
        </div>
        <div className="hris-card">
          <div className="section-title"><h3>Integration Sources</h3><span>Capture channels</span></div>
          <div className="hris-list">
            <div className="hris-list-item"><div><strong>Biometric devices</strong><small>Fingerprint / face</small></div><span>✓</span></div>
            <div className="hris-list-item"><div><strong>Mobile geo-punch</strong><small>Field teams</small></div><span>✓</span></div>
            <div className="hris-list-item"><div><strong>Web punch</strong><small>Back office</small></div><span>✓</span></div>
          </div>
        </div>
      </div>
    </>
  );
}

// ──────────────────────────── Attendance List Tab ────────────────────────────

interface AttendanceRecord {
  id: string;
  employeeName: string;
  employeeCode: string | null;
  employeeId: string;
  date: string;
  punchIn: string | null;
  punchOut: string | null;
  workedHours: number | null;
  status: string;
  remarks: string | null;
  source: string | null;
  shiftName: string | null;
  shiftType: string | null;
  expectedStart: string | null;
  expectedEnd: string | null;
  isLate: boolean;
  lateMins: number;
  isEarlyDeparture: boolean;
  earlyDepartureMins: number;
  isShortHours: boolean;
  isOnLeave: boolean;
  latitude: number | null;
  longitude: number | null;
}

function AttendanceListTab() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [filterEmployee, setFilterEmployee] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [employees, setEmployees] = useState<EmployeeLookup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editModal, setEditModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (filterEmployee) params.set("employeeId", filterEmployee);
    if (filterFrom) params.set("from", filterFrom);
    if (filterTo) params.set("to", filterTo);
    apiFetch<{ items: AttendanceRecord[]; totalCount: number }>(`/api/attendance?${params}`)
      .then((r) => { setRecords(r.items ?? []); setTotalCount(r.totalCount ?? 0); })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [page, filterEmployee, filterFrom, filterTo]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    apiFetch<{ items: EmployeeLookup[] }>("/api/employees?pageSize=500")
      .then((r) => setEmployees(r.items ?? []))
      .catch(() => {});
  }, []);

  function openEdit(rec: AttendanceRecord) { setEditingRecord(rec); setEditModal(true); }

  async function handleEditSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingRecord) return;
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    try {
      await apiFetch(`/api/attendance/${editingRecord.id}`, {
        method: "PUT",
        body: JSON.stringify({
          punchIn: (fd.get("punchIn") as string) || null,
          punchOut: (fd.get("punchOut") as string) || null,
          status: (fd.get("status") as string) || null,
          remarks: (fd.get("remarks") as string) || null,
        }),
      });
      setEditModal(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally { setSaving(false); }
  }

  async function handleDelete(rec: AttendanceRecord) {
    if (!confirm(`Delete attendance record for ${rec.employeeName} on ${fmtDate(rec.date)}?`)) return;
    try {
      await apiFetch(`/api/attendance/${rec.id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className={labelClass}>Employee</label>
          <select value={filterEmployee} onChange={(e) => { setFilterEmployee(e.target.value); setPage(1); }} className={`${inputClass} w-48`}>
            <option value="">All</option>
            {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.fullName}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>From</label>
          <input type="date" value={filterFrom} onChange={(e) => { setFilterFrom(e.target.value); setPage(1); }} className={`${inputClass} w-40`} />
        </div>
        <div>
          <label className={labelClass}>To</label>
          <input type="date" value={filterTo} onChange={(e) => { setFilterTo(e.target.value); setPage(1); }} className={`${inputClass} w-40`} />
        </div>
        <Button variant="secondary" onClick={() => { setFilterEmployee(""); setFilterFrom(""); setFilterTo(""); setPage(1); }}>Clear</Button>
        <div className="ml-auto"><Button onClick={() => setShowCreate(true)}>+ Log Attendance</Button></div>
      </div>

      <CreateAttendanceModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />

      {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-4 py-2.5 font-semibold text-slate-600">Employee</th>
                <th className="px-3 py-2.5 font-semibold text-slate-600">Date</th>
                <th className="px-3 py-2.5 font-semibold text-slate-600">Punch In</th>
                <th className="px-3 py-2.5 font-semibold text-slate-600">Punch Out</th>
                <th className="px-3 py-2.5 font-semibold text-slate-600">Hours</th>
                <th className="px-3 py-2.5 font-semibold text-slate-600">Status</th>
                <th className="px-3 py-2.5 font-semibold text-slate-600">Source</th>
                <th className="px-3 py-2.5 font-semibold text-slate-600">Shift</th>
                <th className="px-3 py-2.5 font-semibold text-slate-600">Flags</th>
                <th className="px-3 py-2.5 font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-400">Loading...</td></tr>}
              {!loading && records.length === 0 && <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-400">No attendance records found.</td></tr>}
              {!loading && records.map((r) => (
                <tr key={r.id && r.id !== "00000000-0000-0000-0000-000000000000" ? String(r.id) : `${r.employeeId}-${r.date}`} className="hover:bg-slate-50/50">
                  <td className="px-4 py-2.5 font-medium text-slate-700">
                    {r.employeeName}
                    {r.employeeCode && <span className="ml-1 text-xs text-slate-400">({r.employeeCode})</span>}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{fmtDate(r.date)}</td>
                  <td className="px-3 py-2.5 text-slate-600">{fmtTime(r.punchIn)}</td>
                  <td className="px-3 py-2.5 text-slate-600">{fmtTime(r.punchOut)}</td>
                  <td className="px-3 py-2.5 text-slate-600">{r.workedHours != null ? r.workedHours.toFixed(1) : "—"}</td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${r.status === "Present" ? "bg-green-100 text-green-700" : r.status === "Late" ? "bg-amber-100 text-amber-700" : r.status === "Absent" ? "bg-red-100 text-red-700" : r.status === "On Leave" ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-600"}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-500 text-xs">{r.source ?? "—"}</td>
                  <td className="px-3 py-2.5 text-slate-500 text-xs">{r.shiftName ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {r.isOnLeave && <span className="inline-block rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">On leave</span>}
                      {!r.isOnLeave && r.isLate && <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Late {r.lateMins}m</span>}
                      {!r.isOnLeave && r.isEarlyDeparture && <span className="inline-block rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">Early {r.earlyDepartureMins}m</span>}
                      {!r.isOnLeave && r.isShortHours && <span className="inline-block rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">Short hrs</span>}
                      {!r.isOnLeave && !r.isLate && !r.isEarlyDeparture && !r.isShortHours && "—"}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    {r.id && r.id !== "00000000-0000-0000-0000-000000000000" ? (
                      <div className="flex gap-1">
                        <button type="button" onClick={() => openEdit(r)} className="rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100">Edit</button>
                        <button type="button" onClick={() => handleDelete(r)} className="rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100">Del</button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
            <span className="text-xs text-slate-500">Page {page} of {totalPages} ({totalCount} records)</span>
            <div className="flex gap-2">
              <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      <Modal open={editModal} onClose={() => setEditModal(false)} title="Edit Attendance Record">
        {editingRecord && (
          <form key={editingRecord.id} onSubmit={handleEditSubmit} className="space-y-4">
            <div className="text-sm text-slate-600">
              <strong>{editingRecord.employeeName}</strong> — {fmtDate(editingRecord.date)}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Punch In</label>
                <input name="punchIn" type="datetime-local" defaultValue={editingRecord.punchIn ? editingRecord.punchIn.slice(0, 16) : ""} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Punch Out</label>
                <input name="punchOut" type="datetime-local" defaultValue={editingRecord.punchOut ? editingRecord.punchOut.slice(0, 16) : ""} className={inputClass} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select name="status" defaultValue={editingRecord.status} className={inputClass}>
                <option value="Present">Present</option>
                <option value="Late">Late</option>
                <option value="Absent">Absent</option>
                <option value="HalfDay">Half Day</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Remarks</label>
              <textarea name="remarks" rows={2} defaultValue={editingRecord.remarks ?? ""} className={inputClass} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => setEditModal(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Update"}</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

// ──────────────────────────── Devices Tab (Phase 4) ────────────────────────────

interface BiometricDevice {
  id: string;
  name: string;
  serialNumber: string;
  location: string | null;
  deviceType: string;
  isActive: boolean;
  lastSyncAt: string | null;
}

interface ImportBatch {
  id: string;
  fileName: string;
  importedAt: string;
  totalRecords: number;
  successCount: number;
  failCount: number;
  status: string;
  errorDetails: string | null;
  deviceId: string;
  deviceName: string | null;
}

function DevicesTab() {
  const [devices, setDevices] = useState<BiometricDevice[]>([]);
  const [history, setHistory] = useState<ImportBatch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deviceModal, setDeviceModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState<BiometricDevice | null>(null);
  const [savingDevice, setSavingDevice] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [importDeviceId, setImportDeviceId] = useState("");
  const [importData, setImportData] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportBatch | null>(null);

  const loadDevices = useCallback(() => {
    apiFetch<BiometricDevice[]>("/api/biometric/devices").then(setDevices).catch((e) => setError(e instanceof Error ? e.message : "Failed to load devices"));
  }, []);

  const loadHistory = useCallback(() => {
    apiFetch<ImportBatch[]>("/api/biometric/import-history").then(setHistory).catch(() => {});
  }, []);

  useEffect(() => { loadDevices(); loadHistory(); }, [loadDevices, loadHistory]);

  async function submitDevice(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingDevice(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: fd.get("name") as string,
      serialNumber: fd.get("serialNumber") as string,
      location: (fd.get("location") as string) || null,
      deviceType: (fd.get("deviceType") as string) || "Fingerprint",
      isActive: fd.get("isActive") === "on",
    };
    try {
      if (editingDevice) {
        await apiFetch(`/api/biometric/devices/${editingDevice.id}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await apiFetch("/api/biometric/devices", { method: "POST", body: JSON.stringify(payload) });
      }
      setDeviceModal(false);
      loadDevices();
    } catch (err) { setError(err instanceof Error ? err.message : "Save failed"); }
    finally { setSavingDevice(false); }
  }

  async function deleteDevice(d: BiometricDevice) {
    if (!confirm(`Delete device "${d.name}"?`)) return;
    try { await apiFetch(`/api/biometric/devices/${d.id}`, { method: "DELETE" }); loadDevices(); }
    catch (err) { setError(err instanceof Error ? err.message : "Delete failed"); }
  }

  async function handleImport(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!importDeviceId || !importData.trim()) return;
    setImporting(true);
    setError(null);
    setImportResult(null);
    try {
      const lines = importData.trim().split("\n");
      const rows = lines.map((line) => {
        const parts = line.split(",").map((s) => s.trim());
        return {
          employeeCode: parts[0] ?? "",
          punchTime: parts[1] ?? "",
          direction: parts[2] ?? undefined,
        };
      });
      const result = await apiFetch<ImportBatch>("/api/biometric/import", {
        method: "POST",
        body: JSON.stringify({ deviceId: importDeviceId, fileName: `manual_import_${new Date().toISOString().slice(0, 10)}.csv`, rows }),
      });
      setImportResult(result);
      loadHistory();
    } catch (err) { setError(err instanceof Error ? err.message : "Import failed"); }
    finally { setImporting(false); }
  }

  return (
    <div className="space-y-6">
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-700">Biometric Devices</h2>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => { setImportModal(true); setImportResult(null); setImportData(""); }}>Import Punches</Button>
          <Button onClick={() => { setEditingDevice(null); setDeviceModal(true); }}>+ Add Device</Button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 text-left">
              <th className="px-4 py-2.5 font-semibold text-slate-600">Name</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Serial</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Location</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Type</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Active</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Last Sync</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {devices.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No devices registered.</td></tr>}
              {devices.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium text-slate-700">{d.name}</td>
                  <td className="px-4 py-3 text-slate-600">{d.serialNumber}</td>
                  <td className="px-4 py-3 text-slate-600">{d.location ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{d.deviceType}</td>
                  <td className="px-4 py-3">{d.isActive ? <span className="text-green-600">Active</span> : <span className="text-slate-400">Inactive</span>}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{d.lastSyncAt ? new Date(d.lastSyncAt).toLocaleString() : "Never"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => { setEditingDevice(d); setDeviceModal(true); }} className="rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100">Edit</button>
                      <button type="button" onClick={() => deleteDevice(d)} className="rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {history.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-4">
            <h3 className="text-[15px] font-bold text-slate-700">Import History</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50 text-left">
                <th className="px-4 py-2.5 font-semibold text-slate-600">File</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Device</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Date</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Total</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Success</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Failed</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Status</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-slate-700">{h.fileName}</td>
                    <td className="px-4 py-3 text-slate-600">{h.deviceName ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{new Date(h.importedAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-600">{h.totalRecords}</td>
                    <td className="px-4 py-3 text-green-600">{h.successCount}</td>
                    <td className="px-4 py-3 text-red-600">{h.failCount}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${h.status === "Completed" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>{h.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={deviceModal} onClose={() => setDeviceModal(false)} title={editingDevice ? "Edit Device" : "Add Device"}>
        <form key={editingDevice?.id ?? "new-dev"} onSubmit={submitDevice} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className={labelClass}>Name *</label><input name="name" required defaultValue={editingDevice?.name ?? ""} className={inputClass} /></div>
            <div><label className={labelClass}>Serial Number *</label><input name="serialNumber" required defaultValue={editingDevice?.serialNumber ?? ""} className={inputClass} /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className={labelClass}>Location</label><input name="location" defaultValue={editingDevice?.location ?? ""} className={inputClass} /></div>
            <div>
              <label className={labelClass}>Device Type</label>
              <select name="deviceType" defaultValue={editingDevice?.deviceType ?? "Fingerprint"} className={inputClass}>
                <option value="Fingerprint">Fingerprint</option>
                <option value="Face">Face Recognition</option>
                <option value="Card">Card Reader</option>
                <option value="Iris">Iris Scanner</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input name="isActive" type="checkbox" defaultChecked={editingDevice?.isActive ?? true} className="h-4 w-4 rounded border-slate-300" />
            Active
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setDeviceModal(false)}>Cancel</Button>
            <Button type="submit" disabled={savingDevice}>{savingDevice ? "Saving..." : editingDevice ? "Update" : "Create"}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={importModal} onClose={() => setImportModal(false)} title="Import Punch Data">
        <form onSubmit={handleImport} className="space-y-4">
          <div>
            <label className={labelClass}>Device *</label>
            <select value={importDeviceId} onChange={(e) => setImportDeviceId(e.target.value)} className={inputClass} required>
              <option value="">Select device</option>
              {devices.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.serialNumber})</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Punch Data (CSV: EmployeeCode, DateTime, Direction)</label>
            <textarea
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              rows={6}
              placeholder={"EMP001, 2026-03-16T08:30:00, in\nEMP001, 2026-03-16T17:00:00, out\nEMP002, 2026-03-16T09:00:00, in"}
              className={inputClass}
              required
            />
            <p className="mt-1 text-xs text-slate-400">One punch per line. Format: EmployeeCode, PunchDateTime, Direction (in/out)</p>
          </div>
          {importResult && (
            <div className={`rounded-xl border px-4 py-3 text-sm ${importResult.failCount > 0 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-green-200 bg-green-50 text-green-700"}`}>
              Import complete: {importResult.successCount} success, {importResult.failCount} failed of {importResult.totalRecords} total.
              {importResult.errorDetails && <pre className="mt-2 text-xs whitespace-pre-wrap">{importResult.errorDetails}</pre>}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setImportModal(false)}>Close</Button>
            <Button type="submit" disabled={importing}>{importing ? "Importing..." : "Import"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ──────────────────────────── OT / No-Pay Tab (Phase 5) ────────────────────────────

interface OtNopayResult {
  employeeId: string;
  employeeName: string;
  employeeCode: string | null;
  totalWorkedHours: number;
  expectedHours: number;
  overtimeHours: number;
  nopayDays: number;
  nopayHours: number;
  lateDays: number;
  presentDays: number;
  absentDays: number;
}

function OtNopayTab() {
  const [results, setResults] = useState<OtNopayResult[]>([]);
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split("T")[0]!);
  const [filterEmployee, setFilterEmployee] = useState("");
  const [employees, setEmployees] = useState<EmployeeLookup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ items: EmployeeLookup[] }>("/api/employees?pageSize=500")
      .then((r) => setEmployees(r.items ?? []))
      .catch(() => {});
  }, []);

  const calculate = useCallback(() => {
    if (!fromDate || !toDate) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ from: fromDate, to: toDate });
    if (filterEmployee) params.set("employeeId", filterEmployee);
    apiFetch<OtNopayResult[]>(`/api/attendance/overtime-nopay?${params}`)
      .then(setResults)
      .catch((e) => setError(e instanceof Error ? e.message : "Calculation failed"))
      .finally(() => setLoading(false));
  }, [fromDate, toDate, filterEmployee]);

  const totals = results.reduce(
    (acc, r) => ({
      worked: acc.worked + r.totalWorkedHours,
      expected: acc.expected + r.expectedHours,
      ot: acc.ot + r.overtimeHours,
      nopayDays: acc.nopayDays + r.nopayDays,
      nopayHours: acc.nopayHours + r.nopayHours,
    }),
    { worked: 0, expected: 0, ot: 0, nopayDays: 0, nopayHours: 0 },
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className={labelClass}>From *</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={`${inputClass} w-40`} />
        </div>
        <div>
          <label className={labelClass}>To *</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={`${inputClass} w-40`} />
        </div>
        <div>
          <label className={labelClass}>Employee</label>
          <select value={filterEmployee} onChange={(e) => setFilterEmployee(e.target.value)} className={`${inputClass} w-48`}>
            <option value="">All</option>
            {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.fullName}</option>)}
          </select>
        </div>
        <Button onClick={calculate}>Calculate</Button>
      </div>

      {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 text-left">
              <th className="px-4 py-2.5 font-semibold text-slate-600">Employee</th>
              <th className="px-3 py-2.5 font-semibold text-slate-600 text-right">Present</th>
              <th className="px-3 py-2.5 font-semibold text-slate-600 text-right">Absent</th>
              <th className="px-3 py-2.5 font-semibold text-slate-600 text-right">Late Days</th>
              <th className="px-3 py-2.5 font-semibold text-slate-600 text-right">Expected Hrs</th>
              <th className="px-3 py-2.5 font-semibold text-slate-600 text-right">Worked Hrs</th>
              <th className="px-3 py-2.5 font-semibold text-slate-600 text-right">OT Hrs</th>
              <th className="px-3 py-2.5 font-semibold text-slate-600 text-right">No-Pay Days</th>
              <th className="px-3 py-2.5 font-semibold text-slate-600 text-right">No-Pay Hrs</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {loading && <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400">Calculating...</td></tr>}
              {!loading && results.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400">No data. Select a date range and click Calculate.</td></tr>}
              {!loading && results.map((r) => (
                <tr key={r.employeeId} className="hover:bg-slate-50/50">
                  <td className="px-4 py-2.5 font-medium text-slate-700">
                    {r.employeeName}
                    {r.employeeCode && <span className="ml-1 text-xs text-slate-400">({r.employeeCode})</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right text-slate-600">{r.presentDays}</td>
                  <td className="px-3 py-2.5 text-right text-red-600">{r.absentDays}</td>
                  <td className="px-3 py-2.5 text-right text-amber-600">{r.lateDays}</td>
                  <td className="px-3 py-2.5 text-right text-slate-600">{r.expectedHours.toFixed(1)}</td>
                  <td className="px-3 py-2.5 text-right text-slate-700 font-medium">{r.totalWorkedHours.toFixed(1)}</td>
                  <td className="px-3 py-2.5 text-right font-medium text-blue-600">{r.overtimeHours.toFixed(1)}</td>
                  <td className="px-3 py-2.5 text-right text-red-600">{r.nopayDays}</td>
                  <td className="px-3 py-2.5 text-right text-red-600">{r.nopayHours.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
            {!loading && results.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 font-semibold">
                  <td className="px-4 py-2.5 text-slate-700">Totals ({results.length} employees)</td>
                  <td className="px-3 py-2.5 text-right" colSpan={3}></td>
                  <td className="px-3 py-2.5 text-right text-slate-700">{totals.expected.toFixed(1)}</td>
                  <td className="px-3 py-2.5 text-right text-slate-700">{totals.worked.toFixed(1)}</td>
                  <td className="px-3 py-2.5 text-right text-blue-600">{totals.ot.toFixed(1)}</td>
                  <td className="px-3 py-2.5 text-right text-red-600">{totals.nopayDays}</td>
                  <td className="px-3 py-2.5 text-right text-red-600">{totals.nopayHours.toFixed(1)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────── Shifts Tab ────────────────────────────

function ShiftsTab() {
  const [items, setItems] = useState<ShiftItem[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ShiftItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formShiftType, setFormShiftType] = useState("Regular");

  const load = useCallback(() => {
    setError(null);
    apiFetch<ShiftItem[]>(`/api/shift?includeInactive=${includeInactive}`)
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load shifts"));
  }, [includeInactive]);
  useEffect(() => { load(); }, [load]);

  function openAdd() { setEditing(null); setFormShiftType("Regular"); setError(null); setShowModal(true); }
  function openEdit(item: ShiftItem) { setEditing(item); setFormShiftType(item.shiftType || "Regular"); setError(null); setShowModal(true); }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const st = (fd.get("shiftType") as string) || "Regular";
    const payload: Record<string, unknown> = {
      name: fd.get("name") as string,
      code: fd.get("code") as string,
      shiftType: st,
      startTime: timeInputToSpan((fd.get("startTime") as string) || "00:00"),
      endTime: timeInputToSpan((fd.get("endTime") as string) || "00:00"),
      breakHours: Number(fd.get("breakHours")) || 0,
      isNightShift: fd.get("isNightShift") === "on",
      isActive: fd.get("isActive") === "on",
      lateGraceMinutes: Number(fd.get("lateGraceMinutes")) || 5,
      earlyDepartureGraceMinutes: Number(fd.get("earlyDepartureGraceMinutes")) || 5,
      halfDayHours: Number(fd.get("halfDayHours")) || 4,
      session2StartTime: null as string | null,
      session2EndTime: null as string | null,
      flexiWindowStart: null as string | null,
      flexiWindowEnd: null as string | null,
      minimumWorkHours: null as number | null,
    };
    if (st === "Split") {
      payload.session2StartTime = timeInputToSpan((fd.get("session2StartTime") as string) || "");
      payload.session2EndTime = timeInputToSpan((fd.get("session2EndTime") as string) || "");
    }
    if (st === "Flexi") {
      payload.flexiWindowStart = timeInputToSpan((fd.get("flexiWindowStart") as string) || "07:00");
      payload.flexiWindowEnd = timeInputToSpan((fd.get("flexiWindowEnd") as string) || "20:00");
      payload.minimumWorkHours = Number(fd.get("minimumWorkHours")) || 8;
    }
    try {
      if (editing) {
        await apiFetch(`/api/shift/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await apiFetch("/api/shift", { method: "POST", body: JSON.stringify(payload) });
      }
      setShowModal(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: ShiftItem) {
    if (!confirm(`Delete shift "${item.name}"? This will fail if any employee is assigned to it.`)) return;
    setError(null);
    try {
      await apiFetch(`/api/shift/${item.id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  const typeBadgeClass = (t: string) => {
    switch (t) {
      case "Split": return "bg-purple-100 text-purple-700";
      case "Flexi": return "bg-cyan-100 text-cyan-700";
      case "Rotational": return "bg-indigo-100 text-indigo-700";
      case "Open": return "bg-slate-200 text-slate-600";
      default: return "bg-blue-100 text-blue-700";
    }
  };

  const showTimes = formShiftType !== "Open";
  const showSession2 = formShiftType === "Split";
  const showFlexi = formShiftType === "Flexi";
  const showNight = formShiftType === "Regular" || formShiftType === "Rotational" || formShiftType === "Split";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
          Include inactive
        </label>
        <Button onClick={openAdd}>+ Add Shift</Button>
      </div>
      {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-[15px] font-bold text-slate-700">Shift Patterns</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 text-left">
              <th className="px-6 py-2.5 font-semibold text-slate-600">Name</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Code</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Type</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Times</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Break</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Grace</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Active</th>
              <th className="px-4 py-2.5 font-semibold text-slate-600">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 && <tr><td colSpan={8} className="px-6 py-8 text-center text-slate-400">No shifts defined. Add a shift to get started.</td></tr>}
              {items.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-3 font-medium text-slate-700">{s.name}</td>
                  <td className="px-4 py-3 text-slate-600">{s.code}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${typeBadgeClass(s.shiftType)}`}>{s.shiftType}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs">
                    {s.shiftType === "Flexi" ? (
                      <span>{s.flexiWindowStart ? timeSpanToInput(s.flexiWindowStart) : "07:00"} - {s.flexiWindowEnd ? timeSpanToInput(s.flexiWindowEnd) : "20:00"} (min {s.minimumWorkHours ?? 8}h)</span>
                    ) : s.shiftType === "Open" ? (
                      <span className="text-slate-400">No fixed times</span>
                    ) : (
                      <>
                        <span>{timeSpanToInput(s.startTime)} - {timeSpanToInput(s.endTime)}</span>
                        {s.shiftType === "Split" && s.session2StartTime && s.session2EndTime && (
                          <span className="ml-1 text-slate-400">+ {timeSpanToInput(s.session2StartTime)} - {timeSpanToInput(s.session2EndTime)}</span>
                        )}
                        {s.isNightShift && <span className="ml-1 text-indigo-500">(Night)</span>}
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{s.breakHours}h</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    <span>Late: {s.lateGraceMinutes}m</span>
                    <span className="ml-2">Early: {s.earlyDepartureGraceMinutes}m</span>
                  </td>
                  <td className="px-4 py-3">{s.isActive ? <span className="text-green-600">Active</span> : <span className="text-slate-400">Inactive</span>}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => openEdit(s)} className="rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100">Edit</button>
                      <button type="button" onClick={() => handleDelete(s)} className="rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? "Edit Shift" : "Add Shift"}>
        <form key={editing?.id ?? "new-shift"} onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div><label className={labelClass}>Name *</label><input name="name" required defaultValue={editing?.name ?? ""} className={inputClass} /></div>
            <div><label className={labelClass}>Code *</label><input name="code" required defaultValue={editing?.code ?? ""} className={inputClass} /></div>
            <div>
              <label className={labelClass}>Shift Type *</label>
              <select name="shiftType" value={formShiftType} onChange={(e) => setFormShiftType(e.target.value)} className={inputClass}>
                {SHIFT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {showTimes && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className={labelClass}>{showFlexi ? "Window Start" : "Start time"} *</label><input name={showFlexi ? "flexiWindowStart" : "startTime"} type="time" required defaultValue={showFlexi ? (editing?.flexiWindowStart ? timeSpanToInput(editing.flexiWindowStart) : "07:00") : (editing ? timeSpanToInput(editing.startTime) : "09:00")} className={inputClass} /></div>
              <div><label className={labelClass}>{showFlexi ? "Window End" : "End time"} *</label><input name={showFlexi ? "flexiWindowEnd" : "endTime"} type="time" required defaultValue={showFlexi ? (editing?.flexiWindowEnd ? timeSpanToInput(editing.flexiWindowEnd) : "20:00") : (editing ? timeSpanToInput(editing.endTime) : "17:00")} className={inputClass} /></div>
            </div>
          )}

          {showFlexi && (
            <div><label className={labelClass}>Minimum Work Hours *</label><input name="minimumWorkHours" type="number" min={0} step={0.5} required defaultValue={editing?.minimumWorkHours ?? 8} className={inputClass} /></div>
          )}

          {showSession2 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className={labelClass}>Session 2 Start *</label><input name="session2StartTime" type="time" required defaultValue={editing?.session2StartTime ? timeSpanToInput(editing.session2StartTime) : "14:00"} className={inputClass} /></div>
              <div><label className={labelClass}>Session 2 End *</label><input name="session2EndTime" type="time" required defaultValue={editing?.session2EndTime ? timeSpanToInput(editing.session2EndTime) : "18:00"} className={inputClass} /></div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className={labelClass}>Break (hours)</label><input name="breakHours" type="number" min={0} step={0.5} defaultValue={editing?.breakHours ?? 1} className={inputClass} /></div>
            <div className="flex flex-wrap items-center gap-4 pt-6">
              {showNight && (
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input name="isNightShift" type="checkbox" defaultChecked={editing?.isNightShift ?? false} className="h-4 w-4 rounded border-slate-300" />
                  Night shift
                </label>
              )}
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input name="isActive" type="checkbox" defaultChecked={editing?.isActive ?? true} className="h-4 w-4 rounded border-slate-300" />
                Active
              </label>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h4 className="mb-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Attendance Rules</h4>
            <div className="grid gap-4 sm:grid-cols-3">
              <div><label className={labelClass}>Late Grace (mins)</label><input name="lateGraceMinutes" type="number" min={0} defaultValue={editing?.lateGraceMinutes ?? 5} className={inputClass} /></div>
              <div><label className={labelClass}>Early Departure Grace (mins)</label><input name="earlyDepartureGraceMinutes" type="number" min={0} defaultValue={editing?.earlyDepartureGraceMinutes ?? 5} className={inputClass} /></div>
              <div><label className={labelClass}>Half-Day Hours</label><input name="halfDayHours" type="number" min={0} defaultValue={editing?.halfDayHours ?? 4} className={inputClass} /></div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)} type="button">Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : editing ? "Update" : "Create"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ──────────────────────────── Roster (templates + assignments) ────────────────────────────

interface RosterTemplateItem {
  id: string;
  name: string;
  description: string | null;
  defaultStartTime: string;
  defaultEndTime: string;
  workHoursPerDay: number;
  isActive: boolean;
  defaultShiftPatternId: string | null;
  defaultShiftPatternName: string | null;
}

interface RosterAssignmentItem {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string | null;
  rosterTemplateId: string;
  rosterTemplateName: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  notes: string | null;
}

function RosterTab() {
  const [templates, setTemplates] = useState<RosterTemplateItem[]>([]);
  const [assignments, setAssignments] = useState<RosterAssignmentItem[]>([]);
  const [shifts, setShifts] = useState<ShiftItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeLookup[]>([]);
  const [includeInactiveTemplates, setIncludeInactiveTemplates] = useState(false);
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>("");
  const [filterDeptId, setFilterDeptId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [tplModal, setTplModal] = useState(false);
  const [editingTpl, setEditingTpl] = useState<RosterTemplateItem | null>(null);
  const [editingAssign, setEditingAssign] = useState<RosterAssignmentItem | null>(null);
  const [editAssignModal, setEditAssignModal] = useState(false);
  const [savingTpl, setSavingTpl] = useState(false);
  const [savingAssign, setSavingAssign] = useState(false);

  // Roster template form: when a shift is selected, times are taken from the shift (read-only)
  const [tplShiftId, setTplShiftId] = useState("");
  const [tplStart, setTplStart] = useState("09:00");
  const [tplEnd, setTplEnd] = useState("17:00");
  const [tplHours, setTplHours] = useState(8);

  // Bulk assign state
  const [bulkModal, setBulkModal] = useState(false);
  const [bulkStep, setBulkStep] = useState<1 | 2>(1);
  const [bulkTemplateId, setBulkTemplateId] = useState("");
  const [bulkFrom, setBulkFrom] = useState("");
  const [bulkTo, setBulkTo] = useState("");
  const [bulkNotes, setBulkNotes] = useState("");
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeptFilter, setBulkDeptFilter] = useState("");
  const [bulkLocFilter, setBulkLocFilter] = useState("");
  const [bulkSearch, setBulkSearch] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

  const departments = (() => {
    const map = new Map<string, string>();
    employees.forEach((e) => { if (e.departmentId && e.departmentName) map.set(e.departmentId, e.departmentName); });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  })();

  const locations = (() => {
    const map = new Map<string, string>();
    employees.forEach((e) => { if (e.locationId && e.locationName) map.set(e.locationId, e.locationName); });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  })();

  const loadTemplates = useCallback(() => {
    setError(null);
    apiFetch<RosterTemplateItem[]>(`/api/roster/templates?includeInactive=${includeInactiveTemplates}`)
      .then(setTemplates)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load roster templates"));
  }, [includeInactiveTemplates]);

  const loadAssignments = useCallback(() => {
    setError(null);
    const params = new URLSearchParams();
    if (filterEmployeeId) params.set("employeeId", filterEmployeeId);
    const q = params.toString();
    apiFetch<RosterAssignmentItem[]>(`/api/roster/assignments${q ? `?${q}` : ""}`)
      .then(setAssignments)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load assignments"));
  }, [filterEmployeeId]);

  const loadLookups = useCallback(() => {
    apiFetch<ShiftItem[]>("/api/shift?includeInactive=true").then(setShifts).catch(() => setShifts([]));
    apiFetch<{ items: EmployeeLookup[] }>("/api/employees?pageSize=500")
      .then((r) => setEmployees(r.items ?? []))
      .catch(() => setEmployees([]));
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);
  useEffect(() => { loadAssignments(); }, [loadAssignments]);
  useEffect(() => { loadLookups(); }, [loadLookups]);

  function openTplAdd() {
    setEditingTpl(null);
    setError(null);
    setTplShiftId("");
    setTplStart("09:00");
    setTplEnd("17:00");
    setTplHours(8);
    setTplModal(true);
  }
  function openTplEdit(t: RosterTemplateItem) {
    setEditingTpl(t);
    setError(null);
    setTplShiftId(t.defaultShiftPatternId ?? "");
    setTplStart(timeSpanToInput(t.defaultStartTime));
    setTplEnd(timeSpanToInput(t.defaultEndTime));
    setTplHours(t.workHoursPerDay);
    setTplModal(true);
  }

  function getWorkHoursFromShift(s: ShiftItem): number {
    const toMins = (t: string) => {
      const parts = (t || "00:00").split(":").map(Number);
      return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
    };
    const startM = toMins(s.startTime);
    const endM = toMins(s.endTime);
    const spanHours = Math.max(0, (endM - startM) / 60) - (s.breakHours ?? 0);
    return Math.max(0, Math.round(spanHours * 100) / 100);
  }

  function handleTplShiftChange(shiftId: string) {
    setTplShiftId(shiftId);
    if (shiftId) {
      const s = shifts.find((x) => x.id === shiftId);
      if (s) {
        setTplStart(timeSpanToInput(s.startTime));
        setTplEnd(timeSpanToInput(s.endTime));
        setTplHours(getWorkHoursFromShift(s));
      }
    }
  }

  async function submitTemplate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingTpl(true);
    setError(null);
    if (!tplShiftId && (!tplStart?.trim() || !tplEnd?.trim())) {
      setError("Default start and end are required when no shift pattern is selected.");
      setSavingTpl(false);
      return;
    }
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: (fd.get("name") as string) || "",
      description: (fd.get("description") as string) || null,
      defaultStartTime: timeInputToSpan(tplStart || "09:00"),
      defaultEndTime: timeInputToSpan(tplEnd || "17:00"),
      workHoursPerDay: tplHours || 8,
      isActive: fd.get("isActive") === "on",
      defaultShiftPatternId: tplShiftId || null,
    };
    try {
      if (editingTpl) {
        await apiFetch(`/api/roster/templates/${editingTpl.id}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await apiFetch("/api/roster/templates", { method: "POST", body: JSON.stringify(payload) });
      }
      setTplModal(false);
      loadTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save template failed");
    } finally { setSavingTpl(false); }
  }

  async function deleteTemplate(t: RosterTemplateItem) {
    if (!confirm(`Delete roster template "${t.name}"?`)) return;
    setError(null);
    try { await apiFetch(`/api/roster/templates/${t.id}`, { method: "DELETE" }); loadTemplates(); }
    catch (err) { setError(err instanceof Error ? err.message : "Delete failed"); }
  }

  function openAssignEdit(a: RosterAssignmentItem) { setEditingAssign(a); setError(null); setEditAssignModal(true); }

  async function submitEditAssignment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingAssign) return;
    setSavingAssign(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const from = (fd.get("effectiveFrom") as string) || "";
    const toRaw = (fd.get("effectiveTo") as string) || "";
    const notes = (fd.get("notes") as string) || null;
    try {
      await apiFetch(`/api/roster/assignments/${editingAssign.id}`, { method: "PUT", body: JSON.stringify({ effectiveFrom: from, effectiveTo: toRaw || null, notes }) });
      setEditAssignModal(false);
      loadAssignments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save assignment failed");
    } finally { setSavingAssign(false); }
  }

  async function deleteAssignment(a: RosterAssignmentItem) {
    if (!confirm(`Remove roster assignment for ${a.employeeName}?`)) return;
    setError(null);
    try { await apiFetch(`/api/roster/assignments/${a.id}`, { method: "DELETE" }); loadAssignments(); }
    catch (err) { setError(err instanceof Error ? err.message : "Delete failed"); }
  }

  // ── Bulk assign helpers ──

  function openBulkModal(prefilledTemplateId?: string) {
    setBulkStep(1);
    setBulkTemplateId(prefilledTemplateId ?? "");
    setBulkFrom("");
    setBulkTo("");
    setBulkNotes("");
    setBulkSelectedIds(new Set());
    setBulkDeptFilter("");
    setBulkLocFilter("");
    setBulkSearch("");
    setError(null);
    setSuccessMsg(null);
    setBulkModal(true);
  }

  const alreadyAssignedIds = new Set(assignments.map((a) => a.employeeId));

  const bulkVisibleEmployees = employees.filter((emp) => {
    if (bulkDeptFilter && emp.departmentId !== bulkDeptFilter) return false;
    if (bulkLocFilter && emp.locationId !== bulkLocFilter) return false;
    if (bulkSearch) {
      const q = bulkSearch.toLowerCase();
      const match = emp.fullName.toLowerCase().includes(q) || (emp.employeeCode?.toLowerCase().includes(q) ?? false);
      if (!match) return false;
    }
    return true;
  });

  function toggleBulkEmployee(id: string) {
    setBulkSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleBulkSelectAll() {
    const selectableIds = bulkVisibleEmployees.filter((e) => !alreadyAssignedIds.has(e.id)).map((e) => e.id);
    const allSelected = selectableIds.length > 0 && selectableIds.every((id) => bulkSelectedIds.has(id));
    if (allSelected) {
      setBulkSelectedIds((prev) => {
        const next = new Set(prev);
        selectableIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setBulkSelectedIds((prev) => {
        const next = new Set(prev);
        selectableIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }

  function handleBulkDeptChange(deptId: string) {
    setBulkDeptFilter(deptId);
    if (deptId) {
      const deptEmpIds = employees.filter((e) => e.departmentId === deptId && !alreadyAssignedIds.has(e.id)).map((e) => e.id);
      setBulkSelectedIds((prev) => {
        const next = new Set(prev);
        deptEmpIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }

  async function submitBulkAssign() {
    if (bulkSelectedIds.size === 0) return;
    setBulkSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const result = await apiFetch<{ created: number; skipped: number; errors: string[] }>("/api/roster/assignments/bulk", {
        method: "POST",
        body: JSON.stringify({
          employeeIds: Array.from(bulkSelectedIds),
          rosterTemplateId: bulkTemplateId,
          effectiveFrom: bulkFrom,
          effectiveTo: bulkTo || null,
          notes: bulkNotes || null,
        }),
      });
      setBulkModal(false);
      loadAssignments();
      const parts: string[] = [];
      if (result.created > 0) parts.push(`${result.created} assignment(s) created`);
      if (result.skipped > 0) parts.push(`${result.skipped} skipped`);
      setSuccessMsg(parts.join(", ") + (result.errors.length > 0 ? `. Issues: ${result.errors.join("; ")}` : ""));
      setTimeout(() => setSuccessMsg(null), 8000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk assign failed");
    } finally { setBulkSaving(false); }
  }

  // ── Assignments filtered by department on the client side ──
  const filteredAssignments = filterDeptId
    ? assignments.filter((a) => {
        const emp = employees.find((e) => e.id === a.employeeId);
        return emp?.departmentId === filterDeptId;
      })
    : assignments;

  const selectableVisibleCount = bulkVisibleEmployees.filter((e) => !alreadyAssignedIds.has(e.id)).length;
  const allVisibleSelected = selectableVisibleCount > 0 && bulkVisibleEmployees.filter((e) => !alreadyAssignedIds.has(e.id)).every((e) => bulkSelectedIds.has(e.id));

  return (
    <div className="space-y-8">
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {successMsg && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{successMsg}</div>}

      {/* ── Templates section ── */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={includeInactiveTemplates} onChange={(e) => setIncludeInactiveTemplates(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
            Include inactive templates
          </label>
          <Button onClick={openTplAdd}>+ Add template</Button>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-[15px] font-bold text-slate-700">Roster templates</h2>
            <p className="mt-1 text-xs text-slate-500">Default times, hours per day, optional link to a shift pattern.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50 text-left">
                <th className="px-6 py-2.5 font-semibold text-slate-600">Name</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Start</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">End</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Hours/day</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Shift</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Active</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {templates.length === 0 && <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-400">No roster templates yet.</td></tr>}
                {templates.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-3 font-medium text-slate-700">{t.name}</td>
                    <td className="px-4 py-3 text-slate-600">{timeSpanToInput(t.defaultStartTime)}</td>
                    <td className="px-4 py-3 text-slate-600">{timeSpanToInput(t.defaultEndTime)}</td>
                    <td className="px-4 py-3 text-slate-600">{t.workHoursPerDay}</td>
                    <td className="px-4 py-3 text-slate-600">{t.defaultShiftPatternName ?? "—"}</td>
                    <td className="px-4 py-3">{t.isActive ? <span className="text-green-600">Yes</span> : <span className="text-slate-400">No</span>}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button type="button" onClick={() => openBulkModal(t.id)} className="rounded bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100">Assign</button>
                        <button type="button" onClick={() => openTplEdit(t)} className="rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100">Edit</button>
                        <button type="button" onClick={() => deleteTemplate(t)} className="rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Assignments section ── */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-600">Employee</label>
              <select value={filterEmployeeId} onChange={(e) => setFilterEmployeeId(e.target.value)} className={`${inputClass} max-w-xs`}>
                <option value="">All employees</option>
                {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.fullName}{emp.employeeCode ? ` (${emp.employeeCode})` : ""}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-600">Department</label>
              <select value={filterDeptId} onChange={(e) => setFilterDeptId(e.target.value)} className={`${inputClass} max-w-xs`}>
                <option value="">All departments</option>
                {departments.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </div>
          </div>
          <Button onClick={() => openBulkModal()}>+ Assign roster</Button>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-[15px] font-bold text-slate-700">Roster assignments</h2>
            <p className="mt-1 text-xs text-slate-500">Date ranges must not overlap for the same employee.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50 text-left">
                <th className="px-6 py-2.5 font-semibold text-slate-600">Employee</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Department</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Template</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">From</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">To</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Notes</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAssignments.length === 0 && <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-400">No assignments yet.</td></tr>}
                {filteredAssignments.map((a) => {
                  const emp = employees.find((e) => e.id === a.employeeId);
                  return (
                    <tr key={a.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-3 font-medium text-slate-700">{a.employeeName}{a.employeeCode ? <span className="ml-1 text-xs text-slate-500">({a.employeeCode})</span> : null}</td>
                      <td className="px-4 py-3 text-slate-600">{emp?.departmentName ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-600">{a.rosterTemplateName}</td>
                      <td className="px-4 py-3 text-slate-600">{dateOnlyForInput(a.effectiveFrom)}</td>
                      <td className="px-4 py-3 text-slate-600">{a.effectiveTo ? dateOnlyForInput(a.effectiveTo) : "—"}</td>
                      <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate" title={a.notes ?? undefined}>{a.notes ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button type="button" onClick={() => openAssignEdit(a)} className="rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100">Edit</button>
                          <button type="button" onClick={() => deleteAssignment(a)} className="rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100">Remove</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Template add/edit modal ── */}
      <Modal open={tplModal} onClose={() => setTplModal(false)} title={editingTpl ? "Edit roster template" : "Add roster template"}>
        <form key={editingTpl?.id ?? "new"} onSubmit={submitTemplate} className="space-y-4">
          <div><label className={labelClass}>Name *</label><input name="name" required defaultValue={editingTpl?.name ?? ""} className={inputClass} /></div>
          <div><label className={labelClass}>Description</label><textarea name="description" rows={2} defaultValue={editingTpl?.description ?? ""} className={inputClass} /></div>
          <div>
            <label className={labelClass}>Default shift pattern</label>
            <select value={tplShiftId} onChange={(e) => handleTplShiftChange(e.target.value)} className={inputClass}>
              <option value="">None</option>
              {shifts.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
            </select>
            <p className="mt-1 text-xs text-slate-500">When set, start/end times and work hours are taken from the shift.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>{tplShiftId ? "Default start" : "Default start *"}</label>
              <input type="time" value={tplStart} onChange={(e) => setTplStart(e.target.value)} readOnly={!!tplShiftId} className={inputClass} />
              {tplShiftId && <p className="mt-0.5 text-xs text-slate-500">From selected shift</p>}
            </div>
            <div>
              <label className={labelClass}>{tplShiftId ? "Default end" : "Default end *"}</label>
              <input type="time" value={tplEnd} onChange={(e) => setTplEnd(e.target.value)} readOnly={!!tplShiftId} className={inputClass} />
              {tplShiftId && <p className="mt-0.5 text-xs text-slate-500">From selected shift</p>}
            </div>
          </div>
          <div>
            <label className={labelClass}>Work hours per day</label>
            <input type="number" min={0} step={0.25} value={tplHours} onChange={(e) => setTplHours(Number(e.target.value) || 0)} readOnly={!!tplShiftId} className={inputClass} />
            {tplShiftId && <p className="mt-0.5 text-xs text-slate-500">From selected shift</p>}
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600"><input name="isActive" type="checkbox" defaultChecked={editingTpl?.isActive ?? true} className="h-4 w-4 rounded border-slate-300" /> Active</label>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setTplModal(false)}>Cancel</Button>
            <Button type="submit" disabled={savingTpl}>{savingTpl ? "Saving..." : editingTpl ? "Update" : "Create"}</Button>
          </div>
        </form>
      </Modal>

      {/* ── Edit single assignment modal ── */}
      <Modal open={editAssignModal} onClose={() => setEditAssignModal(false)} title="Edit assignment">
        {editingAssign && (
          <form key={editingAssign.id} onSubmit={submitEditAssignment} className="space-y-4">
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <span className="font-medium">{editingAssign.employeeName}</span> &mdash; {editingAssign.rosterTemplateName}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className={labelClass}>Effective from *</label><input name="effectiveFrom" type="date" required defaultValue={dateOnlyForInput(editingAssign.effectiveFrom)} className={inputClass} /></div>
              <div><label className={labelClass}>Effective to</label><input name="effectiveTo" type="date" defaultValue={editingAssign.effectiveTo ? dateOnlyForInput(editingAssign.effectiveTo) : ""} className={inputClass} /></div>
            </div>
            <div><label className={labelClass}>Notes</label><textarea name="notes" rows={2} defaultValue={editingAssign.notes ?? ""} className={inputClass} /></div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => setEditAssignModal(false)}>Cancel</Button>
              <Button type="submit" disabled={savingAssign}>{savingAssign ? "Saving..." : "Update"}</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* ── Bulk assign modal ── */}
      <Modal open={bulkModal} onClose={() => setBulkModal(false)} title="Assign Roster to Employees">
        <div className="space-y-5">
          {/* Step indicator */}
          <div className="flex items-center gap-3">
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${bulkStep === 1 ? "bg-blue-600 text-white" : "bg-green-100 text-green-700"}`}>1</div>
            <div className={`text-sm font-medium ${bulkStep === 1 ? "text-blue-700" : "text-green-700"}`}>Template &amp; Dates</div>
            <div className="h-px flex-1 bg-slate-200" />
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${bulkStep === 2 ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"}`}>2</div>
            <div className={`text-sm font-medium ${bulkStep === 2 ? "text-blue-700" : "text-slate-400"}`}>Select Employees</div>
          </div>

          {bulkStep === 1 && (
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Roster template *</label>
                <select value={bulkTemplateId} onChange={(e) => setBulkTemplateId(e.target.value)} className={inputClass}>
                  <option value="" disabled>Select template</option>
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div><label className={labelClass}>Effective from *</label><input type="date" value={bulkFrom} onChange={(e) => setBulkFrom(e.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Effective to</label><input type="date" value={bulkTo} onChange={(e) => setBulkTo(e.target.value)} className={inputClass} /></div>
              </div>
              <div><label className={labelClass}>Notes</label><textarea rows={2} value={bulkNotes} onChange={(e) => setBulkNotes(e.target.value)} className={inputClass} /></div>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="secondary" type="button" onClick={() => setBulkModal(false)}>Cancel</Button>
                <Button type="button" disabled={!bulkTemplateId || !bulkFrom} onClick={() => setBulkStep(2)}>Next &rarr;</Button>
              </div>
            </div>
          )}

          {bulkStep === 2 && (
            <div className="space-y-3">
              {/* Filters row */}
              <div className="flex flex-wrap items-center gap-2">
                <select value={bulkDeptFilter} onChange={(e) => handleBulkDeptChange(e.target.value)} className={`${inputClass} max-w-[180px]`}>
                  <option value="">All departments</option>
                  {departments.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                </select>
                <select value={bulkLocFilter} onChange={(e) => setBulkLocFilter(e.target.value)} className={`${inputClass} max-w-[180px]`}>
                  <option value="">All locations</option>
                  {locations.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                </select>
                <input type="text" placeholder="Search name or code..." value={bulkSearch} onChange={(e) => setBulkSearch(e.target.value)} className={`${inputClass} max-w-[200px]`} />
              </div>

              {/* Select all toggle */}
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input type="checkbox" checked={allVisibleSelected} onChange={toggleBulkSelectAll} className="h-4 w-4 rounded border-slate-300" />
                Select all visible ({selectableVisibleCount})
              </label>

              {/* Employee list */}
              <div className="max-h-[320px] overflow-y-auto rounded-lg border border-slate-200">
                {bulkVisibleEmployees.length === 0 && <div className="px-4 py-6 text-center text-sm text-slate-400">No employees match filters.</div>}
                {bulkVisibleEmployees.map((emp) => {
                  const assigned = alreadyAssignedIds.has(emp.id);
                  const checked = bulkSelectedIds.has(emp.id);
                  return (
                    <label key={emp.id} className={`flex items-center gap-3 border-b border-slate-100 px-4 py-2.5 last:border-0 ${assigned ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-slate-50"}`}>
                      <input type="checkbox" checked={checked} disabled={assigned} onChange={() => toggleBulkEmployee(emp.id)} className="h-4 w-4 rounded border-slate-300" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-slate-700">{emp.fullName}</span>
                        {emp.employeeCode && <span className="ml-2 text-xs text-slate-400">({emp.employeeCode})</span>}
                        {emp.departmentName && <span className="ml-2 text-xs text-slate-500">{emp.departmentName}</span>}
                      </div>
                      {assigned && <span className="shrink-0 rounded bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-600">already assigned</span>}
                    </label>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-2">
                <div className="text-sm text-slate-600 font-medium">{bulkSelectedIds.size} employee(s) selected</div>
                <div className="flex gap-3">
                  <Button variant="secondary" type="button" onClick={() => setBulkStep(1)}>&larr; Back</Button>
                  <Button type="button" disabled={bulkSelectedIds.size === 0 || bulkSaving} onClick={submitBulkAssign}>
                    {bulkSaving ? "Assigning..." : `Assign ${bulkSelectedIds.size} employee(s)`}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
