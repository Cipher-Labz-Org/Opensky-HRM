import { ROUTES } from "@/config/routes";
import { HELP_TOPIC_SECTIONS, type HelpRichSection } from "./help-topic-sections";

export type { HelpRichSection };

export type HelpTopic = {
  slug: string;
  label: string;
  appHref: string;
  /** Short intro shown under the title */
  summary: string;
  /** Legacy short steps (used only when `sections` is omitted). */
  steps: string[];
  /** Rich sections — same card + jump-nav pattern as People Hub. */
  sections?: HelpRichSection[];
  module?: string;
  moduleAnyOf?: string[];
};

export const HELP_TOPICS: HelpTopic[] = [
  {
    slug: "dashboard",
    label: "Dashboard",
    appHref: ROUTES.dashboard,
    module: "Dashboard",
    summary: "Your home view for HR KPIs, shortcuts, and what needs attention.",
    sections: HELP_TOPIC_SECTIONS.dashboard,
    steps: [],
  },
  {
    slug: "people",
    label: "People Hub",
    appHref: ROUTES.people,
    module: "People",
    summary: "Directory, search, filters, profiles, and (where allowed) creating employees.",
    steps: [],
  },
  {
    slug: "people-audit-trail",
    label: "People audit trail",
    appHref: ROUTES.peopleAuditTrail,
    module: "People",
    summary: "Review people-related changes for compliance and troubleshooting.",
    sections: HELP_TOPIC_SECTIONS["people-audit-trail"],
    steps: [],
  },
  {
    slug: "employee-360",
    label: "Employee 360",
    appHref: ROUTES.employeeProfile,
    module: "People",
    summary: "Your own profile summary and (for HR) quick access to employee records.",
    sections: HELP_TOPIC_SECTIONS["employee-360"],
    steps: [],
  },
  {
    slug: "recruitment",
    label: "Recruitment",
    appHref: ROUTES.recruitment,
    module: "Recruitment",
    summary: "Requisitions, candidates, and hiring workflow.",
    sections: HELP_TOPIC_SECTIONS.recruitment,
    steps: [],
  },
  {
    slug: "employee-tasks",
    label: "Employee Tasks",
    appHref: ROUTES.employeeTasks,
    moduleAnyOf: ["People", "Recruitment", "EmployeeTasks"],
    summary: "Tasks assigned across hiring and people operations.",
    sections: HELP_TOPIC_SECTIONS["employee-tasks"],
    steps: [],
  },
  {
    slug: "employee-actions",
    label: "Employee Actions",
    appHref: ROUTES.employeeActions,
    module: "People",
    summary: "HR actions such as confirmations, transfers, and lifecycle events.",
    sections: HELP_TOPIC_SECTIONS["employee-actions"],
    steps: [],
  },
  {
    slug: "leave",
    label: "Leave & Absence",
    appHref: ROUTES.leave,
    module: "Leave",
    summary: "Requesting, approving, and tracking time off.",
    sections: HELP_TOPIC_SECTIONS.leave,
    steps: [],
  },
  {
    slug: "attendance",
    label: "Time & Attendance",
    appHref: ROUTES.attendance,
    module: "Attendance",
    summary: "Clocking, shifts, corrections, and attendance reports.",
    sections: HELP_TOPIC_SECTIONS.attendance,
    steps: [],
  },
  {
    slug: "payroll",
    label: "Payroll",
    appHref: ROUTES.payroll,
    module: "Payroll",
    summary: "Pay runs, earnings, deductions, and payslips.",
    sections: HELP_TOPIC_SECTIONS.payroll,
    steps: [],
  },
  {
    slug: "performance",
    label: "Performance",
    appHref: ROUTES.performance,
    module: "Performance",
    summary: "Goals, reviews, and appraisal cycles.",
    sections: HELP_TOPIC_SECTIONS.performance,
    steps: [],
  },
  {
    slug: "learning",
    label: "Learning & Skills",
    appHref: ROUTES.learning,
    module: "Learning",
    summary: "Courses, skills, and development records.",
    sections: HELP_TOPIC_SECTIONS.learning,
    steps: [],
  },
  {
    slug: "reports",
    label: "Reports",
    appHref: ROUTES.reports,
    module: "Analytics",
    summary: "Standard and custom HR reports.",
    sections: HELP_TOPIC_SECTIONS.reports,
    steps: [],
  },
  {
    slug: "org-structure",
    label: "Org Structure",
    appHref: ROUTES.orgStructure,
    module: "OrgStructure",
    summary: "Hierarchy, positions, and reporting lines.",
    sections: HELP_TOPIC_SECTIONS["org-structure"],
    steps: [],
  },
  {
    slug: "analytics",
    label: "Analytics",
    appHref: ROUTES.analytics,
    module: "Analytics",
    summary: "Dashboards and workforce analytics.",
    sections: HELP_TOPIC_SECTIONS.analytics,
    steps: [],
  },
  {
    slug: "settings",
    label: "Policy & Settings",
    appHref: ROUTES.settings,
    module: "Settings",
    summary: "Company profile, policies, templates, and system options.",
    sections: HELP_TOPIC_SECTIONS.settings,
    steps: [],
  },
  {
    slug: "billing",
    label: "Billing",
    appHref: ROUTES.billing,
    summary: "Subscription and billing information for administrators.",
    sections: HELP_TOPIC_SECTIONS.billing,
    steps: [],
  },
  {
    slug: "email-templates",
    label: "Email & letter templates",
    appHref: ROUTES.emailTemplates,
    module: "Settings",
    summary: "Transactional emails and letter content used by workflows.",
    sections: HELP_TOPIC_SECTIONS["email-templates"],
    steps: [],
  },
  {
    slug: "email-delivery-log",
    label: "Email delivery log",
    appHref: ROUTES.emailDeliveryLog,
    module: "Settings",
    summary: "Trace sent messages and delivery status.",
    sections: HELP_TOPIC_SECTIONS["email-delivery-log"],
    steps: [],
  },
  {
    slug: "administration",
    label: "Data Import / Export",
    appHref: ROUTES.administration,
    module: "Administration",
    summary: "Bulk data loads and exports for administrators.",
    sections: HELP_TOPIC_SECTIONS.administration,
    steps: [],
  },
  {
    slug: "user-management",
    label: "User Management",
    appHref: ROUTES.userManagement,
    module: "Administration",
    summary: "Accounts, roles, and access to the HRM application.",
    sections: HELP_TOPIC_SECTIONS["user-management"],
    steps: [],
  },
];

