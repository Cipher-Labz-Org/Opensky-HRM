"use client";

import { useState, useEffect, useCallback } from "react";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/date-utils";

interface TemplateItem {
  id: string;
  title: string;
  description: string | null;
  category: string;
  sortOrder: number;
  assignmentType: string;
  assignedToUserId: string | null;
  assignedToUserName: string | null;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  type: string;
  isActive: boolean;
  itemCount: number;
  items: TemplateItem[];
}

interface UserLookup {
  id: string;
  username: string;
  employeeName: string | null;
  departmentName: string | null;
}

interface DepartmentLookup {
  id: string;
  name: string;
}

interface ActiveTask {
  id: string;
  title: string;
  category: string;
  isCompleted: boolean;
  completedAt: string | null;
  assignmentType: string;
  assignedToUserId: string | null;
  assignedToUserName: string | null;
}

interface ActiveOffboarding {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  departmentName: string | null;
  terminationReason: string | null;
  terminationDate: string | null;
  totalTasks: number;
  completedTasks: number;
  tasks: ActiveTask[];
}

interface ActiveOnboarding {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  totalTasks: number;
  completedTasks: number;
  tasks: ActiveTask[];
}

type Tab = "templates" | "active" | "activeOnboarding";

const CATEGORIES = ["HR", "IT & Assets", "Finance", "Department", "Security", "Other"];
const inputClass = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100";
const labelClass = "mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wide";

