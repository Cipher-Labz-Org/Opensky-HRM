/**
 * Menu rows for Roles & permissions. Must stay aligned with
 * Backend/OpenSkyHRM.Domain/Security/RolePermissionCatalog.cs.
 * Used when the API still returns the older licensed-module list (no Approvals row).
 */
export type RolePermissionModule = {
  module: string;
  label: string;
  sort: number;
  licenseAnyOf: readonly string[];
};

export const ROLE_PERMISSION_MODULES: RolePermissionModule[] = [
  { module: "Dashboard", label: "Dashboard", sort: 10, licenseAnyOf: ["Dashboard"] },
  { module: "People", label: "People Hub", sort: 20, licenseAnyOf: ["People"] },
  { module: "EmployeeBio", label: "Employee bio", sort: 25, licenseAnyOf: ["People"] },
  { module: "Recruitment", label: "Recruitment", sort: 30, licenseAnyOf: ["Recruitment"] },
  { module: "EmployeeTasks", label: "Employee Tasks", sort: 40, licenseAnyOf: ["People", "Recruitment", "EmployeeTasks"] },
  { module: "EmployeeActions", label: "Employee Actions", sort: 50, licenseAnyOf: ["People"] },
  { module: "Onboarding", label: "Onboarding", sort: 55, licenseAnyOf: ["Onboarding"] },
  { module: "Offboarding", label: "Offboarding", sort: 56, licenseAnyOf: ["Offboarding"] },
  { module: "Leave", label: "Leave & Absence", sort: 60, licenseAnyOf: ["Leave"] },
  { module: "Approvals", label: "Approvals", sort: 65, licenseAnyOf: ["Leave", "Attendance"] },
  { module: "Attendance", label: "Time & Attendance", sort: 70, licenseAnyOf: ["Attendance"] },
  { module: "Payroll", label: "Payroll", sort: 80, licenseAnyOf: ["Payroll"] },
  { module: "Performance", label: "Performance", sort: 90, licenseAnyOf: ["Performance"] },
  { module: "Learning", label: "Learning & Skills", sort: 100, licenseAnyOf: ["Learning"] },
  { module: "Reports", label: "Reports", sort: 110, licenseAnyOf: ["Analytics"] },
  { module: "OrgStructure", label: "Org Structure", sort: 120, licenseAnyOf: ["OrgStructure"] },
  { module: "Analytics", label: "Analytics", sort: 130, licenseAnyOf: ["Analytics"] },
  { module: "Settings", label: "Policy & Settings", sort: 140, licenseAnyOf: ["Settings"] },
  { module: "Billing", label: "Billing", sort: 150, licenseAnyOf: ["Billing"] },
  { module: "AiAssistant", label: "OpenSky AI", sort: 155, licenseAnyOf: ["AiAssistant"] },
  { module: "EmailTemplates", label: "Email & letter templates", sort: 160, licenseAnyOf: ["Settings"] },
  { module: "EmailDeliveryLog", label: "Email delivery log", sort: 170, licenseAnyOf: ["Settings"] },
  { module: "Administration", label: "Data Import / Export", sort: 180, licenseAnyOf: ["Administration"] },
  { module: "UserManagement", label: "User Management", sort: 190, licenseAnyOf: ["Administration"] },
  { module: "Help", label: "Help & guides", sort: 200, licenseAnyOf: [] },
];

/** Prefer the API list when it already includes sidebar rows; otherwise expand from licensed parents. */
export function resolveRolePermissionModules(
  apiModules: { module: string; label: string }[],
): { module: string; label: string }[] {
  if (apiModules.length === 0) {
    return ROLE_PERMISSION_MODULES.map(({ module, label }) => ({ module, label }));
  }

  const apiCodes = new Set(apiModules.map((m) => m.module));
  if (apiCodes.has("Approvals")) {
    return apiModules;
  }

  const fromCatalog = ROLE_PERMISSION_MODULES.filter(
    (m) => m.licenseAnyOf.length === 0 || m.licenseAnyOf.some((code) => apiCodes.has(code)),
  ).map(({ module, label }) => ({ module, label }));

  const catalogCodes = new Set(fromCatalog.map((m) => m.module));
  const extras = apiModules.filter((m) => !catalogCodes.has(m.module));
  return extras.length === 0 ? fromCatalog : [...fromCatalog, ...extras];
}
