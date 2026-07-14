"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { HelpTopicsSidebar } from "@/components/help/HelpTopicsSidebar";
import { ModuleHelpContent } from "@/components/help/ModuleHelpContent";
import { PeopleHubHelpContent } from "@/components/help/PeopleHubHelpPanel";
import { HELP_CONTENT_BY_SLUG } from "@/lib/help-content";
import { getHelpTopic, isHelpTopicLicensed } from "@/lib/help-topics";
import { ROUTES } from "@/config/routes";
import { useAuth } from "@/contexts/auth-context";

export function HelpTopicPage({ slug }: { slug: string }) {
  const { user } = useAuth();
  const topic = getHelpTopic(slug);

  if (!topic) {
    notFound();
  }

  if (!isHelpTopicLicensed(topic, user?.licensedModules)) {
    return (
      <div>
        <AppTopbar title="Help & guides" />
        <p className="text-sm text-slate-600">This guide is not available for your organization&apos;s plan.</p>
        <Link href={ROUTES.helpGuides} className="mt-4 inline-block text-sm font-semibold text-[#1565C9] hover:underline">
          ← Back to Help home
        </Link>
      </div>
    );
  }

  const doc = HELP_CONTENT_BY_SLUG[slug];
  const openLabel = topic.title.replace(/&/g, "and");
  const showModuleLink = slug !== "people-audit-trail";

  return (
    <div>
      <AppTopbar title={`${topic.title} — Help`} subtitle="Step-by-step guide for this area" />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          {slug === "people" ? (
            <PeopleHubHelpContent openModuleHref={topic.moduleHref} openModuleLabel={openLabel} />
          ) : doc ? (
            <ModuleHelpContent
              doc={doc}
              openModuleHref={showModuleLink ? topic.moduleHref : undefined}
              openModuleLabel={showModuleLink ? openLabel : undefined}
            />
          ) : (
            <div className="rounded-2xl border border-slate-200/90 bg-white px-5 py-4 text-sm text-slate-600 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
              <p>Documentation for this module is coming soon.</p>
              <Link
                href={topic.moduleHref}
                className="mt-3 inline-block font-semibold text-[#1565C9] underline-offset-2 hover:underline"
              >
                Open {topic.title} →
              </Link>
            </div>
          )}
        </div>
        <HelpTopicsSidebar activeSlug={slug} />
      </div>
    </div>
  );
}