export default function EmployeeTasksPage() {
  const [tab, setTab] = useState<Tab>("templates");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [users, setUsers] = useState<UserLookup[]>([]);
  const [actives, setActives] = useState<ActiveOffboarding[]>([]);
  const [activeOnboardings, setActiveOnboardings] = useState<ActiveOnboarding[]>([]);
  const [departments, setDepartments] = useState<DepartmentLookup[]>([]);

  // Template form
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [tplName, setTplName] = useState("");
  const [tplDesc, setTplDesc] = useState("");
  const [tplType, setTplType] = useState<"Onboarding" | "Offboarding">("Offboarding");
  const [tplActive, setTplActive] = useState(true);
  const [tplSaving, setTplSaving] = useState(false);

  // Item form
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemTemplateId, setItemTemplateId] = useState<string>("");
  const [itemTitle, setItemTitle] = useState("");
  const [itemDesc, setItemDesc] = useState("");
  const [itemCategory, setItemCategory] = useState("HR");
  const [itemSortOrder, setItemSortOrder] = useState(0);
  const [itemAssignmentType, setItemAssignmentType] = useState("User");
  const [itemAssignee, setItemAssignee] = useState("");
  const [itemSaving, setItemSaving] = useState(false);

  const [typeFilter, setTypeFilter] = useState<"All" | "Onboarding" | "Offboarding">("All");
  const [expandedEmp, setExpandedEmp] = useState<string | null>(null);
  const [expandedObEmp, setExpandedObEmp] = useState<string | null>(null);
  const [completing, setCompleting] = useState<string | null>(null);

  const getUsersForCategory = useCallback((category: string) => {
    const catLower = category.toLowerCase().trim();
    const matchedDept = departments.find(d => {
      const dName = d.name.toLowerCase();
      return dName === catLower
        || dName.startsWith(catLower)
        || catLower.split(/[\s&]+/).every(word => dName.includes(word));
    });
    if (!matchedDept) return users;
    return users.filter(u => u.departmentName?.toLowerCase() === matchedDept.name.toLowerCase());
  }, [users, departments]);

  const loadTemplates = useCallback(async () => {
    const [t, u, d] = await Promise.all([
      apiFetch<Template[]>("/api/employee-tasks/templates").catch(() => []),
      apiFetch<UserLookup[]>("/api/employee-tasks/users").catch(() => []),
      apiFetch<DepartmentLookup[]>("/api/organization/departments").catch(() => []),
    ]);
    setTemplates(t);
    setUsers(u);
    setDepartments(d);
  }, []);

  const loadActives = useCallback(async () => {
    const a = await apiFetch<ActiveOffboarding[]>("/api/offboarding/active").catch(() => []);
    setActives(a);
  }, []);

  const loadActiveOnboardings = useCallback(async () => {
    const a = await apiFetch<ActiveOnboarding[]>("/api/employee-tasks/onboarding/active").catch(() => []);
    setActiveOnboardings(a);
  }, []);

  useEffect(() => { loadTemplates(); loadActives(); loadActiveOnboardings(); }, [loadTemplates, loadActives, loadActiveOnboardings]);

  const filtered = typeFilter === "All" ? templates : templates.filter((t) => t.type === typeFilter);

  // ── Template CRUD ──────────────────────────────────────────

  function openCreateTemplate() {
    setEditingTemplateId(null);
    setTplName(""); setTplDesc(""); setTplType("Offboarding"); setTplActive(true);
    setShowTemplateModal(true);
  }

  function openEditTemplate(t: Template) {
    setEditingTemplateId(t.id);
    setTplName(t.name); setTplDesc(t.description ?? ""); setTplType(t.type as "Onboarding" | "Offboarding"); setTplActive(t.isActive);
    setShowTemplateModal(true);
  }

  async function handleSaveTemplate() {
    if (!tplName.trim()) return;
    setTplSaving(true);
    try {
      const payload = { name: tplName.trim(), description: tplDesc.trim() || null, type: tplType, isActive: tplActive };
      if (editingTemplateId) {
        await apiFetch(`/api/employee-tasks/templates/${editingTemplateId}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await apiFetch("/api/employee-tasks/templates", { method: "POST", body: JSON.stringify(payload) });
      }
      setShowTemplateModal(false);
      loadTemplates();
    } catch (err) { alert(err instanceof Error ? err.message : "Failed to save"); }
    setTplSaving(false);
  }

  async function handleDeleteTemplate(id: string) {
    if (!confirm("Delete this template and all its tasks?")) return;
    await apiFetch(`/api/employee-tasks/templates/${id}`, { method: "DELETE" }).catch(() => {});
    loadTemplates();
  }

  // ── Item CRUD ──────────────────────────────────────────────

  function openAddItem(templateId: string) {
    setEditingItemId(null);
    setItemTemplateId(templateId);
    setItemTitle(""); setItemDesc(""); setItemCategory("HR"); setItemSortOrder(0);
    setItemAssignmentType("User"); setItemAssignee("");
    setShowItemModal(true);
  }

  function openEditItem(templateId: string, item: TemplateItem) {
    setEditingItemId(item.id);
    setItemTemplateId(templateId);
    setItemTitle(item.title); setItemDesc(item.description ?? ""); setItemCategory(item.category);
    setItemSortOrder(item.sortOrder); setItemAssignmentType(item.assignmentType ?? "User");
    setItemAssignee(item.assignedToUserId ?? "");
    setShowItemModal(true);
  }

  async function handleSaveItem() {
    if (!itemTitle.trim()) return;
    setItemSaving(true);
    try {
      const payload = {
        title: itemTitle.trim(), description: itemDesc.trim() || null, category: itemCategory,
        sortOrder: itemSortOrder, assignmentType: itemAssignmentType,
        assignedToUserId: itemAssignmentType === "Supervisor" ? null : (itemAssignee || null),
      };
      if (editingItemId) {
        await apiFetch(`/api/employee-tasks/items/${editingItemId}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await apiFetch(`/api/employee-tasks/templates/${itemTemplateId}/items`, { method: "POST", body: JSON.stringify(payload) });
      }
      setShowItemModal(false);
      loadTemplates();
    } catch (err) { alert(err instanceof Error ? err.message : "Failed to save"); }
    setItemSaving(false);
  }

  async function handleDeleteItem(itemId: string) {
    if (!confirm("Remove this task from the template?")) return;
    await apiFetch(`/api/employee-tasks/items/${itemId}`, { method: "DELETE" }).catch(() => {});
    loadTemplates();
  }

  // ── Active task completion ─────────────────────────────────

  async function handleComplete(taskId: string, empId: string) {
    setCompleting(taskId);
    try {
      await apiFetch(`/api/offboarding/tasks/${taskId}/complete`, { method: "POST" });
      setActives((prev) => prev.map((a) => a.employeeId !== empId ? a : {
        ...a,
        completedTasks: a.completedTasks + 1,
        tasks: a.tasks.map((t) => t.id !== taskId ? t : { ...t, isCompleted: true, completedAt: new Date().toISOString() }),
      }));
    } catch { alert("Failed"); }
    setCompleting(null);
  }

  async function handleCompleteOnboarding(taskId: string, empId: string) {
    setCompleting(taskId);
    try {
      await apiFetch(`/api/employee-tasks/onboarding/tasks/${taskId}/complete`, { method: "POST" });
      setActiveOnboardings((prev) => prev.map((a) => a.employeeId !== empId ? a : {
        ...a,
        completedTasks: a.completedTasks + 1,
        tasks: a.tasks.map((t) => t.id !== taskId ? t : { ...t, isCompleted: true, completedAt: new Date().toISOString() }),
      }));
    } catch { alert("Failed"); }
    setCompleting(null);
  }

  return (
    <>
      <AppTopbar title="Employee Tasks" subtitle="Manage onboarding and offboarding task templates, and track active processes." />

      {/* ── Tab bar ───────────────────────────────────────────── */}
      <div className="mb-6 flex items-center gap-1 rounded-xl bg-slate-100 p-1 w-fit">
        {([["templates", "Task Templates"], ["activeOnboarding", "Active Onboardings"], ["active", "Active Offboardings"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`rounded-lg px-4 py-2 text-sm font-medium transition ${tab === key ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════
          TAB: TASK TEMPLATES
         ═══════════════════════════════════════════════════════ */}
      {tab === "templates" && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {(["All", "Onboarding", "Offboarding"] as const).map((f) => (
                <button key={f} onClick={() => setTypeFilter(f)} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition border ${
                  typeFilter === f
                    ? f === "Onboarding" ? "bg-green-50 border-green-300 text-green-700"
                      : f === "Offboarding" ? "bg-red-50 border-red-300 text-red-700"
                      : "bg-blue-50 border-blue-300 text-blue-700"
                    : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                }`}>{f}</button>
              ))}
            </div>
            <Button onClick={openCreateTemplate}>+ New Template</Button>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
              <p className="text-sm text-slate-400">No templates found. Create one to get started.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map((tpl) => {
                const isExpanded = expandedTemplate === tpl.id;
                return (
                  <div key={tpl.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 px-6 py-4 cursor-pointer hover:bg-slate-50 transition" onClick={() => setExpandedTemplate(isExpanded ? null : tpl.id)}>
                      <svg className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-800">{tpl.name}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${tpl.type === "Onboarding" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{tpl.type}</span>
                          {!tpl.isActive && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-400">Inactive</span>}
                        </div>
                        {tpl.description && <p className="text-xs text-slate-400 mt-0.5 truncate">{tpl.description}</p>}
                      </div>
                      <span className="text-xs text-slate-400">{tpl.itemCount} task{tpl.itemCount !== 1 ? "s" : ""}</span>
                      <button onClick={(e) => { e.stopPropagation(); openEditTemplate(tpl); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition" title="Edit template">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(tpl.id); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition" title="Delete template">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-slate-100">
                        {tpl.items.length === 0 ? (
                          <div className="px-6 py-6 text-center text-xs text-slate-400">No tasks in this template yet.</div>
                        ) : (
                          <table className="w-full text-left">
                            <thead><tr className="border-b border-slate-100 bg-slate-50/50">
                              <th className="px-6 py-2 text-[10px] font-semibold text-slate-400 uppercase">#</th>
                              <th className="px-2 py-2 text-[10px] font-semibold text-slate-400 uppercase">Task</th>
                              <th className="px-2 py-2 text-[10px] font-semibold text-slate-400 uppercase">Category</th>
                              <th className="px-2 py-2 text-[10px] font-semibold text-slate-400 uppercase">Assigned To</th>
                              <th className="px-2 py-2 text-[10px] font-semibold text-slate-400 uppercase w-20"></th>
                            </tr></thead>
                            <tbody>
                              {tpl.items.map((item, idx) => (
                                <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition">
                                  <td className="px-6 py-2.5 text-xs text-slate-400">{idx + 1}</td>
                                  <td className="px-2 py-2.5 text-sm text-slate-700">{item.title}</td>
                                  <td className="px-2 py-2.5"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">{item.category}</span></td>
                                  <td className="px-2 py-2.5 text-xs text-slate-600">
                                    {item.assignmentType === "Supervisor" ? (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                                        <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" /></svg>
                                        Supervisor
                                      </span>
                                    ) : item.assignedToUserName ?? <span className="text-slate-300">—</span>}
                                  </td>
                                  <td className="px-2 py-2.5 text-right">
                                    <button onClick={() => openEditItem(tpl.id, item)} className="mr-1 rounded p-1 text-slate-400 hover:text-blue-600 transition"><svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg></button>
                                    <button onClick={() => handleDeleteItem(item.id)} className="rounded p-1 text-slate-400 hover:text-red-500 transition"><svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                        <div className="px-6 py-3 bg-slate-50/30">
                          <button onClick={() => openAddItem(tpl.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50">
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                            Add Task
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          TAB: ACTIVE ONBOARDINGS
         ═══════════════════════════════════════════════════════ */}
      {tab === "activeOnboarding" && (
        <div>
          {activeOnboardings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
              <p className="text-sm text-slate-400">No active onboardings at the moment.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeOnboardings.map((a) => {
                const progress = a.totalTasks > 0 ? Math.round((a.completedTasks / a.totalTasks) * 100) : 0;
                const isExpanded = expandedObEmp === a.employeeId;
                const allDone = a.completedTasks === a.totalTasks && a.totalTasks > 0;
                return (
                  <div key={a.employeeId} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="flex items-center gap-4 px-6 py-4 cursor-pointer hover:bg-slate-50 transition" onClick={() => setExpandedObEmp(isExpanded ? null : a.employeeId)}>
                      <svg className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-800">{a.employeeName}</span>
                          <span className="text-xs text-slate-400">({a.employeeCode})</span>
                        </div>
                      </div>
                      <div className="shrink-0 w-32">
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                          <span>{a.completedTasks}/{a.totalTasks}</span><span>{progress}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100"><div className={`h-full rounded-full transition-all ${allDone ? "bg-green-500" : "bg-blue-500"}`} style={{ width: `${progress}%` }} /></div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-slate-100 divide-y divide-slate-50">
                        {a.tasks.map((task) => (
                          <div key={task.id} className="flex items-center gap-3 px-6 py-2.5">
                            <button
                              disabled={task.isCompleted || completing === task.id}
                              onClick={(e) => { e.stopPropagation(); handleCompleteOnboarding(task.id, a.employeeId); }}
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${task.isCompleted ? "border-green-400 bg-green-400 text-white" : "border-slate-300 text-slate-300 hover:border-blue-400 hover:text-blue-400 cursor-pointer"}`}
                            >
                              {completing === task.id ? <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-200 border-t-blue-500" /> : task.isCompleted ? <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> : null}
                            </button>
                            <span className={`flex-1 text-sm ${task.isCompleted ? "text-slate-400 line-through" : "text-slate-700"}`}>{task.title}</span>
                            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">{task.category}</span>
                            {task.assignmentType === "Supervisor" && (
                              <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-medium text-amber-700">Supervisor</span>
                            )}
                            <select
                              value={task.assignedToUserId ?? ""}
                              disabled={task.isCompleted}
                              onChange={async (e) => {
                                const userId = e.target.value || null;
                                try {
                                  await apiFetch(`/api/employee-tasks/onboarding/tasks/${task.id}/assign`, { method: "PUT", body: JSON.stringify({ assignedToUserId: userId }) });
                                  const matchedUser = users.find((u) => u.id === userId);
                                  setActiveOnboardings((prev) => prev.map((ao) => ao.employeeId !== a.employeeId ? ao : {
                                    ...ao, tasks: ao.tasks.map((t) => t.id !== task.id ? t : { ...t, assignedToUserId: userId, assignedToUserName: matchedUser?.username ?? null }),
                                  }));
                                } catch { alert("Failed to assign"); }
                              }}
                              className={`shrink-0 w-36 rounded-lg border text-[11px] py-0.5 px-1.5 transition ${task.isCompleted ? "border-slate-100 bg-slate-50 text-slate-400" : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 cursor-pointer"}`}
                            >
                              <option value="">— Unassigned —</option>
                              {getUsersForCategory(task.category).map((u) => <option key={u.id} value={u.id}>{u.username}{u.employeeName ? ` (${u.employeeName})` : ""}</option>)}
                            </select>
                          </div>
                        ))}
                        {allDone && (
                          <div className="px-6 py-3 bg-green-50">
                            <p className="text-xs text-green-600 font-medium">All onboarding tasks completed.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          TAB: ACTIVE OFFBOARDINGS
         ═══════════════════════════════════════════════════════ */}
      {tab === "active" && (
        <div>
          {actives.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
              <p className="text-sm text-slate-400">No active offboardings at the moment.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {actives.map((a) => {
                const progress = a.totalTasks > 0 ? Math.round((a.completedTasks / a.totalTasks) * 100) : 0;
                const isExpanded = expandedEmp === a.employeeId;
                const allDone = a.completedTasks === a.totalTasks && a.totalTasks > 0;
                return (
                  <div key={a.employeeId} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="flex items-center gap-4 px-6 py-4 cursor-pointer hover:bg-slate-50 transition" onClick={() => setExpandedEmp(isExpanded ? null : a.employeeId)}>
                      <svg className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-800">{a.employeeName}</span>
                          <span className="text-xs text-slate-400">({a.employeeCode})</span>
                          {a.departmentName && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">{a.departmentName}</span>}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{a.terminationReason}{a.terminationDate ? ` — ${formatDate(a.terminationDate)}` : ""}</p>
                      </div>
                      <div className="shrink-0 w-32">
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                          <span>{a.completedTasks}/{a.totalTasks}</span><span>{progress}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100"><div className={`h-full rounded-full transition-all ${allDone ? "bg-green-500" : "bg-blue-500"}`} style={{ width: `${progress}%` }} /></div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-slate-100 divide-y divide-slate-50">
                        {a.tasks.map((task) => (
                          <div key={task.id} className="flex items-center gap-3 px-6 py-2.5">
                            <button
                              disabled={task.isCompleted || completing === task.id}
                              onClick={(e) => { e.stopPropagation(); handleComplete(task.id, a.employeeId); }}
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${task.isCompleted ? "border-green-400 bg-green-400 text-white" : "border-slate-300 text-slate-300 hover:border-blue-400 hover:text-blue-400 cursor-pointer"}`}
                            >
                              {completing === task.id ? <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-200 border-t-blue-500" /> : task.isCompleted ? <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> : null}
                            </button>
                            <span className={`flex-1 text-sm ${task.isCompleted ? "text-slate-400 line-through" : "text-slate-700"}`}>{task.title}</span>
                            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">{task.category}</span>
                            {task.assignmentType === "Supervisor" && (
                              <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-medium text-amber-700">Supervisor</span>
                            )}
                            <select
                              value={task.assignedToUserId ?? ""}
                              disabled={task.isCompleted}
                              onChange={async (e) => {
                                const userId = e.target.value || null;
                                try {
                                  await apiFetch(`/api/offboarding/tasks/${task.id}/assign`, { method: "PUT", body: JSON.stringify({ assignedToUserId: userId }) });
                                  const matchedUser = users.find((u) => u.id === userId);
                                  setActives((prev) => prev.map((ao) => ao.employeeId !== a.employeeId ? ao : {
                                    ...ao, tasks: ao.tasks.map((t) => t.id !== task.id ? t : { ...t, assignedToUserId: userId, assignedToUserName: matchedUser?.username ?? null }),
                                  }));
                                } catch { alert("Failed to assign"); }
                              }}
                              className={`shrink-0 w-36 rounded-lg border text-[11px] py-0.5 px-1.5 transition ${task.isCompleted ? "border-slate-100 bg-slate-50 text-slate-400" : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 cursor-pointer"}`}
                            >
                              <option value="">— Unassigned —</option>
                              {getUsersForCategory(task.category).map((u) => <option key={u.id} value={u.id}>{u.username}{u.employeeName ? ` (${u.employeeName})` : ""}</option>)}
                            </select>
                          </div>
                        ))}
                        {allDone && (
                          <div className="px-6 py-3 bg-green-50">
                            <p className="text-xs text-green-600 font-medium">All tasks completed. User account has been deactivated.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          MODAL: CREATE / EDIT TEMPLATE
         ═══════════════════════════════════════════════════════ */}
      <Modal open={showTemplateModal} onClose={() => setShowTemplateModal(false)} title={editingTemplateId ? "Edit Template" : "New Template"}>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Template Name</label>
            <input value={tplName} onChange={(e) => setTplName(e.target.value)} className={inputClass} placeholder="e.g. Standard Offboarding" />
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea value={tplDesc} onChange={(e) => setTplDesc(e.target.value)} rows={2} className={inputClass + " resize-y"} placeholder="Optional..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Type</label>
              <select value={tplType} onChange={(e) => setTplType(e.target.value as "Onboarding" | "Offboarding")} className={inputClass}>
                <option value="Onboarding">Onboarding</option>
                <option value="Offboarding">Offboarding</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input type="checkbox" checked={tplActive} onChange={(e) => setTplActive(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                <span className="text-sm text-slate-600">Active</span>
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowTemplateModal(false)} className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={handleSaveTemplate} disabled={!tplName.trim() || tplSaving} className="rounded-full bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50">{tplSaving ? "Saving..." : "Save"}</button>
          </div>
        </div>
      </Modal>

      {/* ═══════════════════════════════════════════════════════
          MODAL: CREATE / EDIT TASK ITEM
         ═══════════════════════════════════════════════════════ */}
      <Modal open={showItemModal} onClose={() => setShowItemModal(false)} title={editingItemId ? "Edit Task" : "Add Task"}>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Task Title</label>
            <input value={itemTitle} onChange={(e) => setItemTitle(e.target.value)} className={inputClass} placeholder="e.g. Return company laptop" />
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea value={itemDesc} onChange={(e) => setItemDesc(e.target.value)} rows={2} className={inputClass + " resize-y"} placeholder="Optional..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Category</label>
              <select value={itemCategory} onChange={(e) => setItemCategory(e.target.value)} className={inputClass}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Sort Order</label>
              <input type="number" value={itemSortOrder} onChange={(e) => setItemSortOrder(Number(e.target.value))} className={inputClass} min={0} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Assign To</label>
            <div className="flex gap-2 mb-2">
              {(["User", "Supervisor"] as const).map((t) => (
                <button key={t} type="button" onClick={() => { setItemAssignmentType(t); if (t === "Supervisor") setItemAssignee(""); }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition border ${
                    itemAssignmentType === t
                      ? t === "Supervisor" ? "bg-amber-50 border-amber-300 text-amber-700" : "bg-blue-50 border-blue-300 text-blue-700"
                      : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                  }`}>{t === "Supervisor" ? "Employee\u2019s Supervisor" : "Specific User"}</button>
              ))}
            </div>
            {itemAssignmentType === "User" ? (
              <select value={itemAssignee} onChange={(e) => setItemAssignee(e.target.value)} className={inputClass}>
                <option value="">— Unassigned —</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.username}{u.employeeName ? ` (${u.employeeName})` : ""}</option>)}
              </select>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-xs text-amber-700">This task will be automatically assigned to the employee&apos;s direct supervisor.</p>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowItemModal(false)} className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={handleSaveItem} disabled={!itemTitle.trim() || itemSaving} className="rounded-full bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50">{itemSaving ? "Saving..." : "Save"}</button>
          </div>
        </div>
      </Modal>
    </>
  );
}
