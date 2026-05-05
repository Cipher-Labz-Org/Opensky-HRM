import { ROUTES } from "@/config/routes";

const HELP_ROUTE_BY_PREFIX: Array<{ prefix: string; helpRoute: string }> = [
  { prefix: ROUTES.people, helpRoute: `${ROUTES.helpGuides}/people` },
  { prefix: ROUTES.recruitment, helpRoute: `${ROUTES.helpGuides}/recruitment` },
  { prefix: ROUTES.onboarding, helpRoute: `${ROUTES.helpGuides}/onboarding` },
  { prefix: ROUTES.leave, helpRoute: `${ROUTES.helpGuides}/leave` },
  { prefix: ROUTES.attendance, helpRoute: `${ROUTES.helpGuides}/attendance` },
  { prefix: ROUTES.payroll, helpRoute: `${ROUTES.helpGuides}/payroll` },
  { prefix: ROUTES.performance, helpRoute: `${ROUTES.helpGuides}/performance` },
  { prefix: ROUTES.learning, helpRoute: `${ROUTES.helpGuides}/learning` },
  { prefix: ROUTES.analytics, helpRoute: `${ROUTES.helpGuides}/analytics` },
  { prefix: ROUTES.reports, helpRoute: `${ROUTES.helpGuides}/reports` },
  { prefix: ROUTES.settings, helpRoute: `${ROUTES.helpGuides}/settings` },
];

export function contextualHelpGuideHref(pathname: string, _licensedModules?: string[]): string {
  const cleanPath = (pathname || "").trim();
  if (!cleanPath) return ROUTES.helpGuides;

  const match = HELP_ROUTE_BY_PREFIX.find(
    ({ prefix }) => cleanPath === prefix || cleanPath.startsWith(`${prefix}/`)
  );
  return match?.helpRoute ?? ROUTES.helpGuides;
}
