"use client";

import { appAlert, appConfirm, appPrompt } from "@/components/ui/appDialogs";
import { useState, useEffect, useMemo } from "react";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { Button } from "@/components/ui/Button";
import { FormSelect, type FormSelectOption } from "@/components/ui";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/date-utils";

interface UserItem {
  id: string;
  username: string;
  email: string;
  isActive: boolean;
  employeeId: string | null;
  employeeName: string | null;
  roles: string[];
  lastLoginAt: string | null;
  createdAt: string;
  assignedLocationIds?: string[];
  assignedBusinessUnitIds?: string[];
  assignedGradeIds?: string[];
  assignedJobTitleIds?: string[];
}

interface RoleItem {
  id: string;
  name: string;
  code: string;
  description: string | null;
  permissions?: { module: string; action: string; scope: string }[];
}

interface EmpLookup {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface OrgLocation {
  id: string;
  name: string;
}

interface OrgGrade extends OrgLocation {
  level?: number;
}

const kpiTileClass =
  "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md";
const panelClass = "rounded-2xl border border-slate-200 bg-white shadow-sm";

export default function UserManagementPage() {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [employees, setEmployees] = useState<EmpLookup[]>([]);
  const [locations, setLocations] = useState<OrgLocation[]>([]);
  const [businessUnits, setBusinessUnits] = useState<OrgLocation[]>([]);
  const [grades, setGrades] = useState<OrgGrade[]>([]);
  const [jobTitles, setJobTitles] = useState<OrgLocation[]>([]);
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
  const [selectedBusinessUnitIds, setSelectedBusinessUnitIds] = useState<string[]>([]);
  const [selectedGradeIds, setSelectedGradeIds] = useState<string[]>([]);
  const [selectedJobTitleIds, setSelectedJobTitleIds] = useState<string[]>([]);
  const [locationPickerKey, setLocationPickerKey] = useState(0);
  const [buPickerKey, setBuPickerKey] = useState(0);
  const [gradePickerKey, setGradePickerKey] = useState(0);
  const [jobTitlePickerKey, setJobTitlePickerKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<UserItem | null>(null);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [employeeId, setEmployeeId] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterStatus, setFilterStatus] = useState<"" | "active" | "disabled">("");
  const [activeSection, setActiveSection] = useState<"users" | "roles">("users");

  async function loadData() {
    setLoading(true);
    setLoadError("");
    try {
      const [u, r, e, loc, bu, gr, jt] = await Promise.all([
        apiFetch<UserItem[]>("/api/user"),
        apiFetch<RoleItem[]>("/api/auth/roles"),
        apiFetch<{ items: EmpLookup[] }>("/api/employees?pageSize=500"),
        apiFetch<OrgLocation[]>("/api/organization/locations").catch(() => [] as OrgLocation[]),
        apiFetch<OrgLocation[]>("/api/organization/business-units").catch(() => [] as OrgLocation[]),
        apiFetch<OrgGrade[]>("/api/organization/grades").catch(() => [] as OrgGrade[]),
        apiFetch<OrgLocation[]>("/api/organization/job-titles").catch(() => [] as OrgLocation[]),
      ]);
      setUsers(u);
      setRoles(r);
      setEmployees(e.items || []);
      setLocations(loc);
      setBusinessUnits(bu);
      setGrades(gr);
      setJobTitles(jt);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load user data");
    }
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  function openCreate() {
    setEditUser(null);
    setUsername("");
    setEmail("");
    setPassword("");
    setIsActive(true);
    setEmployeeId("");
    setSelectedRoles([]);
    setSelectedLocationIds([]);
    setSelectedBusinessUnitIds([]);
    setSelectedGradeIds([]);
    setSelectedJobTitleIds([]);
    setLocationPickerKey((k) => k + 1);
    setBuPickerKey((k) => k + 1);
    setGradePickerKey((k) => k + 1);
    setJobTitlePickerKey((k) => k + 1);
    setError("");
    setShowModal(true);
  }

  function openEdit(u: UserItem) {
    setEditUser(u);
    setUsername(u.username);
    setEmail(u.email);
    setPassword("");
    setIsActive(u.isActive);
    setEmployeeId(u.employeeId || "");
    const roleIds = roles.filter((r) => u.roles.includes(r.name)).map((r) => r.id);
    setSelectedRoles(roleIds);
    setSelectedLocationIds((u.assignedLocationIds ?? []).map(String));
    setSelectedBusinessUnitIds((u.assignedBusinessUnitIds ?? []).map(String));
    setSelectedGradeIds((u.assignedGradeIds ?? []).map(String));
    setSelectedJobTitleIds((u.assignedJobTitleIds ?? []).map(String));
    setLocationPickerKey((k) => k + 1);
    setBuPickerKey((k) => k + 1);
    setGradePickerKey((k) => k + 1);
    setJobTitlePickerKey((k) => k + 1);
    setError("");
    setShowModal(true);
  }

  async function handleSave() {
    setError("");
    if (!username.trim()) {
      setError("Username is required.");
      return;
    }
    if (!editUser && !password) { setError("Password is required for new users."); return; }
    if (selectedRoles.length === 0) { setError("At least one role is required."); return; }

    setSaving(true);
    try {
      if (editUser) {
        await apiFetch(`/api/user/${editUser.id}`, {
          method: "PUT",
          body: JSON.stringify({
            username,
            email,
            isActive,
            employeeId: employeeId || null,
            roleIds: selectedRoles,
            assignedLocationIds: selectedLocationIds,
            assignedBusinessUnitIds: selectedBusinessUnitIds,
            assignedGradeIds: selectedGradeIds,
            assignedJobTitleIds: selectedJobTitleIds,
          }),
        });
      } else {
        await apiFetch("/api/user", {
          method: "POST",
          body: JSON.stringify({
            username,
            email,
            password,
            isActive,
            employeeId: employeeId || null,
            roleIds: selectedRoles,
            assignedLocationIds: selectedLocationIds.length > 0 ? selectedLocationIds : undefined,
            assignedBusinessUnitIds:
              selectedBusinessUnitIds.length > 0 ? selectedBusinessUnitIds : undefined,
            assignedGradeIds: selectedGradeIds.length > 0 ? selectedGradeIds : undefined,
            assignedJobTitleIds: selectedJobTitleIds.length > 0 ? selectedJobTitleIds : undefined,
          }),
        });
      }
      setShowModal(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save user");
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!(await appConfirm("Are you sure you want to delete this user?"))) return;
    try {
      await apiFetch(`/api/user/${id}`, { method: "DELETE" });
      await loadData();
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Failed to delete user");
    }
  }

  async function handleResetPassword(id: string) {
    if (!(await appConfirm("Reset this user’s password? You will be asked to enter the new password next."))) return;
    const newPw = await appPrompt("Enter the new password for this user account.", { title: "New Password", confirmLabel: "Save Password" });
    if (!newPw) return;
    try {
      await apiFetch(`/api/user/${id}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ newPassword: newPw }),
      });
      await appAlert("Password reset successfully.");
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Failed to reset password");
    }
  }

  function toggleRole(roleId: string) {
    setSelectedRoles((prev) =>
      prev.includes(roleId) ? prev.filter((r) => r !== roleId) : [...prev, roleId]
    );
  }

  const filteredUsers = users.filter((u) => {
    if (search) {
      const q = search.toLowerCase();
      const match = u.username.toLowerCase().includes(q)
        || u.email.toLowerCase().includes(q)
        || (u.employeeName && u.employeeName.toLowerCase().includes(q));
      if (!match) return false;
    }
    if (filterRole && !u.roles.includes(filterRole)) return false;
    if (filterStatus === "active" && !u.isActive) return false;
    if (filterStatus === "disabled" && u.isActive) return false;
    return true;
  });

  const filterRoleOptions = useMemo<FormSelectOption[]>(
    () => [{ value: "", label: "All Roles" }, ...roles.map((r) => ({ value: r.name, label: r.name }))],
    [roles]
  );

  const filterStatusOptions = useMemo<FormSelectOption[]>(
    () => [
      { value: "", label: "All Status" },
      { value: "active", label: "Active" },
      { value: "disabled", label: "Disabled" },
    ],
    []
  );

  const employeeFormOptions = useMemo<FormSelectOption[]>(
    () => [
      { value: "", label: "— None —" },
      ...employees.map((emp) => ({
        value: emp.id,
        label: `${emp.firstName} ${emp.lastName}`.trim() || emp.email || emp.id,
      })),
    ],
    [employees]
  );

  const accountStatusOptions = useMemo<FormSelectOption[]>(
    () => [
      { value: "active", label: "Active" },
      { value: "disabled", label: "Disabled" },
    ],
    []
  );

  const locationAddOptions = useMemo<FormSelectOption[]>(() => {
    const remaining = locations.filter((loc) => !selectedLocationIds.includes(loc.id));
    if (remaining.length === 0) {
      return [{ value: "", label: locations.length ? "All locations added" : "— None available —" }];
    }
    return [{ value: "", label: "Add work location…" }, ...remaining.map((l) => ({ value: l.id, label: l.name }))];
  }, [locations, selectedLocationIds]);

  const buAddOptions = useMemo<FormSelectOption[]>(() => {
    const remaining = businessUnits.filter((b) => !selectedBusinessUnitIds.includes(b.id));
    if (remaining.length === 0) {
      return [
        {
          value: "",
          label: businessUnits.length ? "All business units added" : "— None available —",
        },
      ];
    }
    return [{ value: "", label: "Add business unit…" }, ...remaining.map((b) => ({ value: b.id, label: b.name }))];
  }, [businessUnits, selectedBusinessUnitIds]);

  const gradeAddOptions = useMemo<FormSelectOption[]>(() => {
    const remaining = grades.filter((g) => !selectedGradeIds.includes(g.id));
    if (remaining.length === 0) {
      return [{ value: "", label: grades.length ? "All grades added" : "— None available —" }];
    }
    return [
      { value: "", label: "Add grade…" },
      ...remaining.map((g) => ({
        value: g.id,
        label: g.level != null ? `${g.name} · L${g.level}` : g.name,
      })),
    ];
  }, [grades, selectedGradeIds]);

  const jobTitleAddOptions = useMemo<FormSelectOption[]>(() => {
    const remaining = jobTitles.filter((j) => !selectedJobTitleIds.includes(j.id));
    if (remaining.length === 0) {
      return [{ value: "", label: jobTitles.length ? "All job titles added" : "— None available —" }];
    }
    return [{ value: "", label: "Add job title…" }, ...remaining.map((j) => ({ value: j.id, label: j.name }))];
  }, [jobTitles, selectedJobTitleIds]);

  const activeUserCount = useMemo(() => users.filter((u) => u.isActive).length, [users]);
  const linkedEmployeeCount = useMemo(() => users.filter((u) => u.employeeId).length, [users]);

  const kpiStats = useMemo(
    () => [
      { label: "Total users", value: users.length,},
      { label: "Active", value: activeUserCount, },
      { label: "Roles defined", value: roles.length, },
      { label: "Linked to employee", value: linkedEmployeeCount, },
    ],
    [users.length, activeUserCount, roles.length, linkedEmployeeCount]
  );

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20";
  const labelClass = "mb-1 block text-xs font-medium text-slate-500";

  return (
    <>
      <AppTopbar title="User Management" subtitle="Accounts, roles, and access control for your OpenSky HRM tenant." />

      <div className="mx-auto max-w-6xl space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpiStats.map((k) => (
            <div key={k.label} className={kpiTileClass}>
              <div className="text-xs font-medium uppercase tracking-wider text-slate-500">{k.label}</div>
              <div className="mt-2 text-3xl font-semibold leading-none text-slate-900">{k.value}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5 rounded-2xl border border-slate-200 bg-slate-50/90 p-1.5 shadow-sm">
          <button
            type="button"
            onClick={() => setActiveSection("users")}
            className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
              activeSection === "users" ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/90" : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
            }`}
          >
            User accounts
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setActiveSection("roles")}
              className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                activeSection === "roles" ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/90" : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
              }`}
            >
              Roles & permissions
            </button>
          )}
        </div>

        {activeSection === "roles" && isAdmin ? (
          <RolesPermissionsSection roles={roles} onSaved={loadData} />
        ) : loading ? (
          <div className={`flex items-center justify-center py-20 ${panelClass}`}>
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
          </div>
        ) : loadError ? (
          <div className="rounded-2xl border border-rose-200/90 bg-rose-50 p-6 text-center shadow-sm">
            <p className="text-sm text-rose-900">{loadError}</p>
            <Button type="button" variant="secondary" className="mt-3" onClick={loadData}>
              Retry
            </Button>
          </div>
        ) : (
          <div className={`${panelClass} overflow-hidden`}>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-800">User accounts</h2>
                <p className="text-xs text-slate-500">{users.length} user{users.length !== 1 ? "s" : ""} registered</p>
              </div>
              {isAdmin && (
                <Button type="button" onClick={openCreate}>
                  + Create user
                </Button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50/50 px-6 py-3">
              <div className="relative flex-1 min-w-[200px]">
                <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by username, email, or employee name..."
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <div className="flex min-w-0 flex-col gap-1 sm:w-44">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Role</span>
                <FormSelect
                  value={filterRole}
                  onValueChange={setFilterRole}
                  options={filterRoleOptions}
                  placeholder="All Roles"
                />
              </div>
              <div className="flex min-w-0 flex-col gap-1 sm:w-40">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Status</span>
                <FormSelect
                  value={filterStatus}
                  onValueChange={(v) => setFilterStatus(v as "" | "active" | "disabled")}
                  options={filterStatusOptions}
                  placeholder="All Status"
                />
              </div>
              {(search || filterRole || filterStatus) && (
                <button
                  type="button"
                  onClick={() => { setSearch(""); setFilterRole(""); setFilterStatus(""); }}
                  className="rounded-lg px-3 py-2 text-xs font-medium text-slate-500 transition hover:bg-white hover:text-slate-800"
                >
                  Clear filters
                </button>
              )}
              <span className="text-xs text-slate-400">{filteredUsers.length} of {users.length}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                    <th className="px-6 py-3">Username</th>
                    <th className="px-6 py-3">Email</th>
                    <th className="px-6 py-3">Employee</th>
                    <th className="px-6 py-3">Locations</th>
                    <th className="px-6 py-3">Roles</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Last Login</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="border-b border-slate-50 transition hover:bg-slate-50/70">
                      <td className="px-6 py-3 font-medium text-slate-800">{u.username}</td>
                      <td className="px-6 py-3 text-slate-600">{u.email}</td>
                      <td className="px-6 py-3 text-slate-600">{u.employeeName || "\u2014"}</td>
                      <td className="px-6 py-3 max-w-[200px] text-xs text-slate-600">
                        {!u.assignedLocationIds || u.assignedLocationIds.length === 0 ? (
                          <span className="text-slate-400">All sites</span>
                        ) : (
                          <span className="line-clamp-2" title={u.assignedLocationIds.map((id) => locations.find((l) => l.id === id)?.name ?? id).join(", ")}>
                            {u.assignedLocationIds.map((id) => locations.find((l) => l.id === id)?.name ?? id).join(", ")}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex flex-wrap gap-1">
                          {u.roles.map((r) => (
                            <span key={r} className="inline-block rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-800">{r}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${u.isActive ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>
                          {u.isActive ? "Active" : "Disabled"}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-xs text-slate-500">
                        {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Never"}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {isAdmin && (
                            <>
                              <button type="button" onClick={() => openEdit(u)} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600" title="Edit">
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                              </button>
                              <button type="button" onClick={() => handleResetPassword(u.id)} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-amber-50 hover:text-amber-700" title="Reset Password">
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" /></svg>
                              </button>
                            </>
                          )}
                          {isAdmin && (
                            u.username.toLowerCase() === "admin" || u.roles.includes("Admin") ? (
                              <span
                                className="rounded-lg p-1.5 text-slate-300"
                                title="Protected system admin cannot be deleted"
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 0h10.5a1.5 1.5 0 011.5 1.5v6.75a1.5 1.5 0 01-1.5 1.5H6.75a1.5 1.5 0 01-1.5-1.5V12a1.5 1.5 0 011.5-1.5z" />
                                </svg>
                              </span>
                            ) : (
                              <button type="button" onClick={() => handleDelete(u.id)} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-700" title="Delete">
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr><td colSpan={8} className="px-6 py-10 text-center text-sm text-slate-400">{users.length === 0 ? "No users found." : "No users match your search."}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {showModal && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">{editUser ? "Edit user" : "Create user"}</h3>

            {error && (
              <div className="mb-3 rounded-xl border border-rose-200/80 bg-rose-50 px-4 py-2.5 text-sm text-rose-800">{error}</div>
            )}

            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label className={labelClass}>Username *</label><input value={username} onChange={(e) => setUsername(e.target.value)} className={inputClass} /></div>
                <div>
              <label className={labelClass}>Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                pattern="[^\s@]+@[^\s@]+\.[^\s@]{2,}"
                title="Optional. When set, must be a valid email (e.g. name@company.com)"
                className={inputClass}
              />
            </div>
              </div>

              {!editUser && (
                <div><label className={labelClass}>Password *</label><input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className={inputClass} /></div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Link to Employee</label>
                  <FormSelect
                    value={employeeId}
                    onValueChange={setEmployeeId}
                    options={employeeFormOptions}
                    placeholder="— None —"
                  />
                </div>
                <div>
                  <label className={labelClass}>Status</label>
                  <FormSelect
                    value={isActive ? "active" : "disabled"}
                    onValueChange={(v) => setIsActive(v === "active")}
                    options={accountStatusOptions}
                    placeholder="Active"
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Roles *</label>
                <div className="flex flex-wrap gap-2 pt-1">
                  {roles.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => toggleRole(r.id)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        selectedRoles.includes(r.id)
                          ? "border-indigo-400 bg-indigo-50 text-indigo-800"
                          : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                      }`}
                    >
                      {r.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelClass}>People — allowed work locations</label>
                {locations.length === 0 ? (
                  <p className="text-xs text-amber-700">No locations defined. Add locations under Organization first.</p>
                ) : (
                  <>
                    <FormSelect
                      key={locationPickerKey}
                      value=""
                      onValueChange={(v) => {
                        if (!v) return;
                        setSelectedLocationIds((p) => (p.includes(v) ? p : [...p, v]));
                        setLocationPickerKey((k) => k + 1);
                      }}
                      options={locationAddOptions}
                      placeholder="Add work location…"
                      disabled={locations.length === 0}
                    />
                    {selectedLocationIds.length > 0 && (
                      <div className="mt-2 flex max-h-32 flex-wrap gap-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                        {selectedLocationIds.map((id) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setSelectedLocationIds((prev) => prev.filter((x) => x !== id))}
                            className="rounded-full border border-sky-500 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-900 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-900"
                            title="Click to remove"
                          >
                            {locations.find((l) => l.id === id)?.name ?? id} ×
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div>
                <label className={labelClass}>People — allowed business units</label>
                {businessUnits.length === 0 ? (
                  <p className="text-xs text-amber-700">
                    No business units loaded. Add business units under Organization (Org Structure module), or check
                    your license.
                  </p>
                ) : (
                  <>
                    <FormSelect
                      key={buPickerKey}
                      value=""
                      onValueChange={(v) => {
                        if (!v) return;
                        setSelectedBusinessUnitIds((p) => (p.includes(v) ? p : [...p, v]));
                        setBuPickerKey((k) => k + 1);
                      }}
                      options={buAddOptions}
                      placeholder="Add business unit…"
                      disabled={businessUnits.length === 0}
                    />
                    {selectedBusinessUnitIds.length > 0 && (
                      <div className="mt-2 flex max-h-32 flex-wrap gap-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                        {selectedBusinessUnitIds.map((id) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() =>
                              setSelectedBusinessUnitIds((prev) => prev.filter((x) => x !== id))
                            }
                            className="rounded-full border border-sky-500 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-900 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-900"
                            title="Click to remove"
                          >
                            {businessUnits.find((b) => b.id === id)?.name ?? id} ×
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div>
                <label className={labelClass}>People — allowed grades &amp; bands</label>
                {grades.length === 0 ? (
                  <p className="text-xs text-amber-700">
                    No grades loaded. Add grades under Organization, or check your license.
                  </p>
                ) : (
                  <>
                    <FormSelect
                      key={gradePickerKey}
                      value=""
                      onValueChange={(v) => {
                        if (!v) return;
                        setSelectedGradeIds((p) => (p.includes(v) ? p : [...p, v]));
                        setGradePickerKey((k) => k + 1);
                      }}
                      options={gradeAddOptions}
                      placeholder="Add grade…"
                      disabled={grades.length === 0}
                    />
                    {selectedGradeIds.length > 0 && (
                      <div className="mt-2 flex max-h-32 flex-wrap gap-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                        {selectedGradeIds.map((id) => {
                          const g = grades.find((x) => x.id === id);
                          const label = g ? (g.level != null ? `${g.name} · L${g.level}` : g.name) : id;
                          return (
                            <button
                              key={id}
                              type="button"
                              onClick={() => setSelectedGradeIds((prev) => prev.filter((x) => x !== id))}
                              className="rounded-full border border-sky-500 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-900 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-900"
                              title="Click to remove"
                            >
                              {label} ×
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div>
                <label className={labelClass}>People — allowed job catalog</label>
                {jobTitles.length === 0 ? (
                  <p className="text-xs text-amber-700">
                    No job titles loaded. Add job titles under Organization, or check your license.
                  </p>
                ) : (
                  <>
                    <FormSelect
                      key={jobTitlePickerKey}
                      value=""
                      onValueChange={(v) => {
                        if (!v) return;
                        setSelectedJobTitleIds((p) => (p.includes(v) ? p : [...p, v]));
                        setJobTitlePickerKey((k) => k + 1);
                      }}
                      options={jobTitleAddOptions}
                      placeholder="Add job title…"
                      disabled={jobTitles.length === 0}
                    />
                    {selectedJobTitleIds.length > 0 && (
                      <div className="mt-2 flex max-h-32 flex-wrap gap-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                        {selectedJobTitleIds.map((id) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setSelectedJobTitleIds((prev) => prev.filter((x) => x !== id))}
                            className="rounded-full border border-sky-500 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-900 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-900"
                            title="Click to remove"
                          >
                            {jobTitles.find((j) => j.id === id)?.name ?? id} ×
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : editUser ? "Update user" : "Create user"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ──── Roles & Permissions Section ────

const ACTIONS = [
  { key: "Read", label: "View / Menu Access" },
  { key: "Create", label: "Create" },
  { key: "Update", label: "Update" },
  { key: "Delete", label: "Delete" },
];
const SCOPES = [
  { key: "All", label: "All" },
  { key: "Team", label: "Team" },
  { key: "Own", label: "Own" },
];

const SCOPE_FORM_OPTIONS: FormSelectOption[] = SCOPES.map((s) => ({ value: s.key, label: s.label }));

function RolesPermissionsSection({ roles, onSaved }: { roles: RoleItem[]; onSaved: () => void }) {
  const [modules, setModules] = useState<{ module: string; label: string }[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [permissions, setPermissions] = useState<Record<string, Record<string, { enabled: boolean; scope: string }>>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleCode, setNewRoleCode] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [creatingRole, setCreatingRole] = useState(false);

  useEffect(() => {
    apiFetch<{ module: string; label: string }[]>("/api/auth/roles/available-modules")
      .then(setModules)
      .catch(() => setModules([]));
  }, []);

  const selectedRole = roles.find((r) => r.id === selectedRoleId);

  useEffect(() => {
    if (!selectedRole) {
      setPermissions({});
      return;
    }
    const perms: Record<string, Record<string, { enabled: boolean; scope: string }>> = {};
    for (const mod of modules) {
      perms[mod.module] = {};
      for (const act of ACTIONS) {
        const existing = selectedRole.permissions?.find((p) => p.module === mod.module && p.action === act.key);
        perms[mod.module][act.key] = {
          enabled: !!existing,
          scope: existing?.scope || "All",
        };
      }
    }
    setPermissions(perms);
  }, [selectedRole, modules]);

  function togglePermission(module: string, action: string, enabled: boolean) {
    setPermissions((prev) => ({
      ...prev,
      [module]: {
        ...prev[module],
        [action]: { ...prev[module]?.[action], enabled, scope: prev[module]?.[action]?.scope || "All" },
      },
    }));
  }

  function setScope(module: string, action: string, scope: string) {
    setPermissions((prev) => ({
      ...prev,
      [module]: {
        ...prev[module],
        [action]: { ...prev[module]?.[action], scope },
      },
    }));
  }

  async function handleCreateRole() {
    const name = newRoleName.trim();
    if (!name) {
      setError("Role name is required.");
      return;
    }
    setError("");
    setCreatingRole(true);
    try {
      const created = await apiFetch<RoleItem>("/api/auth/roles", {
        method: "POST",
        body: JSON.stringify({
          name,
          code: newRoleCode.trim() || undefined,
          description: newRoleDescription.trim() || undefined,
        }),
      });
      setShowCreateRole(false);
      setNewRoleName("");
      setNewRoleCode("");
      setNewRoleDescription("");
      await onSaved();
      setSelectedRoleId(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create role");
    }
    setCreatingRole(false);
  }

  async function handleSave() {
    if (!selectedRoleId) return;
    setError("");
    setSaving(true);
    const perms: { module: string; action: string; scope: string }[] = [];
    for (const [mod, acts] of Object.entries(permissions)) {
      for (const [act, val] of Object.entries(acts)) {
        if (val.enabled) perms.push({ module: mod, action: act, scope: val.scope });
      }
    }
    try {
      await apiFetch(`/api/auth/roles/${selectedRoleId}/permissions`, {
        method: "PUT",
        body: JSON.stringify({ permissions: perms }),
      });
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save permissions");
    }
    setSaving(false);
  }

  return (
    <div className={`${panelClass} overflow-hidden`}>
      <div className="border-b border-slate-100 px-6 py-4">
        <h2 className="text-base font-semibold text-slate-800">Roles & permissions</h2>
        <p className="mt-1 text-xs text-slate-500">Configure which menus and actions each role can access. Read = menu visibility.</p>
      </div>
      <div className="flex flex-col lg:flex-row min-h-[400px]">
        <div className="w-full lg:w-56 border-b lg:border-b-0 lg:border-r border-slate-100 p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Select Role</p>
            <Button
              type="button"
              variant="secondary"
              className="!h-8 !min-h-8 px-2.5 text-xs"
              onClick={() => {
                setError("");
                setShowCreateRole(true);
              }}
            >
              + New role
            </Button>
          </div>
          <div className="space-y-1">
            {roles.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedRoleId(r.id)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                  selectedRoleId === r.id
                    ? "border border-slate-200 bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                {r.name}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 p-6 overflow-x-auto">
          {!selectedRole ? (
            <p className="text-sm text-slate-400 py-8">Select a role to configure its permissions.</p>
          ) : (
            <>
              {error && (
                <div className="mb-4 rounded-xl border border-rose-200/80 bg-rose-50 px-4 py-2.5 text-sm text-rose-800">{error}</div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left">
                      <th className="py-2 pr-4 font-medium text-slate-600">Module / Menu</th>
                      {ACTIONS.map((a) => (
                        <th key={a.key} className="py-2 px-2 font-medium text-slate-600 text-center min-w-[100px]">{a.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {modules.map((mod) => (
                      <tr key={mod.module} className="border-b border-slate-50">
                        <td className="py-2.5 pr-4 font-medium text-slate-700">{mod.label}</td>
                        {ACTIONS.map((act) => {
                          const val = permissions[mod.module]?.[act.key] ?? { enabled: false, scope: "All" };
                          return (
                            <td key={act.key} className="py-2 px-2">
                              <div className="flex items-center justify-center gap-1">
                                <input
                                  type="checkbox"
                                  checked={val.enabled}
                                  onChange={(e) => togglePermission(mod.module, act.key, e.target.checked)}
                                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/25"
                                />
                                {val.enabled && (
                                  <FormSelect
                                    value={val.scope}
                                    onValueChange={(v) => setScope(mod.module, act.key, v)}
                                    options={SCOPE_FORM_OPTIONS}
                                    className="!h-8 min-h-8 w-[5.25rem] px-2 py-0 text-[11px] leading-tight"
                                  />
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-6 flex justify-end">
                <Button type="button" onClick={handleSave} disabled={saving}>
                  {saving ? "Saving…" : "Save permissions"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {showCreateRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-800">Create new role</h3>
            <p className="mt-1 text-xs text-slate-500">
              Code is auto-generated from the name if left blank (e.g. Payroll Clerk → PAYROLL_CLERK).
            </p>
            {error && (
              <div className="mt-3 rounded-xl border border-rose-200/80 bg-rose-50 px-4 py-2.5 text-sm text-rose-800">
                {error}
              </div>
            )}
            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Role name *</span>
                <input
                  type="text"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="e.g. Payroll Clerk"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Code (optional)</span>
                <input
                  type="text"
                  value={newRoleCode}
                  onChange={(e) => setNewRoleCode(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="e.g. PAYROLL_CLERK"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Description</span>
                <input
                  type="text"
                  value={newRoleDescription}
                  onChange={(e) => setNewRoleDescription(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Optional"
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setShowCreateRole(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleCreateRole} disabled={creatingRole}>
                {creatingRole ? "Creating…" : "Create role"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
