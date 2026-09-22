const VENDOR_TOKEN_KEY = "vendor_licensing_token";

/** Sidebar modules in the vendor panel — same order and labels as the in-app menu. */
export const VENDOR_SIDEBAR_MODULES = [
  { code: "Dashboard", displayName: "Dashboard", category: "Core" },
  { code: "People", displayName: "People Hub", category: "Core" },
  { code: "EmployeeBio", displayName: "Employee bio", category: "Core" },
  { code: "Recruitment", displayName: "Recruitment", category: "Core" },
  { code: "EmployeeTasks", displayName: "Employee Tasks", category: "Core" },
  { code: "EmployeeActions", displayName: "Employee Actions", category: "Core" },
  { code: "Leave", displayName: "Leave & Absence", category: "Workforce" },
  { code: "Approvals", displayName: "Approvals", category: "Workforce" },
  { code: "Attendance", displayName: "Time & Attendance", category: "Workforce" },
  { code: "Payroll", displayName: "Payroll", category: "Workforce" },
  { code: "Performance", displayName: "Performance Appraisal", category: "Workforce" },
  { code: "Learning", displayName: "Learning & Skills", category: "Workforce" },
  { code: "Reports", displayName: "Reports", category: "Intelligence" },
  { code: "OrgStructure", displayName: "Org Structure", category: "Intelligence" },
  { code: "Analytics", displayName: "Analytics", category: "Intelligence" },
  { code: "CompanyProfile", displayName: "Company Profile", category: "Intelligence" },
  { code: "Settings", displayName: "Policy & Settings", category: "Intelligence" },
  { code: "Billing", displayName: "Billing", category: "Intelligence" },
  { code: "EmailTemplates", displayName: "Email & letter templates", category: "Audit & Compliance" },
  { code: "EmailDeliveryLog", displayName: "Email delivery log", category: "Audit & Compliance" },
  { code: "Administration", displayName: "Data Import / Export", category: "Administration" },
  { code: "UserManagement", displayName: "User Management", category: "Administration" },
] as const;

const VENDOR_SIDEBAR_CODES = new Set<string>(VENDOR_SIDEBAR_MODULES.map((m) => m.code));

export function isVendorSidebarModule(code: string): boolean {
  return VENDOR_SIDEBAR_CODES.has(code);
}

export function getVendorLicensingToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(VENDOR_TOKEN_KEY);
}

export function setVendorLicensingToken(token: string): void {
  sessionStorage.setItem(VENDOR_TOKEN_KEY, token);
}

export function clearVendorLicensingToken(): void {
  sessionStorage.removeItem(VENDOR_TOKEN_KEY);
}
