"use client";

import Link from "next/link";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { HelpTopicsSidebar } from "@/components/help/HelpTopicsSidebar";
import { filterHelpTopics, helpTopicHref } from "@/lib/help-topics";
import { useAuth } from "@/contexts/auth-context";

export function HelpHubHome() {
  const { user } = useAuth();
  const topics = filterHelpTopics(user?.licensedModules);

  return (
    <div>
      <AppTopbar title="Help & guides" subtitle="How-to documentation for every area of OpenSky HRM" />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {topics.map((topic) => (
              <article
                key={topic.slug}
                className="flex flex-col rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition hover:border-slate-300 hover:shadow-md"
              >
                <h2 className="text-base font-semibold text-slate-900">{topic.title}</h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-500">{topic.description}</p>
                <Link
                  href={helpTopicHref(topic.slug)}
                  className="mt-4 inline-flex text-sm font-semibold text-[#1565C9] hover:underline"
                >
                  Open guide →
                </Link>
              </article>
            ))}
          </div>
        </div>
        <HelpTopicsSidebar />
      </div>
    </div>
  );
}
