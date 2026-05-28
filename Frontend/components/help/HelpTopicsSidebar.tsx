"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ROUTES } from "@/config/routes";
import { filterHelpTopics, helpTopicHref } from "@/lib/help-topics";
import { useAuth } from "@/contexts/auth-context";

export function HelpTopicsSidebar({ activeSlug }: { activeSlug?: string }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const topics = filterHelpTopics(user?.licensedModules);

  return (
    <aside className="w-full shrink-0 lg:w-[220px]">
      <div className="sticky top-[76px] rounded-2xl border border-slate-200/90 bg-white px-3 py-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
        <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Help topics</p>
        <nav className="flex flex-col gap-0.5" aria-label="Help topics">
          <Link
            href={ROUTES.helpGuides}
            className={`rounded-lg px-2.5 py-2 text-sm font-medium transition ${
              pathname === ROUTES.helpGuides
                ? "bg-[#e8f4fc] text-[#157fb8]"
                : "text-[#1565C9] hover:bg-slate-50"
            }`}
          >
            Help home
          </Link>
          <ul className="mt-1 max-h-[min(70vh,28rem)] space-y-0.5 overflow-y-auto pr-0.5">
            {topics.map((topic) => {
              const href = helpTopicHref(topic.slug);
              const active = activeSlug === topic.slug || pathname === href;
              return (
                <li key={topic.slug}>
                  <Link
                    href={href}
                    className={`block rounded-lg px-2.5 py-2 text-sm transition ${
                      active
                        ? "bg-[#e8f4fc] font-medium text-[#157fb8]"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    {topic.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </aside>
  );
}
