"use client";

import Link from "next/link";
import type { HelpTopic } from "@/lib/help-topics";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { PeopleHubHelpContent } from "@/components/help/PeopleHubHelpPanel";
import { DetailedHelpContent } from "@/components/help/DetailedHelpContent";
import { HelpGuidesShell } from "@/components/help/HelpGuidesShell";

type Props = { topic: HelpTopic };

export function HelpTopicView({ topic }: Props) {
  const isPeople = topic.slug === "people";

  return (
    <>
      <AppTopbar title={`Help: ${topic.label}`} subtitle={topic.summary} />

      <HelpGuidesShell>
        <div className="min-w-0 w-full">
          <div className="rounded-2xl bg-slate-200/40 p-5 ring-1 ring-slate-200/60 sm:p-7 md:p-8">
            {isPeople ? (
              <PeopleHubHelpContent openModuleHref={topic.appHref} openModuleLabel={topic.label} />
            ) : topic.sections?.length ? (
              <DetailedHelpContent
                idPrefix={topic.slug}
                sections={topic.sections}
                openModuleHref={topic.appHref}
                openModuleLabel={topic.label}
              />
            ) : (
              <article className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-[0_1px_3px_rgba(15,23,42,0.06)] sm:p-7">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-bold tracking-tight text-slate-900">How to use this area</h2>
                  <Link
                    href={topic.appHref}
                    className="shrink-0 rounded-full border border-[#1a92d5]/35 bg-[#e8f4fc] px-3 py-1.5 text-sm font-semibold text-[#157fb8] transition hover:border-[#1a92d5] hover:bg-[#1a92d5] hover:text-white"
                  >
                    Open {topic.label} →
                  </Link>
                </div>
                <p className="mt-4 text-[15px] leading-[1.65] text-slate-600">{topic.summary}</p>
                <ol className="mt-6 list-decimal space-y-3 pl-5 text-[15px] leading-[1.65] text-slate-700 marker:font-semibold">
                  {topic.steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </article>
            )}
          </div>
        </div>
      </HelpGuidesShell>
    </>
  );
}
