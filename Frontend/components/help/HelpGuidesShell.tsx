"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ROUTES } from "@/config/routes";
import { useAuth } from "@/contexts/auth-context";
import { filterHelpTopicsForLicense, helpGuideHref } from "@/lib/help-topics";

export function HelpGuidesShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const { user } = useAuth();
  const topics = filterHelpTopicsForLicense(user?.licensedModules);

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-5">
      <div className="min-w-0 flex-1">{children}</div>
      <aside className="shrink-0 lg:w-60 lg:sticky lg:top-20 lg:self-start">
        <nav className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-3 shadow-[var(--shadow)]">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">Help topics</p>
          <Link
            href={ROUTES.helpGuides}
            className={`mb-2 block rounded-xl px-3 py-2 text-sm font-semibold transition ${
              pathname === ROUTES.helpGuides
                ? "bg-[var(--primary-soft)] text-[var(--primary-deep)]"
                : "text-[var(--primary)] hover:bg-slate-50"
            }`}
          >
            Help home
          </Link>
          <div className="max-h-[min(70vh,520px)] space-y-0.5 overflow-y-auto border-t border-slate-100 pt-2">
            {topics.map((t) => {
              const href = helpGuideHref(t.slug);
              const active = pathname === href;
              return (
                <Link
                  key={t.slug}
                  href={href}
                  className={`block rounded-xl px-3 py-2 text-sm transition ${
                    active
                      ? "bg-[var(--primary-soft)] font-semibold text-[var(--primary-deep)]"
                      : "text-[var(--text)] hover:bg-slate-50"
                  }`}
                >
                  {t.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </aside>
    </div>
  );
}
