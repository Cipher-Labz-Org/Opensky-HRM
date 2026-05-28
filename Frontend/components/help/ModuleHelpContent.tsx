"use client";

import Link from "next/link";
import type { HelpContentDoc } from "@/lib/help-content";
import { HelpDetailSection } from "@/components/help/HelpDetailSection";
import { ROUTES } from "@/config/routes";

export function ModuleHelpContent({
  doc,
  openModuleHref,
  openModuleLabel,
}: {
  doc: HelpContentDoc;
  openModuleHref?: string;
  openModuleLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-6 pb-2">
      <nav
        className="flex flex-wrap gap-2 rounded-2xl border border-slate-200/90 bg-white px-4 py-3 text-[13px] font-medium text-slate-600 shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
        aria-label="On this page"
      >
        {doc.sections.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="rounded-full px-3 py-1.5 transition hover:bg-slate-100 hover:text-slate-900"
          >
            {section.tabLabel ?? section.title}
          </a>
        ))}
        {openModuleHref && openModuleLabel ? (
          <Link
            href={openModuleHref}
            className="rounded-full border border-[#1a92d5]/35 bg-[#e8f4fc] px-3 py-1.5 text-[13px] font-semibold text-[#157fb8] transition hover:border-[#1a92d5] hover:bg-[#1a92d5] hover:text-white"
          >
            Open {openModuleLabel} →
          </Link>
        ) : null}
      </nav>

      {doc.sections.map((section) => (
        <HelpDetailSection key={section.id} id={section.id} title={section.title}>
          {section.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          {section.bullets?.length ? (
            <ul className="list-disc space-y-2 pl-5 marker:text-slate-400">
              {section.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          ) : null}
        </HelpDetailSection>
      ))}

      <HelpDetailSection id="module-help-more" title="More help">
        <p>
          For other modules, open{" "}
          <Link href={ROUTES.helpGuides} className="font-semibold text-[#1565C9] underline-offset-2 hover:underline">
            Help &amp; guides
          </Link>{" "}
          from the sidebar or the header help icon.
        </p>
      </HelpDetailSection>
    </div>
  );
}
