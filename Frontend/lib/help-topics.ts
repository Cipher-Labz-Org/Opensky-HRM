import { ROUTES } from "@/config/routes";

export type HelpTopic = {
  slug: string;
  title: string;
  description: string;
  /** App route for the live module (Open … link). */
  moduleHref: string;
  /** Licensing module code; omit when always visible (e.g. Help hub). */
  licenseModule?: string;
  licenseAnyOf?: string[];
};

export const HELP_TOPICS: HelpTopic[] = [
  {
    slug: "dashboard",
    title: "Dashboard",
    description: "Home view for HR KPIs, shortcuts, and tasks.",
    moduleHref: ROUTES.dashboard,
    licenseModule: "Dashboard",
  },
  {
    slug: "people",
    title: "People Hub",
    description: "Directory, search, filters, and employee profile creation.",
    moduleHref: ROUTES.people,
    licenseModule: "People",
  },
  {
    slug: "people-audit-trail",
    title: "People audit trail",
    description: "Reviewing changes for compliance and troubleshooting.",
    moduleHref: ROUTES.peopleAuditTrail,
    licenseModule: "People",
  },
  {
    slug: "employee-360",
    title: "Employee 360",
    description: "Personal profile summary and access to employee records.",
    moduleHref: ROUTES.employeeProfile,
    licenseModule: "People",
  },
  {
    slug: "recruitment",
    title: "Recruitment",
    description: "Requisitions, candidates, and hiring workflows.",
    moduleHref: ROUTES.recruitment,
    licenseModule: "Recruitment",
  },
  {
    slug: "employee-tasks",
    title: "Employee Tasks",
    description: "Tasks related to hiring and people operations.",
    moduleHref: ROUTES.employeeTasks,
    licenseAnyOf: ["People", "Recruitment", "EmployeeTasks"],
  },
  {
    slug: "employee-actions",
    title: "Employee Actions",
    description: "HR actions like transfers and lifecycle events.",
    moduleHref: ROUTES.employeeActions,
    licenseModule: "People",
  },
  {
    slug: "leave",
    title: "Leave & Absence",
    description: "Requesting and tracking time off.",
    moduleHref: ROUTES.leave,
    licenseModule: "Leave",
  },
  {
    slug: "approvals",
    title: "Approvals",
    description: "Central hub for leave and attendance approvals.",
    moduleHref: ROUTES.approvals,
    licenseAnyOf: ["Leave", "Attendance"],
  },
  {
    slug: "attendance",
    title: "Time & Attendance",
    description: "Clocking, shifts, and attendance reports.",
    moduleHref: ROUTES.attendance,
    licenseModule: "Attendance",
  },
  {
    slug: "payroll",
    title: "Payroll",
    description: "Pay runs, earnings, and payslips.",
    moduleHref: ROUTES.payroll,
    licenseModule: "Payroll",
  },
  {
    slug: "performance",
    title: "Performance",
    description: "Goals, reviews, and appraisal cycles.",
    moduleHref: ROUTES.performance,
    licenseModule: "Performance",
  },
  {
    slug: "learning",
    title: "Learning & Skills",
    description: "Courses and development records.",
    moduleHref: ROUTES.learning,
    licenseModule: "Learning",
  },
  {
    slug: "reports",
    title: "Reports",
    description: "Standard and custom HR reports.",
    moduleHref: ROUTES.reports,
    licenseModule: "Analytics",
  },
  {
    slug: "org-structure",
    title: "Org Structure",
    description: "Departments, locations, and hierarchy.",
    moduleHref: ROUTES.orgStructure,
    licenseModule: "OrgStructure",
  },
  {
    slug: "analytics",
    title: "Analytics",
    description: "Executive dashboards and workforce insights.",
    moduleHref: ROUTES.analytics,
    licenseModule: "Analytics",
  },
  {
    slug: "company-profile",
    title: "Company Profile",
    description: "Company logo, legal details, and mobile app connection.",
    moduleHref: ROUTES.companyProfile,
    licenseModule: "Settings",
  },
  {
    slug: "settings",
    title: "Policy & Settings",
    description: "Policies, entitlements, and system configuration.",
    moduleHref: ROUTES.settings,
    licenseModule: "Settings",
  },
  {
    slug: "onboarding",
    title: "Onboarding",
    description: "New-hire checklists and onboarding tasks.",
    moduleHref: ROUTES.onboarding,
    licenseModule: "Onboarding",
  },
  {
    slug: "offboarding",
    title: "Offboarding",
    description: "Exit workflows and offboarding tasks.",
    moduleHref: ROUTES.offboarding,
    licenseModule: "Offboarding",
  },
  {
    slug: "administration",
    title: "Data Import / Export",
    description: "Bulk upload, templates, and data exchange.",
    moduleHref: ROUTES.administration,
    licenseModule: "Administration",
  },
  {
    slug: "user-management",
    title: "User Management",
    description: "Users, roles, and access control.",
    moduleHref: ROUTES.userManagement,
    licenseModule: "Administration",
  },
  {
    slug: "billing",
    title: "Billing",
    description: "Subscription and billing for your organization.",
    moduleHref: ROUTES.billing,
  },
  {
    slug: "email-templates",
    title: "Email & letter templates",
    description: "Transactional templates and merge fields.",
    moduleHref: ROUTES.emailTemplates,
    licenseModule: "Settings",
  },
  {
    slug: "email-delivery-log",
    title: "Email delivery log",
    description: "Sent messages and delivery status for compliance.",
    moduleHref: ROUTES.emailDeliveryLog,
    licenseModule: "Settings",
  },
];

