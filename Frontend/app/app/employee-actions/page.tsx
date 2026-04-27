"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { Button } from "@/components/ui/Button";
import { FormSelect } from "@/components/ui/FormSelect";
import { Modal } from "@/components/ui/Modal";
import { appAlert, appConfirm } from "@/components/ui/appDialogs";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/date-utils";
import { ROUTES } from "@/config/routes";
import { DonutMixChart, formatInt, HorizontalCompareBars, WeeklyActivityBars } from "@/lib/workspace-charts";

const STORAGE_VERSION = 1;
const ACTION_TYPES = ["Promotion", "Warning", "Transfer", "Recognition", "Other"] as const;
type ActionType = (typeof ACTION_TYPES)[number];

const TYPE_COLORS: Record<ActionType, string> = {
  Promotion: "#22c55e",
  Warning: "#f97316",
  Transfer: "#3b82f6",
  Recognition: "#a855f7",
  Other: "#64748b",
};

interface EmployeeRow {
  id: string;
  employeeCode: string;
  fullName: string;
}

interface EmployeeActionRecord {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  actionType: ActionType;
  effectiveDate: string;
  title: string;
  details: string;
  createdAt: string;
  createdByUsername: string | null;
}

function storageKey(userId: string) {
  return `openskyhrm_employee_actions_v${STORAGE_VERSION}_${userId}`;
}

function parseStored(raw: string | null): EmployeeActionRecord[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is EmployeeActionRecord =>
        r &&
        typeof r === "object" &&
        typeof (r as EmployeeActionRecord).id === "string" &&
        ACTION_TYPES.includes((r as EmployeeActionRecord).actionType as ActionType)
    );
  } catch {
    return [];
  }
}

const emptyForm = {
  employeeId: "",
  actionType: "Promotion" as ActionType,
  effectiveDate: new Date().toISOString().slice(0, 10),
  title: "",
  details: "",
};

