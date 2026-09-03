"use client";

import { appAlert, appConfirm, appPrompt } from "@/components/ui/appDialogs";
import { useState, useEffect, useMemo } from "react";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { Button } from "@/components/ui/Button";
import { CreateRoleModal } from "@/components/forms/CreateRoleModal";
import { FormSelect, TablePagination, FormErrorAlert, FlashMessageBanner, UsernameInput, EmailInput, type FormSelectOption, type FlashMessage } from "@/components/ui";
import { SUCCESS_BANNER_DISMISS_MS } from "@/lib/use-auto-dismiss";
import { EmployeeSearchCombobox } from "@/components/workforce/EmployeeSearchCombobox";
import { UserAdvancedPermissionsPanel } from "@/components/user-management/UserAdvancedPermissionsPanel";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/date-utils";
import { resolveRolePermissionModules } from "@/lib/role-permission-modules";
import { useApplyFilter } from "@/lib/use-apply-filter";
import {
  sanitizeUsernameInput,
  isValidUsername,
  isValidEmailInput,
  isValidEmailFormat,
  USERNAME_VALIDATION_MESSAGE,
  EMAIL_INPUT_VALIDATION_MESSAGE,
  EMAIL_FORMAT_VALIDATION_MESSAGE,
} from "@/lib/input-validation";
import { modalShellWidthClass } from "@/lib/modal-layout";

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

function isNotFoundError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : "";
  return msg.includes("not found") || msg.includes("(404)");
}

async function fetchUsersForPage(
  params: URLSearchParams,
  pageSize: number,
): Promise<{ items: UserItem[]; totalCount: number }> {
  try {
    const paged = await apiFetch<{ items?: UserItem[]; totalCount?: number } | UserItem[]>(`/api/user?${params}`);
    if (Array.isArray(paged)) {
      return { items: paged, totalCount: paged.length };
    }
    return {
      items: paged.items ?? [],
      totalCount: paged.totalCount ?? paged.items?.length ?? 0,
    };
  } catch (err) {
    if (!isNotFoundError(err)) throw err;
  }

  const legacy = await apiFetch<UserItem[] | { items?: UserItem[] }>("/api/user");
  const all = Array.isArray(legacy) ? legacy : legacy.items ?? [];
  const search = (params.get("search") ?? "").trim().toLowerCase();
  const role = params.get("role") ?? "";
  const isActive = params.get("isActive");
  const page = Math.max(1, Number(params.get("page") ?? "1"));

  let filtered = all;
  if (search) {
    filtered = filtered.filter(
      (u) =>
        u.username.toLowerCase().includes(search)
        || u.email.toLowerCase().includes(search)
        || (u.employeeName ?? "").toLowerCase().includes(search),
    );
  }
  if (role) {
    filtered = filtered.filter((u) => u.roles.includes(role));
  }
  if (isActive === "true") filtered = filtered.filter((u) => u.isActive);
  if (isActive === "false") filtered = filtered.filter((u) => !u.isActive);

  const start = (page - 1) * pageSize;
  return {
    items: filtered.slice(start, start + pageSize),
    totalCount: filtered.length,
  };
}

async function fetchUserSummaryFallback(): Promise<{
  totalUsers: number;
  activeUsers: number;
  linkedToEmployee: number;
}> {
  try {
    return await apiFetch<{ totalUsers: number; activeUsers: number; linkedToEmployee: number }>("/api/user/summary");
  } catch (err) {
    if (!isNotFoundError(err)) throw err;
    const legacy = await apiFetch<UserItem[] | { items?: UserItem[] }>("/api/user");
    const all = Array.isArray(legacy) ? legacy : legacy.items ?? [];
    return {
      totalUsers: all.length,
      activeUsers: all.filter((u) => u.isActive).length,
      linkedToEmployee: all.filter((u) => u.employeeId).length,
    };
  }
}

