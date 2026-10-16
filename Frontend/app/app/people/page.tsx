"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { TablePagination } from "@/components/ui";
import { CreateEmployeeModal } from "@/components/forms/CreateEmployeeModal";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { filterLookupsByAllowedIds } from "@/lib/people-scope-filters";
import { apiFetch } from "@/lib/api";
import { resolveAssetUrl } from "@/config/constants";
import { ROUTES } from "@/config/routes";
import { formatDate } from "@/lib/date-utils";
import {
  type EmploymentTypeCatalogItem,
  employmentTypeDisplayName,
  employmentTypeFilterOptions,
} from "@/lib/employment-types";
import { sanitizeSearchInput } from "@/lib/input-validation";
import { formatFirstNameOnly, formatSupervisorFirstNames } from "@/lib/person-display";
import { PeopleHubSearchBar } from "@/components/people/PeopleHubSearchBar";
import { PeopleHubEmployeeFavoriteButton } from "@/components/people/PeopleHubEmployeeFavoriteButton";
import {
  loadPeopleHubEmployeeFavorites,
  savePeopleHubEmployeeFavorites,
  createPeopleHubEmployeeFavorite,
  type PeopleHubEmployeeFavorite,
  type PeopleHubDiscoverEmployee,
} from "@/lib/people-hub-employee-favorites";
import {
  groupEmployeesByKey,
  peopleGroupByLabel,
  type PeopleGroupByKey,
  type PeopleHubStatusFilter,
  type PeopleHubFieldFilterKey,
  type PeopleHubFilterPill,
  type PeopleHubFilterSection,
} from "@/lib/people-hub-search";
import { useMultiCompanyFeature } from "@/lib/use-multi-company-feature";

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

interface Filters {
  search: string;
  employeeCode: string;
  status: string;
  employmentType: string;
  departmentId: string;
  jobTitleId: string;
  locationId: string;
  managerId: string;
  companyProfileKey: string;
}

