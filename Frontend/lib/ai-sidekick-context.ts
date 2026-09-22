import { HELP_TOPICS } from "@/lib/help-topics";
import { ROUTES } from "@/config/routes";

export type AiPageContext = {
  pathname: string;
  moduleCode: string;
  moduleLabel: string;
};

const ROUTE_PREFIXES: { prefix: string; moduleCode: string; moduleLabel: string }[] = [
  { prefix: ROUTES.dashboard, moduleCode: "Dashboard", moduleLabel: "Dashboard" },
  { prefix: ROUTES.people, moduleCode: "People", moduleLabel: "People Hub" },
  { prefix: ROUTES.recruitment, moduleCode: "Recruitment", moduleLabel: "Recruitment" },
  { prefix: ROUTES.leave, moduleCode: "Leave", moduleLabel: "Leave & Absence" },
  { prefix: ROUTES.approvals, moduleCode: "Approvals", moduleLabel: "Approvals" },
  { prefix: ROUTES.attendance, moduleCode: "Attendance", moduleLabel: "Time & Attendance" },
  { prefix: ROUTES.payroll, moduleCode: "Payroll", moduleLabel: "Payroll" },
  { prefix: ROUTES.performance, moduleCode: "Performance", moduleLabel: "Performance" },
  { prefix: ROUTES.learning, moduleCode: "Learning", moduleLabel: "Learning & Skills" },
  { prefix: ROUTES.analytics, moduleCode: "Analytics", moduleLabel: "Analytics" },
  { prefix: ROUTES.reports, moduleCode: "Reports", moduleLabel: "Reports" },
  { prefix: ROUTES.companyProfile, moduleCode: "CompanyProfile", moduleLabel: "Company Profile" },
  { prefix: ROUTES.settings, moduleCode: "Settings", moduleLabel: "Policy & Settings" },
  { prefix: ROUTES.orgStructure, moduleCode: "OrgStructure", moduleLabel: "Org Structure" },
  { prefix: ROUTES.employeeTasks, moduleCode: "EmployeeTasks", moduleLabel: "Employee Tasks" },
];

export function resolveAiPageContext(pathname: string): AiPageContext {
  const normalized = pathname.split("?")[0] ?? pathname;

  for (const topic of HELP_TOPICS) {
    if (normalized === topic.moduleHref || normalized.startsWith(`${topic.moduleHref}/`)) {
      return {
        pathname: normalized,
        moduleCode: topic.licenseModule ?? topic.licenseAnyOf?.[0] ?? "Dashboard",
        moduleLabel: topic.title,
      };
    }
  }

  const match = ROUTE_PREFIXES.find(
    (r) => normalized === r.prefix || normalized.startsWith(`${r.prefix}/`)
  );
  if (match) {
    return { pathname: normalized, moduleCode: match.moduleCode, moduleLabel: match.moduleLabel };
  }

  return { pathname: normalized, moduleCode: "Dashboard", moduleLabel: "OpenSky HRM" };
}

export const AI_SIDEKICK_STARTER_PROMPTS = [
  "How many employees do we have by department?",
  "What leave requests need my approval?",
  "Show my leave balance for this year",
  "Who has birthdays coming up in the next two weeks?",
];