export default function UserManagementPage() {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [locations, setLocations] = useState<OrgLocation[]>([]);
  const [businessUnits, setBusinessUnits] = useState<OrgLocation[]>([]);
  const [grades, setGrades] = useState<OrgGrade[]>([]);
  const [jobTitles, setJobTitles] = useState<OrgLocation[]>([]);
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
  const [selectedBusinessUnitIds, setSelectedBusinessUnitIds] = useState<string[]>([]);
  const [selectedGradeIds, setSelectedGradeIds] = useState<string[]>([]);
  const [selectedJobTitleIds, setSelectedJobTitleIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<UserItem | null>(null);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mustChangePassword, setMustChangePassword] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [employeeId, setEmployeeId] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const searchFilter = useApplyFilter();
  const [filterRole, setFilterRole] = useState("");
  const [filterStatus, setFilterStatus] = useState<"" | "active" | "disabled">("");
  const [activeSection, setActiveSection] = useState<"users" | "roles">("users");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [userSummary, setUserSummary] = useState({ totalUsers: 0, activeUsers: 0, linkedToEmployee: 0 });
  const PAGE_SIZE = 10;

  async function loadData() {
    setLoading(true);
    setLoadError("");
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (searchFilter.applied) params.set("search", searchFilter.applied);
      if (filterRole) params.set("role", filterRole);
      if (filterStatus === "active") params.set("isActive", "true");
      if (filterStatus === "disabled") params.set("isActive", "false");

      const u = await fetchUsersForPage(params, PAGE_SIZE);
      const [summary, r, loc, bu, gr, jt] = await Promise.all([
        fetchUserSummaryFallback(),
        apiFetch<RoleItem[]>("/api/auth/roles"),
        apiFetch<OrgLocation[]>("/api/organization/locations").catch(() => [] as OrgLocation[]),
        apiFetch<OrgLocation[]>("/api/organization/business-units").catch(() => [] as OrgLocation[]),
        apiFetch<OrgGrade[]>("/api/organization/grades").catch(() => [] as OrgGrade[]),
        apiFetch<OrgLocation[]>("/api/organization/job-titles").catch(() => [] as OrgLocation[]),
      ]);
      setUsers(u.items ?? []);
      setTotalCount(u.totalCount ?? 0);
      setUserSummary({
        totalUsers: summary.totalUsers ?? 0,
        activeUsers: summary.activeUsers ?? 0,
        linkedToEmployee: summary.linkedToEmployee ?? 0,
      });
      setRoles(r);
      setLocations(loc);
      setBusinessUnits(bu);
      setGrades(gr);
      setJobTitles(jt);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load user data");
    }
    setLoading(false);
  }

  useEffect(() => { void loadData(); }, [page, searchFilter.applied, filterRole, filterStatus]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    if (page > maxPage) setPage(maxPage);
  }, [totalCount, page]);

  function openCreate() {
    setEditUser(null);
    setUsername("");
    setEmail("");
    setPassword("");
    setMustChangePassword(true);
    setIsActive(true);
    setEmployeeId("");
    setSelectedRoleId("");
    setSelectedLocationIds([]);
    setSelectedBusinessUnitIds([]);
    setSelectedGradeIds([]);
    setSelectedJobTitleIds([]);
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
    setSelectedRoleId(roleIds[0] ?? "");
    setSelectedLocationIds((u.assignedLocationIds ?? []).map(String));
    setSelectedBusinessUnitIds((u.assignedBusinessUnitIds ?? []).map(String));
    setSelectedGradeIds((u.assignedGradeIds ?? []).map(String));
    setSelectedJobTitleIds((u.assignedJobTitleIds ?? []).map(String));
    setError("");
    setShowModal(true);
  }

  async function handleSave() {
    setError("");
    const normalizedUsername = sanitizeUsernameInput(username.trim());
    if (!normalizedUsername) {
      setError("Username is required.");
      return;
    }
    if (!isValidUsername(normalizedUsername)) {
      setError(USERNAME_VALIDATION_MESSAGE);
      return;
    }
    const trimmedEmail = email.trim();
    if (trimmedEmail && !isValidEmailInput(trimmedEmail)) {
      setError(EMAIL_INPUT_VALIDATION_MESSAGE);
      return;
    }
    if (trimmedEmail && !isValidEmailFormat(trimmedEmail)) {
      setError(EMAIL_FORMAT_VALIDATION_MESSAGE);
      return;
    }
    if (!editUser && !password) { setError("Password is required for new users."); return; }
    if (!editUser && password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (!selectedRoleId) { setError("A role is required."); return; }

    setSaving(true);
    try {
      if (editUser) {
        await apiFetch(`/api/user/${editUser.id}`, {
          method: "PUT",
          body: JSON.stringify({
            username: normalizedUsername,
            email,
            isActive,
            employeeId: employeeId || null,
            roleIds: [selectedRoleId],
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
            username: normalizedUsername,
            email,
            password,
            isActive,
            mustChangePassword,
            employeeId: employeeId || null,
            roleIds: [selectedRoleId],
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

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

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

  const accountStatusOptions = useMemo<FormSelectOption[]>(
    () => [
      { value: "active", label: "Active" },
      { value: "disabled", label: "Disabled" },
    ],
    []
  );

  const roleOptions = useMemo<FormSelectOption[]>(
    () => [{ value: "", label: "Select a role…" }, ...roles.map((r) => ({ value: r.id, label: r.name }))],
    [roles]
  );

  const kpiStats = useMemo(
    () => [
      { label: "Total users", value: userSummary.totalUsers },
      { label: "Active", value: userSummary.activeUsers },
      { label: "Roles defined", value: roles.length },
      { label: "Linked to employee", value: userSummary.linkedToEmployee },
    ],
    [userSummary.totalUsers, userSummary.activeUsers, userSummary.linkedToEmployee, roles.length]
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
          <RolesPermissionsSection roles={roles} onSaved={() => void loadData()} />
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
                <p className="text-xs text-slate-500">{userSummary.totalUsers} user{userSummary.totalUsers !== 1 ? "s" : ""} registered</p>
              </div>
              {isAdmin && (
                <Button type="button" onClick={openCreate}>
                  + Create user
                </Button>
              )}
            </div>

            <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 bg-slate-50/50 px-6 py-3">
              <div className="flex min-w-[200px] flex-1 flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Search</span>
                <div className="relative">
                  <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
                  <input
                    value={searchFilter.input}
                    onChange={(e) => searchFilter.setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        searchFilter.apply();
                        setPage(1);
                      }
                    }}
                    placeholder="Search username, email, or name… (Enter)"
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>
              <div className="flex w-full min-w-0 flex-col gap-1 sm:w-44">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Role</span>
                <FormSelect
                  value={filterRole}
                  onValueChange={(v) => { setFilterRole(v); setPage(1); }}
                  options={filterRoleOptions}
                  placeholder="All Roles"
                />
              </div>
              <div className="flex w-full min-w-0 flex-col gap-1 sm:w-40">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Status</span>
                <FormSelect
                  value={filterStatus}
                  onValueChange={(v) => { setFilterStatus(v as "" | "active" | "disabled"); setPage(1); }}
                  options={filterStatusOptions}
                  placeholder="All Status"
                />
              </div>
              {(searchFilter.hasApplied || filterRole || filterStatus) && (
                <button
                  type="button"
                  onClick={() => { searchFilter.clear(); setFilterRole(""); setFilterStatus(""); setPage(1); }}
                  className="rounded-lg px-3 py-2 text-xs font-medium text-slate-500 transition hover:bg-white hover:text-slate-800"
                >
                  Clear filters
                </button>
              )}
              <span className="pb-2 text-xs text-slate-400">{totalCount} user(s)</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                    <th className="px-6 py-3">Username</th>
                    <th className="px-6 py-3">Employee</th>
                    <th className="px-6 py-3">Locations</th>
                    <th className="px-6 py-3">Roles</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Last Login</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-slate-50 transition hover:bg-slate-50/70">
                      <td className="px-6 py-3 font-medium text-slate-800">{u.username}</td>
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
                        {u.roles[0] ? (
                          <span className="inline-block rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-800">
                            {u.roles[0]}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
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
                  {users.length === 0 && (
                    <tr><td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-400">{users.length === 0 ? "No users found." : "No users match your search."}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <TablePagination
              page={page}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </div>
        )}

      </div>

      {showModal && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className={`w-full ${modalShellWidthClass()} max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl`}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <h3 className="text-lg font-semibold text-slate-900">{editUser ? "Edit user" : "Create user"}</h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <FormErrorAlert
              message={error}
              onDismiss={() => setError("")}
              className="mb-3 rounded-xl border border-rose-200/80 bg-rose-50 px-4 py-2.5 text-sm text-rose-800"
            />

            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label className={labelClass}>Username *</label><UsernameInput value={username} onChange={(e) => setUsername(e.target.value)} className={inputClass} /></div>
                <div>
              <label className={labelClass}>Email</label>
              <EmailInput
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                title="Optional. When set, must be a valid email (e.g. name@company.com)"
                className={inputClass}
              />
            </div>
              </div>

              {!editUser && (
                <>
                  <div><label className={labelClass}>Password *</label><input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className={inputClass} /></div>
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={mustChangePassword}
                      onChange={(e) => setMustChangePassword(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[var(--primary)] accent-[var(--primary)]"
                    />
                    <span className="text-sm leading-relaxed text-slate-700">
                      <span className="font-medium text-slate-900">Require password change on first sign-in</span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        The user must set a new password before they can use the app.
                      </span>
                    </span>
                  </label>
                </>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Link to Employee</label>
                  <EmployeeSearchCombobox
                    value={employeeId}
                    placeholder="Type name or employee code…"
                    onPick={(emp) => setEmployeeId(emp?.id ?? "")}
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
                <label className={labelClass}>Role *</label>
                <FormSelect
                  value={selectedRoleId}
                  onValueChange={setSelectedRoleId}
                  options={roleOptions}
                  placeholder="Select a role…"
                  disabled={roles.length === 0}
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Each user is assigned one role. Permissions come from that role.
                </p>
              </div>

              <UserAdvancedPermissionsPanel
                locations={locations}
                businessUnits={businessUnits}
                grades={grades}
                jobTitles={jobTitles}
                selectedLocationIds={selectedLocationIds}
                selectedBusinessUnitIds={selectedBusinessUnitIds}
                selectedGradeIds={selectedGradeIds}
                selectedJobTitleIds={selectedJobTitleIds}
                onLocationChange={setSelectedLocationIds}
                onBusinessUnitChange={setSelectedBusinessUnitIds}
                onGradeChange={setSelectedGradeIds}
                onJobTitleChange={setSelectedJobTitleIds}
              />
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
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [modules, setModules] = useState<{ module: string; label: string }[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [permissions, setPermissions] = useState<Record<string, Record<string, { enabled: boolean; scope: string }>>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState<FlashMessage | null>(null);

  useEffect(() => {
    apiFetch<{ module: string; label: string }[]>("/api/auth/roles/available-modules")
      .then((list) => setModules(resolveRolePermissionModules(Array.isArray(list) ? list : [])))
      .catch(() => setModules(resolveRolePermissionModules([])));
  }, []);

  const selectedRole = roles.find((r) => r.id === selectedRoleId);

  useEffect(() => {
    setSuccessMsg(null);
    setError("");
  }, [selectedRoleId]);

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

  function grantAllPermissions() {
    setPermissions((prev) => {
      const next: Record<string, Record<string, { enabled: boolean; scope: string }>> = {};
      for (const mod of modules) {
        next[mod.module] = {};
        for (const act of ACTIONS) {
          next[mod.module][act.key] = {
            enabled: true,
            scope: prev[mod.module]?.[act.key]?.scope || "All",
          };
        }
      }
      return next;
    });
  }

  function clearAllPermissions() {
    setPermissions((prev) => {
      const next: Record<string, Record<string, { enabled: boolean; scope: string }>> = {};
      for (const mod of modules) {
        next[mod.module] = {};
        for (const act of ACTIONS) {
          next[mod.module][act.key] = {
            enabled: false,
            scope: prev[mod.module]?.[act.key]?.scope || "All",
          };
        }
      }
      return next;
    });
  }

  function grantAllForModule(module: string) {
    setPermissions((prev) => ({
      ...prev,
      [module]: Object.fromEntries(
        ACTIONS.map((act) => [
          act.key,
          { enabled: true, scope: prev[module]?.[act.key]?.scope || "All" },
        ]),
      ),
    }));
  }

  async function handleSave() {
    if (!selectedRoleId) return;
    setError("");
    setSuccessMsg(null);
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
      setSuccessMsg({
        type: "ok",
        text: `Permissions saved successfully for ${selectedRole?.name ?? "role"}.`,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save permissions");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className={`${panelClass} overflow-hidden`}>
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Roles & permissions</h2>
              <p className="mt-1 text-xs text-slate-500">Configure which menus and actions each role can access. Read = menu visibility. Use Grant all to enable every module in this list.</p>
          </div>
          <Button type="button" onClick={() => setShowCreateRole(true)}>
            + New Security Role
          </Button>
        </div>
      <div className="flex flex-col lg:flex-row min-h-[400px]">
        <div className="w-full lg:w-56 border-b lg:border-b-0 lg:border-r border-slate-100 p-4">
          <div className="mb-2">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Select Role</p>
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
                {r.code ? (
                  <span className="mt-0.5 block text-[11px] font-normal text-slate-400">{r.code}</span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 p-6 overflow-x-auto">
          {!selectedRole ? (
            <p className="text-sm text-slate-400 py-8">Select a role to configure its permissions.</p>
          ) : (
            <>
              <FlashMessageBanner
                msg={successMsg}
                onClear={() => setSuccessMsg(null)}
                dismissMs={SUCCESS_BANNER_DISMISS_MS}
                className="mb-4"
              />
              <FormErrorAlert
                message={error}
                onDismiss={() => setError("")}
                className="mb-4 rounded-xl border border-rose-200/80 bg-rose-50 px-4 py-2.5 text-sm text-rose-800"
              />
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-700">
                  Permissions for {selectedRole.name}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" onClick={grantAllPermissions}>
                    Grant all
                  </Button>
                  <Button type="button" variant="secondary" onClick={clearAllPermissions}>
                    Clear all
                  </Button>
                </div>
              </div>
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
                        <td className="py-2.5 pr-4">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-700">{mod.label}</span>
                            <button
                              type="button"
                              onClick={() => grantAllForModule(mod.module)}
                              className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800"
                            >
                              All
                            </button>
                          </div>
                        </td>
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
                <Button type="button" onClick={() => void handleSave()} disabled={saving}>
                  {saving ? "Saving…" : "Save permissions"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
      </div>
      <CreateRoleModal
        open={showCreateRole}
        onClose={() => setShowCreateRole(false)}
        onCreated={() => void onSaved()}
      />
    </>
  );
}
