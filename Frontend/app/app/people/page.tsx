"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { Button } from "@/components/ui/Button";
import { CreateEmployeeModal } from "@/components/forms/CreateEmployeeModal";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api";
import { API_BASE_URL } from "@/config/constants";

interface Employee {
  id: string;
  employeeCode: string;
  fullName: string;
  departmentName: string | null;
  jobTitleName: string | null;
  positionTitle: string | null;
  status: string;
  terminationReason: string | null;
  managerName: string | null;
  locationName: string | null;
  isTopOfHierarchy: boolean;
  hasDirectSupervisor: boolean;
  profileImageUrl: string | null;
}

interface Lookup { id: string; name: string }

interface TaskProgress {
  employeeId: string;
  totalTasks: number;
  completedTasks: number;
}

interface Filters {
  search: string;
  employeeCode: string;
  status: string;
  departmentId: string;
  jobTitleId: string;
  locationId: string;
  managerId: string;
}

const emptyFilters: Filters = {
  search: "", employeeCode: "", status: "",
  departmentId: "", jobTitleId: "", locationId: "", managerId: "",
};

const statusBadge: Record<string, string> = {
  Active: "badge-green",
  Probation: "badge-blue",
  OnNotice: "badge-red",
  Terminated: "badge-red",
  Resigned: "badge-orange",
  Inactive: "badge-orange",
  OnLeave: "badge-blue",
};

interface StatusType { code: string; name: string; }

