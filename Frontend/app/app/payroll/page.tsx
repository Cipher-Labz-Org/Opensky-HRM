"use client";

import { useState, useEffect, useCallback, type FormEvent } from "react";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/date-utils";
import { API_BASE_URL } from "@/config/constants";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { DatePickerField } from "@/components/ui";

interface Component {
  id: string; name: string; code: string; type: string; category: string;
  isTaxable: boolean; isStatutory: boolean; isActive: boolean;
  description?: string; formulaExpression?: string; dependsOnComponentCode?: string;
  sortOrder: number; isEmployerContribution: boolean;
}

interface EmpComp {
  id: string; employeeId: string; employeeName: string; componentId: string;
  componentName: string; componentCode: string; componentType: string; componentCategory: string;
  amount: number; currency: string; effectiveFrom: string; effectiveTo?: string; isActive: boolean;
  batchId?: string;
}

interface Batch {
  id: string; batchCode: string; month: number; year: number; status: string;
  processedAt?: string; approvedBy?: string; employeeCount: number;
  totalGross: number; totalDeductions: number; totalNet: number; totalEmployerCost: number;
  notes?: string; selectedCount: number; createdAt: string;
}

interface StatementLine {
  id: string; componentId: string; componentName: string; componentCode: string;
  type: string; amount: number; isEmployerContribution: boolean; sortOrder: number;
}

interface Statement {
  id: string; batchId: string; employeeId: string; employeeName: string;
  employeeCode?: string; department?: string; month: number; year: number;
  basicPay: number; totalEarnings: number; totalDeductions: number;
  grossPay: number; netPay: number; employerCost: number; status: string;
  lines?: StatementLine[];
}

interface Revision {
  id: string; employeeId: string; employeeName: string; revisionType: string;
  currentSalary: number; proposedSalary: number; changePercentage: number;
  justification?: string; status: string; effectiveDate: string;
  approvedBy?: string; approvedAt?: string; remarks?: string;
}

interface Employee { id: string; firstName: string; lastName: string; employeeCode: string; }
interface EligibleEmployee { id: string; firstName: string; lastName: string; employeeCode: string; department: string; grade: string; location: string; }
interface Settings { epfEmployeeRate: number; epfEmployerRate: number; etfEmployerRate: number; }
interface PagedResult<T> { items: T[]; totalCount: number; page: number; pageSize: number; }

const TABS = ["Dashboard", "Components", "Employee Salary", "Variable Entry", "Payroll Run", "Pay Statements", "Settings"] as const;
type Tab = typeof TABS[number];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const fmt = (n: number) => n.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const inputCls = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100";
const labelCls = "mb-1 block text-xs font-medium text-slate-500";
const badgeCls: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-600",
  Calculated: "bg-blue-50 text-blue-600",
  Reviewed: "bg-indigo-50 text-indigo-600",
  Approved: "bg-green-50 text-green-700",
  Finalized: "bg-emerald-50 text-emerald-700",
  Cancelled: "bg-red-50 text-red-600",
  Pending: "bg-amber-50 text-amber-600",
  Rejected: "bg-red-50 text-red-600",
};

export default function PayrollPage() {
  const [tab, setTab] = useState<Tab>("Dashboard");

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Payroll & Compensation</h1>
        <p className="mt-1 text-sm text-slate-500">Manage compensation components, run monthly payroll, and view pay statements.</p>
      </div>

      {/* Tab bar */}
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${tab === t ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >{t}</button>
        ))}
      </div>

      {tab === "Dashboard" && <DashboardTab />}
      {tab === "Components" && <ComponentsTab />}
      {tab === "Employee Salary" && <EmployeeSalaryTab />}
      {tab === "Variable Entry" && <VariableEntryTab />}
      {tab === "Payroll Run" && <PayrollRunTab />}
      {tab === "Pay Statements" && <PayStatementsTab />}
      {tab === "Settings" && <SettingsTab />}
    </div>
  );
}

/* ═══════════════════════════ DASHBOARD ═══════════════════════════ */

