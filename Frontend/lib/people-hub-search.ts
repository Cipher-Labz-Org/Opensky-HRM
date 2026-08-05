import type { EmploymentTypeCatalogItem } from "@/lib/employment-types";
import { employmentTypeDisplayName } from "@/lib/employment-types";
import { formatSupervisorFirstNames } from "@/lib/person-display";

export type PeopleHubStatusFilter = "active" | "all" | "terminated";

export const PEOPLE_STATUS_FILTER_OPTIONS: { value: PeopleHubStatusFilter; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "all", label: "All" },
  { value: "terminated", label: "Terminated" },
];

export function peopleStatusFilterLabel(value: PeopleHubStatusFilter): string {
  return PEOPLE_STATUS_FILTER_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export type PeopleGroupByKey =
  | "name"
  | "employeeCode"
  | "employmentType"
  | "supervisor"
  | "jobTitle"
  | "department"
  | "location";

export const PEOPLE_GROUP_BY_OPTIONS: { key: PeopleGroupByKey; label: string }[] = [
  { key: "name", label: "Employee Name" },
  { key: "employeeCode", label: "Employee Id" },
  { key: "employmentType", label: "Employment Type" },
  { key: "supervisor", label: "Supervisor Name" },
  { key: "jobTitle", label: "Job Title" },
  { key: "department", label: "Sub Unit / Department" },
  { key: "location", label: "Location" },
];

export function peopleGroupByLabel(key: PeopleGroupByKey): string {
  return PEOPLE_GROUP_BY_OPTIONS.find((o) => o.key === key)?.label ?? key;
}

export type PeopleHubFieldFilterKey =
  | "employmentType"
  | "managerId"
  | "jobTitleId"
  | "departmentId"
  | "locationId";

export interface PeopleHubFilterSection {
  key: PeopleHubFieldFilterKey;
  label: string;
  options: { value: string; label: string }[];
}

export interface PeopleHubAppliedFilters {
  search: string;
  employeeCode: string;
  status: string;
  employmentType: string;
  departmentId: string;
  jobTitleId: string;
  locationId: string;
  managerId: string;
}

export interface PeopleHubFilterPill {
  key: keyof PeopleHubAppliedFilters;
  label: string;
}

export interface PeopleHubEmployeeRow {
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
}

export interface PeopleHubFavorite {
  id: string;
  name: string;
  groupBy: PeopleGroupByKey | null;
  quickSearch: string;
  statusFilter: PeopleHubStatusFilter;
  filters: PeopleHubAppliedFilters;
  createdAt: string;
}

export const PEOPLE_HUB_FAVORITES_STORAGE_KEY = "opensky.peopleHub.favorites";

export function createPeopleHubFavoriteSnapshot(input: {
  name: string;
  groupBy: PeopleGroupByKey | null;
  quickSearch: string;
  statusFilter: PeopleHubStatusFilter;
  appliedFilters: PeopleHubAppliedFilters;
}): PeopleHubFavorite {
  const searchTerm = input.quickSearch.trim() || input.appliedFilters.search.trim();
  return {
    id: typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: input.name.trim(),
    groupBy: input.groupBy,
    quickSearch: searchTerm,
    statusFilter: input.statusFilter,
    filters: {
      ...input.appliedFilters,
      search: searchTerm,
    },
    createdAt: new Date().toISOString(),
  };
}

function isPeopleHubStatusFilter(value: unknown): value is PeopleHubStatusFilter {
  return value === "active" || value === "all" || value === "terminated";
}

function isPeopleGroupByKey(value: unknown): value is PeopleGroupByKey {
  return typeof value === "string" && PEOPLE_GROUP_BY_OPTIONS.some((o) => o.key === value);
}

function normalizeAppliedFilters(raw: unknown, fallbackSearch = ""): PeopleHubAppliedFilters {
  const f = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const search =
    (typeof f.search === "string" ? f.search : "").trim() ||
    fallbackSearch.trim();
  return {
    search,
    employeeCode: typeof f.employeeCode === "string" ? f.employeeCode : "",
    status: typeof f.status === "string" ? f.status : "",
    employmentType: typeof f.employmentType === "string" ? f.employmentType : "",
    departmentId: typeof f.departmentId === "string" ? f.departmentId : "",
    jobTitleId: typeof f.jobTitleId === "string" ? f.jobTitleId : "",
    locationId: typeof f.locationId === "string" ? f.locationId : "",
    managerId: typeof f.managerId === "string" ? f.managerId : "",
  };
}

export function normalizePeopleHubFavorite(raw: unknown): PeopleHubFavorite | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  if (typeof item.id !== "string" || typeof item.name !== "string" || !item.name.trim()) {
    return null;
  }

  const quickSearch = typeof item.quickSearch === "string" ? item.quickSearch : "";
  const filters = normalizeAppliedFilters(item.filters, quickSearch);
  const searchTerm = quickSearch.trim() || filters.search;

  return {
    id: item.id,
    name: item.name.trim(),
    groupBy: item.groupBy === null ? null : isPeopleGroupByKey(item.groupBy) ? item.groupBy : null,
    quickSearch: searchTerm,
    statusFilter: isPeopleHubStatusFilter(item.statusFilter) ? item.statusFilter : "active",
    filters: { ...filters, search: searchTerm },
    createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString(),
  };
}