const emptyFilters: Filters = {
  search: "", employeeCode: "", status: "", employmentType: "",
  departmentId: "", jobTitleId: "", locationId: "", managerId: "",
  companyProfileKey: "",
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
const PEOPLE_PAGE_SIZE = 25;
const PEOPLE_VIEW_STORAGE_KEY = "opensky.peopleHub.viewMode";

type PeopleHubViewMode = "medium" | "small" | "details";

const PEOPLE_VIEW_OPTIONS: { mode: PeopleHubViewMode; label: string }[] = [
  { mode: "medium", label: "Medium icons" },
  { mode: "small", label: "Small icons" },
  { mode: "details", label: "Details" },
];

function PeopleViewIcon({ mode }: { mode: PeopleHubViewMode }) {
  const cls = "h-4 w-4 shrink-0";
  switch (mode) {
    case "medium":
      return (
        <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" aria-hidden>
          <rect x="4" y="2" width="8" height="8" rx="1.25" />
          <path d="M3 13h10" />
        </svg>
      );
    case "small":
      return (
        <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" aria-hidden>
          <circle cx="4" cy="4" r="1.5" />
          <circle cx="8" cy="4" r="1.5" />
          <circle cx="12" cy="4" r="1.5" />
          <circle cx="4" cy="8" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="12" cy="8" r="1.5" />
        </svg>
      );
    case "details":
      return (
        <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" aria-hidden>
          <path d="M3 4h10M3 8h10M3 12h10" />
        </svg>
      );
  }
}

function employeeInitials(fullName: string) {
  return fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function PeopleEmployeeAvatar({
  emp,
  className,
}: {
  emp: Employee;
  className: string;
}) {
  if (emp.profileImageUrl) {
    return (
      <img
        src={resolveAssetUrl(emp.profileImageUrl) ?? ""}
        alt={emp.fullName}
        className={`rounded-full object-cover ring-1 ring-slate-200 ${className}`}
      />
    );
  }
  return (
    <div
      className={`flex items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-blue-50 font-semibold text-slate-500 ring-1 ring-slate-200 ${className}`}
    >
      {employeeInitials(emp.fullName)}
    </div>
  );
}

function PeopleEmployeeBadges({ emp }: { emp: Employee }) {
  return (
    <>
      {emp.isTopOfHierarchy && (
        <span title="Top of Hierarchy" className="inline-flex shrink-0">
          <svg className="h-3 w-3 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
            <path
              fillRule="evenodd"
              d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      )}
      {emp.needsProfileSetup && (
        <span title="New hire — complete profile" className="inline-flex shrink-0">
          <svg className="h-3 w-3 text-amber-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        </span>
      )}
      {!emp.needsProfileSetup && !emp.isTopOfHierarchy && !emp.hasDirectSupervisor && (
        <span title="No direct supervisor" className="inline-flex shrink-0">
          <svg className="h-3 w-3 text-amber-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        </span>
      )}
    </>
  );
}

type EmployeeListStatusFilter = PeopleHubStatusFilter;


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
  const [quickSearch, setQuickSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState<Employee[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionTotal, setSuggestionTotal] = useState(0);
  const suggestDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const favoritesDiscoverDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [favoritesDiscoverQuery, setFavoritesDiscoverQuery] = useState("");
  const [favoritesDiscoverResults, setFavoritesDiscoverResults] = useState<PeopleHubDiscoverEmployee[]>([]);
  const [favoritesDiscoverLoading, setFavoritesDiscoverLoading] = useState(false);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(emptyFilters);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [page, setPage] = useState(1);
  const [listPageSize, setListPageSize] = useState(PEOPLE_PAGE_SIZE);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<EmployeeListStatusFilter>("active");
  const [sortBy, setSortBy] = useState<PeopleSortKey>("employeeCode");
  const [sortAsc, setSortAsc] = useState(true);
  const [viewMode, setViewMode] = useState<PeopleHubViewMode>("details");
  const [groupBy, setGroupBy] = useState<PeopleGroupByKey | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [employeeFavorites, setEmployeeFavorites] = useState<PeopleHubEmployeeFavorite[]>([]);
  const [favoriteSaveNotice, setFavoriteSaveNotice] = useState<string | null>(null);

  const [departments, setDepartments] = useState<Lookup[]>([]);
  const [jobTitles, setJobTitles] = useState<Lookup[]>([]);
  const [locations, setLocations] = useState<Lookup[]>([]);
  const [managers, setManagers] = useState<Lookup[]>([]);
  const [employmentTypes, setEmploymentTypes] = useState<EmploymentTypeCatalogItem[]>([]);
  const [stats, setStats] = useState({ total: 0, departments: 0, locations: 0, jobTitles: 0 });
  const { multiCompanyActive, companyFilterOptions } = useMultiCompanyFeature();

  const employmentTypeFilterOpts = useMemo(
    () => employmentTypeFilterOptions(employmentTypes),
    [employmentTypes]
  );

  const visibleLocations = useMemo(
    () => filterLookupsByAllowedIds(locations, user?.assignedLocationIds),
    [locations, user?.assignedLocationIds],
  );

  const visibleJobTitles = useMemo(
    () => filterLookupsByAllowedIds(jobTitles, user?.assignedJobTitleIds),
    [jobTitles, user?.assignedJobTitleIds],
  );

  useEffect(() => {
    if (multiCompanyActive) return;
    setAppliedFilters((prev) =>
      prev.companyProfileKey ? { ...prev, companyProfileKey: "" } : prev,
    );
    setFilters((prev) => (prev.companyProfileKey ? { ...prev, companyProfileKey: "" } : prev));
  }, [multiCompanyActive]);

  useEffect(() => {
    Promise.all([
      apiFetch<Lookup[]>("/api/organization/departments").catch(() => []),
      apiFetch<Lookup[]>("/api/organization/job-titles").catch(() => []),
      apiFetch<Lookup[]>("/api/organization/locations").catch(() => []),
      apiFetch<{ items: { id: string; fullName: string }[] }>("/api/employees?pageSize=200&excludeTerminated=true")
        .then((r) => r.items.map((e) => ({ id: e.id, name: e.fullName })))
        .catch(() => []),
      apiFetch<{ totalCount: number }>("/api/employees?pageSize=1&excludeTerminated=true").catch(() => ({ totalCount: 0 })),
      apiFetch<EmploymentTypeCatalogItem[]>("/api/organization/employment-statuses").catch(() => [] as EmploymentTypeCatalogItem[]),
    ]).then(([d, j, l, m, empResult, empTypes]) => {
      setDepartments(d);
      setJobTitles(j);
      setLocations(l);
      setManagers(m);
      setEmploymentTypes(empTypes);
      setStats({ total: empResult.totalCount, departments: d.length, locations: l.length, jobTitles: j.length });
    });
  }, []);

  const loadEmployees = useCallback(async (
    f: Filters,
    p: number,
    pageSize: number,
    listStatusFilter: EmployeeListStatusFilter,
    sortKey: PeopleSortKey,
    asc: boolean,
  ) => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(p));
    params.set("pageSize", String(pageSize));
    params.set("sortBy", sortKey);
    params.set("sortDir", asc ? "asc" : "desc");
    if (f.search) params.set("search", f.search);
    if (f.employeeCode) params.set("search", f.employeeCode);
    if (f.employmentType) params.set("employmentType", f.employmentType);
    if (f.departmentId) params.set("departmentId", f.departmentId);
    if (f.jobTitleId) params.set("jobTitleId", f.jobTitleId);
    if (f.locationId) params.set("locationId", f.locationId);
    if (f.managerId) params.set("managerId", f.managerId);
    if (f.companyProfileKey) params.set("companyProfileKey", f.companyProfileKey);
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
    loadEmployees(appliedFilters, page, listPageSize, statusFilter, sortBy, sortAsc);
  }, [appliedFilters, page, listPageSize, statusFilter, sortBy, sortAsc, loadEmployees]);

  useEffect(() => {
    setEmployeeFavorites(loadPeopleHubEmployeeFavorites());
  }, []);

  const employeeFavoriteIds = useMemo(
    () => new Set(employeeFavorites.map((fav) => fav.employeeId)),
    [employeeFavorites],
  );

  useEffect(() => {
    if (!groupBy) return;
    if (totalEmployees > PEOPLE_PAGE_SIZE && listPageSize === PEOPLE_PAGE_SIZE) {
      setListPageSize(totalEmployees);
      setPage(1);
    }
  }, [groupBy, totalEmployees, listPageSize]);

  function resetEmployeeListPaging() {
    setPage(1);
    setListPageSize(PEOPLE_PAGE_SIZE);
  }

  function handleQuickSearch() {
    const term = quickSearch.trim();
    const next = { ...appliedFilters, search: term };
    setFilters(next);
    setAppliedFilters(next);
    resetEmployeeListPaging();
    setShowSuggestions(false);
  }

  function applyFieldFilter(key: PeopleHubFieldFilterKey, value: string) {
    const current = appliedFilters[key];
    const nextValue = current === value ? "" : value;
    const next = { ...appliedFilters, [key]: nextValue };
    setFilters(next);
    setAppliedFilters(next);
    resetEmployeeListPaging();
  }

  function handleReset() {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setQuickSearch("");
    resetEmployeeListPaging();
    setSortBy("employeeCode");
    setSortAsc(true);
    setStatusFilter("active");
    setGroupBy(null);
    setCollapsedGroups(new Set());
  }

  function handleGroupByChange(key: PeopleGroupByKey | null) {
    setGroupBy(key);
    setCollapsedGroups(new Set());
    setPage(1);
    if (!key) {
      setListPageSize(PEOPLE_PAGE_SIZE);
    }
  }

  function toggleEmployeeFavorite(emp: Employee | PeopleHubDiscoverEmployee) {
    const isFavorite = employeeFavoriteIds.has(emp.id);
    const next = isFavorite
      ? employeeFavorites.filter((fav) => fav.employeeId !== emp.id)
      : [createPeopleHubEmployeeFavorite(emp), ...employeeFavorites.filter((fav) => fav.employeeId !== emp.id)];
    setEmployeeFavorites(next);
    savePeopleHubEmployeeFavorites(next);
    setFavoriteSaveNotice(isFavorite ? "Removed from favorites" : "Added to favorites");
    window.setTimeout(() => setFavoriteSaveNotice(null), 2500);
  }

  function handleDeleteEmployeeFavorite(id: string) {
    const next = employeeFavorites.filter((fav) => fav.id !== id);
    setEmployeeFavorites(next);
    savePeopleHubEmployeeFavorites(next);
    setFavoriteSaveNotice("Removed from favorites");
    window.setTimeout(() => setFavoriteSaveNotice(null), 2500);
  }

  function openEmployeeFavorite(favorite: PeopleHubEmployeeFavorite) {
    setShowSuggestions(false);
    router.push(`/app/people/${favorite.employeeId}`);
  }

  function toggleGroupCollapsed(key: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const employeeGroups = useMemo(() => {
    if (!groupBy) return null;
    return groupEmployeesByKey(employees, groupBy, employmentTypes);
  }, [employees, groupBy, employmentTypes]);

  const filterSections = useMemo<PeopleHubFilterSection[]>(
    () => [
      ...(multiCompanyActive
        ? [
            {
              key: "companyProfileKey" as const,
              label: "Company",
              options: companyFilterOptions.filter((opt) => opt.value !== ""),
            },
          ]
        : []),
      {
        key: "employmentType",
        label: "Employment Type",
        options: employmentTypeFilterOpts,
      },
      {
        key: "managerId",
        label: "Supervisor Name",
        options: managers.map((m) => ({ value: m.id, label: m.name })),
      },
      {
        key: "jobTitleId",
        label: "Job Title",
        options: visibleJobTitles.map((j) => ({ value: j.id, label: j.name })),
      },
      {
        key: "departmentId",
        label: "Sub Unit / Department",
        options: departments.map((d) => ({ value: d.id, label: d.name })),
      },
      {
        key: "locationId",
        label: "Location",
        options: visibleLocations.map((l) => ({ value: l.id, label: l.name })),
      },
    ],
    [
      multiCompanyActive,
      companyFilterOptions,
      employmentTypeFilterOpts,
      managers,
      visibleJobTitles,
      departments,
      visibleLocations,
    ],
  );

  const activeFilterValues = useMemo(
    () => ({
      employmentType: appliedFilters.employmentType || undefined,
      managerId: appliedFilters.managerId || undefined,
      jobTitleId: appliedFilters.jobTitleId || undefined,
      departmentId: appliedFilters.departmentId || undefined,
      locationId: appliedFilters.locationId || undefined,
      companyProfileKey: appliedFilters.companyProfileKey || undefined,
    }),
    [appliedFilters],
  );

  function removeAppliedFilter(key: keyof Filters) {
    const next = { ...appliedFilters, [key]: "" };
    setAppliedFilters(next);
    setFilters(next);
    if (key === "search") setQuickSearch("");
    resetEmployeeListPaging();
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
      case "companyProfileKey":
        return `Company: ${companyFilterOptions.find((c) => c.value === value)?.label ?? value}`;
      default:
        return value;
    }
  }

  const filterPills = useMemo<PeopleHubFilterPill[]>(() => {
    return (Object.entries(appliedFilters) as [keyof Filters, string][])
      .filter(
        ([key, value]) =>
          Boolean(value) &&
          key !== "status" &&
          key !== "search" &&
          key !== "employeeCode",
      )
      .map(([key, value]) => ({
        key,
        label: filterLabel(key, value),
      }));
  }, [appliedFilters, departments, jobTitles, locations, managers, employmentTypes, companyFilterOptions]);

  const hasActiveSearch = Boolean(appliedFilters.search.trim() || appliedFilters.employeeCode.trim());

  const hasListFilters =
    filterPills.length > 0 || statusFilter !== "active" || groupBy !== null || hasActiveSearch;

  function handleSortColumn(key: PeopleSortKey) {
    setPage(1);
    if (sortBy === key) setSortAsc((a) => !a);
    else {
      setSortBy(key);
      setSortAsc(true);
    }
  }

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
        applyEmployeeListStatusParams(params, statusFilter, appliedFilters);
        if (appliedFilters.companyProfileKey) {
          params.set("companyProfileKey", appliedFilters.companyProfileKey);
        }
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
  }, [quickSearch, statusFilter, appliedFilters.companyProfileKey]);

  const handleFavoritesDiscoverQueryChange = useCallback((query: string) => {
    setFavoritesDiscoverQuery(query);
  }, []);

  useEffect(() => {
    if (favoritesDiscoverDebounceRef.current) clearTimeout(favoritesDiscoverDebounceRef.current);
    const q = favoritesDiscoverQuery.trim();
    if (q.length < 1) {
      setFavoritesDiscoverResults([]);
      setFavoritesDiscoverLoading(false);
      return;
    }
    setFavoritesDiscoverLoading(true);
    favoritesDiscoverDebounceRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          pageSize: "10",
          search: q,
        });
        applyEmployeeListStatusParams(params, statusFilter, emptyFilters);
        const r = await apiFetch<{ items: Employee[] }>(`/api/employees?${params.toString()}`);
        setFavoritesDiscoverResults(
          r.items.map((emp) => ({
            id: emp.id,
            employeeCode: emp.employeeCode,
            fullName: emp.fullName,
            departmentName: emp.departmentName,
            jobTitleName: emp.jobTitleName,
            profileImageUrl: emp.profileImageUrl,
          })),
        );
      } catch {
        setFavoritesDiscoverResults([]);
      } finally {
        setFavoritesDiscoverLoading(false);
      }
    }, 280);
    return () => {
      if (favoritesDiscoverDebounceRef.current) clearTimeout(favoritesDiscoverDebounceRef.current);
    };
  }, [favoritesDiscoverQuery, statusFilter]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PEOPLE_VIEW_STORAGE_KEY);
      if (saved && PEOPLE_VIEW_OPTIONS.some((o) => o.mode === saved)) {
        setViewMode(saved as PeopleHubViewMode);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const searchSuggestionsPanel = showSuggestions && quickSearch.trim().length >= 1 ? (
    <div className="absolute left-0 top-[calc(100%+6px)] z-[100] w-[min(620px,calc(100vw-2rem))] max-h-[min(360px,calc(100vh-10rem))] overflow-y-auto rounded-xl border border-slate-200/90 bg-white shadow-xl shadow-slate-200/50">
      <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {suggestionsLoading ? "Searching…" : "Employees"}
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
        const initials = emp.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
        const idx = emp.fullName.toLowerCase().indexOf(quickSearch.toLowerCase());
        const isFavorite = employeeFavoriteIds.has(emp.id);
        return (
          <div
            key={emp.id}
            className="flex w-full items-center gap-2 px-3 py-2 transition-colors hover:bg-blue-50/60"
          >
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
              onClick={() => {
                setShowSuggestions(false);
                router.push(`/app/people/${emp.id}`);
              }}
            >
              {emp.profileImageUrl ? (
                <img src={resolveAssetUrl(emp.profileImageUrl) ?? ""} alt={emp.fullName} className="h-7 w-7 rounded-full object-cover ring-1 ring-slate-200" />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-blue-50 ring-1 ring-slate-200 text-[9px] font-semibold text-slate-500">
                  {initials}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-medium text-slate-800">
                  {idx >= 0 ? (
                    <>
                      {emp.fullName.slice(0, idx)}
                      <span className="bg-yellow-100 text-yellow-800">{emp.fullName.slice(idx, idx + quickSearch.length)}</span>
                      {emp.fullName.slice(idx + quickSearch.length)}
                    </>
                  ) : (
                    emp.fullName
                  )}
                </div>
                <div className="truncate text-[10px] text-slate-400">
                  {emp.employeeCode}
                  {emp.departmentName ? ` · ${emp.departmentName}` : ""}
                  {emp.jobTitleName ? ` · ${emp.jobTitleName}` : ""}
                </div>
              </div>
            </button>
            <PeopleHubEmployeeFavoriteButton
              active={isFavorite}
              size="sm"
              onToggle={() => toggleEmployeeFavorite(emp)}
            />
          </div>
        );
      })}
      {!suggestionsLoading && suggestionTotal > searchSuggestions.length && (
        <button
          className="flex w-full items-center justify-center gap-1 border-t border-slate-100 py-2 text-[11px] font-medium text-blue-600 transition hover:bg-blue-50/40"
          onClick={() => {
            setShowSuggestions(false);
            handleQuickSearch();
          }}
        >
          Show all {suggestionTotal} results
          <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </div>
  ) : null;

  function selectViewMode(mode: PeopleHubViewMode) {
    setViewMode(mode);
    try {
      localStorage.setItem(PEOPLE_VIEW_STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  }

  function openEmployeeProfile(id: string) {
    router.push(`/app/people/${id}`);
  }

  function renderGroupHeader(groupKey: string, count: number) {
    const collapsed = collapsedGroups.has(groupKey);
    const groupTitle = groupBy ? peopleGroupByLabel(groupBy) : "";
    return (
      <button
        type="button"
        onClick={() => toggleGroupCollapsed(groupKey)}
        className="flex w-full items-center gap-2 border-b border-slate-200 bg-slate-50/90 px-5 py-2.5 text-left transition hover:bg-slate-100/80"
      >
        <svg
          className={`h-3.5 w-3.5 shrink-0 text-slate-500 transition ${collapsed ? "-rotate-90" : ""}`}
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden
        >
          <path d="M10 14l-5-5h10l-5 5z" />
        </svg>
        <span className="text-[12px] font-semibold text-slate-700">
          {groupTitle}: {groupKey}
        </span>
        <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-medium tabular-nums text-slate-600">
          {count}
        </span>
      </button>
    );
  }

  function renderDetailsRow(emp: Employee) {
    const isFavorite = employeeFavoriteIds.has(emp.id);
    return (
      <tr
        key={emp.id}
        onClick={() => openEmployeeProfile(emp.id)}
        className={`cursor-pointer border-b transition-colors ${
          emp.needsProfileSetup
            ? "border-amber-200/80 bg-amber-50/90 hover:bg-amber-100/70"
            : "border-slate-100 hover:bg-blue-50/40"
        }`}
      >
        <td className="py-2 pl-5 pr-1">
          <PeopleEmployeeAvatar emp={emp} className="h-8 w-8 text-[10px]" />
        </td>
        <td className="px-3 py-2 font-mono text-[12px] text-slate-500">{emp.employeeCode}</td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-1">
            <span className="text-[12px] font-medium text-slate-800">
              {formatFirstNameOnly(emp.firstName || emp.fullName)}
            </span>
            <PeopleEmployeeBadges emp={emp} />
          </div>
        </td>
        <td className="px-3 py-2 text-[12px] text-slate-600">{emp.jobTitleName ?? emp.positionTitle ?? "—"}</td>
        <td className="px-3 py-2">
          <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium leading-none ${getStatusColor(emp.status)}`}>
            {emp.status}
          </span>
        </td>
        <td className="px-3 py-2 text-[11px] text-slate-500">
          {employmentTypeDisplayName(employmentTypes, emp.employmentType)}
        </td>
        <td className="px-3 py-2 text-[12px] text-slate-600">{emp.departmentName ?? "—"}</td>
        <td className="px-3 py-2 text-[12px] text-slate-600">{emp.locationName ?? "—"}</td>
        <td className="px-3 py-2 text-[12px] text-slate-600">
          {formatSupervisorFirstNames(emp.supervisorNames ?? emp.managerName)}
        </td>
        <td className="px-2 py-2 pr-5">
          <PeopleHubEmployeeFavoriteButton
            active={isFavorite}
            size="sm"
            onToggle={() => toggleEmployeeFavorite(emp)}
          />
        </td>
      </tr>
    );
  }

  function renderGridCard(emp: Employee) {
    const isFavorite = employeeFavoriteIds.has(emp.id);
    return (
      <div
        key={emp.id}
        className={`relative rounded-xl border ${employeeSurfaceClass(emp)}`}
      >
        <PeopleHubEmployeeFavoriteButton
          active={isFavorite}
          size="sm"
          className="absolute right-1.5 top-1.5 z-10"
          onToggle={() => toggleEmployeeFavorite(emp)}
        />
        <button
          type="button"
          onClick={() => openEmployeeProfile(emp.id)}
          className="flex w-full flex-col items-center p-3 pt-8 text-center"
        >
        <PeopleEmployeeAvatar
          emp={emp}
          className={viewMode === "medium" ? "h-14 w-14 text-sm" : "h-10 w-10 text-[10px]"}
        />
        <div className="mt-2 flex w-full min-w-0 items-center justify-center gap-1">
          <p
            className={`line-clamp-2 font-semibold text-slate-800 ${
              viewMode === "small" ? "text-[10px]" : "text-xs"
            }`}
          >
            {emp.fullName}
          </p>
          <PeopleEmployeeBadges emp={emp} />
        </div>
        <p className="mt-0.5 w-full truncate text-[10px] font-mono text-slate-500">{emp.employeeCode}</p>
        {(emp.jobTitleName ?? emp.positionTitle) && (
          <p
            className={`mt-1 w-full truncate text-slate-600 ${
              viewMode === "small" ? "text-[9px]" : "text-[11px]"
            }`}
          >
            {emp.jobTitleName ?? emp.positionTitle}
          </p>
        )}
        {viewMode === "medium" && emp.departmentName ? (
          <p className="mt-0.5 w-full truncate text-[10px] text-slate-500">{emp.departmentName}</p>
        ) : null}
        {viewMode === "medium" && emp.locationName ? (
          <p className="mt-0.5 w-full truncate text-[10px] text-slate-400">{emp.locationName}</p>
        ) : null}
        <span
          className={`mt-2 inline-block rounded px-1.5 py-0.5 font-medium leading-none ${getStatusColor(emp.status)} ${
            viewMode === "small" ? "text-[9px]" : "text-[10px]"
          }`}
        >
          {emp.status}
        </span>
        </button>
      </div>
    );
  }

  function employeeSurfaceClass(emp: Employee, extra = "") {
    const base = emp.needsProfileSetup
      ? "border-amber-200/80 bg-amber-50/90 hover:bg-amber-100/70"
      : "border-slate-100 bg-white hover:border-blue-200 hover:bg-blue-50/40";
    return `${base} ${extra}`.trim();
  }

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
        <div className="osky-phead mb-0">
          <div>
            <span className="osky-eyebrow">
              <i aria-hidden />
              OpenSky HRM · live
            </span>
            <h1>People Hub</h1>
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

      {canCreateEmployee && (
      <CreateEmployeeModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => { loadEmployees(appliedFilters, page, listPageSize, statusFilter, sortBy, sortAsc); }}
      />
      )}

      {favoriteSaveNotice && (
        <div className="mb-3 rounded-xl bg-emerald-50 px-4 py-2.5 text-[12px] font-medium text-emerald-700 ring-1 ring-emerald-100">
          {favoriteSaveNotice}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="relative z-30 flex flex-wrap items-center gap-x-3 gap-y-2 overflow-visible border-b border-slate-200/80 bg-slate-50/70 px-3 py-2.5">
          <div className="relative z-30 w-full min-w-0 max-w-lg overflow-visible">
            <PeopleHubSearchBar
              quickSearch={quickSearch}
              onQuickSearchChange={(value) => {
                setQuickSearch(sanitizeSearchInput(value));
                setShowSuggestions(true);
              }}
              onQuickSearchSubmit={handleQuickSearch}
              groupBy={groupBy}
              onGroupByChange={handleGroupByChange}
              statusFilter={statusFilter}
              onStatusFilterChange={(value) => {
                setStatusFilter(value);
                resetEmployeeListPaging();
              }}
              filterSections={filterSections}
              filterPills={filterPills}
              onFilterChange={applyFieldFilter}
              onRemoveFilter={removeAppliedFilter}
              activeFilterValues={activeFilterValues}
              onClearAll={handleReset}
              employeeFavorites={employeeFavorites}
              onOpenEmployeeFavorite={openEmployeeFavorite}
              onDeleteEmployeeFavorite={handleDeleteEmployeeFavorite}
              onFavoritesDiscoverQueryChange={handleFavoritesDiscoverQueryChange}
              favoritesDiscoverResults={favoritesDiscoverResults}
              favoritesDiscoverLoading={favoritesDiscoverLoading}
              isEmployeeFavorite={(employeeId) => employeeFavoriteIds.has(employeeId)}
              onToggleEmployeeFavorite={toggleEmployeeFavorite}
              showSuggestions={showSuggestions}
              onFocusSearch={() => {
                if (quickSearch.trim().length >= 1) setShowSuggestions(true);
              }}
              onDismissSuggestions={() => setShowSuggestions(false)}
              suggestionsSlot={searchSuggestionsPanel}
            />
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2.5">
            <span className="hidden text-[11px] font-medium tabular-nums text-slate-500 sm:inline">
              {loading ? "Loading…" : `${totalEmployees} ${totalEmployees === 1 ? "person" : "people"}`}
            </span>
            <div className="hidden h-5 w-px bg-slate-200 sm:block" aria-hidden />
            <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
              {PEOPLE_VIEW_OPTIONS.map((opt) => (
                <button
                  key={opt.mode}
                  type="button"
                  onClick={() => selectViewMode(opt.mode)}
                  title={opt.label}
                  aria-label={opt.label}
                  aria-pressed={viewMode === opt.mode}
                  className={`flex h-8 w-8 items-center justify-center rounded-md transition ${
                    viewMode === opt.mode
                      ? "bg-[#2B7DE9] text-white shadow-sm"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                  }`}
                >
                  <PeopleViewIcon mode={opt.mode} />
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="overflow-hidden">
        {loading ? (
          <p className="py-10 text-center text-xs text-slate-400">Loading...</p>
        ) : employees.length === 0 ? (
          <p className="py-10 text-center text-xs text-slate-400">
            {hasListFilters ? "No employees match your filters." : "No employees found. Create one to get started."}
          </p>
        ) : (
          <>
            {employees.some((e) => e.needsProfileSetup) && (
              <div className="border-b border-amber-200/80 bg-amber-50 px-5 py-2.5 text-xs text-amber-900">
                New hires converted from recruitment are listed first. Complete job title, location, and supervisor to clear the highlight.
              </div>
            )}
            {viewMode === "details" ? (
              employeeGroups ? (
                <div>
                  {employeeGroups.map((group) => (
                    <div key={group.key}>
                      {renderGroupHeader(group.key, group.items.length)}
                      {!collapsedGroups.has(group.key) && (
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
                                <PeopleSortHeader label="Supervisor" sortKey="supervisor" activeKey={sortBy} asc={sortAsc} onSort={handleSortColumn} />
                                <th className="w-10 py-2.5 pr-5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                  <span className="sr-only">Favorite</span>
                                  ★
                                </th>
                              </tr>
                            </thead>
                            <tbody>{group.items.map((emp) => renderDetailsRow(emp))}</tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
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
                      <PeopleSortHeader label="Supervisor" sortKey="supervisor" activeKey={sortBy} asc={sortAsc} onSort={handleSortColumn} />
                      <th className="w-10 py-2.5 pr-5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        <span className="sr-only">Favorite</span>
                        ★
                      </th>
                    </tr>
                  </thead>
                  <tbody>{employees.map((emp) => renderDetailsRow(emp))}</tbody>
                </table>
              </div>
              )
            ) : employeeGroups ? (
              <div className="space-y-2 p-4">
                {employeeGroups.map((group) => (
                  <div key={group.key}>
                    {renderGroupHeader(group.key, group.items.length)}
                    {!collapsedGroups.has(group.key) && (
                      <div
                        className={`grid gap-3 pt-3 ${
                          viewMode === "medium"
                            ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
                            : "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8"
                        }`}
                      >
                        {group.items.map((emp) => renderGridCard(emp))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div
                className={`grid gap-3 p-4 ${
                  viewMode === "medium"
                    ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
                    : "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8"
                }`}
              >
                {employees.map((emp) => renderGridCard(emp))}
              </div>
            )}
            {!groupBy && (
            <TablePagination
              page={page}
              totalPages={totalPages}
              totalCount={totalEmployees}
              pageSize={listPageSize}
              onPageChange={setPage}
              showSeeAll={totalEmployees > PEOPLE_PAGE_SIZE}
              seeAllActive={listPageSize >= totalEmployees && totalEmployees > PEOPLE_PAGE_SIZE}
              onSeeAll={() => {
                setListPageSize(totalEmployees);
                setPage(1);
              }}
              onShowPaged={() => {
                setListPageSize(PEOPLE_PAGE_SIZE);
                setPage(1);
              }}
              showPagePicker={!(listPageSize >= totalEmployees && totalEmployees > PEOPLE_PAGE_SIZE)}
            />
            )}
          </>
        )}
        </div>
      </div>
    </>
  );
}
