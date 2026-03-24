/**
 * Longest-prefix wins. Maps app routes to licensing module codes (backend catalog).
 */
const ROUTE_PREFIX_TO_MODULE: { prefix: string; module: string }[] = [
  { prefix: "/app/user-management", module: "Administration" },
  { prefix: "/app/administration", module: "Administration" },
  { prefix: "/app/employee-profile", module: "People" },
  { prefix: "/app/people", module: "People" },
  { prefix: "/app/employee-tasks", module: "EmployeeTasks" },
  { prefix: "/app/recruitment", module: "Recruitment" },
  { prefix: "/app/onboarding", module: "Onboarding" },
  { prefix: "/app/offboarding", module: "Offboarding" },
  { prefix: "/app/leave", module: "Leave" },
  { prefix: "/app/attendance", module: "Attendance" },
  { prefix: "/app/payroll", module: "Payroll" },
  { prefix: "/app/performance", module: "Performance" },
  { prefix: "/app/learning", module: "Learning" },
  { prefix: "/app/reports", module: "Analytics" },
  { prefix: "/app/org-chart", module: "OrgStructure" },
  { prefix: "/app/org-structure", module: "OrgStructure" },
  { prefix: "/app/analytics", module: "Analytics" },
  { prefix: "/app/settings", module: "Settings" },
  { prefix: "/app/billing", module: "Billing" },
  { prefix: "/app/dashboard", module: "Dashboard" },
];

export function getLicensedModuleForPath(pathname: string): string | null {
  const path = pathname.split("?")[0] ?? pathname;
  const sorted = [...ROUTE_PREFIX_TO_MODULE].sort(
    (a, b) => b.prefix.length - a.prefix.length
  );
  for (const { prefix, module } of sorted) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return module;
  }
  return null;
}