export function applyPeopleHubFavoriteSnapshot(favorite: PeopleHubFavorite): {
  groupBy: PeopleGroupByKey | null;
  quickSearch: string;
  statusFilter: PeopleHubStatusFilter;
  filters: PeopleHubAppliedFilters;
} {
  const searchTerm = favorite.quickSearch.trim() || favorite.filters.search.trim();
  const filters = { ...favorite.filters, search: searchTerm };
  return {
    groupBy: favorite.groupBy,
    quickSearch: searchTerm,
    statusFilter: favorite.statusFilter,
    filters,
  };
}

export type PeopleHubFavoriteSnapshotInput = {
  groupBy: PeopleGroupByKey | null;
  quickSearch: string;
  statusFilter: PeopleHubStatusFilter;
  appliedFilters: PeopleHubAppliedFilters;
};

export function peopleHubFavoriteSummary(fav: PeopleHubFavorite): string {
  const parts: string[] = [];
  if (fav.groupBy) parts.push(peopleGroupByLabel(fav.groupBy));
  if (fav.statusFilter !== "active") parts.push(peopleStatusFilterLabel(fav.statusFilter));
  const search = fav.quickSearch.trim() || fav.filters.search.trim();
  if (search) parts.push(`Search: ${search}`);
  if (fav.filters.employmentType) parts.push("Employment type");
  if (fav.filters.managerId) parts.push("Supervisor");
  if (fav.filters.jobTitleId) parts.push("Job title");
  if (fav.filters.departmentId) parts.push("Department");
  if (fav.filters.locationId) parts.push("Location");
  return parts.length > 0 ? parts.join(" · ") : "Default view";
}

export function buildPeopleHubFavoriteDefaultName(
  input: PeopleHubFavoriteSnapshotInput,
  extraLabels: string[] = [],
): string {
  const parts: string[] = [];
  if (input.groupBy) parts.push(peopleGroupByLabel(input.groupBy));
  if (input.statusFilter !== "active") parts.push(peopleStatusFilterLabel(input.statusFilter));
  const search = input.quickSearch.trim() || input.appliedFilters.search.trim();
  if (search) parts.push(search);
  for (const label of extraLabels) {
    if (label && !parts.includes(label)) parts.push(label);
  }
  if (parts.length > 0) return parts.slice(0, 4).join(" · ");
  return `My search ${new Date().toLocaleDateString()}`;
}

function peopleHubFavoriteStateKey(input: {
  groupBy: PeopleGroupByKey | null;
  statusFilter: PeopleHubStatusFilter;
  filters: PeopleHubAppliedFilters;
}): string {
  return JSON.stringify({
    groupBy: input.groupBy,
    statusFilter: input.statusFilter,
    filters: input.filters,
  });
}

