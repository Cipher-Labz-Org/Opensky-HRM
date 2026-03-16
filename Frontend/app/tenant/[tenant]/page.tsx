import Link from "next/link";
import { ROUTES } from "@/config/routes";

type Props = { params?: { tenant: string } };

export default function TenantPage({ params }: Props) {
  const tenant = params?.tenant ?? "";
  const dashboardHref = ROUTES.tenantDashboard(tenant);
  const settingsHref = ROUTES.tenantSettings(tenant);

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-2xl font-bold text-[var(--text)]">
        Tenant: {tenant}
      </h1>
      <p className="text-[var(--muted)]">
        Placeholder tenant landing. Future: tenant-specific dashboard and context.
      </p>
      <div className="flex gap-4">
        <Link
          href={dashboardHref}
          className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white"
        >
          Tenant Dashboard
        </Link>
        <Link
          href={settingsHref}
          className="rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 py-2 text-sm font-semibold"
        >
          Tenant Settings
        </Link>
      </div>
    </div>
  );
}
