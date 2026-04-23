"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { LetterTemplatesContent } from "@/components/settings/LetterTemplatesContent";
import {
  TransactionalEmailTemplatesContent,
  type TemplateListItem,
} from "@/components/settings/TransactionalEmailTemplatesContent";
import { ROUTES } from "@/config/routes";
import { DonutMixChart, formatInt, HorizontalCompareBars } from "@/lib/workspace-charts";

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [letterTemplates, setLetterTemplates] = useState<TemplateListItem[]>([]);

  const onTemplatesChange = useCallback((rows: TemplateListItem[]) => {
    setTemplates(rows);
  }, []);

  const onLetterTemplatesChange = useCallback((rows: TemplateListItem[]) => {
    setLetterTemplates(rows);
  }, []);

  const activeCount = useMemo(() => templates.filter((t) => t.isActive).length, [templates]);
  const inactiveCount = templates.length - activeCount;
  const letterActiveCount = useMemo(() => letterTemplates.filter((t) => t.isActive).length, [letterTemplates]);
  const letterInactiveCount = letterTemplates.length - letterActiveCount;

  const emailKpis = useMemo(
    () => [
      {
        label: "Transactional templates",
        value: formatInt(templates.length),
        sub: "Email_* keys from document templates API",
      },
      {
        label: "Active",
        value: formatInt(activeCount),
        sub: "Eligible for the next send",
      },
      {
        label: "Inactive",
        value: formatInt(inactiveCount),
        sub: "Paused until re-enabled",
      },
      {
        label: "Leave-related",
        value: formatInt(templates.filter((t) => /leave/i.test(t.templateKey)).length),
        sub: "Keys matching “leave”",
      },
    ],
    [templates, activeCount, inactiveCount]
  );

  const letterKpis = useMemo(
    () => [
      {
        label: "Employee letter templates",
        value: formatInt(letterTemplates.length),
        sub: "Non-Email_* keys (PDF/Word from People)",
      },
      {
        label: "Letters active",
        value: formatInt(letterActiveCount),
        sub: "Eligible in Create Document",
      },
      {
        label: "Letters inactive",
        value: formatInt(letterInactiveCount),
        sub: "Hidden until re-enabled",
      },
    ],
    [letterTemplates.length, letterActiveCount, letterInactiveCount]
  );

  const templateKeyBars = useMemo(() => {
    const colors = ["#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#64748b", "#eab308"];
    return templates.slice(0, 10).map((t, i) => ({
      label: t.templateKey.length > 28 ? `${t.templateKey.slice(0, 26)}…` : t.templateKey,
      value: 1,
      color: colors[i % colors.length],
    }));
  }, [templates]);

  const activeInactiveDonut = useMemo(() => {
    const rows = [
      { label: "Active", value: activeCount, color: "#22c55e" },
      { label: "Inactive", value: inactiveCount, color: "#94a3b8" },
    ].filter((x) => x.value > 0);
    return rows;
  }, [activeCount, inactiveCount]);

  return (
    <>
      <AppTopbar
        title="Email & letter templates"
        subtitle="Transactional emails (Email_*) and employee letter HTML used for PDF/Word from People — all stored as document templates."
      />

      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 px-7 py-8 text-slate-900 shadow-sm">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-sky-100/50 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 h-72 w-72 rounded-full bg-indigo-100/40 blur-3xl" />
        <div className="relative z-10">
          <p className="mb-2 inline-flex rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
            Messaging workspace
          </p>
          <h2 className="text-2xl font-semibold leading-tight text-slate-900 lg:text-3xl">Messaging &amp; document catalog</h2>
          <p className="mt-3 max-w-2xl text-sm text-slate-600">
            Edit transactional email copy below, then configure employee letters in the same workspace. Delivery outcomes
            live in the email log — same Command Center visual language as the rest of the app.
          </p>
        </div>
      </section>

      <div className="mt-6 space-y-6">
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {emailKpis.map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="text-xs font-medium uppercase tracking-wider text-slate-500">{kpi.label}</div>
              <div className="mt-2 text-2xl font-semibold leading-tight text-slate-900">{kpi.value}</div>
              <div className="mt-2 text-xs text-slate-600">{kpi.sub}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {letterKpis.map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="text-xs font-medium uppercase tracking-wider text-slate-500">{kpi.label}</div>
              <div className="mt-2 text-2xl font-semibold leading-tight text-slate-900">{kpi.value}</div>
              <div className="mt-2 text-xs text-slate-600">{kpi.sub}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-800">Templates in catalog</h3>
              <span className="text-xs text-slate-500">Up to 10 keys</span>
            </div>
            {templateKeyBars.length > 0 ? (
              <HorizontalCompareBars items={templateKeyBars} />
            ) : (
              <p className="py-10 text-center text-sm text-slate-500">
                No Email_* templates yet. Seed the API or run migrations to populate defaults.
              </p>
            )}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-800">Active vs inactive</h3>
              <span className="text-xs text-slate-500">Toggle in editor</span>
            </div>
            {activeInactiveDonut.length > 0 ? (
              <DonutMixChart values={activeInactiveDonut} />
            ) : (
              <p className="py-10 text-center text-sm text-slate-500">No templates loaded.</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-900">Quick links</h3>
            <p className="text-xs text-slate-500">Policy, delivery audit, and related hubs</p>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href={ROUTES.settings}
              className="group rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-800">Policy &amp; Settings</div>
                  <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">Master data, branding &amp; approvals</div>
                </div>
                <span className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700">
                  →
                </span>
              </div>
            </Link>
            <Link
              href={ROUTES.emailDeliveryLog}
              className="group rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-800">Email delivery log</div>
                  <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">Sent / failed / skipped rows</div>
                </div>
                <span className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700">
                  →
                </span>
              </div>
            </Link>
            <Link
              href={ROUTES.recruitment}
              className="group rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-800">Recruitment</div>
                  <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">Offer emails &amp; candidate flow</div>
                </div>
                <span className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700">
                  →
                </span>
              </div>
            </Link>
            <Link
              href={ROUTES.leave}
              className="group rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-800">Leave &amp; Absence</div>
                  <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">Workflows using leave mail</div>
                </div>
                <span className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700">
                  →
                </span>
              </div>
            </Link>
          </div>
        </div>

        <TransactionalEmailTemplatesContent onTemplatesChange={onTemplatesChange} />

        <LetterTemplatesContent onTemplatesChange={onLetterTemplatesChange} />

        <p className="footer-note">
          Charts above reflect Email_* rows after load. Letter KPIs count non-Email_* keys. Saving an email template
          updates subject/HTML for the next provider send; saving a letter template affects PDF/Word generation from People.
          The delivery log records actual email dispatch results.
        </p>
      </div>
    </>
  );
}
