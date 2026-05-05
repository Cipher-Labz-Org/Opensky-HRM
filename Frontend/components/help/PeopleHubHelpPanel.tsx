"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ROUTES } from "@/config/routes";
import { HelpDetailSection } from "@/components/help/HelpDetailSection";

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <HelpDetailSection id={id} title={title}>
      {children}
    </HelpDetailSection>
  );
}

export function PeopleHubHelpContent({
  onLinkFollow,
  openModuleHref,
  openModuleLabel,
}: {
  onLinkFollow?: () => void;
  openModuleHref?: string;
  openModuleLabel?: string;
}) {
  const follow = onLinkFollow ?? (() => {});

  return (
    <div className="flex flex-col gap-6 pb-2">
      <nav
        className="flex flex-wrap gap-2 rounded-2xl border border-slate-200/90 bg-white px-4 py-3 text-[13px] font-medium text-slate-600 shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
        aria-label="On this page"
      >
        <a href="#ph-help-overview" className="rounded-full px-3 py-1.5 transition hover:bg-slate-100 hover:text-slate-900">
          Overview
        </a>
        <a href="#ph-help-search" className="rounded-full px-3 py-1.5 transition hover:bg-slate-100 hover:text-slate-900">
          Search
        </a>
        <a href="#ph-help-filters" className="rounded-full px-3 py-1.5 transition hover:bg-slate-100 hover:text-slate-900">
          Filters
        </a>
        <a href="#ph-help-directory" className="rounded-full px-3 py-1.5 transition hover:bg-slate-100 hover:text-slate-900">
          Directory
        </a>
        <a href="#ph-help-profiles" className="rounded-full px-3 py-1.5 transition hover:bg-slate-100 hover:text-slate-900">
          Profiles
        </a>
        <a href="#ph-help-audit" className="rounded-full px-3 py-1.5 transition hover:bg-slate-100 hover:text-slate-900">
          Audit
        </a>
        <a href="#ph-help-access" className="rounded-full px-3 py-1.5 transition hover:bg-slate-100 hover:text-slate-900">
          Access
        </a>
        <a href="#ph-help-more" className="rounded-full px-3 py-1.5 transition hover:bg-slate-100 hover:text-slate-900">
          More help
        </a>
        {openModuleHref && openModuleLabel ? (
          <Link
            href={openModuleHref}
            onClick={follow}
            className="rounded-full border border-[#1a92d5]/35 bg-[#e8f4fc] px-3 py-1.5 text-[13px] font-semibold text-[#157fb8] transition hover:border-[#1a92d5] hover:bg-[#1a92d5] hover:text-white"
          >
            Open {openModuleLabel} →
          </Link>
        ) : null}
      </nav>

      <Section id="ph-help-overview" title="Overview">
        <p>
          <strong className="font-semibold text-slate-900">People Hub</strong> is your workforce directory. You can search and filter
          employees, open full profiles to view or edit (based on your permissions), add new employees, and review audit
          history where available.
        </p>
        <p>
          Summary tiles at the top show approximate counts for active employees, departments, locations, and job titles
          (based on live data when the page loads).
        </p>
      </Section>

      <Section id="ph-help-search" title="Quick search">
        <p>
          Use the <strong className="font-semibold text-slate-900">Search employees</strong> field to find people by name. Results update
          automatically after a short pause as you type.
        </p>
        <ul className="list-disc space-y-2 pl-5 marker:text-slate-400">
          <li>
            <strong className="font-semibold text-slate-900">Enter</strong> applies the search immediately and closes suggestion lists.
          </li>
          <li>
            While typing, you may see <strong className="font-semibold text-slate-900">suggestions</strong> from managers whose names
            match; pick one to jump to that person&apos;s profile.
          </li>
          <li>
            Use <strong className="font-semibold text-slate-900">Show all results</strong> when there are many name matches to run a full
            directory search instead of only the short suggestion list.
          </li>
        </ul>
      </Section>

      <Section id="ph-help-filters" title="Advanced filters">
        <p>
          Click the <strong className="font-semibold text-slate-900">funnel</strong> icon to open the filter panel. A badge on the icon
          shows how many filter fields are set.
        </p>
        <p>You can narrow the list by:</p>
        <ul className="list-disc space-y-2 pl-5 marker:text-slate-400">
          <li>Employee name or employee code</li>
          <li>Status (e.g. Active, On notice, Terminated)</li>
          <li>Employment type (full-time, part-time, contract, etc.)</li>
          <li>Supervisor, job title, department, and location</li>
        </ul>
        <p>
          Choose <strong className="font-semibold text-slate-900">Search</strong> to apply the panel values, or{" "}
          <strong className="font-semibold text-slate-900">Reset</strong> to clear filters and the quick search box. The{" "}
          <strong className="font-semibold text-slate-900">Active only</strong> option hides terminated records when enabled.
        </p>
      </Section>

      <Section id="ph-help-directory" title="Directory table & pagination">
        <p>
          Each row shows key details such as code, name, department, job, status, manager, and tenure.{" "}
          <strong className="font-semibold text-slate-900">Status</strong> chips use color so you can scan lifecycle at a glance.
        </p>
        <p>
          The footer shows how many records match your criteria and provides{" "}
          <strong className="font-semibold text-slate-900">Previous</strong> / <strong className="font-semibold text-slate-900">Next</strong> pages when
          there are more results than one page (10 per page).
        </p>
      </Section>

      <Section id="ph-help-profiles" title="Opening & managing profiles">
        <p>
          Click a person&apos;s name or row action to open their <strong className="font-semibold text-slate-900">profile</strong>. There
          you can review job, compensation, documents, and related HR data depending on your role.
        </p>
        <p>
          If you have <strong className="font-semibold text-slate-900">Create</strong> permission on People, use{" "}
          <strong className="font-semibold text-slate-900">New Employee</strong> to open the create dialog and add someone to the directory.
        </p>
        <p>
          For a read-only summary of your own record (and directory search for HR/admin where allowed), use{" "}
          <Link
            href={ROUTES.employeeProfile}
            onClick={follow}
            className="font-semibold text-[#1565C9] underline-offset-2 hover:underline"
          >
            Employee 360
          </Link>{" "}
          in the sidebar.
        </p>
      </Section>

      <Section id="ph-help-audit" title="Audit trail">
        <p>
          Users with the right access see an <strong className="font-semibold text-slate-900">Audit trail</strong> button in the People Hub
          header. It opens a log of people-related changes for compliance and troubleshooting.
        </p>
      </Section>

      <Section id="ph-help-access" title="Who sees what">
        <p>
          Access is controlled by your <strong className="font-semibold text-slate-900">People</strong> permissions and scope (for
          example <em>Own</em>, <em>Team</em>, or <em>All</em>), and by your organization&apos;s licensed modules.
        </p>
        <ul className="list-disc space-y-2 pl-5 marker:text-slate-400">
          <li>
            <strong className="font-semibold text-slate-900">Own</strong> scope usually sends you straight to your own profile instead of
            the full directory.
          </li>
          <li>
            If you cannot open someone or an action is missing, your administrator may need to adjust roles or entitlements.
          </li>
        </ul>
      </Section>

      <Section id="ph-help-more" title="More help">
        <p>
          For other modules, open{" "}
          <Link href={ROUTES.helpGuides} onClick={follow} className="font-semibold text-[#1565C9] underline-offset-2 hover:underline">
            Help &amp; guides
          </Link>{" "}
          from the sidebar or the header help icon. For sales or account issues, see{" "}
          <Link href={ROUTES.contact} onClick={follow} className="font-semibold text-[#1565C9] underline-offset-2 hover:underline">
            Contact
          </Link>
          .
        </p>
      </Section>
    </div>
  );
}
