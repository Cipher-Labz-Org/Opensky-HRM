"use client";

import Link from "next/link";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { HelpGuidesShell } from "@/components/help/HelpGuidesShell";
import { ROUTES } from "@/config/routes";
import { useAuth } from "@/contexts/auth-context";
import { filterHelpTopicsForLicense, helpGuideHref } from "@/lib/help-topics";

/** Hub root: card grid for every licensed topic + sidebar index. */
export default function HelpGuidesOverviewPage() {
  const { user } = useAuth();
  const topics = filterHelpTopicsForLicense(user?.licensedModules);

  return (
    <>
      <AppTopbar
        title="Help & guides"
        subtitle="Browse every module below or use Help topics on the right. Each guide opens as a full page with detailed sections."
      />
      <HelpGuidesShell>
        <div className="min-w-0 w-full">
          <div className="rounded-2xl bg-slate-200/40 p-5 ring-1 ring-slate-200/60 sm:p-7 md:p-8">
            <p className="mb-6 text-[15px] leading-[1.65] text-slate-700">
              Pick a card to open the step-by-step guide for that area. Guides stay inside the app so you can switch back
              to the live screen anytime.
            </p>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {topics.map((t) => (
                <Link
                  key={t.slug}
                  href={helpGuideHref(t.slug)}
                  className="group flex min-h-[11rem] flex-col rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition hover:border-[#1a92d5]/40 hover:shadow-md"
                >
                  <h2 className="text-base font-bold tracking-tight text-slate-900">{t.label}</h2>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{t.summary}</p>
                  <span className="mt-4 text-sm font-semibold text-[#1565C9] group-hover:underline">
                    Open guide →
                  </span>
                </Link>
              ))}
            </div>

            <p className="mt-10 text-center text-[15px] text-slate-600">
              Need something else?{" "}
              <Link href={ROUTES.contact} className="font-semibold text-[#1565C9] underline-offset-2 hover:underline">
                Contact support
              </Link>
            </p>
          </div>
        </div>
      </HelpGuidesShell>
    </>
  );
}