export default function EmployeeActionsPage() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [empLoading, setEmpLoading] = useState(true);
  const [records, setRecords] = useState<EmployeeActionRecord[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const [typeFilter, setTypeFilter] = useState<ActionType | "All">("All");
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  /** Single field: search text and, after pick, shows "Name (CODE)". */
  const [empInput, setEmpInput] = useState("");
  const [empComboOpen, setEmpComboOpen] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);

  const persist = useCallback(
    (next: EmployeeActionRecord[]) => {
      if (!user?.id) return;
      try {
        localStorage.setItem(storageKey(user.id), JSON.stringify(next));
      } catch {
        /* quota or private mode */
      }
    },
    [user?.id]
  );

  useEffect(() => {
    setEmpLoading(true);
    apiFetch<{ items: EmployeeRow[] }>("/api/employees?pageSize=500&excludeTerminated=true")
      .then((r) => setEmployees(Array.isArray(r.items) ? r.items : []))
      .catch(() => setEmployees([]))
      .finally(() => setEmpLoading(false));
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setRecords([]);
      setHydrated(true);
      return;
    }
    const raw = localStorage.getItem(storageKey(user.id));
    setRecords(parseStored(raw));
    setHydrated(true);
  }, [user?.id]);

  const employeeMatches = useMemo(() => {
    const q = empInput.trim().toLowerCase();
    if (!q) return [];
    return employees
      .filter(
        (e) =>
          e.fullName.toLowerCase().includes(q) ||
          e.employeeCode.toLowerCase().includes(q) ||
          e.id.toLowerCase().includes(q)
      )
      .slice(0, 50);
  }, [employees, empInput]);

  function employeeLabel(e: EmployeeRow) {
    return `${e.fullName} (${e.employeeCode})`;
  }

  function pickEmployee(e: EmployeeRow) {
    setForm((f) => ({ ...f, employeeId: e.id }));
    setEmpInput(employeeLabel(e));
    setEmpComboOpen(false);
  }

  const visibleRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records
      .filter((r) => typeFilter === "All" || r.actionType === typeFilter)
      .filter(
        (r) =>
          !q ||
          r.employeeName.toLowerCase().includes(q) ||
          r.employeeCode.toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          r.details.toLowerCase().includes(q)
      )
      .sort((a, b) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime());
  }, [records, typeFilter, search]);

  const kpis = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const monthStart = new Date(y, m, 1).getTime();
    const monthEnd = new Date(y, m + 1, 0, 23, 59, 59, 999).getTime();
    const d30 = new Date(now);
    d30.setDate(d30.getDate() - 30);
    const t30 = d30.getTime();
    const total = records.length;
    const promotions = records.filter((r) => r.actionType === "Promotion").length;
    const warnings = records.filter((r) => r.actionType === "Warning").length;
    const thisMonth = records.filter((r) => {
      const t = new Date(r.effectiveDate).getTime();
      return t >= monthStart && t <= monthEnd;
    }).length;
    const last30 = records.filter((r) => new Date(r.effectiveDate).getTime() >= t30).length;
    return [
      { label: "Total on file", value: formatInt(total), sub: "Stored in this browser for your account" },
      { label: "Promotions", value: formatInt(promotions), sub: "All-time promotion records" },
      { label: "Warnings", value: formatInt(warnings), sub: "Formal warnings and similar" },
      {
        label: "Effective this month",
        value: formatInt(thisMonth),
        sub: `${formatInt(last30)} with effective date in the last 30 days`,
      },
    ];
  }, [records]);

  const donutValues = useMemo(() => {
    const tally = new Map<ActionType, number>();
    ACTION_TYPES.forEach((t) => tally.set(t, 0));
    for (const r of records) {
      tally.set(r.actionType, (tally.get(r.actionType) ?? 0) + 1);
    }
    return ACTION_TYPES.map((label) => ({
      label,
      value: tally.get(label) ?? 0,
      color: TYPE_COLORS[label],
    })).filter((v) => v.value > 0);
  }, [records]);

  const compareBars = useMemo(() => {
    return ACTION_TYPES.map((label) => ({
      label,
      value: records.filter((r) => r.actionType === label).length,
      color: TYPE_COLORS[label],
    }));
  }, [records]);

  const weeklyActivity = useMemo(() => {
    const today = new Date();
    const keys: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      keys.push(d.toISOString().slice(0, 10));
    }
    const counts = new Map<string, number>();
    for (const k of keys) counts.set(k, 0);
    for (const r of records) {
      const k = r.effectiveDate.slice(0, 10);
      if (counts.has(k)) counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return keys.map((key) => ({
      label: new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" }),
      count: counts.get(key) ?? 0,
    }));
  }, [records]);

  function openCreate() {
    setEditingId(null);
    setForm({ ...emptyForm, effectiveDate: new Date().toISOString().slice(0, 10) });
    setEmpInput("");
    setEmpComboOpen(false);
    setModalOpen(true);
  }

  function openEdit(r: EmployeeActionRecord) {
    setEditingId(r.id);
    setForm({
      employeeId: r.employeeId,
      actionType: r.actionType,
      effectiveDate: r.effectiveDate.slice(0, 10),
      title: r.title,
      details: r.details,
    });
    const fromList = employees.find((e) => e.id === r.employeeId);
    setEmpInput(fromList ? employeeLabel(fromList) : `${r.employeeName} (${r.employeeCode})`);
    setEmpComboOpen(false);
    setModalOpen(true);
  }

  function handleSave() {
    if (!form.employeeId || !form.title.trim()) {
      void appAlert("Choose an employee and enter a short title.", "Missing Information");
      return;
    }
    const emp = employees.find((e) => e.id === form.employeeId);
    const prev = editingId ? records.find((x) => x.id === editingId) : undefined;
    const employeeName = emp?.fullName ?? prev?.employeeName ?? "Unknown";
    const employeeCode = emp?.employeeCode ?? prev?.employeeCode ?? "—";

    if (editingId) {
      const next = records.map((r) =>
        r.id === editingId
          ? {
              ...r,
              employeeId: form.employeeId,
              employeeCode,
              employeeName,
              actionType: form.actionType,
              effectiveDate: form.effectiveDate,
              title: form.title.trim(),
              details: form.details.trim(),
            }
          : r
      );
      setRecords(next);
      persist(next);
    } else {
      const row: EmployeeActionRecord = {
        id: crypto.randomUUID(),
        employeeId: form.employeeId,
        employeeCode,
        employeeName,
        actionType: form.actionType,
        effectiveDate: form.effectiveDate,
        title: form.title.trim(),
        details: form.details.trim(),
        createdAt: new Date().toISOString(),
        createdByUsername: user?.username ?? null,
      };
      const next = [row, ...records];
      setRecords(next);
      persist(next);
    }
    setModalOpen(false);
  }

  async function handleDelete(id: string) {
    if (!(await appConfirm("Remove this record? This cannot be undone.", "Delete Record"))) return;
    const next = records.filter((r) => r.id !== id);
    setRecords(next);
    persist(next);
  }

  async function exportPdf() {
    if (records.length === 0) return;
    setPdfExporting(true);
    try {
      const { buildEmployeeActionsPdfBlob } = await import("@/lib/employee-actions-pdf");
      const blob = await buildEmployeeActionsPdfBlob(records);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `employee-actions-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      console.error(e);
      void appAlert("Could not build the PDF. Please try again.", "Export Failed");
    } finally {
      setPdfExporting(false);
    }
  }

  function importPdf(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const { extractRecordsArrayFromEmployeeActionsPdf } = await import("@/lib/employee-actions-pdf");
        const buf = reader.result as ArrayBuffer;
        const data = extractRecordsArrayFromEmployeeActionsPdf(buf);
        if (!data) {
          void appAlert(
            "Could not read employee actions from this PDF. Re-import only works for PDFs exported from this page (do not re-save the file in an editor that strips attachments or trailing data)."
            , "Import Failed"
          );
          return;
        }
        const merged = parseStored(JSON.stringify(data));
        if (merged.length === 0 && data.length > 0) {
          void appAlert("No valid records found in the PDF backup.", "Import Failed");
          return;
        }
        if (!(await appConfirm(`Import ${merged.length} record(s)? Existing records stay; duplicates are not merged by id.`, "Confirm Import"))) return;
        const next = [...merged, ...records];
        setRecords(next);
        persist(next);
      } catch {
        void appAlert("Could not read that PDF file.", "Import Failed");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  return (
    <>
      <AppTopbar
        title="Employee Actions"
        subtitle="Track promotions, warnings, transfers, and other HR actions. Records stay in this browser per signed-in user; use Export PDF for a printable report and re-import from that same export when needed."
      />

      <section className="relative mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 px-7 py-8 text-slate-900 shadow-sm">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-emerald-100/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 h-72 w-72 rounded-full bg-rose-100/35 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 inline-flex rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
              People operations
            </p>
            <h2 className="text-2xl font-semibold leading-tight text-slate-900 lg:text-3xl">Workforce action log</h2>
            <p className="mt-3 max-w-2xl text-sm text-slate-600">
              Keep a consistent paper trail for career moves and disciplinary steps. Export PDF for sharing or archiving; import merges records from a PDF that was exported here.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={openCreate}>
              Add record
            </Button>
            <Button
              variant="secondary"
              onClick={() => void exportPdf()}
              disabled={records.length === 0 || pdfExporting}
            >
              {pdfExporting ? "Building PDF…" : "Export PDF"}
            </Button>
            <label className="inline-flex min-h-[42px] cursor-pointer items-center justify-center rounded-lg border border-slate-200/90 bg-white/70 px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-md transition hover:bg-white/90">
              Import PDF
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => {
                  importPdf(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </div>
      </section>

      {!hydrated ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          <div className="mb-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {kpis.map((kpi) => (
              <div
                key={kpi.label}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="text-xs font-medium uppercase tracking-wider text-slate-500">{kpi.label}</div>
                <div className="mt-2 text-3xl font-semibold leading-none text-slate-900">{kpi.value}</div>
                <div className="mt-2 text-xs text-slate-600">{kpi.sub}</div>
              </div>
            ))}
          </div>

          <div className="mb-6 grid gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-1">
              <h3 className="mb-1 text-base font-semibold text-slate-800">Mix by type</h3>
              <p className="mb-4 text-xs text-slate-500">Distribution of saved records</p>
              {donutValues.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">No records yet. Add a promotion or warning to see the chart.</p>
              ) : (
                <DonutMixChart values={donutValues} />
              )}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-1">
              <h3 className="mb-1 text-base font-semibold text-slate-800">Volume by category</h3>
              <p className="mb-4 text-xs text-slate-500">Compare action types</p>
              <HorizontalCompareBars items={compareBars} />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-1">
              <h3 className="mb-1 text-base font-semibold text-slate-800">Effective dates (7 days)</h3>
              <p className="mb-4 text-xs text-slate-500">Counts by calendar day (effective date)</p>
              <WeeklyActivityBars data={weeklyActivity} />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-800">Records</h3>
                <p className="text-xs text-slate-500">{visibleRecords.length} shown · {records.length} total</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <FormSelect
                  value={typeFilter}
                  onValueChange={(value) => setTypeFilter(value as ActionType | "All")}
                  className="min-w-[160px]"
                  options={[
                    { value: "All", label: "All types" },
                    ...ACTION_TYPES.map((t) => ({ value: t, label: t })),
                  ]}
                />
                <input
                  type="search"
                  placeholder="Search employee, code, title…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="min-w-[200px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 sm:max-w-xs"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-2.5 pr-3">Effective</th>
                    <th className="py-2.5 pr-3">Employee</th>
                    <th className="py-2.5 pr-3">Type</th>
                    <th className="py-2.5 pr-3">Title</th>
                    <th className="py-2.5 pr-3">Logged</th>
                    <th className="py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {visibleRecords.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500">
                        No records match your filters.{" "}
                        <button type="button" className="font-medium text-[#2B7DE9] hover:underline" onClick={openCreate}>
                          Add one
                        </button>
                        .
                      </td>
                    </tr>
                  ) : (
                    visibleRecords.map((r) => (
                      <tr key={r.id} className="text-slate-700">
                        <td className="py-3 pr-3 whitespace-nowrap text-slate-600">{formatDate(r.effectiveDate)}</td>
                        <td className="py-3 pr-3">
                          <Link href={`${ROUTES.people}/${r.employeeId}`} className="font-medium text-[#2B7DE9] hover:underline">
                            {r.employeeName}
                          </Link>
                          <div className="text-xs text-slate-400">{r.employeeCode}</div>
                        </td>
                        <td className="py-3 pr-3">
                          <span
                            className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                            style={{ backgroundColor: TYPE_COLORS[r.actionType] }}
                          >
                            {r.actionType}
                          </span>
                        </td>
                        <td className="max-w-[220px] py-3 pr-3">
                          <div className="truncate font-medium text-slate-800">{r.title}</div>
                          {r.details ? <div className="truncate text-xs text-slate-500">{r.details}</div> : null}
                        </td>
                        <td className="py-3 pr-3 text-xs text-slate-500 whitespace-nowrap">
                          {formatDate(r.createdAt)}
                          {r.createdByUsername ? <div>@{r.createdByUsername}</div> : null}
                        </td>
                        <td className="py-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            className="mr-2 text-xs font-semibold text-[#2B7DE9] hover:underline"
                            onClick={() => openEdit(r)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="text-xs font-semibold text-rose-600 hover:underline"
                            onClick={() => handleDelete(r.id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Edit action" : "New action"}
        wide
      >
        <div className="space-y-4">
          <div className="relative">
            <label className="mb-1 block text-xs font-medium text-slate-600">Employee</label>
            <input
              type="text"
              autoComplete="off"
              placeholder={empLoading ? "Loading employees…" : "Type name or employee ID to search…"}
              value={empInput}
              disabled={empLoading}
              onChange={(e) => {
                const v = e.target.value;
                setEmpInput(v);
                setEmpComboOpen(true);
                if (!form.employeeId) return;
                const sel = employees.find((x) => x.id === form.employeeId);
                const rec = editingId ? records.find((x) => x.id === editingId) : undefined;
                const expected = sel
                  ? employeeLabel(sel)
                  : rec
                    ? `${rec.employeeName} (${rec.employeeCode})`
                    : "";
                if (expected && v !== expected) {
                  setForm((f) => ({ ...f, employeeId: "" }));
                }
              }}
              onFocus={() => setEmpComboOpen(true)}
              onBlur={() => {
                window.setTimeout(() => setEmpComboOpen(false), 200);
              }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-[#2B7DE9]/30 focus:ring-2"
            />
            {empComboOpen && !empLoading && empInput.trim().length > 0 && (
              <ul
                className="absolute z-[60] mt-1 max-h-52 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg"
                role="listbox"
              >
                {employeeMatches.length === 0 ? (
                  <li className="px-3 py-2.5 text-slate-500">No employees match that search.</li>
                ) : (
                  employeeMatches.map((e) => (
                    <li key={e.id} className="border-b border-slate-50 last:border-0">
                      <button
                        type="button"
                        className="w-full px-3 py-2.5 text-left transition hover:bg-slate-50"
                        onMouseDown={(ev) => ev.preventDefault()}
                        onClick={() => pickEmployee(e)}
                      >
                        <span className="font-medium text-slate-800">{e.fullName}</span>
                        <span className="text-slate-500"> · {e.employeeCode}</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
            {form.employeeId ? (
              <p className="mt-1 text-xs text-emerald-700">Employee selected.</p>
            ) : (
              <p className="mt-1 text-xs text-slate-500">Pick a row from the list to confirm the employee.</p>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Action type</label>
              <FormSelect
                value={form.actionType}
                onValueChange={(value) => setForm((f) => ({ ...f, actionType: value as ActionType }))}
                options={ACTION_TYPES.map((t) => ({ value: t, label: t }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Effective date</label>
              <input
                type="date"
                value={form.effectiveDate}
                onChange={(e) => setForm((f) => ({ ...f, effectiveDate: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Title</label>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Promoted to Senior Analyst"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Details (optional)</label>
            <textarea
              value={form.details}
              onChange={(e) => setForm((f) => ({ ...f, details: e.target.value }))}
              rows={4}
              placeholder="Context, policy reference, next steps…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave}>
              {editingId ? "Save changes" : "Save record"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