export default function PeoplePage() {
  const router = useRouter();
  const { hasPermission, isAdmin, getPeopleReadScope, user } = useAuth();
  const canCreateEmployee = isAdmin || hasPermission("People", "Create");
  const peopleScope = getPeopleReadScope();
  const showSimplifiedView = peopleScope === "Own";
  const [showCreate, setShowCreate] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [quickSearch, setQuickSearch] = useState("");
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(emptyFilters);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [activeOnly, setActiveOnly] = useState(true);

  const [departments, setDepartments] = useState<Lookup[]>([]);
  const [jobTitles, setJobTitles] = useState<Lookup[]>([]);
  const [locations, setLocations] = useState<Lookup[]>([]);
  const [managers, setManagers] = useState<Lookup[]>([]);
  const [onboardingProgress, setOnboardingProgress] = useState<Map<string, TaskProgress>>(new Map());
  const [offboardingProgress, setOffboardingProgress] = useState<Map<string, TaskProgress>>(new Map());
  const [statusTypes, setStatusTypes] = useState<StatusType[]>([]);

  useEffect(() => {
    Promise.all([
      apiFetch<Lookup[]>("/api/organization/departments").catch(() => []),
      apiFetch<Lookup[]>("/api/organization/job-titles").catch(() => []),
      apiFetch<Lookup[]>("/api/organization/locations").catch(() => []),
      apiFetch<{ items: { id: string; fullName: string }[] }>("/api/employees?pageSize=200&excludeTerminated=true")
        .then((r) => r.items.map((e) => ({ id: e.id, name: e.fullName })))
        .catch(() => []),
      apiFetch<StatusType[]>("/api/organization/employment-statuses").catch(() => []),
    ]).then(([d, j, l, m, st]) => {
      setDepartments(d);
      setJobTitles(j);
      setLocations(l);
      setManagers(m);
      setStatusTypes(st);
    });

    apiFetch<TaskProgress[]>("/api/employee-tasks/onboarding/active")
      .then((list) => {
        const map = new Map<string, TaskProgress>();
        list.forEach((p) => map.set(p.employeeId, p));
        setOnboardingProgress(map);
      })
      .catch(() => {});

    apiFetch<TaskProgress[]>("/api/offboarding/active")
      .then((list) => {
        const map = new Map<string, TaskProgress>();
        list.forEach((p) => map.set(p.employeeId, p));
        setOffboardingProgress(map);
      })
      .catch(() => {});
  }, []);

  const loadEmployees = useCallback(async (f: Filters, p: number, exclTerminated: boolean) => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(p));
    params.set("pageSize", "20");
    if (f.search) params.set("search", f.search);
    if (f.employeeCode) params.set("search", f.employeeCode);
    if (f.status) params.set("status", f.status);
    if (f.departmentId) params.set("departmentId", f.departmentId);
    if (f.jobTitleId) params.set("jobTitleId", f.jobTitleId);
    if (f.locationId) params.set("locationId", f.locationId);
    if (f.managerId) params.set("managerId", f.managerId);
    if (exclTerminated) params.set("excludeTerminated", "true");
    try {
      const r = await apiFetch<{ items: Employee[]; totalCount: number; totalPages: number }>(
        `/api/employees?${params.toString()}`
      );
      setEmployees(r.items);
      setTotalEmployees(r.totalCount);
      setTotalPages(r.totalPages);
    } catch {
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadEmployees(appliedFilters, page, activeOnly); }, [appliedFilters, page, activeOnly, loadEmployees]);

  function handleQuickSearch() {
    const next = { ...emptyFilters, search: quickSearch };
    setFilters(next);
    setAppliedFilters(next);
    setPage(1);
  }

  function handleSearch() {
    setAppliedFilters({ ...filters });
    setPage(1);
    setShowFilters(false);
  }

  function handleReset() {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setQuickSearch("");
    setPage(1);
  }

  const activeFilterCount = Object.values(appliedFilters).filter(Boolean).length;

  const selectClass =
    "w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20";
  const inputClass = selectClass;
  const labelClass = "mb-1 block text-xs font-semibold text-[var(--primary)]";

  useEffect(() => {
    if (showSimplifiedView && user?.employeeId) {
      router.replace(`/app/people/${user.employeeId}`);
    }
  }, [showSimplifiedView, user?.employeeId, router]);

  if (showSimplifiedView) {
    if (user?.employeeId) {
      return (
        <div className="flex min-h-[200px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
        </div>
      );
    }
    return (
      <>
        <AppTopbar
          title="My Profile"
          subtitle="View and manage your personal information."
        />
        <div className="mx-auto max-w-xl">
          <div className="hris-card flex flex-col items-center justify-center gap-6 py-12 text-center">
            <p className="text-sm text-[var(--text-muted)]">
              Your account is not linked to an employee profile. Contact HR for assistance.
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <AppTopbar
        title="People Hub"
        subtitle="Central employee master, contracts, documents, and lifecycle changes."
      />

      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Employee Name"
              className="w-[260px] rounded-xl border border-[var(--border)] bg-white py-2.5 pl-3 pr-9 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleQuickSearch(); }}
            />
            <button
              onClick={handleQuickSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[var(--primary)]"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </div>
          <div className="flex items-center rounded-xl border border-slate-200 bg-white overflow-hidden">
            <button
              onClick={() => { setActiveOnly(true); setPage(1); }}
              className={`px-3 py-2 text-xs font-medium transition ${activeOnly ? "bg-[var(--primary)] text-white" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"}`}
            >
              Active
            </button>
            <button
              onClick={() => { setActiveOnly(false); setPage(1); }}
              className={`px-3 py-2 text-xs font-medium transition ${!activeOnly ? "bg-[var(--primary)] text-white" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"}`}
            >
              All
            </button>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`relative flex h-10 w-10 items-center justify-center rounded-xl border transition ${showFilters ? "border-blue-400 bg-blue-50 text-blue-600" : "border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:text-slate-600"}`}
            title={showFilters ? "Hide Filters" : "Filters"}
          >
            <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            {activeFilterCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
        {canCreateEmployee && (
          <Button onClick={() => setShowCreate(true)}>+ Create New Employee</Button>
        )}
      </div>

      {canCreateEmployee && (
      <CreateEmployeeModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => { loadEmployees(appliedFilters, page, activeOnly); }}
      />
      )}

      {/* Advanced Filter Panel */}
      {showFilters && (
        <div className="hris-card mb-6">
          <div className="mb-4 rounded-xl bg-[var(--primary)] px-5 py-3">
            <h3 className="text-base font-bold text-white">Filter Employees By</h3>
          </div>
          <div className="grid gap-4 px-1 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Employee Name</label>
              <input
                type="text"
                className={inputClass}
                placeholder="Employee Name"
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelClass}>Employee Id</label>
              <input
                type="text"
                className={inputClass}
                placeholder="Employee Code"
                value={filters.employeeCode}
                onChange={(e) => setFilters((f) => ({ ...f, employeeCode: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelClass}>Employment Status</label>
              <select
                className={selectClass}
                value={filters.status}
                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="">All</option>
                {statusTypes.map((s) => (
                  <option key={s.code} value={s.code}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Supervisor Name</label>
              <select
                className={selectClass}
                value={filters.managerId}
                onChange={(e) => setFilters((f) => ({ ...f, managerId: e.target.value }))}
              >
                <option value="">All</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Job Title</label>
              <select
                className={selectClass}
                value={filters.jobTitleId}
                onChange={(e) => setFilters((f) => ({ ...f, jobTitleId: e.target.value }))}
              >
                <option value="">All</option>
                {jobTitles.map((j) => (
                  <option key={j.id} value={j.id}>{j.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Sub Unit / Department</label>
              <select
                className={selectClass}
                value={filters.departmentId}
                onChange={(e) => setFilters((f) => ({ ...f, departmentId: e.target.value }))}
              >
                <option value="">All</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Location</label>
              <select
                className={selectClass}
                value={filters.locationId}
                onChange={(e) => setFilters((f) => ({ ...f, locationId: e.target.value }))}
              >
                <option value="">All</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-5 flex items-center justify-center gap-3">
            <Button variant="secondary" onClick={handleReset}>Reset</Button>
            <Button variant="secondary" onClick={() => setShowFilters(false)}>Cancel</Button>
            <Button onClick={handleSearch}>Search</Button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">Employee Directory</h3>
          <span className="text-[11px] text-slate-400">{totalEmployees} records{activeFilterCount > 0 ? " (filtered)" : ""}</span>
        </div>
        {loading ? (
          <p className="py-8 text-center text-xs text-slate-400">Loading...</p>
        ) : employees.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-400">
            {activeFilterCount > 0 ? "No employees match your filters." : "No employees found. Create one to get started."}
          </p>
        ) : (
          <>
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="w-10 py-2 pl-4 pr-1"></th>
                  <th className="py-2 px-2 text-left font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Employee</th>
                  <th className="py-2 px-2 text-left font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Department</th>
                  <th className="py-2 px-2 text-left font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Role</th>
                  <th className="py-2 px-2 text-left font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Status</th>
                  <th className="py-2 px-2 text-left font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Onboarding</th>
                  <th className="py-2 px-2 text-left font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Offboarding</th>
                  <th className="py-2 px-2 pr-4 text-left font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Supervisor</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => {
                  const ob = onboardingProgress.get(emp.id);
                  const ofb = offboardingProgress.get(emp.id);
                  const initials = emp.fullName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
                  return (
                    <tr key={emp.id} onClick={() => router.push(`/app/people/${emp.id}`)} className="cursor-pointer border-b border-slate-100 transition hover:bg-slate-50/60">
                      <td className="py-1.5 pl-4 pr-1 w-10">
                        {emp.profileImageUrl ? (
                          <img
                            src={`${API_BASE_URL}${emp.profileImageUrl}`}
                            alt={emp.fullName}
                            className="h-7 w-7 rounded-full object-cover ring-1 ring-slate-200"
                          />
                        ) : (
                          <div className="flex h-7 w-7 items-center justify-center rounded-full ring-1 ring-slate-200 bg-gradient-to-br from-slate-100 to-blue-50 text-[10px] font-semibold text-slate-500">
                            {initials}
                          </div>
                        )}
                      </td>
                      <td className="py-1.5 px-2">
                        <div className="flex items-center gap-1">
                          <span className="font-medium text-slate-800">{emp.fullName}</span>
                          {emp.isTopOfHierarchy && (
                            <span title="Top of Hierarchy" className="inline-flex shrink-0">
                              <svg className="h-3 w-3 text-amber-500" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clipRule="evenodd" /></svg>
                            </span>
                          )}
                          {!emp.isTopOfHierarchy && !emp.hasDirectSupervisor && (
                            <span title="No direct supervisor assigned" className="inline-flex shrink-0">
                              <svg className="h-3 w-3 text-amber-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 leading-tight">{emp.employeeCode}</div>
                      </td>
                      <td className="py-1.5 px-2 text-slate-600">{emp.departmentName ?? "—"}</td>
                      <td className="py-1.5 px-2 text-slate-600">{emp.jobTitleName ?? emp.positionTitle ?? "—"}</td>
                      <td className="py-1.5 px-2">
                        <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium leading-none ${
                          emp.status === "Terminated" ? "bg-red-50 text-red-600" :
                          emp.status === "Resigned" || emp.status === "Inactive" ? "bg-amber-50 text-amber-600" :
                          emp.status === "Probation" || emp.status === "OnLeave" ? "bg-blue-50 text-blue-600" :
                          "bg-emerald-50 text-emerald-600"
                        }`}>{statusTypes.find(s => s.code === emp.status)?.name ?? emp.status}</span>
                        {emp.status === "Terminated" && emp.terminationReason && (
                          <span className="ml-1 text-[10px] text-red-400">({emp.terminationReason})</span>
                        )}
                      </td>
                      <td className="py-1.5 px-2">
                        {ob ? (
                          <div className="flex items-center gap-1.5 min-w-[80px]">
                            <div className="flex-1 h-1 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${ob.completedTasks === ob.totalTasks ? "bg-emerald-500" : "bg-blue-500"}`}
                                style={{ width: `${Math.round((ob.completedTasks / ob.totalTasks) * 100)}%` }}
                              />
                            </div>
                            <span className="text-[9px] text-slate-400 tabular-nums">{ob.completedTasks}/{ob.totalTasks}</span>
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="py-1.5 px-2">
                        {ofb ? (
                          <div className="flex items-center gap-1.5 min-w-[80px]">
                            <div className="flex-1 h-1 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${ofb.completedTasks === ofb.totalTasks ? "bg-emerald-500" : "bg-orange-500"}`}
                                style={{ width: `${Math.round((ofb.completedTasks / ofb.totalTasks) * 100)}%` }}
                              />
                            </div>
                            <span className="text-[9px] text-slate-400 tabular-nums">{ofb.completedTasks}/{ofb.totalTasks}</span>
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="py-1.5 px-2 pr-4 text-slate-600">{emp.managerName ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 border-t border-slate-100 py-2.5">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-30"
                >
                  Previous
                </button>
                <span className="text-[11px] text-slate-400 tabular-nums">Page {page} of {totalPages}</span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-30"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