function DashboardTab() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<PagedResult<Batch>>("/api/payroll/batches?pageSize=5"),
      apiFetch<Settings>("/api/payroll/settings"),
    ]).then(([b, s]) => { setBatches(b.items); setSettings(s); })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;

  const latest = batches[0];
  const stats = [
    { label: "Total Gross", value: latest ? `LKR ${fmt(latest.totalGross)}` : "—", color: "bg-blue-50 text-blue-700" },
    { label: "Total Deductions", value: latest ? `LKR ${fmt(latest.totalDeductions)}` : "—", color: "bg-red-50 text-red-600" },
    { label: "Total Net", value: latest ? `LKR ${fmt(latest.totalNet)}` : "—", color: "bg-green-50 text-green-700" },
    { label: "Employees", value: latest ? String(latest.employeeCount) : "—", color: "bg-slate-50 text-slate-700" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(s => (
          <div key={s.label} className={`rounded-xl border border-slate-100 p-5 ${s.color}`}>
            <div className="text-xs font-medium uppercase tracking-wider opacity-70">{s.label}</div>
            <div className="mt-2 text-2xl font-bold">{s.value}</div>
            {latest && <div className="mt-1 text-xs opacity-60">{MONTHS[latest.month - 1]} {latest.year}</div>}
          </div>
        ))}
      </div>

      <Card title="EPF / ETF Rates">
        {settings && (
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-slate-50 p-4 text-center">
              <div className="text-xs text-slate-500">EPF (Employee)</div>
              <div className="mt-1 text-xl font-bold text-slate-800">{(settings.epfEmployeeRate * 100).toFixed(0)}%</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-4 text-center">
              <div className="text-xs text-slate-500">EPF (Employer)</div>
              <div className="mt-1 text-xl font-bold text-slate-800">{(settings.epfEmployerRate * 100).toFixed(0)}%</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-4 text-center">
              <div className="text-xs text-slate-500">ETF (Employer)</div>
              <div className="mt-1 text-xl font-bold text-slate-800">{(settings.etfEmployerRate * 100).toFixed(0)}%</div>
            </div>
          </div>
        )}
      </Card>

      <Card title="Recent Payroll Batches">
        {batches.length === 0 ? <EmptyState text="No payroll batches yet." /> : (
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b text-xs text-slate-400">
              <th className="pb-2 font-medium">Batch</th><th className="pb-2 font-medium">Period</th>
              <th className="pb-2 font-medium">Employees</th><th className="pb-2 font-medium">Net Pay</th>
              <th className="pb-2 font-medium">Status</th>
            </tr></thead>
            <tbody>
              {batches.map(b => (
                <tr key={b.id} className="border-b border-slate-50">
                  <td className="py-2.5 font-medium text-slate-700">{b.batchCode}</td>
                  <td className="py-2.5 text-slate-600">{MONTHS[b.month - 1]} {b.year}</td>
                  <td className="py-2.5 text-slate-600">{b.employeeCount}</td>
                  <td className="py-2.5 text-slate-700 font-medium">LKR {fmt(b.totalNet)}</td>
                  <td className="py-2.5"><Badge status={b.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

/* ═══════════════════════════ COMPONENTS ═══════════════════════════ */

function ComponentsTab() {
  const [components, setComponents] = useState<Component[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Component | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<Component[]>("/api/payroll/components").then(setComponents).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleEdit(c: Component) { setEditing(c); setShowForm(true); }
  async function handleDelete(id: string) {
    if (!confirm("Delete this component?")) return;
    await apiFetch(`/api/payroll/components/${id}`, { method: "DELETE" });
    load();
  }

  if (loading) return <Loading />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Compensation Components</h2>
        <Button onClick={() => { setEditing(null); setShowForm(true); }}>+ Add Component</Button>
      </div>

      {components.length === 0 ? <EmptyState text="No components defined yet. Add your first component." /> : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b bg-slate-50 text-xs text-slate-500">
              <th className="px-4 py-3 font-medium">Name</th><th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Type</th><th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Tax</th><th className="px-4 py-3 font-medium">Formula</th>
              <th className="px-4 py-3 font-medium">Order</th><th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr></thead>
            <tbody>
              {components.map(c => (
                <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium text-slate-700">{c.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.code}</td>
                  <td className="px-4 py-3 text-slate-600">{c.type}</td>
                  <td className="px-4 py-3 text-slate-600">{c.category}</td>
                  <td className="px-4 py-3">{c.isTaxable ? <span className="text-amber-600">Taxable</span> : <span className="text-slate-400">No</span>}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.formulaExpression || "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{c.sortOrder}</td>
                  <td className="px-4 py-3">{c.isActive ? <span className="text-green-600">Active</span> : <span className="text-slate-400">Inactive</span>}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => handleEdit(c)} className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50">Edit</button>
                      <button onClick={() => handleDelete(c.id)} className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <ComponentFormModal editing={editing} onClose={() => setShowForm(false)} onSaved={load} />}
    </div>
  );
}

function ComponentFormModal({ editing, onClose, onSaved }: { editing: Component | null; onClose: () => void; onSaved: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(""); setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: fd.get("name"), code: fd.get("code"), type: fd.get("type"), category: fd.get("category"),
      isTaxable: fd.get("isTaxable") === "true", isStatutory: fd.get("isStatutory") === "true",
      description: fd.get("description") || null, formulaExpression: fd.get("formulaExpression") || null,
      dependsOnComponentCode: fd.get("dependsOnComponentCode") || null,
      sortOrder: Number(fd.get("sortOrder") || 0),
      isEmployerContribution: fd.get("isEmployerContribution") === "true",
      isActive: editing ? fd.get("isActive") === "true" : true,
    };
    try {
      if (editing) {
        await apiFetch(`/api/payroll/components/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await apiFetch("/api/payroll/components", { method: "POST", body: JSON.stringify(payload) });
      }
      onSaved(); onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally { setSubmitting(false); }
  }

  return (
    <Modal open onClose={onClose} title={editing ? "Edit Component" : "Add Component"} wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className={labelCls}>Name *</label><input name="name" required className={inputCls} defaultValue={editing?.name} /></div>
          <div><label className={labelCls}>Code *</label><input name="code" required className={inputCls} defaultValue={editing?.code} placeholder="e.g. BASIC" /></div>
          <div><label className={labelCls}>Type *</label>
            <select name="type" className={inputCls} defaultValue={editing?.type || "Earning"}>
              <option>Earning</option><option>Deduction</option><option>StatutoryDeduction</option><option>StatutoryContribution</option>
            </select>
          </div>
          <div><label className={labelCls}>Category *</label>
            <select name="category" className={inputCls} defaultValue={editing?.category || "Fixed"}>
              <option>Fixed</option><option>Variable</option><option>Statutory</option><option>OneTime</option>
            </select>
          </div>
          <div><label className={labelCls}>Taxable</label>
            <select name="isTaxable" className={inputCls} defaultValue={String(editing?.isTaxable ?? false)}>
              <option value="false">No</option><option value="true">Yes</option>
            </select>
          </div>
          <div><label className={labelCls}>Statutory</label>
            <select name="isStatutory" className={inputCls} defaultValue={String(editing?.isStatutory ?? false)}>
              <option value="false">No</option><option value="true">Yes</option>
            </select>
          </div>
          <div><label className={labelCls}>Employer Contribution</label>
            <select name="isEmployerContribution" className={inputCls} defaultValue={String(editing?.isEmployerContribution ?? false)}>
              <option value="false">No</option><option value="true">Yes</option>
            </select>
          </div>
          <div><label className={labelCls}>Sort Order</label><input name="sortOrder" type="number" className={inputCls} defaultValue={editing?.sortOrder ?? 0} /></div>
        </div>
        <div><label className={labelCls}>Formula Expression</label><input name="formulaExpression" className={inputCls} defaultValue={editing?.formulaExpression ?? ""} placeholder="e.g. BASIC * 0.08" /></div>
        <div><label className={labelCls}>Depends On Component Code</label><input name="dependsOnComponentCode" className={inputCls} defaultValue={editing?.dependsOnComponentCode ?? ""} /></div>
        <div><label className={labelCls}>Description</label><textarea name="description" className={inputCls} rows={2} defaultValue={editing?.description ?? ""} /></div>
        {editing && (
          <div><label className={labelCls}>Active</label>
            <select name="isActive" className={inputCls} defaultValue={String(editing.isActive)}>
              <option value="true">Active</option><option value="false">Inactive</option>
            </select>
          </div>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : editing ? "Update" : "Create"}</Button>
        </div>
      </form>
    </Modal>
  );
}

/* ═══════════════════════ EMPLOYEE SALARY ═══════════════════════ */

interface SalaryEmployee { id: string; firstName: string; lastName: string; employeeCode: string; department: string; grade: string; location: string; }

function EmployeeSalaryTab() {
  const [allEmployees, setAllEmployees] = useState<SalaryEmployee[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterGrade, setFilterGrade] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [selectedEmp, setSelectedEmp] = useState<SalaryEmployee | null>(null);
  const [empComp, setEmpComp] = useState<EmpComp[]>([]);
  const [components, setComponents] = useState<Component[]>([]);
  const [showAssign, setShowAssign] = useState(false);
  const [editingComp, setEditingComp] = useState<EmpComp | null>(null);
  const [compLoading, setCompLoading] = useState(false);
  const [compTab, setCompTab] = useState<"Fixed" | "Variable">("Fixed");
  const [showImport, setShowImport] = useState(false);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState("");

  useEffect(() => {
    apiFetch<Component[]>("/api/payroll/components").then(setComponents).catch(() => {});
    apiFetch<PagedResult<Batch>>("/api/payroll/batches?pageSize=50").then(d => {
      setBatches(d.items);
      const draft = d.items.find(b => b.status === "Draft" || b.status === "Calculated");
      if (draft) setSelectedBatchId(draft.id);
    }).catch(() => {});
    setListLoading(true);
    apiFetch<SalaryEmployee[]>("/api/payroll/active-employees")
      .then(setAllEmployees).catch(() => {}).finally(() => setListLoading(false));
  }, []);

  const departments = Array.from(new Set(allEmployees.map(e => e.department).filter(Boolean))).sort();
  const grades = Array.from(new Set(allEmployees.map(e => e.grade).filter(Boolean))).sort();
  const locations = Array.from(new Set(allEmployees.map(e => e.location).filter(Boolean))).sort();

  const filtered = allEmployees.filter(e => {
    if (filterDept && e.department !== filterDept) return false;
    if (filterGrade && e.grade !== filterGrade) return false;
    if (filterLocation && e.location !== filterLocation) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!e.firstName.toLowerCase().includes(q) && !e.lastName.toLowerCase().includes(q)
        && !e.employeeCode.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  function selectEmployee(emp: SalaryEmployee) {
    setSelectedEmp(emp);
    setCompLoading(true);
    apiFetch<EmpComp[]>(`/api/payroll/compensation/${emp.id}`)
      .then(setEmpComp).catch(() => {}).finally(() => setCompLoading(false));
  }

  async function handleRemove(id: string) {
    if (!confirm("Remove this compensation line?")) return;
    await apiFetch(`/api/payroll/compensation/line/${id}`, { method: "DELETE" });
    if (selectedEmp) selectEmployee(selectedEmp);
  }

  const totalEarnings = empComp.filter(c => c.componentType === "Earning").reduce((s, c) => s + c.amount, 0);
  const totalDeductions = empComp.filter(c => c.componentType !== "Earning").reduce((s, c) => s + c.amount, 0);

  if (listLoading) return <Loading />;

  return (
    <div className="flex gap-4" style={{ minHeight: 500 }}>
      {/* Employee list */}
      <div className="w-[340px] shrink-0 space-y-2">
        <input className={inputCls + " !mb-0"} placeholder="Search name or code..." value={search} onChange={e => setSearch(e.target.value)} />
        <div className="flex gap-1.5">
          <select className={inputCls + " !mb-0 !py-1.5 !text-xs"} value={filterDept} onChange={e => setFilterDept(e.target.value)}>
            <option value="">All Depts</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select className={inputCls + " !mb-0 !py-1.5 !text-xs"} value={filterGrade} onChange={e => setFilterGrade(e.target.value)}>
            <option value="">All Grades</option>
            {grades.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select className={inputCls + " !mb-0 !py-1.5 !text-xs"} value={filterLocation} onChange={e => setFilterLocation(e.target.value)}>
            <option value="">All Locations</option>
            {locations.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div className="text-xs text-slate-400">{filtered.length} employee{filtered.length !== 1 ? "s" : ""}</div>
        <div className="max-h-[420px] overflow-y-auto rounded-lg border border-slate-200">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-slate-400">No employees match filters</div>
          ) : filtered.map(emp => (
            <button key={emp.id} onClick={() => selectEmployee(emp)}
              className={`flex w-full items-center gap-2 border-b border-slate-50 px-3 py-2.5 text-left text-sm transition-colors hover:bg-slate-50 ${selectedEmp?.id === emp.id ? "bg-blue-50 border-l-2 border-l-blue-500" : ""}`}>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-slate-700">{emp.firstName} {emp.lastName}</div>
                <div className="truncate text-xs text-slate-400">{emp.employeeCode} · {emp.department}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Compensation details */}
      <div className="flex-1 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5">
            {(["Fixed", "Variable"] as const).map(t => (
              <button key={t} onClick={() => setCompTab(t)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${compTab === t ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                {t}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {compTab === "Variable" && (
              <select className={inputCls + " !mb-0 !py-1.5 !text-xs w-auto min-w-[180px]"} value={selectedBatchId}
                onChange={e => setSelectedBatchId(e.target.value)}>
                <option value="">Select Batch...</option>
                {batches.map(b => <option key={b.id} value={b.id}>{b.batchCode} — {MONTHS[b.month - 1]} {b.year}</option>)}
              </select>
            )}
            <Button variant="secondary" onClick={() => setShowImport(true)}
              disabled={compTab === "Variable" && !selectedBatchId}>Import</Button>
          </div>
        </div>

        {compTab === "Variable" && !selectedBatchId ? (
          <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 py-20 text-sm text-slate-400">
            Select a payroll batch above to view variable components
          </div>
        ) : !selectedEmp ? (
          <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 py-20 text-sm text-slate-400">
            Select an employee to view their compensation
          </div>
        ) : (
          <CompensationTable
            title={`${selectedEmp.firstName} ${selectedEmp.lastName} — ${selectedEmp.employeeCode}`}
            items={empComp.filter(c => compTab === "Fixed"
              ? c.componentCategory === "Fixed" || c.componentCategory === "Statutory" || c.componentCategory === "OneTime"
              : c.componentCategory === "Variable" && (selectedBatchId ? c.batchId === selectedBatchId : true)
            )}
            allItems={empComp.filter(c => c.componentCategory !== "Variable" || (selectedBatchId ? c.batchId === selectedBatchId : true))}
            loading={compLoading}
            onAssign={() => setShowAssign(true)}
            onEdit={setEditingComp}
            onRemove={handleRemove}
          />
        )}
      </div>

      {showAssign && selectedEmp && (
        <AssignComponentModal empId={selectedEmp.id} components={components.filter(c => c.category === compTab)}
          batchId={compTab === "Variable" ? selectedBatchId : undefined}
          onClose={() => setShowAssign(false)}
          onSaved={() => selectEmployee(selectedEmp)} />
      )}

      {editingComp && selectedEmp && (
        <EditCompensationModal comp={editingComp} onClose={() => setEditingComp(null)}
          onSaved={() => selectEmployee(selectedEmp)} />
      )}

      {showImport && (
        <ImportCompensationModal category={compTab}
          batchId={compTab === "Variable" ? selectedBatchId : undefined}
          onClose={() => setShowImport(false)}
          onImported={() => { setShowImport(false); if (selectedEmp) selectEmployee(selectedEmp); }} />
      )}
    </div>
  );
}

function CompensationTable({ title, items, allItems, loading, onAssign, onEdit, onRemove }: {
  title: string; items: EmpComp[]; allItems: EmpComp[]; loading: boolean;
  onAssign: () => void; onEdit: (c: EmpComp) => void; onRemove: (id: string) => void;
}) {
  const totalEarnings = allItems.filter(c => c.componentType === "Earning").reduce((s, c) => s + c.amount, 0);
  const totalDeductions = allItems.filter(c => c.componentType !== "Earning").reduce((s, c) => s + c.amount, 0);

  return (
    <Card title={title}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-4 text-sm">
          <span className="text-green-700">Earnings: LKR {fmt(totalEarnings)}</span>
          <span className="text-red-600">Deductions: LKR {fmt(totalDeductions)}</span>
          <span className="font-semibold text-slate-800">Net: LKR {fmt(totalEarnings - totalDeductions)}</span>
        </div>
        <Button onClick={onAssign}>+ Assign</Button>
      </div>

      {loading ? <Loading /> : items.length === 0 ? <EmptyState text="No components in this category." /> : (
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b text-xs text-slate-400">
            <th className="pb-2 font-medium">Component</th><th className="pb-2 font-medium">Type</th>
            <th className="pb-2 font-medium text-right">Amount</th><th className="pb-2 font-medium">Effective</th>
            <th className="pb-2 font-medium">Actions</th>
          </tr></thead>
          <tbody>
            {items.map(c => (
              <tr key={c.id} className="border-b border-slate-50">
                <td className="py-2.5 font-medium text-slate-700">{c.componentName} <span className="text-xs text-slate-400">({c.componentCode})</span></td>
                <td className="py-2.5 text-slate-600">{c.componentType}</td>
                <td className="py-2.5 text-right font-mono text-slate-700">LKR {fmt(c.amount)}</td>
                <td className="py-2.5 text-xs text-slate-500">{formatDate(c.effectiveFrom)}</td>
                <td className="py-2.5">
                  <div className="flex gap-1">
                    <button onClick={() => onEdit(c)} className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50">Edit</button>
                    <button onClick={() => onRemove(c.id)} className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50">Remove</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function ImportCompensationModal({ category, batchId, onClose, onImported }: { category: string; batchId?: string; onClose: () => void; onImported: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split("T")[0]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number; errors: string[] } | null>(null);
  const [error, setError] = useState("");

  async function downloadTemplate() {
    const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    const res = await fetch(`${API_BASE_URL}/api/payroll/compensation/import-template?category=${category}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) { setError("Failed to download template"); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `compensation_${category.toLowerCase()}_template.xlsx`; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true); setError(""); setResult(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
      const batchParam = batchId ? `&batchId=${batchId}` : "";
      const res = await fetch(
        `${API_BASE_URL}/api/payroll/compensation/import?effectiveFrom=${effectiveFrom}${batchParam}`,
        { method: "POST", body: fd, headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.message || "Import failed"); }
      const data = await res.json();
      setResult(data);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Import failed"); }
    finally { setUploading(false); }
  }

  return (
    <Modal open onClose={onClose} title={`Import ${category} Components`}>
      <div className="space-y-4">
        {error && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}

        <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
          <p className="mb-2 font-medium text-slate-700">How to import:</p>
          <ol className="ml-4 list-decimal space-y-1">
            <li>Download the template with component codes as column headers</li>
            <li>Fill in employee codes in the first column and amounts under each component</li>
            <li>Upload the completed file. Existing assignments will be updated, new ones created.</li>
          </ol>
        </div>

        <button onClick={downloadTemplate} className="text-sm font-medium text-blue-600 hover:underline">
          Download {category} Template (.xlsx)
        </button>

        <div><label className={labelCls}>Effective From *</label>
          <DatePickerField className={inputCls} value={effectiveFrom} onChange={setEffectiveFrom} />
        </div>

        <div><label className={labelCls}>Upload File (.xlsx)</label>
          <input type="file" accept=".xlsx,.xls" className={inputCls} onChange={e => setFile(e.target.files?.[0] || null)} />
        </div>

        {result && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm">
            <p className="font-medium text-green-800">Import Complete</p>
            <p className="text-green-700">{result.created} created, {result.updated} updated, {result.skipped} skipped</p>
            {result.errors.length > 0 && (
              <div className="mt-2 max-h-24 overflow-y-auto text-xs text-red-600">
                {result.errors.map((e, i) => <div key={i}>{e}</div>)}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          {result ? (
            <Button onClick={onImported}>Done</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
              <Button onClick={handleUpload} disabled={!file || uploading}>
                {uploading ? "Importing..." : "Upload & Import"}
              </Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

function EditCompensationModal({ comp, onClose, onSaved }: { comp: EmpComp; onClose: () => void; onSaved: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true); setError("");
    const fd = new FormData(e.currentTarget as HTMLFormElement);
    const payload = {
      amount: Number(fd.get("amount")),
      currency: fd.get("currency") || "LKR",
      effectiveFrom: fd.get("effectiveFrom"),
      effectiveTo: fd.get("effectiveTo") || null,
    };
    try {
      await apiFetch(`/api/payroll/compensation/line/${comp.id}`, { method: "PUT", body: JSON.stringify(payload) });
      onSaved(); onClose();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed"); }
    finally { setSubmitting(false); }
  }

  return (
    <Modal open onClose={onClose} title={`Edit — ${comp.componentName}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}
        <div><label className={labelCls}>Amount *</label><input name="amount" type="number" step="0.01" required className={inputCls} defaultValue={comp.amount} /></div>
        <div><label className={labelCls}>Currency</label><input name="currency" className={inputCls} defaultValue={comp.currency || "LKR"} /></div>
        <div><label className={labelCls}>Effective From *</label><DatePickerField key={comp.id} name="effectiveFrom" required className={inputCls} defaultValue={comp.effectiveFrom?.slice(0, 10) ?? ""} /></div>
        <div><label className={labelCls}>Effective To</label><DatePickerField key={`${comp.id}-to`} name="effectiveTo" className={inputCls} defaultValue={comp.effectiveTo?.slice(0, 10) ?? ""} /></div>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : "Update"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function AssignComponentModal({ empId, components, batchId, onClose, onSaved }: { empId: string; components: Component[]; batchId?: string; onClose: () => void; onSaved: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(""); setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {
      componentId: fd.get("componentId"), amount: Number(fd.get("amount")),
      currency: "LKR", effectiveFrom: fd.get("effectiveFrom"),
    };
    if (batchId) payload.batchId = batchId;
    try {
      await apiFetch(`/api/payroll/compensation/${empId}`, { method: "POST", body: JSON.stringify(payload) });
      onSaved(); onClose();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed"); }
    finally { setSubmitting(false); }
  }

  return (
    <Modal open onClose={onClose} title="Assign Component">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}
        <div><label className={labelCls}>Component *</label>
          <select name="componentId" required className={inputCls}>
            <option value="">Select component...</option>
            {components.filter(c => c.isActive).map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
          </select>
        </div>
        <div><label className={labelCls}>Amount (LKR) *</label>
          <input name="amount" type="number" step="0.01" required className={inputCls} />
        </div>
        <div><label className={labelCls}>Effective From *</label>
          <DatePickerField name="effectiveFrom" required className={inputCls} defaultValue={new Date().toISOString().split("T")[0]} />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : "Assign"}</Button>
        </div>
      </form>
    </Modal>
  );
}

/* ═══════════════════════ VARIABLE ENTRY ═══════════════════════ */

interface VarEntry {
  id: string; employeeId: string; componentId: string; amount: number; currency: string;
  employeeName: string; employeeCode: string; department: string;
  componentName: string; componentCode: string;
}

function VariableEntryTab() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [components, setComponents] = useState<Component[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [selectedCompId, setSelectedCompId] = useState("");
  const [entries, setEntries] = useState<VarEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editedAmounts, setEditedAmounts] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    apiFetch<PagedResult<Batch>>("/api/payroll/batches?pageSize=200").then(d => {
      const list = d.items ?? [];
      setBatches(list);
      if (list.length > 0) setSelectedBatchId(list[0].id);
    }).catch(() => {});
    apiFetch<Component[]>("/api/payroll/components").then(c => {
      const varComps = c.filter(x => x.category === "Variable" && x.isActive);
      setComponents(varComps);
    }).catch(() => {});
  }, []);

  const loadEntries = useCallback(async () => {
    if (!selectedBatchId) return;
    setLoading(true);
    try {
      const url = selectedCompId
        ? `/api/payroll/compensation/variable?batchId=${selectedBatchId}&componentId=${selectedCompId}`
        : `/api/payroll/compensation/variable?batchId=${selectedBatchId}`;
      const data = await apiFetch<VarEntry[]>(url);
      setEntries(data);
      setEditedAmounts({});
    } catch { setEntries([]); }
    finally { setLoading(false); }
  }, [selectedBatchId, selectedCompId]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  function handleAmountChange(id: string, value: string) {
    setEditedAmounts(prev => ({ ...prev, [id]: value }));
  }

  const dirtyCount = Object.keys(editedAmounts).length;

  async function handleSave() {
    if (dirtyCount === 0) return;
    setSaving(true); setMsg(null);
    try {
      const updates = Object.entries(editedAmounts).map(([id, val]) => ({
        id, amount: parseFloat(val) || 0,
      }));
      await apiFetch("/api/payroll/compensation/variable/bulk", {
        method: "PUT",
        body: JSON.stringify({ updates }),
      });
      setMsg({ text: `${updates.length} record(s) updated successfully.`, ok: true });
      await loadEntries();
    } catch { setMsg({ text: "Failed to save changes.", ok: false }); }
    finally { setSaving(false); }
  }

  const filtered = entries.filter(e => {
    if (!search) return true;
    const s = search.toLowerCase();
    return e.employeeName.toLowerCase().includes(s) || e.employeeCode.toLowerCase().includes(s)
      || e.componentName.toLowerCase().includes(s) || e.department.toLowerCase().includes(s);
  });

  const total = filtered.reduce((s, e) => s + (editedAmounts[e.id] !== undefined ? (parseFloat(editedAmounts[e.id]) || 0) : e.amount), 0);

  const selectedBatch = batches.find(b => b.id === selectedBatchId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px]">
          <label className={labelCls}>Payroll Batch</label>
          <select className={inputCls} value={selectedBatchId} onChange={e => setSelectedBatchId(e.target.value)}>
            <option value="">-- Select Batch --</option>
            {batches.map(b => (
              <option key={b.id} value={b.id}>{b.batchCode} — {MONTHS[b.month - 1]} {b.year}</option>
            ))}
          </select>
        </div>
        <div className="min-w-[220px]">
          <label className={labelCls}>Component</label>
          <select className={inputCls} value={selectedCompId} onChange={e => setSelectedCompId(e.target.value)}>
            <option value="">All Variable Components</option>
            {components.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
            ))}
          </select>
        </div>
        <div className="min-w-[200px]">
          <label className={labelCls}>Search</label>
          <input className={inputCls} placeholder="Name, code, department..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="ml-auto flex items-center gap-2">
          {dirtyCount > 0 && (
            <span className="text-xs text-amber-600 font-medium">{dirtyCount} unsaved change{dirtyCount !== 1 ? "s" : ""}</span>
          )}
          <Button onClick={handleSave} disabled={saving || dirtyCount === 0}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {selectedBatch && (
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span>Batch: <strong className="text-slate-700">{selectedBatch.batchCode}</strong></span>
          <span>Status: <Badge status={selectedBatch.status} /></span>
          <span>Period: <strong className="text-slate-700">{MONTHS[selectedBatch.month - 1]} {selectedBatch.year}</strong></span>
        </div>
      )}

      {msg && (
        <div className={`rounded-lg px-4 py-2 text-sm ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{msg.text}</div>
      )}

      {!selectedBatchId ? (
        <EmptyState text="Select a payroll batch to view variable components" />
      ) : loading ? (
        <Loading />
      ) : filtered.length === 0 ? (
        <EmptyState text={entries.length === 0 ? "No variable components assigned for this batch" : "No matching records found"} />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">#</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Employee Code</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Employee Name</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Department</th>
                  {!selectedCompId && <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Component</th>}
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500">Amount</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, i) => {
                  const edited = editedAmounts[e.id];
                  const isDirty = edited !== undefined;
                  return (
                    <tr key={e.id} className={`border-b border-slate-50 ${isDirty ? "bg-amber-50/40" : "hover:bg-slate-50/50"}`}>
                      <td className="px-4 py-2 text-slate-400">{i + 1}</td>
                      <td className="px-4 py-2 font-mono text-xs">{e.employeeCode}</td>
                      <td className="px-4 py-2 font-medium text-slate-700">{e.employeeName}</td>
                      <td className="px-4 py-2 text-slate-500">{e.department}</td>
                      {!selectedCompId && <td className="px-4 py-2 text-slate-500">{e.componentName} <span className="text-slate-400">({e.componentCode})</span></td>}
                      <td className="px-4 py-2 text-right">
                        <input type="number" step="0.01" className="w-32 rounded border border-slate-200 px-2 py-1 text-right text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                          value={isDirty ? edited : e.amount}
                          onChange={ev => handleAmountChange(e.id, ev.target.value)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50 font-semibold">
                  <td colSpan={selectedCompId ? 4 : 5} className="px-4 py-2.5 text-right text-xs text-slate-600">
                    Total ({filtered.length} record{filtered.length !== 1 ? "s" : ""})
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm text-slate-800">{fmt(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════ PAYROLL RUN ═══════════════════════════ */

function PayrollRunTab() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [batchStatements, setBatchStatements] = useState<Statement[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<PagedResult<Batch>>("/api/payroll/batches?pageSize=50").then(d => setBatches(d.items)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAction(batchId: string, action: string) {
    setActionLoading(batchId);
    try {
      if (action === "calculate") {
        await apiFetch(`/api/payroll/batches/${batchId}/calculate`, { method: "POST" });
      } else if (action === "approve") {
        await apiFetch(`/api/payroll/batches/${batchId}/approve`, { method: "PUT" });
      } else if (action === "finalize") {
        await apiFetch(`/api/payroll/batches/${batchId}/finalize`, { method: "PUT" });
      } else if (action === "delete") {
        if (!confirm("Delete this batch?")) { setActionLoading(null); return; }
        await apiFetch(`/api/payroll/batches/${batchId}`, { method: "DELETE" });
      }
      load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Action failed");
    } finally { setActionLoading(null); }
  }

  async function viewBatchDetails(batch: Batch) {
    setSelectedBatch(batch);
    const data = await apiFetch<PagedResult<Statement>>(`/api/payroll/statements?pageSize=200`);
    setBatchStatements(data.items.filter(s => s.batchId === batch.id));
  }

  if (loading) return <Loading />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Payroll Batches</h2>
        <Button onClick={() => setShowCreate(true)}>+ New Batch</Button>
      </div>

      {batches.length === 0 ? <EmptyState text="No payroll batches yet. Create one to start." /> : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b bg-slate-50 text-xs text-slate-500">
              <th className="px-4 py-3 font-medium">Batch</th><th className="px-4 py-3 font-medium">Period</th>
              <th className="px-4 py-3 font-medium">Employees</th><th className="px-4 py-3 font-medium text-right">Gross</th>
              <th className="px-4 py-3 font-medium text-right">Net</th><th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr></thead>
            <tbody>
              {batches.map(b => (
                <tr key={b.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-4 py-3">
                    <button onClick={() => viewBatchDetails(b)} className="font-medium text-blue-600 hover:underline">{b.batchCode}</button>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{MONTHS[b.month - 1]} {b.year}</td>
                  <td className="px-4 py-3 text-slate-600">{b.status === "Draft" ? `${b.selectedCount} selected` : b.employeeCount}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700">{b.totalGross ? `LKR ${fmt(b.totalGross)}` : "—"}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700">{b.totalNet ? `LKR ${fmt(b.totalNet)}` : "—"}</td>
                  <td className="px-4 py-3"><Badge status={b.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {b.status === "Draft" && <ActionBtn label="Calculate" onClick={() => handleAction(b.id, "calculate")} loading={actionLoading === b.id} />}
                      {b.status === "Calculated" && <ActionBtn label="Recalculate" onClick={() => handleAction(b.id, "calculate")} loading={actionLoading === b.id} />}
                      {b.status === "Calculated" && <ActionBtn label="Approve" onClick={() => handleAction(b.id, "approve")} loading={actionLoading === b.id} />}
                      {b.status === "Approved" && <ActionBtn label="Finalize" onClick={() => handleAction(b.id, "finalize")} loading={actionLoading === b.id} />}
                      {(b.status === "Draft" || b.status === "Calculated") && <button onClick={() => handleAction(b.id, "delete")} className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50">Delete</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <CreateBatchModal onClose={() => setShowCreate(false)} onCreated={load} />}

      {selectedBatch && (
        <BatchDetailModal batch={selectedBatch} statements={batchStatements} onClose={() => setSelectedBatch(null)} />
      )}
    </div>
  );
}

function CreateBatchModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [notes, setNotes] = useState("");

  const [employees, setEmployees] = useState<EligibleEmployee[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterGrade, setFilterGrade] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [empLoading, setEmpLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (step !== 2) return;
    setEmpLoading(true);
    apiFetch<EligibleEmployee[]>("/api/payroll/eligible-employees")
      .then(emps => { setEmployees(emps); setSelected(new Set(emps.map(e => e.id))); })
      .catch(() => setError("Failed to load employees"))
      .finally(() => setEmpLoading(false));
  }, [step]);

  const departments = Array.from(new Set(employees.map(e => e.department).filter(Boolean))).sort();
  const grades = Array.from(new Set(employees.map(e => e.grade).filter(Boolean))).sort();
  const locations = Array.from(new Set(employees.map(e => e.location).filter(Boolean))).sort();

  const filtered = employees.filter(e => {
    if (filterDept && e.department !== filterDept) return false;
    if (filterGrade && e.grade !== filterGrade) return false;
    if (filterLocation && e.location !== filterLocation) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return e.firstName.toLowerCase().includes(q) || e.lastName.toLowerCase().includes(q)
      || e.employeeCode.toLowerCase().includes(q) || e.department.toLowerCase().includes(q);
  });

  const allFilteredSelected = filtered.length > 0 && filtered.every(e => selected.has(e.id));

  function toggleAll() {
    const next = new Set(selected);
    if (allFilteredSelected) { filtered.forEach(e => next.delete(e.id)); } else { filtered.forEach(e => next.add(e.id)); }
    setSelected(next);
  }

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }

  async function handleCreate() {
    if (selected.size === 0) { setError("Select at least one employee"); return; }
    setSubmitting(true); setError("");
    try {
      await apiFetch("/api/payroll/batches", {
        method: "POST",
        body: JSON.stringify({ month, year, notes: notes || null, employeeIds: Array.from(selected) }),
      });
      onCreated(); onClose();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed"); }
    finally { setSubmitting(false); }
  }

  return (
    <Modal open onClose={onClose} title={step === 1 ? "New Payroll Batch" : `Select Employees — ${MONTHS[month - 1]} ${year}`} wide={step === 2}>
      {error && <div className="mb-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}

      {step === 1 && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className={labelCls}>Month *</label>
              <select className={inputCls} value={month} onChange={e => setMonth(Number(e.target.value))}>
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Year *</label><input type="number" className={inputCls} value={year} onChange={e => setYear(Number(e.target.value))} /></div>
          </div>
          <div><label className={labelCls}>Notes</label><textarea className={inputCls} rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={() => setStep(2)}>Next — Select Employees</Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input className={inputCls + " !mb-0 min-w-[180px] flex-1"} placeholder="Search name or code..."
              value={search} onChange={e => setSearch(e.target.value)} />
            <select className={inputCls + " !mb-0 w-auto min-w-[140px]"} value={filterDept} onChange={e => setFilterDept(e.target.value)}>
              <option value="">All Departments</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select className={inputCls + " !mb-0 w-auto min-w-[120px]"} value={filterGrade} onChange={e => setFilterGrade(e.target.value)}>
              <option value="">All Grades</option>
              {grades.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <select className={inputCls + " !mb-0 w-auto min-w-[130px]"} value={filterLocation} onChange={e => setFilterLocation(e.target.value)}>
              <option value="">All Locations</option>
              {locations.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <span className="whitespace-nowrap text-sm text-slate-500">{selected.size}/{employees.length} selected</span>
          </div>

          {empLoading ? <Loading /> : (
            <div className="max-h-[400px] overflow-y-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="border-b text-xs text-slate-500">
                    <th className="px-3 py-2.5"><input type="checkbox" checked={allFilteredSelected} onChange={toggleAll} className="rounded" /></th>
                    <th className="px-3 py-2.5 font-medium">Employee</th>
                    <th className="px-3 py-2.5 font-medium">Code</th>
                    <th className="px-3 py-2.5 font-medium">Department</th>
                    <th className="px-3 py-2.5 font-medium">Grade</th>
                    <th className="px-3 py-2.5 font-medium">Location</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">No employees match the current filters</td></tr>
                  ) : filtered.map(e => (
                    <tr key={e.id} className="border-b border-slate-50 hover:bg-slate-50/50 cursor-pointer" onClick={() => toggle(e.id)}>
                      <td className="px-3 py-2"><input type="checkbox" checked={selected.has(e.id)} onChange={() => toggle(e.id)} className="rounded" /></td>
                      <td className="px-3 py-2 font-medium text-slate-700">{e.firstName} {e.lastName}</td>
                      <td className="px-3 py-2 text-slate-500">{e.employeeCode}</td>
                      <td className="px-3 py-2 text-slate-500">{e.department}</td>
                      <td className="px-3 py-2 text-slate-500">{e.grade}</td>
                      <td className="px-3 py-2 text-slate-500">{e.location}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={handleCreate} disabled={submitting || selected.size === 0}>
              {submitting ? "Creating..." : `Create Batch (${selected.size} employees)`}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function BatchDetailModal({ batch, statements, onClose }: { batch: Batch; statements: Statement[]; onClose: () => void }) {
  const [selectedStmt, setSelectedStmt] = useState<Statement | null>(null);
  const [stmtDetail, setStmtDetail] = useState<Statement | null>(null);

  async function viewPayslip(stmt: Statement) {
    setSelectedStmt(stmt);
    const detail = await apiFetch<Statement>(`/api/payroll/statements/${stmt.id}`);
    setStmtDetail(detail);
  }

  return (
    <Modal open onClose={onClose} title={`Batch: ${batch.batchCode}`} wide>
      <div className="mb-4 grid gap-3 sm:grid-cols-4 text-sm">
        <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-400">Gross</div><div className="font-semibold">LKR {fmt(batch.totalGross)}</div></div>
        <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-400">Deductions</div><div className="font-semibold">LKR {fmt(batch.totalDeductions)}</div></div>
        <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-400">Net</div><div className="font-semibold">LKR {fmt(batch.totalNet)}</div></div>
        <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-400">Employer Cost</div><div className="font-semibold">LKR {fmt(batch.totalEmployerCost)}</div></div>
      </div>

      {statements.length === 0 ? <EmptyState text="No pay statements in this batch." /> : (
        <div className="max-h-[400px] overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b text-xs text-slate-400">
              <th className="pb-2 font-medium">Employee</th><th className="pb-2 font-medium text-right">Gross</th>
              <th className="pb-2 font-medium text-right">Deductions</th><th className="pb-2 font-medium text-right">Net</th>
              <th className="pb-2 font-medium">View</th>
            </tr></thead>
            <tbody>
              {statements.map(s => (
                <tr key={s.id} className="border-b border-slate-50">
                  <td className="py-2.5"><span className="font-medium text-slate-700">{s.employeeName}</span> <span className="text-xs text-slate-400">{s.employeeCode}</span></td>
                  <td className="py-2.5 text-right font-mono">LKR {fmt(s.grossPay)}</td>
                  <td className="py-2.5 text-right font-mono text-red-600">LKR {fmt(s.totalDeductions)}</td>
                  <td className="py-2.5 text-right font-mono font-semibold">LKR {fmt(s.netPay)}</td>
                  <td className="py-2.5"><button onClick={() => viewPayslip(s)} className="text-xs text-blue-600 hover:underline">Payslip</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {stmtDetail && stmtDetail.lines && (
        <PayslipModal statement={stmtDetail} onClose={() => { setStmtDetail(null); setSelectedStmt(null); }} />
      )}
    </Modal>
  );
}

function PayslipModal({ statement, onClose }: { statement: Statement; onClose: () => void }) {
  const earnings = statement.lines?.filter(l => l.type === "Earning" && !l.isEmployerContribution) || [];
  const deductions = statement.lines?.filter(l => (l.type === "Deduction" || l.type === "StatutoryDeduction") && !l.isEmployerContribution) || [];
  const employerItems = statement.lines?.filter(l => l.isEmployerContribution) || [];

  return (
    <Modal open onClose={onClose} title={`Payslip — ${statement.employeeName}`} wide>
      <div className="mb-4 text-sm text-slate-500">
        {MONTHS[statement.month - 1]} {statement.year} &middot; {statement.employeeCode} &middot; {statement.department || ""}
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-green-700">Earnings</h4>
          <table className="w-full text-sm">
            <tbody>
              {earnings.map(l => (
                <tr key={l.id} className="border-b border-slate-50">
                  <td className="py-1.5 text-slate-700">{l.componentName}</td>
                  <td className="py-1.5 text-right font-mono">LKR {fmt(l.amount)}</td>
                </tr>
              ))}
              <tr className="font-semibold"><td className="py-1.5">Total Earnings</td><td className="py-1.5 text-right font-mono">LKR {fmt(statement.totalEarnings)}</td></tr>
            </tbody>
          </table>
        </div>
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-red-600">Deductions</h4>
          <table className="w-full text-sm">
            <tbody>
              {deductions.map(l => (
                <tr key={l.id} className="border-b border-slate-50">
                  <td className="py-1.5 text-slate-700">{l.componentName}</td>
                  <td className="py-1.5 text-right font-mono">LKR {fmt(l.amount)}</td>
                </tr>
              ))}
              <tr className="font-semibold"><td className="py-1.5">Total Deductions</td><td className="py-1.5 text-right font-mono">LKR {fmt(statement.totalDeductions)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 p-4">
        <span className="text-lg font-bold text-slate-800">Net Pay</span>
        <span className="text-2xl font-bold text-green-700">LKR {fmt(statement.netPay)}</span>
      </div>
      {employerItems.length > 0 && (
        <div className="mt-4">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Employer Contributions</h4>
          <table className="w-full text-sm">
            <tbody>
              {employerItems.map(l => (
                <tr key={l.id} className="border-b border-slate-50">
                  <td className="py-1.5 text-slate-600">{l.componentName}</td>
                  <td className="py-1.5 text-right font-mono text-slate-600">LKR {fmt(l.amount)}</td>
                </tr>
              ))}
              <tr className="font-semibold"><td className="py-1.5">Total Employer Cost</td><td className="py-1.5 text-right font-mono">LKR {fmt(statement.employerCost)}</td></tr>
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

/* ═══════════════════════ PAY STATEMENTS ═══════════════════════ */

function PayStatementsTab() {
  const [statements, setStatements] = useState<Statement[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [viewStmt, setViewStmt] = useState<Statement | null>(null);
  const pageSize = 20;

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<PagedResult<Statement>>(`/api/payroll/statements?page=${page}&pageSize=${pageSize}`)
      .then(d => { setStatements(d.items); setTotalCount(d.totalCount); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [page]);

  useEffect(() => { load(); }, [load]);

  async function viewPayslip(stmt: Statement) {
    const detail = await apiFetch<Statement>(`/api/payroll/statements/${stmt.id}`);
    setViewStmt(detail);
  }

  if (loading) return <Loading />;

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-800">Pay Statements</h2>

      {statements.length === 0 ? <EmptyState text="No pay statements generated yet." /> : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b bg-slate-50 text-xs text-slate-500">
                <th className="px-4 py-3 font-medium">Employee</th><th className="px-4 py-3 font-medium">Period</th>
                <th className="px-4 py-3 font-medium text-right">Gross</th><th className="px-4 py-3 font-medium text-right">Deductions</th>
                <th className="px-4 py-3 font-medium text-right">Net Pay</th><th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">View</th>
              </tr></thead>
              <tbody>
                {statements.map(s => (
                  <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3"><span className="font-medium text-slate-700">{s.employeeName}</span><br/><span className="text-xs text-slate-400">{s.employeeCode}</span></td>
                    <td className="px-4 py-3 text-slate-600">{MONTHS[s.month - 1]} {s.year}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700">LKR {fmt(s.grossPay)}</td>
                    <td className="px-4 py-3 text-right font-mono text-red-600">LKR {fmt(s.totalDeductions)}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-slate-800">LKR {fmt(s.netPay)}</td>
                    <td className="px-4 py-3"><Badge status={s.status} /></td>
                    <td className="px-4 py-3"><button onClick={() => viewPayslip(s)} className="text-xs text-blue-600 hover:underline">Payslip</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="rounded border px-3 py-1 text-sm disabled:opacity-40">Prev</button>
              <span className="text-sm text-slate-500">Page {page} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="rounded border px-3 py-1 text-sm disabled:opacity-40">Next</button>
            </div>
          )}
        </>
      )}

      {viewStmt && viewStmt.lines && <PayslipModal statement={viewStmt} onClose={() => setViewStmt(null)} />}
    </div>
  );
}

/* ═══════════════════════════ SETTINGS ═══════════════════════════ */

function SettingsTab() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    apiFetch<Settings>("/api/payroll/settings").then(setSettings).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true); setMsg("");
    const fd = new FormData(e.currentTarget);
    const payload = {
      epfEmployeeRate: Number(fd.get("epfEmployeeRate")) / 100,
      epfEmployerRate: Number(fd.get("epfEmployerRate")) / 100,
      etfEmployerRate: Number(fd.get("etfEmployerRate")) / 100,
    };
    try {
      const result = await apiFetch<Settings>("/api/payroll/settings", { method: "PUT", body: JSON.stringify(payload) });
      setSettings(result);
      setMsg("Settings saved successfully.");
    } catch { setMsg("Failed to save settings."); }
    finally { setSaving(false); }
  }

  if (loading) return <Loading />;

  return (
    <div className="max-w-lg">
      <Card title="Statutory Rates">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelCls}>EPF Employee Rate (%)</label>
            <input name="epfEmployeeRate" type="number" step="0.01" className={inputCls}
              defaultValue={settings ? (settings.epfEmployeeRate * 100).toFixed(2) : "8"} />
          </div>
          <div>
            <label className={labelCls}>EPF Employer Rate (%)</label>
            <input name="epfEmployerRate" type="number" step="0.01" className={inputCls}
              defaultValue={settings ? (settings.epfEmployerRate * 100).toFixed(2) : "12"} />
          </div>
          <div>
            <label className={labelCls}>ETF Employer Rate (%)</label>
            <input name="etfEmployerRate" type="number" step="0.01" className={inputCls}
              defaultValue={settings ? (settings.etfEmployerRate * 100).toFixed(2) : "3"} />
          </div>
          {msg && <div className={`rounded-lg px-4 py-2 text-sm ${msg.includes("success") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{msg}</div>}
          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Settings"}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

/* ═══════════════════════ SHARED COMPONENTS ═══════════════════════ */

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="mb-4 text-sm font-semibold text-slate-700">{title}</h3>
      {children}
    </div>
  );
}

function Badge({ status }: { status: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeCls[status] || "bg-slate-100 text-slate-600"}`}>{status}</span>;
}

function ActionBtn({ label, onClick, loading }: { label: string; onClick: () => void; loading: boolean }) {
  return <button onClick={onClick} disabled={loading} className="rounded bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100 disabled:opacity-50">{loading ? "..." : label}</button>;
}

function Loading() {
  return <div className="flex items-center justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" /></div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">{text}</div>;
}
