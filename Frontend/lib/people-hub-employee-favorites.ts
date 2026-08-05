export interface PeopleHubDiscoverEmployee {
  id: string;
  employeeCode: string;
  fullName: string;
  departmentName: string | null;
  jobTitleName: string | null;
  profileImageUrl: string | null;
}

export interface PeopleHubEmployeeFavorite {
  id: string;
  employeeId: string;
  employeeCode: string;
  fullName: string;
  departmentName: string | null;
  jobTitleName: string | null;
  profileImageUrl: string | null;
  savedAt: string;
}

export const PEOPLE_HUB_EMPLOYEE_FAVORITES_STORAGE_KEY = "opensky.peopleHub.employeeFavorites";

export function loadPeopleHubEmployeeFavorites(): PeopleHubEmployeeFavorite[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PEOPLE_HUB_EMPLOYEE_FAVORITES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizePeopleHubEmployeeFavorite)
      .filter((item): item is PeopleHubEmployeeFavorite => item !== null);
  } catch {
    return [];
  }
}

export function savePeopleHubEmployeeFavorites(favorites: PeopleHubEmployeeFavorite[]): void {
  try {
    localStorage.setItem(PEOPLE_HUB_EMPLOYEE_FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
  } catch {
    /* ignore */
  }
}

function normalizePeopleHubEmployeeFavorite(raw: unknown): PeopleHubEmployeeFavorite | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  if (typeof item.employeeId !== "string" || typeof item.fullName !== "string") return null;
  return {
    id: typeof item.id === "string" ? item.id : item.employeeId,
    employeeId: item.employeeId,
    employeeCode: typeof item.employeeCode === "string" ? item.employeeCode : "",
    fullName: item.fullName,
    departmentName: typeof item.departmentName === "string" ? item.departmentName : null,
    jobTitleName: typeof item.jobTitleName === "string" ? item.jobTitleName : null,
    profileImageUrl: typeof item.profileImageUrl === "string" ? item.profileImageUrl : null,
    savedAt: typeof item.savedAt === "string" ? item.savedAt : new Date().toISOString(),
  };
}

export function createPeopleHubEmployeeFavorite(emp: {
  id: string;
  employeeCode: string;
  fullName: string;
  departmentName: string | null;
  jobTitleName: string | null;
  positionTitle?: string | null;
  profileImageUrl: string | null;
}): PeopleHubEmployeeFavorite {
  return {
    id: emp.id,
    employeeId: emp.id,
    employeeCode: emp.employeeCode,
    fullName: emp.fullName,
    departmentName: emp.departmentName,
    jobTitleName: emp.jobTitleName ?? emp.positionTitle ?? null,
    profileImageUrl: emp.profileImageUrl,
    savedAt: new Date().toISOString(),
  };
}

export function filterPeopleHubEmployeeFavorites(
  favorites: PeopleHubEmployeeFavorite[],
  query: string,
  limit = 8,
): PeopleHubEmployeeFavorite[] {
  const sorted = [...favorites].sort(
    (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime(),
  );
  const q = query.trim().toLowerCase();
  if (!q) return sorted.slice(0, limit);
  return sorted
    .filter((fav) => {
      const haystack = `${fav.fullName} ${fav.employeeCode} ${fav.departmentName ?? ""} ${fav.jobTitleName ?? ""}`.toLowerCase();
      return haystack.includes(q);
    })
    .slice(0, limit);
}
