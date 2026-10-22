"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { findGuardedNavHref, isNavItemVisible, type NavVisibilityContext } from "@/lib/nav-visibility";

/**
 * Blocks deep-links to app pages the signed-in role cannot open from the sidebar.
 * The API enforces the same permissions; this keeps users from landing on empty or erroring screens.
 */
export function PagePermissionGate({
  ctx,
  fallbackHref,
  children,
}: {
  ctx: NavVisibilityContext;
  fallbackHref: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const guarded = findGuardedNavHref(pathname);
  if (!guarded || isNavItemVisible(guarded, ctx)) return <>{children}</>;

  return (
    <div className="mx-auto max-w-lg rounded-[22px] border border-[var(--border)] bg-[var(--panel)] p-8 text-center shadow-[var(--shadow)]">
      <h2 className="text-lg font-semibold text-[var(--text)]">No access to this page</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Your role does not include access to this area. Ask an administrator to update your role in Roles &amp; permissions.
      </p>
      {fallbackHref && fallbackHref !== guarded && (
        <Link
          href={fallbackHref}
          className="mt-6 inline-block rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Go to an available page
        </Link>
      )}
    </div>
  );
}
