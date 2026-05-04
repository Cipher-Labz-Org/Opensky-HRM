"use client";

import Link from "next/link";
import { Fragment } from "react";
import type { HelpRichSection } from "@/lib/help-topic-sections";
import { ROUTES } from "@/config/routes";
import { HelpDetailSection } from "@/components/help/HelpDetailSection";

function RichText({ text }: { text: string }) {
  const parts = text.split(/\*\*/);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-semibold text-slate-900">
            {part}
          </strong>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </>
  );
}

type Props = {
  /** Prefix for anchor IDs, e.g. topic slug */
  idPrefix: string;
  sections: HelpRichSection[];
  /** Link to the live module (shown as last pill in the jump row). */
  openModuleHref?: string;
  openModuleLabel?: string;
};

export function DetailedHelpContent({ idPrefix, sections, openModuleHref, openModuleLabel }: Props) {
  const anchor = (sid: string) => `${idPrefix}-${sid}`;

  return (
    <div className="flex flex-col gap-6 pb-2">
      <nav
        className="flex flex-wrap gap-2 rounded-2xl border border-slate-200/90 bg-white px-4 py-3 text-[13px] font-medium text-slate-600 shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
        aria-label="On this page"
      >
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#${anchor(s.id)}`}
            className="rounded-full px-3 py-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            {s.navLabel ?? s.title}
          </a>
        ))}
        <a
          href={`#${anchor("more-help")}`}
          className="rounded-full px-3 py-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
        >
          More help
        </a>
        {openModuleHref && openModuleLabel ? (
          <Link
            href={openModuleHref}
            className="rounded-full border border-[#1a92d5]/35 bg-[#e8f4fc] px-3 py-1.5 text-[13px] font-semibold text-[#157fb8] transition hover:border-[#1a92d5] hover:bg-[#1a92d5] hover:text-white"
          >
            Open {openModuleLabel} →
          </Link>
        ) : null}
      </nav>

      {sections.map((s) => (
        <HelpDetailSection key={s.id} id={anchor(s.id)} title={s.title}>
          {s.paragraphs?.map((p, i) => (
            <p key={i}>
              <RichText text={p} />
            </p>
          ))}
          {s.bullets?.length ? (
            <ul className="list-disc space-y-2 pl-5 marker:text-slate-400">
              {s.bullets.map((b, i) => (
                <li key={i}>
                  <RichText text={b} />
                </li>
              ))}
            </ul>
          ) : null}
        </HelpDetailSection>
      ))}

      <HelpDetailSection id={anchor("more-help")} title="More help">
        <p>
          Browse other modules from{" "}
          <Link href={ROUTES.helpGuides} className="font-semibold text-[#1565C9] underline-offset-2 hover:underline">
            Help home
          </Link>{" "}
          or the sidebar. For account or sales questions, see{" "}
          <Link href={ROUTES.contact} className="font-semibold text-[#1565C9] underline-offset-2 hover:underline">
            Contact
          </Link>
          .
        </p>
      </HelpDetailSection>
    </div>
  );
}
