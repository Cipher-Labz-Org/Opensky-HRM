/**
 * Route path constants.
 * Centralizes route definitions for navigation and links.
 * Aligned with hris_ui_pack modules.
 */

export const ROUTES = {
  // Marketing
  home: "/",
  login: "/login",
  forgotPassword: "/forgot-password",
  pricing: "/pricing",
  contact: "/contact",
  privacy: "/privacy",
  dataDeletion: "/data-deletion",

  // App – Core (under /app so one layout wraps all)
  dashboard: "/app/dashboard",
  people: "/app/people",
  /** All in-app how-to guides (topic list + per-module pages). */
  helpGuides: "/app/help",
  /** People Hub guide (under Help hub; `/app/people/help` redirects here). */
  peopleHelp: "/app/help/people",
  peopleAuditTrail: "/app/people/audit-trail",
  employeeProfile: "/app/employee-profile",
  recruitment: "/app/recruitment",
  recruitmentTab: (tab: string) => `/app/recruitment?tab=${encodeURIComponent(tab)}`,
  recruitmentRequisition: (id: string) => `/app/recruitment/requisition/${id}`,
  onboarding: "/app/onboarding",
  offboarding: "/app/offboarding",
  employeeTasks: "/app/employee-tasks",
  employeeActions: "/app/employee-actions",

  // App – Workforce
  leave: "/app/leave",
  approvals: "/app/approvals",
  attendance: "/app/attendance",
  payroll: "/app/payroll",
  performance: "/app/performance",
  performanceAppraisal: (id: string) => `/app/performance/appraisal/${id}`,
  learning: "/app/learning",

  // App – Intelligence
  reports: "/app/reports",
  orgStructure: "/app/org-structure",
  analytics: "/app/analytics",
  companyProfile: "/app/company-profile",
  settings: "/app/settings",
  billing: "/app/billing",
  billingCustomerReset: "/app/billing/customer-reset",
  emailDeliveryLog: "/app/email-delivery-log",
  emailTemplates: "/app/email-templates",

  // App – Administration
  administration: "/app/administration",
  userManagement: "/app/user-management",
  /** First-time password change after bulk-import or similar (no sidebar until complete). */
  changePassword: "/app/change-password",

  // Tenant (placeholder for future multi-tenant)
  tenant: (tenantId: string) => `/tenant/${tenantId}`,
  tenantDashboard: (tenantId: string) => `/tenant/${tenantId}/dashboard`,
  tenantSettings: (tenantId: string) => `/tenant/${tenantId}/settings`,
} as const;
