"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { Button } from "@/components/ui/Button";
import { FormSelect, TablePagination, type FormSelectOption } from "@/components/ui";
import { CreateEmployeeModal } from "@/components/forms/CreateEmployeeModal";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api";
import { API_BASE_URL } from "@/config/constants";
import { ROUTES } from "@/config/routes";
import { formatDate } from "@/lib/date-utils";
import {
  type EmploymentTypeCatalogItem,
  employmentTypeDisplayName,
  employmentTypeFilterOptions,
} from "@/lib/employment-types";
import { sanitizeSearchInput } from "@/lib/input-validation";
import { formatFirstNameOnly, formatSupervisorFirstNames } from "@/lib/person-display";

interface Employee {
  id: string;
  employeeCode: string;
  firstName: string;
  fullName: string;
  departmentName: string | null;
  jobTitleName: string | null;
  positionTitle: string | null;
  status: string;
  employmentType: string;
  managerName: string | null;
  supervisorNames: string | null;
  locationName: string | null;
  isTopOfHierarchy: boolean;
  hasDirectSupervisor: boolean;
  needsProfileSetup: boolean;
  profileImageUrl: string | null;
  joinDate: string;
  terminationDate: string | null;
}

interface Lookup { id: string; name: string }
interface StatusLookup { id: string; name: string; code: string }

interface Filters {
  search: string;
  employeeCode: string;
  status: string;
  employmentType: string;
  departmentId: string;
  jobTitleId: string;
  locationId: string;
  managerId: string;
}

const emptyFilters: Filters = {
  search: "", employeeCode: "", status: "", employmentType: "",
  departmentId: "", jobTitleId: "", locationId: "", managerId: "",
};

type PeopleSortKey =
  | "employeeCode"
  | "name"
  | "jobTitle"
  | "status"
  | "employmentType"
  | "department"
  | "location"
  | "supervisor";

function PeopleSortHeader({
  label,
  sortKey,
  activeKey,
  asc,
  onSort,
  className = "",
}: {
  label: string;
  sortKey: PeopleSortKey;
  activeKey: PeopleSortKey;
  asc: boolean;
  onSort: (k: PeopleSortKey) => void;
  className?: string;
}) {
  const active = activeKey === sortKey;
  return (
    <th className={`py-2.5 px-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500 ${className}`.trim()}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex max-w-full items-center gap-1 rounded px-0.5 py-0.5 -mx-0.5 text-left transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50"
      >
        <span className="min-w-0">{label}</span>
        {active && (
          <span className="shrink-0 text-slate-400" aria-hidden>
            {asc ? (
              <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
              </svg>
            ) : (
              <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            )}
          </span>
        )}
      </button>
    </th>
  );
}

const statusColorMap: Record<string, string> = {
  Active: "bg-emerald-50 text-emerald-600",
  OnNotice: "bg-amber-50 text-amber-600",
  Resigned: "bg-orange-50 text-orange-600",
  Terminated: "bg-red-50 text-red-600",
  Retired: "bg-slate-100 text-slate-500",
  Deceased: "bg-slate-100 text-slate-500",
  Absconded: "bg-red-50 text-red-600",
};

function getStatusColor(status: string): string {
  return statusColorMap[status] ?? "bg-slate-100 text-slate-500";
}

const employmentTypeLabels: Record<string, string> = {
  Freelance: "Freelance", FullTimeContract: "Full-Time Contract", FullTimeInternship: "Full-Time Internship",
  FullTimePermanent: "Full-Time Permanent", FullTimeProbation: "Full-Time Probation",
  PartTimeContract: "Part-Time Contract", PartTimeInternship: "Part-Time Internship", PartTimePermanent: "Part-Time Permanent",
};
const employmentTypeOptions = ["Freelance", "FullTimeContract", "FullTimeInternship", "FullTimePermanent", "FullTimeProbation", "PartTimeContract", "PartTimeInternship", "PartTimePermanent"];
const PEOPLE_PAGE_SIZE = 10;

type EmployeeListStatusFilter = "active" | "all" | "terminated";

