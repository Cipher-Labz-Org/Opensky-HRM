import { ROUTES } from "@/config/routes";

/**
 * Maps analytics drill-down links to the Reports UI (`/app/reports?category=&report=`).
 * Server also returns the same mapping in `ExecutiveDashboardDto.drillDown` from GET /api/analytics/executive-dashboard.
 */
export function reportsPageDrillUrl(category: string, reportKey: string, queryHint?: string | null): string {
  const q = new URLSearchParams();
  q.set("category", category);
  q.set("report", reportKey);
  if (queryHint) {
    const hint = queryHint.startsWith("?") ? queryHint.slice(1) : queryHint;
    const extra = new URLSearchParams(hint);
    extra.forEach((v, k) => {
      if (!q.has(k)) q.set(k, v);
    });
  }
  return `${ROUTES.reports}?${q.toString()}`;
}
