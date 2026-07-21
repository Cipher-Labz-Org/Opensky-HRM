export const STORAGE_KEYS = {
  API_BASE_URL: "opensky_api_base_url",
  AUTH_TOKEN: "opensky_auth_token",
  AUTH_EXPIRES_AT: "opensky_auth_expires_at",
  COMPANY_NAME: "opensky_company_name",
  COMPANY_LOGO_URL: "opensky_company_logo_url",
} as const;

export const APP_SCHEME = "openskyhrm";

export const DEFAULT_API_TIMEOUT_MS = 45_000;

export const LICENSED_MODULES = {
  LEAVE: "Leave",
  ATTENDANCE: "Attendance",
  PAYROLL: "Payroll",
  PEOPLE: "People",
  DASHBOARD: "Dashboard",
} as const;

export const ROLES = {
  ADMIN: "ADMIN",
  HR_MANAGER: "HR_MANAGER",
  SUPERVISOR: "SUPERVISOR",
  EMPLOYEE: "EMPLOYEE",
} as const;