const EMPLOYEE_LIST_STATUS_OPTIONS: FormSelectOption[] = [
  { value: "active", label: "Active" },
  { value: "all", label: "All" },
  { value: "terminated", label: "Terminated" },
];

const peopleFilterLabelClass = "mb-1 block text-xs font-medium text-slate-500";

function applyEmployeeListStatusParams(
  params: URLSearchParams,
  statusFilter: EmployeeListStatusFilter,
  f: Filters,
) {
  if (f.status) {
    params.set("status", f.status);
    return;
  }
  if (statusFilter === "terminated") {
    params.set("status", "Terminated");
  } else if (statusFilter === "active") {
    params.set("excludeTerminated", "true");
  }
}

export default function PeoplePage() {
  const router = useRouter();
  const { hasPermission, isAdmin, getPeopleReadScope, user } = useAuth();
  const canCreateEmployee = isAdmin || hasPermission("People", "Create");
  const peopleScope = getPeopleReadScope();
  const showSimplifiedView = peopleScope === "Own";
  const [showCreate, setShowCreate] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [quickSearch, setQuickSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState<Employee[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionTotal, setSuggestionTotal] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);
  const suggestDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(emptyFilters);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<EmployeeListStatusFilter>("active");
  const [sortBy, setSortBy] = useState<PeopleSortKey>("employeeCode");
  const [sortAsc, setSortAsc] = useState(true);

  const [departments, setDepartments] = useState<Lookup[]>([]);
  const [jobTitles, setJobTitles] = useState<Lookup[]>([]);
  const [locations, setLocations] = useState<Lookup[]>([]);
  const [managers, setManagers] = useState<Lookup[]>([]);
  const [employeeStatuses, setEmployeeStatuses] = useState<StatusLookup[]>([]);
  const [employmentTypes, setEmploymentTypes] = useState<EmploymentTypeCatalogItem[]>([]);
  const [stats, setStats] = useState({ total: 0, departments: 0, locations: 0, jobTitles: 0 });

  const employmentTypeFilterOpts = useMemo(
    () => employmentTypeFilterOptions(employmentTypes),
    [employmentTypes]
  );

  useEffect(() => {
    Promise.all([
      apiFetch<Lookup[]>("/api/organization/departments").catch(() => []),
      apiFetch<Lookup[]>("/api/organization/job-titles").catch(() => []),
      apiFetch<Lookup[]>("/api/organization/locations").catch(() => []),
      apiFetch<{ items: { id: string; fullName: string }[] }>("/api/employees?pageSize=200&excludeTerminated=true")
        .then((r) => r.items.map((e) => ({ id: e.id, name: e.fullName })))
        .catch(() => []),
      apiFetch<{ totalCount: number }>("/api/employees?pageSize=1&excludeTerminated=true").catch(() => ({ totalCount: 0 })),
      apiFetch<StatusLookup[]>("/api/organization/employee-statuses").catch(() => [] as StatusLookup[]),
      apiFetch<EmploymentTypeCatalogItem[]>("/api/organization/employment-statuses").catch(() => [] as EmploymentTypeCatalogItem[]),
    ]).then(([d, j, l, m, empResult, statuses, empTypes]) => {
      setDepartments(d);
      setJobTitles(j);
      setLocations(l);
      setManagers(m);
      setEmployeeStatuses(statuses);
      setEmploymentTypes(empTypes);
      setStats({ total: empResult.totalCount, departments: d.length, locations: l.length, jobTitles: j.length });
    });
  }, []);

  const loadEmployees = useCallback(async (
    f: Filters,
    p: number,
    listStatusFilter: EmployeeListStatusFilter,
    sortKey: PeopleSortKey,
    asc: boolean,
  ) => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(p));
    params.set("pageSize", String(PEOPLE_PAGE_SIZE));
    params.set("sortBy", sortKey);
    params.set("sortDir", asc ? "asc" : "desc");
    if (f.search) params.set("search", f.search);
    if (f.employeeCode) params.set("search", f.employeeCode);
    if (f.employmentType) params.set("employmentType", f.employmentType);
    if (f.departmentId) params.set("departmentId", f.departmentId);
    if (f.jobTitleId) params.set("jobTitleId", f.jobTitleId);
    if (f.locationId) params.set("locationId", f.locationId);
    if (f.managerId) params.set("managerId", f.managerId);
    applyEmployeeListStatusParams(params, listStatusFilter, f);
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

  useEffect(() => {
    loadEmployees(appliedFilters, page, statusFilter, sortBy, sortAsc);
  }, [appliedFilters, page, statusFilter, sortBy, sortAsc, loadEmployees]);

  function handleQuickSearch() {
    const term = quickSearch.trim();
    if (!term) {
      handleReset();
      setShowSuggestions(false);
      return;
    }
    const next = { ...emptyFilters, search: term };
    setFilters(next);
    setAppliedFilters(next);
    setPage(1);
    setShowSuggestions(false);
  }

  function handleSearch() {
    const next = { ...filters };
    setAppliedFilters(next);
    setFilters(next);
    setQuickSearch(next.search);
    setPage(1);
    setShowFilters(false);
  }

  function handleReset() {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setQuickSearch("");
    setPage(1);
    setSortBy("employeeCode");
    setSortAsc(true);
    setStatusFilter("active");
  }

  function openFilters() {
    setFilters({ ...appliedFilters });
    setQuickSearch(appliedFilters.search);
    setShowFilters(true);
  }

  function removeAppliedFilter(key: keyof Filters) {
    const next = { ...appliedFilters, [key]: "" };
    setAppliedFilters(next);
    setFilters(next);
    if (key === "search") setQuickSearch("");
    setPage(1);
  }

  function filterLabel(key: keyof Filters, value: string): string {
    switch (key) {
      case "search":
        return `Name: ${value}`;
      case "employeeCode":
        return `Employee ID: ${value}`;
      case "status":
        return `Status: ${value}`;
      case "employmentType":
        return `Employment type: ${employmentTypeLabels[value] ?? employmentTypeDisplayName(employmentTypes, value) ?? value}`;
      case "departmentId":
        return `Department: ${departments.find((d) => d.id === value)?.name ?? value}`;
      case "jobTitleId":
        return `Job title: ${jobTitles.find((j) => j.id === value)?.name ?? value}`;
      case "locationId":
        return `Location: ${locations.find((l) => l.id === value)?.name ?? value}`;
      case "managerId":
        return `Supervisor: ${managers.find((m) => m.id === value)?.name ?? value}`;
      default:
        return value;
    }
  }

  const activeFilterEntries = (Object.entries(appliedFilters) as [keyof Filters, string][])
    .filter(([, value]) => Boolean(value));

  function handleSortColumn(key: PeopleSortKey) {
    setPage(1);
    if (sortBy === key) setSortAsc((a) => !a);
    else {
      setSortBy(key);
      setSortAsc(true);
    }
  }

  const activeFilterCount = activeFilterEntries.length + (statusFilter !== "active" ? 1 : 0);

  useEffect(() => {
    if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
    const q = quickSearch.trim();
    if (q.length < 1) {
      setSearchSuggestions([]);
      setSuggestionTotal(0);
      setSuggestionsLoading(false);
      return;
    }
    setSuggestionsLoading(true);
    suggestDebounceRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          pageSize: "8",
          search: q,
        });
        applyEmployeeListStatusParams(params, statusFilter, emptyFilters);
        const r = await apiFetch<{ items: Employee[]; totalCount: number }>(
          `/api/employees?${params.toString()}`
        );
        setSearchSuggestions(r.items);
        setSuggestionTotal(r.totalCount);
      } catch {
        setSearchSuggestions([]);
        setSuggestionTotal(0);
      } finally {
        setSuggestionsLoading(false);
      }
    }, 280);
    return () => {
      if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
    };
  }, [quickSearch, statusFilter]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSuggestions(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  const statCards = [
    { label: "Total Employees", value: stats.total, icon: "M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z", iconColor: "text-[#3B8BEA]" },
    { label: "Departments", value: stats.departments, icon: "M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 0h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z", iconColor: "text-[#E8192C]" },
    { label: "Locations", value: stats.locations, icon: "M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z", iconColor: "text-[#3B8BEA]" },
    { label: "Job Titles", value: stats.jobTitles, icon: "M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z", iconColor: "text-[#E8192C]" },
  ];

  return (
    <>
      {/* Header */}
      <div className="mb-6 rounded-2xl border border-slate-200/80 bg-white px-6 py-5 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800">People Hub</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(isAdmin || hasPermission("People", "Read")) && !showSimplifiedView && (
              <Link
                href={ROUTES.peopleAuditTrail}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-600 shadow-sm transition-all hover:border-slate-300 hover:text-slate-800"
              >
                Audit trail
              </Link>
            )}
            {canCreateEmployee && (
              <button
                onClick={() => setShowCreate(true)}
                className="group flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-700 shadow-sm transition-all hover:border-[#2B7DE9] hover:text-[#2B7DE9] hover:shadow active:scale-[0.98]"
                title="Create Employee"
              >
                <svg className="h-4 w-4 text-[#2B7DE9]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                New Employee
              </button>
            )}
          </div>
        </div>

        {/* Stat Cards */}
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {statCards.map((s) => (
            <div key={s.label} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${s.iconColor === "text-[#2B7DE9]" ? "bg-blue-50" : "bg-red-50"}`}>
                <svg className={`h-5 w-5 ${s.iconColor}`} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d={s.icon} />
                </svg>
              </div>
              <div>
                <div className="text-lg font-bold tabular-nums text-slate-800">{s.value}</div>
                <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Search & Filters Bar */}
      <div className="mb-5 flex items-end justify-between gap-3">
        <div className="flex items-end gap-2">
          <div className="relative">
            <span className={`${peopleFilterLabelClass} invisible block`} aria-hidden="true">
              Status
            </span>
            <div className="relative" ref={searchRef}>
            <input
              type="text"
              placeholder="Search employees… (Enter)"
              className="h-9 w-[280px] rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-[13px] text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              value={quickSearch}
              onChange={(e) => { setQuickSearch(sanitizeSearchInput(e.target.value)); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={(e) => { if (e.key === "Enter") { handleQuickSearch(); } if (e.key === "Escape") setShowSuggestions(false); }}
            />
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {showSuggestions && quickSearch.trim().length >= 1 && (
              <div className="absolute left-0 top-full z-50 mt-1 w-[320px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {suggestionsLoading ? "Searching…" : "Suggestions"}
                </div>
                {!suggestionsLoading && searchSuggestions.length === 0 && (
                  <div className="px-3 py-3 text-[12px] text-slate-500">
                    No employees found
                    {statusFilter === "active" ? " (active only)" : statusFilter === "terminated" ? " (terminated only)" : ""}.
                    {statusFilter === "active" && (
                      <span className="mt-1 block text-[11px] text-slate-400">
                        Switch to All or Terminated in the status filter to widen results.
                      </span>
                    )}
                  </div>
                )}
                {searchSuggestions.map((emp) => {
                  const initials = emp.fullName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
                  const idx = emp.fullName.toLowerCase().indexOf(quickSearch.toLowerCase());
                  return (
                    <button
                      key={emp.id}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-blue-50/60"
                      onClick={() => { setShowSuggestions(false); router.push(`/app/people/${emp.id}`); }}
                    >
                      {emp.profileImageUrl ? (
                        <img src={`${API_BASE_URL}${emp.profileImageUrl}`} alt={emp.fullName} className="h-7 w-7 rounded-full object-cover ring-1 ring-slate-200" />
                      ) : (
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-blue-50 ring-1 ring-slate-200 text-[9px] font-semibold text-slate-500">{initials}</div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12px] font-medium text-slate-800">
                          {idx >= 0 ? (
                            <>{emp.fullName.slice(0, idx)}<span className="bg-yellow-100 text-yellow-800">{emp.fullName.slice(idx, idx + quickSearch.length)}</span>{emp.fullName.slice(idx + quickSearch.length)}</>
                          ) : emp.fullName}
                        </div>
                        <div className="truncate text-[10px] text-slate-400">{emp.employeeCode}{emp.departmentName ? ` · ${emp.departmentName}` : ""}{emp.jobTitleName ? ` · ${emp.jobTitleName}` : ""}</div>
                      </div>
                    </button>
                  );
                })}
                {!suggestionsLoading && suggestionTotal > searchSuggestions.length && (
                  <button
                    className="flex w-full items-center justify-center gap-1 border-t border-slate-100 py-2 text-[11px] font-medium text-blue-600 transition hover:bg-blue-50/40"
                    onClick={() => { setShowSuggestions(false); handleQuickSearch(); }}
                  >
                    Show all {suggestionTotal} results
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  </button>
                )}
              </div>
            )}
            </div>
          </div>
          <div className="w-36 shrink-0">
            <label className={peopleFilterLabelClass} htmlFor="people-status-filter">
              Status
            </label>
            <FormSelect
              id="people-status-filter"
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value as EmployeeListStatusFilter);
                setPage(1);
              }}
              options={EMPLOYEE_LIST_STATUS_OPTIONS}
              clearable={false}
              className="!h-9 min-h-9 text-[13px]"
            />
          </div>
          <button
            onClick={() => (showFilters ? setShowFilters(false) : openFilters())}
            className={`relative flex h-9 w-9 items-center justify-center rounded-xl border shadow-sm transition ${showFilters ? "border-blue-400 bg-blue-50 text-blue-600" : "border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:text-slate-600"}`}
            title={showFilters ? "Hide Filters" : "Filters"}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            {activeFilterCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
        <span className="text-[11px] text-slate-400">{totalEmployees} records{activeFilterCount > 0 ? " (filtered)" : ""}</span>
      </div>

      {activeFilterCount > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium text-slate-500">Active filters:</span>
          {activeFilterEntries.map(([key, value]) => (
            <button
              key={key}
              type="button"
              onClick={() => removeAppliedFilter(key)}
              className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-800 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-900"
              title="Remove filter"
            >
              {filterLabel(key, value)}
              <span aria-hidden>×</span>
            </button>
          ))}
          {statusFilter !== "active" && (
            <button
              type="button"
              onClick={() => { setStatusFilter("active"); setPage(1); }}
              className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-800 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-900"
              title="Remove filter"
            >
              {statusFilter === "terminated" ? "Terminated only" : "All statuses"}
              <span aria-hidden>×</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleReset}
            className="text-[11px] font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
          >
            Clear all
          </button>
        </div>
      )}

      {canCreateEmployee && (
      <CreateEmployeeModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => { loadEmployees(appliedFilters, page, statusFilter, sortBy, sortAsc); }}
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
              <label className={labelClass}>Status</label>
              <select
                className={selectClass}
                value={filters.status}
                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="">All</option>
                {employeeStatuses.map((s) => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Employment Type</label>
              <select
                className={selectClass}
                value={filters.employmentType}
                onChange={(e) => setFilters((f) => ({ ...f, employmentType: e.target.value }))}
              >
                <option value="">All</option>
                {employmentTypeOptions.map((s) => (
                  <option key={s} value={s}>{employmentTypeLabels[s]}</option>
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
          <div className="mt-4 flex items-center justify-center gap-3">
            <Button variant="secondary" onClick={handleReset}>Reset</Button>
            <Button variant="secondary" onClick={() => setShowFilters(false)}>Cancel</Button>
            <Button onClick={handleSearch}>Search</Button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        {loading ? (
          <p className="py-10 text-center text-xs text-slate-400">Loading...</p>
        ) : employees.length === 0 ? (
          <p className="py-10 text-center text-xs text-slate-400">
            {activeFilterCount > 0 ? "No employees match your filters." : "No employees found. Create one to get started."}
          </p>
        ) : (
          <>
            {employees.some((e) => e.needsProfileSetup) && (
              <div className="border-b border-amber-200/80 bg-amber-50 px-5 py-2.5 text-xs text-amber-900">
                New hires converted from recruitment are listed first. Complete job title, location, and supervisor to clear the highlight.
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th className="w-10 py-2.5 pl-5 pr-1"></th>
                    <PeopleSortHeader label="Employee Id" sortKey="employeeCode" activeKey={sortBy} asc={sortAsc} onSort={handleSortColumn} />
                    <PeopleSortHeader label="Name" sortKey="name" activeKey={sortBy} asc={sortAsc} onSort={handleSortColumn} />
                    <PeopleSortHeader label="Job Title" sortKey="jobTitle" activeKey={sortBy} asc={sortAsc} onSort={handleSortColumn} />
                    <PeopleSortHeader label="Status" sortKey="status" activeKey={sortBy} asc={sortAsc} onSort={handleSortColumn} />
                    <PeopleSortHeader label="Emp. Type" sortKey="employmentType" activeKey={sortBy} asc={sortAsc} onSort={handleSortColumn} />
                    <PeopleSortHeader label="Department" sortKey="department" activeKey={sortBy} asc={sortAsc} onSort={handleSortColumn} />
                    <PeopleSortHeader label="Location" sortKey="location" activeKey={sortBy} asc={sortAsc} onSort={handleSortColumn} />
                    <PeopleSortHeader label="Supervisor" sortKey="supervisor" activeKey={sortBy} asc={sortAsc} onSort={handleSortColumn} className="pr-5" />
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => {
                    const initials = emp.fullName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
                    return (
                      <tr
                        key={emp.id}
                        onClick={() => router.push(`/app/people/${emp.id}`)}
                        className={`cursor-pointer border-b transition-colors ${
                          emp.needsProfileSetup
                            ? "border-amber-200/80 bg-amber-50/90 hover:bg-amber-100/70"
                            : "border-slate-100 hover:bg-blue-50/40"
                        }`}
                      >
                        <td className="py-2 pl-5 pr-1">
                          {emp.profileImageUrl ? (
                            <img
                              src={`${API_BASE_URL}${emp.profileImageUrl}`}
                              alt={emp.fullName}
                              className="h-8 w-8 rounded-full object-cover ring-1 ring-slate-200"
                            />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-blue-50 ring-1 ring-slate-200 text-[10px] font-semibold text-slate-500">
                              {initials}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-3 text-[12px] font-mono text-slate-500">{emp.employeeCode}</td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1">
                            <span className="text-[12px] font-medium text-slate-800">
                              {formatFirstNameOnly(emp.firstName || emp.fullName)}
                            </span>
                            {emp.isTopOfHierarchy && (
                              <span title="Top of Hierarchy" className="inline-flex shrink-0">
                                <svg className="h-3 w-3 text-amber-500" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clipRule="evenodd" /></svg>
                              </span>
                            )}
                            {emp.needsProfileSetup && (
                              <span title="New hire from recruitment — complete job title, work location, and direct supervisor" className="inline-flex shrink-0">
                                <svg className="h-3 w-3 text-amber-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                              </span>
                            )}
                            {!emp.needsProfileSetup && !emp.isTopOfHierarchy && !emp.hasDirectSupervisor && (
                              <span title="No direct supervisor assigned" className="inline-flex shrink-0">
                                <svg className="h-3 w-3 text-amber-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-[12px] text-slate-600">{emp.jobTitleName ?? emp.positionTitle ?? "—"}</td>
                        <td className="py-2 px-3">
                          <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium leading-none ${
                            getStatusColor(emp.status)
                          }`}>{emp.status}</span>
                        </td>
                        <td className="py-2 px-3 text-[11px] text-slate-500">
                          {employmentTypeDisplayName(employmentTypes, emp.employmentType)}
                        </td>
                        <td className="py-2 px-3 text-[12px] text-slate-600">{emp.departmentName ?? "—"}</td>
                        <td className="py-2 px-3 text-[12px] text-slate-600">{emp.locationName ?? "—"}</td>
                        <td className="py-2 px-3 pr-5 text-[12px] text-slate-600">
                          {formatSupervisorFirstNames(emp.supervisorNames ?? emp.managerName)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <TablePagination
              page={page}
              totalPages={totalPages}
              totalCount={totalEmployees}
              pageSize={PEOPLE_PAGE_SIZE}
              onPageChange={setPage}
            />
          </>
        )}
      </div>
    </>
  );
}
