import { ROUTES } from "@/config/routes";

export type NavVisibilityContext = {
  isAdmin: boolean;
  hasPermission: (module: string, action: string) => boolean;
  getPeopleReadScope: () => "Own" | "Team" | "All" | null;
  getLeaveReadScope: () => "Own" | "Team" | "All" | null;
  hasRole: (roleCode: string) => boolean;
  permissions: ReadonlyArray<{ module: string; action: string; scope?: string | null }>;
};

function readScope(
  ctx: NavVisibilityContext,
  module: string,
): "Own" | "Team" | "All" | null {
  if (ctx.isAdmin) return "All";
  const reads = ctx.permissions.filter((p) => p.module === module && p.action === "Read");
  if (reads.length === 0) return null;
  if (reads.some((p) => (p.scope ?? "Own") === "All")) return "All";
  if (reads.some((p) => (p.scope ?? "Own") === "Team")) return "Team";
  return "Own";
}

function hasTeamOrAllScope(scope: "Own" | "Team" | "All" | null): boolean {
  return scope === "Team" || scope === "All";
}

/** Help is available to every signed-in user. */
export function isAlwaysVisibleNavHref(href: string): boolean {
  return href === ROUTES.helpGuides || href.startsWith(`${ROUTES.helpGuides}/`);
}

/**
 * Menu visibility per route — finer than module-level Read checks.
 * Aligns sidebar with Roles & permissions (e.g. Employee sees Dashboard, People Hub, Leave, Help only).
 */
export function isNavItemVisible(href: string, ctx: NavVisibilityContext): boolean {
  if (isAlwaysVisibleNavHref(href)) return true;
  if (ctx.isAdmin) return true;

  switch (href) {
    case ROUTES.dashboard:
      return ctx.hasPermission("Dashboard", "Read");

    case ROUTES.people:
      return ctx.hasPermission("People", "Read");

    case ROUTES.peopleAuditTrail:
      return hasTeamOrAllScope(ctx.getPeopleReadScope());

    case ROUTES.employeeProfile:
      return ctx.hasPermission("People", "Read");

    case ROUTES.recruitment:
      return ctx.hasPermission("Recruitment", "Read");

    case ROUTES.employeeTasks:
      return ctx.hasPermission("EmployeeTasks", "Read");

    case ROUTES.employeeActions:
      return (
        ctx.hasPermission("People", "Update") || hasTeamOrAllScope(ctx.getPeopleReadScope())
      );

    case ROUTES.leave:
      return ctx.hasPermission("Leave", "Read");

    case ROUTES.approvals:
      return (
        ctx.hasRole("SUPERVISOR") ||
        hasTeamOrAllScope(ctx.getLeaveReadScope()) ||
        hasTeamOrAllScope(readScope(ctx, "Attendance"))
      );

    case ROUTES.attendance:
      return ctx.hasPermission("Attendance", "Read");

    case ROUTES.payroll:
      return ctx.hasPermission("Payroll", "Read");

    case ROUTES.performance:
      return ctx.hasPermission("Performance", "Read");

    case ROUTES.learning:
      return ctx.hasPermission("Learning", "Read");

    case ROUTES.reports:
    case ROUTES.analytics:
      return ctx.hasPermission("Analytics", "Read");

    case ROUTES.orgStructure:
      return ctx.hasPermission("OrgStructure", "Read");

    case ROUTES.settings:
    case ROUTES.emailTemplates:
    case ROUTES.emailDeliveryLog:
      return ctx.hasPermission("Settings", "Read");

    case ROUTES.billing:
    case ROUTES.billingCustomerReset:
      return ctx.hasPermission("Billing", "Read");

    case ROUTES.administration:
    case ROUTES.userManagement:
      return ctx.hasPermission("Administration", "Read");

    default:
      return false;
  }
}
