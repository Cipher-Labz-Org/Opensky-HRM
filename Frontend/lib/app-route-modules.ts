/**
 * Longest-prefix wins. Maps app routes to licensing module codes (backend catalog).
 */
export type AppPathLicense = { one: string } | { anyOf: readonly string[] };

const ROUTE_PREFIX_TO_MODULE: { prefix: string; module: string }[] = [
  { prefix: "/app/email-delivery-log", module: "EmailDeliveryLog" },
  { prefix: "/app/email-templates", module: "EmailTemplates" },
  { prefix: "/app/user-management", module: "UserManagement" },
  { prefix: "/app/administration", module: "Administration" },
  { prefix: "/app/employee-profile", module: "EmployeeBio" },
  { prefix: "/app/people", module: "People" },
  { prefix: "/app/employee-actions", module: "EmployeeActions" },
  { prefix: "/app/employee-tasks", module: "EmployeeTasks" },
  { prefix: "/app/recruitment", module: "Recruitment" },
  { prefix: "/app/onboarding", module: "Onboarding" },
  { prefix: "/app/offboarding", module: "Offboarding" },
  { prefix: "/app/leave", module: "Leave" },
  { prefix: "/app/attendance", module: "Attendance" },
  { prefix: "/app/payroll", module: "Payroll" },
  { prefix: "/app/performance", module: "Performance" },
  { prefix: "/app/learning", module: "Learning" },
  { prefix: "/app/reports", module: "Reports" },
  { prefix: "/app/org-structure", module: "OrgStructure" },
  { prefix: "/app/analytics", module: "Analytics" },
  { prefix: "/app/company-profile", module: "CompanyProfile" },
  { prefix: "/app/settings", module: "Settings" },
  { prefix: "/app/billing", module: "Billing" },
  { prefix: "/app/dashboard", module: "Dashboard" },
];

/** Employee tasks: licensed as its own SKU. */
const EMPLOYEE_TASKS_LICENSE_ANY = ["EmployeeTasks"] as const;

/** Central approvals hub: licensed as its own SKU. */
const APPROVALS_LICENSE_ANY = ["Approvals"] as const;

/**
 * License rule for a path. Use for client-side gating; must stay aligned with API
 * `[RequireLicensedModuleAny]` on `EmployeeTasksController` actions.
 */
export function getAppPathLicense(pathname: string): AppPathLicense | null {
  const path = pathname.split("?")[0] ?? pathname;
  if (path === "/app/approvals" || path.startsWith("/app/approvals/")) {
    return { anyOf: APPROVALS_LICENSE_ANY };
  }
  const sorted = [...ROUTE_PREFIX_TO_MODULE].sort(
    (a, b) => b.prefix.length - a.prefix.length
  );
  for (const { prefix, module } of sorted) {
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      if (prefix === "/app/employee-tasks") return { anyOf: EMPLOYEE_TASKS_LICENSE_ANY };
      return { one: module };
    }
  }
  return null;
}

/** @deprecated Prefer getAppPathLicense — kept for callers that expect a single code. */
export function getLicensedModuleForPath(pathname: string): string | null {
  const r = getAppPathLicense(pathname);
  if (!r) return null;
  return "one" in r ? r.one : r.anyOf[0];
}