export function helpGuideHref(slug: string): string {
  return `/app/help/${encodeURIComponent(slug)}`;
}

export function getHelpTopic(slug: string): HelpTopic | undefined {
  return HELP_TOPICS.find((t) => t.slug === slug);
}

export function isHelpTopicLicensed(topic: HelpTopic, licensedModules: string[] | undefined): boolean {
  if (topic.moduleAnyOf?.length) {
    if (licensedModules == null || licensedModules.length === 0) return true;
    return topic.moduleAnyOf.some((m) => licensedModules.includes(m));
  }
  if (!topic.module) return true;
  if (licensedModules == null || licensedModules.length === 0) return true;
  return licensedModules.includes(topic.module);
}

export function filterHelpTopicsForLicense(
  licensedModules: string[] | undefined
): HelpTopic[] {
  return HELP_TOPICS.filter((t) => isHelpTopicLicensed(t, licensedModules));
}

/**
 * Help URL for the module the user is currently in (longest `appHref` match).
 * On `/app/help/*` returns the hub root so the icon does not bounce between topics.
 */
export function contextualHelpGuideHref(
  pathname: string,
  licensedModules: string[] | undefined
): string {
  const raw = pathname.split("?")[0] ?? "";
  const path = raw.replace(/\/+$/, "") || "/";

  if (path === ROUTES.helpGuides || path.startsWith(`${ROUTES.helpGuides}/`)) {
    return ROUTES.helpGuides;
  }

  const topics = filterHelpTopicsForLicense(licensedModules).sort(
    (a, b) => b.appHref.length - a.appHref.length
  );

  for (const t of topics) {
    if (path === t.appHref || path.startsWith(`${t.appHref}/`)) {
      return helpGuideHref(t.slug);
    }
  }

  return ROUTES.helpGuides;
}