export function peopleHubFavoriteMatchesCurrent(
  favorite: PeopleHubFavorite,
  input: PeopleHubFavoriteSnapshotInput,
): boolean {
  const current = createPeopleHubFavoriteSnapshot({ name: "_", ...input });
  const applied = applyPeopleHubFavoriteSnapshot(favorite);
  return (
    peopleHubFavoriteStateKey({
      groupBy: applied.groupBy,
      statusFilter: applied.statusFilter,
      filters: applied.filters,
    }) ===
    peopleHubFavoriteStateKey({
      groupBy: current.groupBy,
      statusFilter: current.statusFilter,
      filters: current.filters,
    })
  );
}

export function filterPeopleHubFavorites(
  favorites: PeopleHubFavorite[],
  query: string,
  limit = 6,
): PeopleHubFavorite[] {
  const q = query.trim().toLowerCase();
  const sorted = [...favorites].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  if (!q) return sorted.slice(0, limit);
  return sorted
    .filter((fav) => {
      const haystack = `${fav.name} ${peopleHubFavoriteSummary(fav)}`.toLowerCase();
      return haystack.includes(q);
    })
    .slice(0, limit);
}

export function peopleHubHasSavableState(input: PeopleHubFavoriteSnapshotInput): boolean {
  const search = input.quickSearch.trim() || input.appliedFilters.search.trim();
  return (
    input.groupBy !== null ||
    input.statusFilter !== "active" ||
    Boolean(search) ||
    Boolean(input.appliedFilters.employmentType) ||
    Boolean(input.appliedFilters.managerId) ||
    Boolean(input.appliedFilters.jobTitleId) ||
    Boolean(input.appliedFilters.departmentId) ||
    Boolean(input.appliedFilters.locationId) ||
    Boolean(input.appliedFilters.employeeCode)
  );
}

export function loadPeopleHubFavorites(): PeopleHubFavorite[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PEOPLE_HUB_FAVORITES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizePeopleHubFavorite)
      .filter((item): item is PeopleHubFavorite => item !== null);
  } catch {
    return [];
  }
}

export function savePeopleHubFavorites(favorites: PeopleHubFavorite[]): void {
  try {
    localStorage.setItem(PEOPLE_HUB_FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
  } catch {
    /* ignore */
  }
}

export function getEmployeeGroupKey(
  emp: PeopleHubEmployeeRow,
  groupBy: PeopleGroupByKey,
  employmentTypes: EmploymentTypeCatalogItem[],
): string {
  switch (groupBy) {
    case "name": {
      const name = (emp.fullName || emp.firstName || "").trim();
      if (!name) return "Unknown";
      const letter = name[0]?.toUpperCase() ?? "#";
      return /[A-Z]/.test(letter) ? letter : "#";
    }
    case "employeeCode": {
      const code = emp.employeeCode?.trim();
      if (!code) return "Unknown";
      const prefix = code.slice(0, 2).toUpperCase();
      return prefix || "Unknown";
    }
    case "employmentType":
      return employmentTypeDisplayName(employmentTypes, emp.employmentType) || "Unknown";
    case "supervisor":
      return formatSupervisorFirstNames(emp.supervisorNames ?? emp.managerName) || "No supervisor";
    case "jobTitle":
      return emp.jobTitleName ?? emp.positionTitle ?? "No job title";
    case "department":
      return emp.departmentName ?? "No department";
    case "location":
      return emp.locationName ?? "No location";
    default:
      return "Unknown";
  }
}

export function groupEmployeesByKey<T extends PeopleHubEmployeeRow>(
  items: T[],
  groupBy: PeopleGroupByKey,
  employmentTypes: EmploymentTypeCatalogItem[],
): { key: string; items: T[] }[] {
  const map = new Map<string, T[]>();
  for (const emp of items) {
    const key = getEmployeeGroupKey(emp, groupBy, employmentTypes);
    const bucket = map.get(key);
    if (bucket) bucket.push(emp);
    else map.set(key, [emp]);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: "base" }))
    .map(([key, groupItems]) => ({ key, items: groupItems }));
}
