"use client";

import { useState, useEffect } from "react";
import { AppTopbar } from "@/components/navigation/AppTopbar";
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

export default function UserManagementPage() {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [employees, setEmployees] = useState<EmpLookup[]>([]);
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
      const [u, r, e] = await Promise.all([
        apiFetch<UserItem[]>("/api/user"),
        apiFetch<RoleItem[]>("/api/auth/roles"),
        apiFetch<{ items: EmpLookup[] }>("/api/employees?pageSize=500"),
      ]);
      setUsers(u);
      setRoles(r);
      setEmployees(e.items || []);
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
    setError("");
    setShowModal(true);
  }

  async function handleSave() {
    setError("");
    if (!username || !email) { setError("Username and email are required."); return; }
    if (!editUser && !password) { setError("Password is required for new users."); return; }
    if (selectedRoles.length === 0) { setError("At least one role is required."); return; }

    setSaving(true);
    try {
      if (editUser) {
        await apiFetch(`/api/user/${editUser.id}`, {
          method: "PUT",
          body: JSON.stringify({ username, email, isActive, employeeId: employeeId || null, roleIds: selectedRoles }),
        });
      } else {
        await apiFetch("/api/user", {
          method: "POST",
          body: JSON.stringify({ username, email, password, isActive, employeeId: employeeId || null, roleIds: selectedRoles }),
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
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      await apiFetch(`/api/user/${id}`, { method: "DELETE" });
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete user");
    }
  }

  async function handleResetPassword(id: string) {
    const newPw = prompt("Enter new password:");
    if (!newPw) return;
    try {
      await apiFetch(`/api/user/${id}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ newPassword: newPw }),
      });
      alert("Password reset successfully.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to reset password");
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

  const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100";
  const labelClass = "mb-1 block text-xs font-medium text-slate-500";

  return (
    <>
      <AppTopbar title="User Management" />

      <div className="mx-auto max-w-6xl space-y-6 pt-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">User Management</h1>
          <p className="mt-1 text-sm text-slate-500">Manage user accounts, assign roles, and control system access.</p>
        </div>

        <div className="flex gap-1 border-b border-slate-200">
          <button
            onClick={() => setActiveSection("users")}
            className={`px-4 py-2.5 text-sm font-medium transition rounded-t-lg -mb-px ${
              activeSection === "users" ? "bg-white border border-slate-200 border-b-white text-slate-800" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            User Accounts
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveSection("roles")}
              className={`px-4 py-2.5 text-sm font-medium transition rounded-t-lg -mb-px ${
                activeSection === "roles" ? "bg-white border border-slate-200 border-b-white text-slate-800" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Roles & Permissions
            </button>
          )}
        </div>

        {activeSection === "roles" && isAdmin ? (
          <RolesPermissionsSection roles={roles} onSaved={loadData} />
        ) : loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
          </div>
        ) : loadError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <p className="text-sm text-red-600">{loadError}</p>
            <button onClick={loadData} className="mt-3 rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-200 transition">Retry</button>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">User Accounts</h2>
                <p className="text-xs text-slate-500">{users.length} user{users.length !== 1 ? "s" : ""} registered</p>
              </div>
              <button onClick={openCreate} className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:from-emerald-600 hover:to-teal-700 transition">
                + Create User
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-6 py-3 bg-slate-50/50">
              <div className="relative flex-1 min-w-[200px]">
                <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by username, email, or employee name..."
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">All Roles</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.name}>{r.name}</option>
                ))}
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as "" | "active" | "disabled")}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </select>
              {(search || filterRole || filterStatus) && (
                <button
                  onClick={() => { setSearch(""); setFilterRole(""); setFilterStatus(""); }}
                  className="rounded-lg px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-100 transition"
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
                    <th className="px-6 py-3">Roles</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Last Login</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition">
                      <td className="px-6 py-3 font-medium text-slate-800">{u.username}</td>
                      <td className="px-6 py-3 text-slate-600">{u.email}</td>
                      <td className="px-6 py-3 text-slate-600">{u.employeeName || "\u2014"}</td>
                      <td className="px-6 py-3">
                        <div className="flex flex-wrap gap-1">
                          {u.roles.map((r) => (
                            <span key={r} className="inline-block rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">{r}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${u.isActive ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                          {u.isActive ? "Active" : "Disabled"}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-xs text-slate-500">
                        {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Never"}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(u)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition" title="Edit">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                          </button>
                          <button onClick={() => handleResetPassword(u.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition" title="Reset Password">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" /></svg>
                          </button>
                          {u.username.toLowerCase() === "admin" || u.roles.includes("Admin") ? (
                            <span
                              className="rounded-lg p-1.5 text-slate-300"
                              title="Protected system admin cannot be deleted"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 0h10.5a1.5 1.5 0 011.5 1.5v6.75a1.5 1.5 0 01-1.5 1.5H6.75a1.5 1.5 0 01-1.5-1.5V12a1.5 1.5 0 011.5-1.5z" />
                              </svg>
                            </span>
                          ) : (
                            <button onClick={() => handleDelete(u.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition" title="Delete">
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr><td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-400">{users.length === 0 ? "No users found." : "No users match your search."}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-bold text-slate-800">{editUser ? "Edit User" : "Create User"}</h3>

            {error && <div className="mb-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>}

            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label className={labelClass}>Username *</label><input value={username} onChange={(e) => setUsername(e.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Email *</label><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" pattern="[^\s@]+@[^\s@]+\.[^\s@]{2,}" title="Enter a valid email (e.g. name@company.com)" className={inputClass} /></div>
              </div>

              {!editUser && (
                <div><label className={labelClass}>Password *</label><input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className={inputClass} /></div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Link to Employee</label>
                  <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={inputClass}>
                    <option value="">-- None --</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Status</label>
                  <select value={isActive ? "active" : "disabled"} onChange={(e) => setIsActive(e.target.value === "active")} className={inputClass}>
                    <option value="active">Active</option>
                    <option value="disabled">Disabled</option>
                  </select>
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
                          ? "border-blue-400 bg-blue-50 text-blue-700"
                          : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                      }`}
                    >
                      {r.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:from-emerald-600 hover:to-teal-700 transition disabled:opacity-50">
                {saving ? "Saving..." : editUser ? "Update User" : "Create User"}
              </button>
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

function RolesPermissionsSection({ roles, onSaved }: { roles: RoleItem[]; onSaved: () => void }) {
  const [modules, setModules] = useState<{ module: string; label: string }[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [permissions, setPermissions] = useState<Record<string, Record<string, { enabled: boolean; scope: string }>>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-100 px-6 py-4">
        <h2 className="text-lg font-bold text-slate-800">Roles & Permissions</h2>
        <p className="text-xs text-slate-500 mt-1">Configure which menus and actions each role can access. Read = menu visibility.</p>
      </div>
      <div className="flex flex-col lg:flex-row min-h-[400px]">
        <div className="w-full lg:w-56 border-b lg:border-b-0 lg:border-r border-slate-100 p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Select Role</p>
          <div className="space-y-1">
            {roles.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedRoleId(r.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition ${
                  selectedRoleId === r.id ? "bg-blue-50 text-blue-700 border border-blue-200" : "hover:bg-slate-50 text-slate-700"
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
              {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>}
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
                                  className="rounded border-slate-300"
                                />
                                {val.enabled && (
                                  <select
                                    value={val.scope}
                                    onChange={(e) => setScope(mod.module, act.key, e.target.value)}
                                    className="rounded border border-slate-200 px-1.5 py-0.5 text-xs"
                                  >
                                    {SCOPES.map((s) => (
                                      <option key={s.key} value={s.key}>{s.label}</option>
                                    ))}
                                  </select>
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
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-emerald-600 hover:to-teal-700 transition disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Permissions"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
