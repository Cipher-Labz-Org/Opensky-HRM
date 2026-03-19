/**
 * Route path constants.
 * Centralizes route definitions for navigation and links.
 * Aligned with hris_ui_pack modules.
 */

export const ROUTES = {
  // Marketing
  home: "/",
  pricing: "/pricing",
  contact: "/contact",

  // App – Core (under /app so one layout wraps all)
  dashboard: "/app/dashboard",
  people: "/app/people",
  employeeProfile: "/app/employee-profile",
  recruitment: "/app/recruitment",
  onboarding: "/app/onboarding",

  // App – Workforce
  leave: "/app/leave",
  attendance: "/app/attendance",
  payroll: "/app/payroll",
  performance: "/app/performance",
  learning: "/app/learning",

  // App – Intelligence
  orgStructure: "/app/org-structure",
  analytics: "/app/analytics",
  settings: "/app/settings",
  billing: "/app/billing",

  // App – Administration
  administration: "/app/administration",
  userManagement: "/app/user-management",

  // Tenant (placeholder for future multi-tenant)
  tenant: (tenantId: string) => `/tenant/${tenantId}`,
  tenantDashboard: (tenantId: string) => `/tenant/${tenantId}/dashboard`,
  tenantSettings: (tenantId: string) => `/tenant/${tenantId}/settings`,
} as const;
