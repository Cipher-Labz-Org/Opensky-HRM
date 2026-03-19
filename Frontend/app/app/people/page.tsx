"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { Button } from "@/components/ui/Button";
import { CreateEmployeeModal } from "@/components/forms/CreateEmployeeModal";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api";

interface Employee {
  id: string;
  employeeCode: string;
  fullName: string;
  departmentName: string | null;
  jobTitleName: string | null;
  positionTitle: string | null;
  status: string;
  managerName: string | null;
  locationName: string | null;
  isTopOfHierarchy: boolean;
  hasDirectSupervisor: boolean;
}

interface Lookup { id: string; name: string }

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

const statusLabels: Record<string, string> = { Freelance: "Freelance", FullTimeContract: "Full-Time Contract", FullTimeInternship: "Full-Time Internship", FullTimePermanent: "Full-Time Permanent", FullTimeProbation: "Full-Time Probation", PartTimeContract: "Part-Time Contract", PartTimeInternship: "Part-Time Internship", PartTimePermanent: "Part-Time Permanent" };
const statusOptions = ["Freelance", "FullTimeContract", "FullTimeInternship", "FullTimePermanent", "FullTimeProbation", "PartTimeContract", "PartTimeInternship", "PartTimePermanent"];

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
  const [counts, setCounts] = useState({ bu: 0, grades: 0, jobs: 0 });

  const [departments, setDepartments] = useState<Lookup[]>([]);
  const [jobTitles, setJobTitles] = useState<Lookup[]>([]);
  const [locations, setLocations] = useState<Lookup[]>([]);
  const [managers, setManagers] = useState<Lookup[]>([]);

  useEffect(() => {
    Promise.all([
      apiFetch<Lookup[]>("/api/organization/departments").catch(() => []),
      apiFetch<Lookup[]>("/api/organization/job-titles").catch(() => []),
      apiFetch<Lookup[]>("/api/organization/locations").catch(() => []),
      apiFetch<{ items: { id: string; fullName: string }[] }>("/api/employees?pageSize=200")
        .then((r) => r.items.map((e) => ({ id: e.id, name: e.fullName })))
        .catch(() => []),
    ]).then(([d, j, l, m]) => {
      setDepartments(d);
      setJobTitles(j);
      setLocations(l);
      setManagers(m);
    });
    Promise.all([
      apiFetch<Lookup[]>("/api/organization/business-units").then((r) => r.length).catch(() => 0),
      apiFetch<Lookup[]>("/api/organization/grades").then((r) => r.length).catch(() => 0),
      apiFetch<Lookup[]>("/api/organization/job-titles").then((r) => r.length).catch(() => 0),
    ]).then(([bu, grades, jobs]) => setCounts({ bu, grades, jobs }));
  }, []);

  const loadEmployees = useCallback(async (f: Filters, p: number) => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(p));
    params.set("pageSize", "10");
    if (f.search) params.set("search", f.search);
    if (f.employeeCode) params.set("search", f.employeeCode);
    if (f.status) params.set("status", f.status);
    if (f.departmentId) params.set("departmentId", f.departmentId);
    if (f.jobTitleId) params.set("jobTitleId", f.jobTitleId);
    if (f.locationId) params.set("locationId", f.locationId);
    if (f.managerId) params.set("managerId", f.managerId);
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

  useEffect(() => { loadEmployees(appliedFilters, page); }, [appliedFilters, page, loadEmployees]);

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
          <Button
            variant="secondary"
            onClick={() => setShowFilters(!showFilters)}
          >
            <svg className="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            {showFilters ? "Hide Filters" : "Filters"}
            {activeFilterCount > 0 && (
              <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--primary)] text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>
        {canCreateEmployee && (
          <Button onClick={() => setShowCreate(true)}>+ Create New Employee</Button>
        )}
      </div>

      {canCreateEmployee && (
      <CreateEmployeeModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => { loadEmployees(appliedFilters, page); }}
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
                {statusOptions.map((s) => (
                  <option key={s} value={s}>{statusLabels[s]}</option>
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

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="hris-card lg:col-span-2">
          <div className="section-title">
            <h3>Employee Directory</h3>
            <span>{totalEmployees} records{activeFilterCount > 0 ? " (filtered)" : ""}</span>
          </div>
          {loading ? (
            <p className="py-6 text-center text-sm text-[var(--text-muted)]">Loading...</p>
          ) : employees.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--text-muted)]">
              {activeFilterCount > 0 ? "No employees match your filters." : "No employees found. Create one to get started."}
            </p>
          ) : (
            <>
              <table className="hris-table">
                <thead>
                  <tr><th>Employee</th><th>Department</th><th>Role</th><th>Status</th><th>Manager</th></tr>
                </thead>
                <tbody>
                  {employees.map((emp) => (
                    <tr key={emp.id} onClick={() => router.push(`/app/people/${emp.id}`)} className="cursor-pointer transition hover:bg-[var(--bg-subtle)]">
                      <td>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium">{emp.fullName}</span>
                          {emp.isTopOfHierarchy && (
                            <span title="Top of Hierarchy" className="inline-flex shrink-0">
                              <svg className="h-4 w-4 text-amber-500" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clipRule="evenodd" /></svg>
                            </span>
                          )}
                          {!emp.isTopOfHierarchy && !emp.hasDirectSupervisor && (
                            <span title="No direct supervisor assigned – cannot apply for leave" className="inline-flex shrink-0">
                              <svg className="h-4 w-4 text-amber-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[var(--text-muted)]">{emp.employeeCode}</div>
                      </td>
                      <td>{emp.departmentName ?? "—"}</td>
                      <td>{emp.jobTitleName ?? emp.positionTitle ?? "—"}</td>
                      <td><span className={`badge ${statusBadge[emp.status] ?? "badge-blue"}`}>{emp.status}</span></td>
                      <td>{emp.managerName ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-[var(--text-muted)]">Page {page} of {totalPages}</span>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
        <div className="hris-card">
          <div className="section-title">
            <h3>Master Data Blocks</h3>
            <span>Reusable configuration</span>
          </div>
          <div className="hris-list">
            <div className="hris-list-item">
              <div><strong>Business Units</strong><small>{counts.bu} configured</small></div>
              <Link href="/app/settings?edit=business-units" className="badge badge-blue no-underline hover:opacity-80">Edit</Link>
            </div>
            <div className="hris-list-item">
              <div><strong>Grades &amp; Bands</strong><small>{counts.grades} pay grades</small></div>
              <Link href="/app/settings?edit=grades" className="badge badge-blue no-underline hover:opacity-80">Edit</Link>
            </div>
            <div className="hris-list-item">
              <div><strong>Job Catalog</strong><small>{counts.jobs} job titles</small></div>
              <Link href="/app/settings?edit=job-titles" className="badge badge-blue no-underline hover:opacity-80">Edit</Link>
            </div>
            <div className="hris-list-item">
              <div><strong>Document Types</strong><small>Manage in settings</small></div>
              <Link href="/app/settings?edit=document-types" className="badge badge-blue no-underline hover:opacity-80">Edit</Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="hris-card">
          <div className="section-title">
            <h3>Lifecycle Transactions</h3>
            <span>Controlled via workflows</span>
          </div>
          <div className="hris-list">
            <div className="hris-list-item">
              <div><strong>New Hire</strong><small>Create person, assign position, open onboarding</small></div>
              <span>&rarr;</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Promotion / Transfer</strong><small>Manage effective date, salary, reporting line</small></div>
              <span>&rarr;</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Contract Renewal</strong><small>Alert before expiry, revised terms</small></div>
              <span>&rarr;</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Separation</strong><small>Resignation, termination, final clearance</small></div>
              <span>&rarr;</span>
            </div>
          </div>
        </div>
        <div className="hris-card">
          <div className="section-title">
            <h3>Document Compliance</h3>
            <span>Expiry watch</span>
          </div>
          <table className="hris-table">
            <thead>
              <tr><th>Document</th><th>Count</th><th>Risk</th></tr>
            </thead>
            <tbody>
              <tr><td>Passport/Visa</td><td>18</td><td><span className="badge badge-orange">30 days</span></td></tr>
              <tr><td>Medical certificates</td><td>9</td><td><span className="badge badge-red">Expired</span></td></tr>
              <tr><td>Probation letters</td><td>31</td><td><span className="badge badge-blue">Due review</span></td></tr>
              <tr><td>Contract addendums</td><td>14</td><td><span className="badge badge-orange">Pending sign</span></td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <p className="footer-note">
        Prototype prepared as a downloadable UI concept. All numbers and employee records are sample data for design purposes.
      </p>
    </>
  );
}
