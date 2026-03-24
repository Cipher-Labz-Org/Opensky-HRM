"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ROUTES } from "@/config/routes";
import { useAuth } from "@/contexts/auth-context";
import { getLicensedModuleForPath } from "@/lib/app-route-modules";

/**
 * Blocks deep-links to app areas when the instance has not licensed the module.
 */
export function LicensePageGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const { user, isLoading } = useAuth();

  if (isLoading || !user) return <>{children}</>;

  const requiredModule = getLicensedModuleForPath(pathname);
  if (!requiredModule) return <>{children}</>;

  const licensed = user.licensedModules;
  if (licensed == null || licensed.length === 0) return <>{children}</>;

  if (licensed.includes(requiredModule)) return <>{children}</>;

  return (
    <div className="mx-auto max-w-lg rounded-[22px] border border-[var(--border)] bg-[var(--panel)] p-8 text-center shadow-[var(--shadow)]">
      <h2 className="text-lg font-semibold text-[var(--text)]">Module not included</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">
        This area ({requiredModule}) is not enabled for your organization&apos;s plan.
      </p>
      <Link
        href={ROUTES.dashboard}
        className="mt-6 inline-block rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
