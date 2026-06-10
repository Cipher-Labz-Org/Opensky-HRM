"use client";

import { appAlert, appConfirm } from "@/components/ui/appDialogs";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { Button } from "@/components/ui/Button";
import { TablePagination } from "@/components/ui";
import { useClientPagination } from "@/lib/use-client-pagination";
import { Modal } from "@/components/ui/Modal";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/date-utils";

interface TemplateItem {
  id: string;
  title: string;
  description: string | null;
  category: string;
  sortOrder: number;
  isActive: boolean;
  assignmentType: string;
  assignedToUserId: string | null;
  assignedToUserName: string | null;
}

interface UserLookup {
  id: string;
  username: string;
  employeeName: string | null;
}

interface TaskItem {
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
  tasks: TaskItem[];
}

type Tab = "templates" | "active";

const CATEGORIES = ["HR", "IT & Assets", "Finance", "Department", "Security", "Other"];

const inputClass = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100";
const labelClass = "mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wide";

export default function OffboardingPage() {
  const [tab, setTab] = useState<Tab>("templates");
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [users, setUsers] = useState<UserLookup[]>([]);
  const [actives, setActives] = useState<ActiveOffboarding[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formCategory, setFormCategory] = useState("HR");
  const [formSortOrder, setFormSortOrder] = useState(0);
  const [formActive, setFormActive] = useState(true);
  const [formAssignmentType, setFormAssignmentType] = useState("User");
  const [formAssignee, setFormAssignee] = useState("");
  const [saving, setSaving] = useState(false);

  const [expandedEmp, setExpandedEmp] = useState<string | null>(null);
  const [completing, setCompleting] = useState<string | null>(null);
  const templatesPager = useClientPagination(templates);
  const activesPager = useClientPagination(actives, 8);

  const loadTemplates = useCallback(async () => {
    const [t, u] = await Promise.all([
      apiFetch<TemplateItem[]>("/api/offboarding/templates").catch(() => []),
      apiFetch<UserLookup[]>("/api/offboarding/users").catch(() => []),
    ]);
    setTemplates(t);
    setUsers(u);
  }, []);

  const loadActive = useCallback(async () => {
    const a = await apiFetch<ActiveOffboarding[]>("/api/offboarding/active").catch(() => []);
    setActives(a);
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadTemplates(), loadActive()]).finally(() => setLoading(false));
  }, [loadTemplates, loadActive]);

  function openCreate() {
    setEditingId(null);
    setFormTitle("");
    setFormDesc("");
    setFormCategory("HR");
    setFormSortOrder(templates.length > 0 ? Math.max(...templates.map((t) => t.sortOrder)) + 1 : 1);
    setFormActive(true);
    setFormAssignmentType("User");
    setFormAssignee("");
    setShowModal(true);
  }

  function openEdit(t: TemplateItem) {
    setEditingId(t.id);
    setFormTitle(t.title);
    setFormDesc(t.description ?? "");
    setFormCategory(t.category);
    setFormSortOrder(t.sortOrder);
    setFormActive(t.isActive);
    setFormAssignmentType(t.assignmentType ?? "User");
    setFormAssignee(t.assignedToUserId ?? "");
    setShowModal(true);
  }

  async function handleSave() {
    if (!formTitle.trim()) return;
    setSaving(true);
    try {
      const payload = {
        title: formTitle.trim(),
        description: formDesc.trim() || null,
        category: formCategory,
        sortOrder: formSortOrder,
        isActive: formActive,
        assignmentType: formAssignmentType,
        assignedToUserId: formAssignmentType === "Supervisor" ? null : (formAssignee || null),
      };
      if (editingId) {
        const updated = await apiFetch<TemplateItem>(`/api/offboarding/templates/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
        setTemplates((prev) => prev.map((t) => (t.id === editingId ? updated : t)));
      } else {
        const created = await apiFetch<TemplateItem>("/api/offboarding/templates", { method: "POST", body: JSON.stringify(payload) });
        setTemplates((prev) => [...prev, created]);
      }
      setShowModal(false);
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!(await appConfirm("Delete this template?"))) return;
    try {
      await apiFetch(`/api/offboarding/templates/${id}`, { method: "DELETE" });
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch {
      await appAlert("Failed to delete");
    }
  }

  async function handleCompleteTask(taskId: string, empId: string) {
    setCompleting(taskId);
    try {
      await apiFetch(`/api/offboarding/tasks/${taskId}/complete`, { method: "POST" });
      setActives((prev) =>
        prev.map((a) => {
          if (a.employeeId !== empId) return a;
          const updatedTasks = a.tasks.map((t) => (t.id === taskId ? { ...t, isCompleted: true, completedAt: new Date().toISOString() } : t));
          return { ...a, tasks: updatedTasks, completedTasks: updatedTasks.filter((t) => t.isCompleted).length };
        })
      );
    } catch {
      await appAlert("Failed to complete task");
    } finally {
      setCompleting(null);
    }
  }

  if (loading) {
    return (
      <>
        <AppTopbar title="Offboarding" subtitle="Manage offboarding task templates and track active offboardings." />
        <div className="flex items-center justify-center py-20 text-slate-400">Loading...</div>
      </>
    );
  }

  return (
    <>
      <AppTopbar title="Offboarding" subtitle="Manage offboarding task templates and track active employee offboardings." />

      {/* Tab Switcher */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
          {[
            { key: "templates" as Tab, label: "Task Templates", count: templates.length },
            { key: "active" as Tab, label: "Active Offboardings", count: actives.length },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                tab === t.key ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {t.label}
              <span className="ml-1.5 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">{t.count}</span>
            </button>
          ))}
        </div>
        {tab === "templates" && <Button onClick={openCreate}>+ New Template</Button>}
      </div>

      {/* ═══ TEMPLATES TAB ═══ */}
      {tab === "templates" && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          {templates.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-400">
              No task templates yet. Create your first one to define default offboarding tasks.
            </div>
          ) : (
            <>
            <table className="hris-table">
              <thead>
                <tr>
                  <th className="w-10">#</th>
                  <th>Task</th>
                  <th>Category</th>
                  <th>Assigned To</th>
                  <th className="w-20">Active</th>
                  <th className="w-24"></th>
                </tr>
              </thead>
              <tbody>
                {templatesPager.pageItems.map((t) => (
                  <tr key={t.id}>
                    <td className="text-center text-xs text-slate-400">{t.sortOrder}</td>
                    <td>
                      <span className="font-medium text-slate-700">{t.title}</span>
                      {t.description && <p className="mt-0.5 text-xs text-slate-400">{t.description}</p>}
                    </td>
                    <td>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{t.category}</span>
                    </td>
                    <td className="text-sm text-slate-600">
                      {t.assignmentType === "Supervisor" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" /></svg>
                          Supervisor
                        </span>
                      ) : t.assignedToUserName ? (
                        t.assignedToUserName
                      ) : (
                        <span className="text-slate-300">— Unassigned —</span>
                      )}
                    </td>
                    <td className="text-center">
                      {t.isActive ? (
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-green-600">
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        </span>
                      ) : (
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(t)} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-blue-600" title="Edit">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" /></svg>
                        </button>
                        <button onClick={() => handleDelete(t.id)} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500" title="Delete">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <TablePagination page={templatesPager.page} totalPages={templatesPager.totalPages} totalCount={templatesPager.totalCount} pageSize={templatesPager.pageSize} onPageChange={templatesPager.setPage} />
            </>
          )}
        </div>
      )}

      {/* ═══ ACTIVE OFFBOARDINGS TAB ═══ */}
      {tab === "active" && (
        <div className="space-y-4">
          {actives.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-400 shadow-sm">
              No active offboardings at the moment.
            </div>
          ) : (
            activesPager.pageItems.map((a) => {
              const pct = a.totalTasks > 0 ? Math.round((a.completedTasks / a.totalTasks) * 100) : 0;
              const allDone = a.completedTasks === a.totalTasks;
              const isExpanded = expandedEmp === a.employeeId;
              return (
                <div key={a.employeeId} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedEmp(isExpanded ? null : a.employeeId)}
                    className="flex w-full items-center gap-4 px-6 py-4 text-left transition hover:bg-slate-50"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Link href={`/app/people/${a.employeeId}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-slate-800 hover:text-blue-600 transition">{a.employeeName}</Link>
                        <span className="text-xs text-slate-400">{a.employeeCode}</span>
                        {a.terminationReason && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-600">{a.terminationReason}</span>}
                      </div>
                      <div className="mt-0.5 flex items-center gap-3 text-xs text-slate-400">
                        {a.departmentName && <span>{a.departmentName}</span>}
                        {a.terminationDate && <span>Terminated {formatDate(a.terminationDate)}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-32">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-slate-500">{a.completedTasks}/{a.totalTasks}</span>
                          <span className={`font-semibold ${allDone ? "text-green-600" : "text-blue-600"}`}>{pct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100">
                          <div className={`h-full rounded-full transition-all ${allDone ? "bg-green-500" : "bg-blue-500"}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <svg className={`h-5 w-5 text-slate-400 transition ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="border-t border-slate-100 divide-y divide-slate-50">
                      {a.tasks.map((task) => (
                        <div key={task.id} className="flex items-center gap-3 px-6 py-3">
                          <button
                            type="button"
                            disabled={task.isCompleted || completing === task.id}
                            onClick={() => handleCompleteTask(task.id, a.employeeId)}
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                              task.isCompleted
                                ? "border-green-500 bg-green-500 text-white cursor-default"
                                : "border-slate-300 hover:border-green-400 cursor-pointer"
                            }`}
                          >
                            {task.isCompleted && (
                              <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            )}
                            {completing === task.id && (
                              <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-blue-500" />
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <span className={`text-sm ${task.isCompleted ? "text-slate-400 line-through" : "text-slate-700"}`}>{task.title}</span>
                          </div>
                          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">{task.category}</span>
                          {task.assignmentType === "Supervisor" && (
                            <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                              <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" /></svg>
                              Supervisor
                            </span>
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
                                  ...ao,
                                  tasks: ao.tasks.map((t) => t.id !== task.id ? t : { ...t, assignedToUserId: userId, assignedToUserName: matchedUser?.username ?? null }),
                                }));
                              } catch { await appAlert("Failed to assign"); }
                            }}
                            className={`shrink-0 w-36 rounded-lg border text-[11px] py-0.5 px-1.5 transition ${
                              task.isCompleted ? "border-slate-100 bg-slate-50 text-slate-400 cursor-default" : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 cursor-pointer"
                            }`}
                          >
                            <option value="">— Unassigned —</option>
                            {users.map((u) => (
                              <option key={u.id} value={u.id}>{u.username}{u.employeeName ? ` (${u.employeeName})` : ""}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                      {allDone && (
                        <div className="px-6 py-3 bg-green-50">
                          <p className="text-xs text-green-600 font-medium">
                            <svg className="mr-1 inline h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                            All tasks completed. User account has been deactivated.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
          {actives.length > 0 && (
            <TablePagination page={activesPager.page} totalPages={activesPager.totalPages} totalCount={activesPager.totalCount} pageSize={activesPager.pageSize} onPageChange={activesPager.setPage} />
          )}
        </div>
      )}

      {/* ═══ TEMPLATE MODAL ═══ */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="">
        <div>
          <h3 className="text-lg font-semibold text-slate-700">{editingId ? "Edit Template" : "New Task Template"}</h3>
          <div className="mt-4 space-y-4">
            <div>
              <label className={labelClass}>Title <span className="text-red-500">*</span></label>
              <input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} className={inputClass} placeholder="e.g. Return company laptop" />
            </div>
            <div>
              <label className={labelClass}>Description</label>
              <textarea value={formDesc} onChange={(e) => setFormDesc(e.target.value)} rows={2} className={inputClass + " resize-y"} placeholder="Optional details..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Category</label>
                <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)} className={inputClass}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Sort Order</label>
                <input type="number" value={formSortOrder} onChange={(e) => setFormSortOrder(Number(e.target.value))} className={inputClass} min={0} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Assign To</label>
              <div className="flex gap-2 mb-2">
                {(["User", "Supervisor"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { setFormAssignmentType(t); if (t === "Supervisor") setFormAssignee(""); }}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition border ${
                      formAssignmentType === t
                        ? t === "Supervisor" ? "bg-amber-50 border-amber-300 text-amber-700" : "bg-blue-50 border-blue-300 text-blue-700"
                        : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    {t === "Supervisor" ? "Employee\u2019s Supervisor" : "Specific User"}
                  </button>
                ))}
              </div>
              {formAssignmentType === "User" ? (
                <>
                  <select value={formAssignee} onChange={(e) => setFormAssignee(e.target.value)} className={inputClass}>
                    <option value="">— Unassigned —</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.username}{u.employeeName ? ` (${u.employeeName})` : ""}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-400">Pick a specific user responsible for this task.</p>
                </>
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="text-xs text-amber-700">
                    <svg className="mr-1 inline h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" /></svg>
                    This task will be automatically assigned to the terminated employee&apos;s direct supervisor.
                  </p>
                </div>
              )}
            </div>
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={formActive} onChange={(e) => setFormActive(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                <span className="text-sm text-slate-600">Active (included in new offboardings)</span>
              </label>
            </div>
          </div>
          <div className="mt-5 border-t border-slate-100 pt-4 flex items-center justify-end gap-3">
            <button type="button" onClick={() => setShowModal(false)} className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">Cancel</button>
            <button type="button" onClick={handleSave} disabled={!formTitle.trim() || saving} className="rounded-full bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Saving..." : editingId ? "Update" : "Create"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
