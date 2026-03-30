"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { ROUTES } from "@/config/routes";

type PeopleHubHelpContextValue = {
  open: () => void;
  close: () => void;
  isOpen: boolean;
};

const PeopleHubHelpContext = createContext<PeopleHubHelpContextValue | null>(null);

export function usePeopleHubHelp(): PeopleHubHelpContextValue {
  const ctx = useContext(PeopleHubHelpContext);
  if (!ctx) {
    throw new Error("usePeopleHubHelp must be used within PeopleHubHelpProvider");
  }
  return ctx;
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-4 rounded-xl border border-slate-200/80 bg-slate-50/80 p-4">
      <h2 className="text-base font-bold text-slate-800">{title}</h2>
      <div className="mt-2 space-y-2 text-[13px] leading-relaxed text-slate-600">{children}</div>
    </section>
  );
}

function PeopleHubHelpContent({ onLinkFollow }: { onLinkFollow?: () => void }) {
  const follow = onLinkFollow ?? (() => {});

  return (
    <div className="flex flex-col gap-4 pb-6">
      <nav className="flex flex-wrap gap-1.5 text-[11px] font-medium text-slate-500">
        <a href="#ph-help-overview" className="rounded-full px-2 py-1 hover:bg-slate-200/60 hover:text-slate-800">
          Overview
        </a>
        <a href="#ph-help-search" className="rounded-full px-2 py-1 hover:bg-slate-200/60 hover:text-slate-800">
          Search
        </a>
        <a href="#ph-help-filters" className="rounded-full px-2 py-1 hover:bg-slate-200/60 hover:text-slate-800">
          Filters
        </a>
        <a href="#ph-help-directory" className="rounded-full px-2 py-1 hover:bg-slate-200/60 hover:text-slate-800">
          Directory
        </a>
        <a href="#ph-help-profiles" className="rounded-full px-2 py-1 hover:bg-slate-200/60 hover:text-slate-800">
          Profiles
        </a>
        <a href="#ph-help-access" className="rounded-full px-2 py-1 hover:bg-slate-200/60 hover:text-slate-800">
          Access
        </a>
      </nav>

      <Section id="ph-help-overview" title="Overview">
        <p>
          <strong className="text-slate-800">People Hub</strong> is your workforce directory. You can search and filter
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
          Use the <strong className="text-slate-800">Search employees</strong> field to find people by name. Results update
          automatically after a short pause as you type.
        </p>
        <ul className="list-disc space-y-1 pl-4">
          <li>
            <strong className="text-slate-800">Enter</strong> applies the search immediately and closes suggestion lists.
          </li>
          <li>
            While typing, you may see <strong className="text-slate-800">suggestions</strong> from managers whose names
            match; pick one to jump to that person&apos;s profile.
          </li>
          <li>
            Use <strong className="text-slate-800">Show all results</strong> when there are many name matches to run a full
            directory search instead of only the short suggestion list.
          </li>
        </ul>
      </Section>

      <Section id="ph-help-filters" title="Advanced filters">
        <p>
          Click the <strong className="text-slate-800">funnel</strong> icon to open the filter panel. A badge on the icon
          shows how many filter fields are set.
        </p>
        <p>You can narrow the list by:</p>
        <ul className="list-disc space-y-1 pl-4">
          <li>Employee name or employee code</li>
          <li>Status (e.g. Active, On notice, Terminated)</li>
          <li>Employment type (full-time, part-time, contract, etc.)</li>
          <li>Supervisor, job title, department, and location</li>
        </ul>
        <p>
          Choose <strong className="text-slate-800">Search</strong> to apply the panel values, or{" "}
          <strong className="text-slate-800">Reset</strong> to clear filters and the quick search box. The{" "}
          <strong className="text-slate-800">Active only</strong> option hides terminated records when enabled.
        </p>
      </Section>

      <Section id="ph-help-directory" title="Directory table & pagination">
        <p>
          Each row shows key details such as code, name, department, job, status, manager, and tenure.{" "}
          <strong className="text-slate-800">Status</strong> chips use color so you can scan lifecycle at a glance.
        </p>
        <p>
          The footer shows how many records match your criteria and provides{" "}
          <strong className="text-slate-800">Previous</strong> / <strong className="text-slate-800">Next</strong> pages when
          there are more results than one page (10 per page).
        </p>
      </Section>

      <Section id="ph-help-profiles" title="Opening & managing profiles">
        <p>
          Click a person&apos;s name or row action to open their <strong className="text-slate-800">profile</strong>. There
          you can review job, compensation, documents, and related HR data depending on your role.
        </p>
        <p>
          If you have <strong className="text-slate-800">Create</strong> permission on People, use{" "}
          <strong className="text-slate-800">New Employee</strong> to open the create dialog and add someone to the directory.
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
          Users with the right access see an <strong className="text-slate-800">Audit trail</strong> button in the People Hub
          header. It opens a log of people-related changes for compliance and troubleshooting.
        </p>
      </Section>

      <Section id="ph-help-access" title="Who sees what">
        <p>
          Access is controlled by your <strong className="text-slate-800">People</strong> permissions and scope (for
          example <em>Own</em>, <em>Team</em>, or <em>All</em>), and by your organization&apos;s licensed modules.
        </p>
        <ul className="list-disc space-y-1 pl-4">
          <li>
            <strong className="text-slate-800">Own</strong> scope usually sends you straight to your own profile instead of
            the full directory.
          </li>
          <li>
            If you cannot open someone or an action is missing, your administrator may need to adjust roles or entitlements.
          </li>
        </ul>
      </Section>

      <Section id="ph-help-more" title="More help">
        <p>
          For product questions outside People Hub, use the help icon on other pages to open the{" "}
          <Link href={ROUTES.contact} onClick={follow} className="font-semibold text-[#1565C9] underline-offset-2 hover:underline">
            contact
          </Link>{" "}
          page, or speak with your internal HR or IT contact.
        </p>
      </Section>
    </div>
  );
}

function PeopleHubHelpSlider({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <button
        type="button"
        aria-label="Close help"
        className={`fixed inset-0 z-[10040] bg-slate-900/40 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="people-hub-help-title"
        className={`fixed inset-y-0 right-0 z-[10041] flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform duration-300 ease-out ${
          open ? "pointer-events-auto translate-x-0" : "pointer-events-none translate-x-full"
        }`}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h2 id="people-hub-help-title" className="text-lg font-bold text-slate-800">
              People Hub — help
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">Directory, search, filters, and profiles.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-4">
          <PeopleHubHelpContent onLinkFollow={onClose} />
        </div>
      </div>
    </>
  );
}

export function PeopleHubHelpProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const open = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);

  const value: PeopleHubHelpContextValue = {
    open,
    close,
    isOpen,
  };

  return (
    <PeopleHubHelpContext.Provider value={value}>
      {children}
      <PeopleHubHelpSlider open={isOpen} onClose={close} />
    </PeopleHubHelpContext.Provider>
  );
}
