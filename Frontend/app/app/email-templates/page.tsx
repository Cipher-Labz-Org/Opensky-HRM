"use client";

import Link from "next/link";
import { useCallback, useState, type ReactNode } from "react";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import {
  DocumentTemplateWorkspace,
  type TemplateListItem,
} from "@/components/settings/DocumentTemplateWorkspace";
import { ROUTES } from "@/config/routes";

type TemplateTab = "email" | "letter";

export default function EmailTemplatesPage() {
  const [tab, setTab] = useState<TemplateTab>("email");
  const [, setEmailTemplates] = useState<TemplateListItem[]>([]);
  const [, setLetterTemplates] = useState<TemplateListItem[]>([]);

  const onEmailTemplatesChange = useCallback((rows: TemplateListItem[]) => {
    setEmailTemplates(rows);
  }, []);

  const onLetterTemplatesChange = useCallback((rows: TemplateListItem[]) => {
    setLetterTemplates(rows);
  }, []);

  return (
    <>
      <AppTopbar
        title="Email & letter templates"
        subtitle="Preview, edit, and test centralized notification and letter templates before rolling out changes."
      />

      <div className="mt-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100/80 p-1">
            <TabSwitch active={tab === "email"} onClick={() => setTab("email")}>
              Transactional emails
            </TabSwitch>
            <TabSwitch active={tab === "letter"} onClick={() => setTab("letter")}>
              Employee letters
            </TabSwitch>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <QuickLink href={ROUTES.emailDeliveryLog} label="Email delivery log" />
            <QuickLink href={ROUTES.settings} label="Settings" />
          </div>
        </div>

        {tab === "email" ? (
          <DocumentTemplateWorkspace kind="email" onTemplatesChange={onEmailTemplatesChange} />
        ) : (
          <DocumentTemplateWorkspace kind="letter" onTemplatesChange={onLetterTemplatesChange} />
        )}
      </div>
    </>
  );
}

function TabSwitch({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
        active ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
      }`}
    >
      {children}
    </button>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
    >
      {label}
    </Link>
  );
}
