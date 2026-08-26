import { ROUTES } from "@/config/routes";

export type NavVisibilityContext = {
  isAdmin: boolean;
  hasPermission: (module: string, action: string) => boolean;
  getPeopleReadScope: () => "Own" | "Team" | "All" | null;
  getLeaveReadScope: () => "Own" | "Team" | "All" | null;
  hasRole: (roleCode: string) => boolean;
  permissions: ReadonlyArray<{ module: string; action: string; scope?: string | null }>;
};

function hasTeamOrAllScope(scope: "Own" | "Team" | "All" | null): boolean {
  return scope === "Team" || scope === "All";
}

/** Help stays reachable without a product license; role permission still applies. */
export function isAlwaysVisibleNavHref(href: string): boolean {
  return href === ROUTES.helpGuides || href.startsWith(`${ROUTES.helpGuides}/`);
}

/**
 * Menu visibility per route — finer than module-level Read checks.
 * Aligns sidebar with Roles & permissions (one row per sidebar item).
 */
export function isNavItemVisible(href: string, ctx: NavVisibilityContext): boolean {
  if (ctx.isAdmin) return true;

  switch (href) {
    case ROUTES.dashboard:
      return ctx.hasPermission("Dashboard", "Read");

    case ROUTES.people:
      return ctx.hasPermission("People", "Read");

    case ROUTES.peopleAuditTrail:
      return hasTeamOrAllScope(ctx.getPeopleReadScope());

    case ROUTES.employeeProfile:
      return ctx.hasPermission("EmployeeBio", "Read");

    case ROUTES.recruitment:
      return ctx.hasPermission("Recruitment", "Read");

    case ROUTES.employeeTasks:
      return ctx.hasPermission("EmployeeTasks", "Read");

    case ROUTES.employeeActions:
      return (
        ctx.hasPermission("EmployeeActions", "Read") ||
        ctx.hasPermission("EmployeeActions", "Update")
      );

    case ROUTES.leave:
      return ctx.hasPermission("Leave", "Read");

    case ROUTES.approvals:
      return ctx.hasPermission("Approvals", "Read");

    case ROUTES.attendance:
      return ctx.hasPermission("Attendance", "Read");

    case ROUTES.payroll:
      return ctx.hasPermission("Payroll", "Read");

    case ROUTES.performance:
      return ctx.hasPermission("Performance", "Read");

    case ROUTES.learning:
      return ctx.hasPermission("Learning", "Read");

    case ROUTES.reports:
      return ctx.hasPermission("Reports", "Read");

    case ROUTES.analytics:
      return ctx.hasPermission("Analytics", "Read");

    case ROUTES.orgStructure:
      return ctx.hasPermission("OrgStructure", "Read");

    case ROUTES.settings:
      return ctx.hasPermission("Settings", "Read");

    case ROUTES.emailTemplates:
      return ctx.hasPermission("EmailTemplates", "Read");

    case ROUTES.emailDeliveryLog:
      return ctx.hasPermission("EmailDeliveryLog", "Read");

    case ROUTES.billing:
    case ROUTES.billingCustomerReset:
      return ctx.hasPermission("Billing", "Read");

    case ROUTES.administration:
      return ctx.hasPermission("Administration", "Read");

    case ROUTES.userManagement:
      return ctx.hasPermission("UserManagement", "Read");

    case ROUTES.helpGuides:
      return ctx.hasPermission("Help", "Read");

    default:
      if (href.startsWith(`${ROUTES.helpGuides}/`)) return ctx.hasPermission("Help", "Read");
      return false;
  }
}