export function helpTopicHref(slug: string): string {
  return `${ROUTES.helpGuides}/${slug}`;
}

export function getHelpTopic(slug: string): HelpTopic | undefined {
  return HELP_TOPICS.find((t) => t.slug === slug);
}

export function isHelpTopicLicensed(topic: HelpTopic, licensedModules?: string[] | null): boolean {
  if (licensedModules == null || licensedModules.length === 0) return true;
  if (topic.licenseAnyOf?.length) {
    return topic.licenseAnyOf.some((m) => licensedModules.includes(m));
  }
  if (topic.licenseModule) return licensedModules.includes(topic.licenseModule);
  return true;
}

export function filterHelpTopics(licensedModules?: string[] | null): HelpTopic[] {
  return HELP_TOPICS.filter((t) => isHelpTopicLicensed(t, licensedModules));
}

const HELP_ROUTE_BY_PREFIX: Array<{ prefix: string; helpRoute: string }> = [
  { prefix: ROUTES.dashboard, helpRoute: helpTopicHref("dashboard") },
  { prefix: ROUTES.peopleAuditTrail, helpRoute: helpTopicHref("people-audit-trail") },
  { prefix: ROUTES.employeeProfile, helpRoute: helpTopicHref("employee-360") },
  { prefix: ROUTES.people, helpRoute: helpTopicHref("people") },
  { prefix: ROUTES.employeeActions, helpRoute: helpTopicHref("employee-actions") },
  { prefix: ROUTES.employeeTasks, helpRoute: helpTopicHref("employee-tasks") },
  { prefix: ROUTES.recruitment, helpRoute: helpTopicHref("recruitment") },
  { prefix: ROUTES.onboarding, helpRoute: helpTopicHref("onboarding") },
  { prefix: ROUTES.offboarding, helpRoute: helpTopicHref("offboarding") },
  { prefix: ROUTES.approvals, helpRoute: helpTopicHref("approvals") },
  { prefix: ROUTES.leave, helpRoute: helpTopicHref("leave") },
  { prefix: ROUTES.attendance, helpRoute: helpTopicHref("attendance") },
  { prefix: ROUTES.payroll, helpRoute: helpTopicHref("payroll") },
  { prefix: ROUTES.performance, helpRoute: helpTopicHref("performance") },
  { prefix: ROUTES.learning, helpRoute: helpTopicHref("learning") },
  { prefix: ROUTES.orgStructure, helpRoute: helpTopicHref("org-structure") },
  { prefix: ROUTES.analytics, helpRoute: helpTopicHref("analytics") },
  { prefix: ROUTES.reports, helpRoute: helpTopicHref("reports") },
  { prefix: ROUTES.companyProfile, helpRoute: helpTopicHref("company-profile") },
  { prefix: ROUTES.settings, helpRoute: helpTopicHref("settings") },
  { prefix: ROUTES.administration, helpRoute: helpTopicHref("administration") },
  { prefix: ROUTES.userManagement, helpRoute: helpTopicHref("user-management") },
  { prefix: ROUTES.billing, helpRoute: helpTopicHref("billing") },
  { prefix: ROUTES.emailTemplates, helpRoute: helpTopicHref("email-templates") },
  { prefix: ROUTES.emailDeliveryLog, helpRoute: helpTopicHref("email-delivery-log") },
].sort((a, b) => b.prefix.length - a.prefix.length);

export function contextualHelpGuideHref(pathname: string, _licensedModules?: string[]): string {
  const cleanPath = (pathname || "").trim();
  if (!cleanPath || cleanPath === ROUTES.helpGuides || cleanPath.startsWith(`${ROUTES.helpGuides}/`)) {
    return ROUTES.helpGuides;
  }

  const match = HELP_ROUTE_BY_PREFIX.find(
    ({ prefix }) => cleanPath === prefix || cleanPath.startsWith(`${prefix}/`)
  );
  return match?.helpRoute ?? ROUTES.helpGuides;
}
