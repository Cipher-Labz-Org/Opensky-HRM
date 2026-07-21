"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { publicApiFetch } from "@/lib/api";
import { CandidateJobApplicationPanel } from "@/components/recruitment/CandidateJobApplicationPanel";
import { formatDate } from "@/lib/date-utils";
import { APP_NAME } from "@/config/constants";
import { employmentTypeDisplayName, type EmploymentTypeCatalogItem } from "@/lib/employment-types";
import { generateRequisitionDescription, type RequisitionDescriptionSnapshot } from "@/lib/generate-requisition-description";
import { normalizeSalaryCurrency } from "@/lib/salary-currency";
import { parseRequisitionDescription } from "@/lib/parse-requisition-description";
import {
  REQUISITION_GRADIENT_BAR_CLASS,
  RequisitionDocumentHeader,
} from "@/components/recruitment/RequisitionDocumentHeader";

/** Public API payload (matches internal detail fields used for rendering). */
interface PublicRequisition {
  id: string;
  title: string;
  code: string;
  description?: string;
  vacancies: number;
  status: string;
  targetDate?: string;
  priority?: string;
  employmentType?: string;
  experienceMin?: number;
  experienceMax?: number;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  skills?: string;
  departmentName?: string;
  departmentId: string;
  jobTitleName?: string;
  jobTitleId?: string;
  hiringManagerName?: string;
  hiringManagerId?: string;
  locationName?: string;
  locationId?: string;
  positionTitle?: string;
  positionId?: string;
}

const gradientBarClass = REQUISITION_GRADIENT_BAR_CLASS;

function snapshotFromReq(req: PublicRequisition, employmentTypeLabel: string): RequisitionDescriptionSnapshot {
  return {
    title: req.title,
    code: req.code,
    vacancies: req.vacancies,
    targetDate: req.targetDate ? formatDate(req.targetDate) : "",
    priority: req.priority ?? "",
    employmentType: req.employmentType ?? "",
    employmentTypeLabel,
    experienceMin: req.experienceMin != null ? String(req.experienceMin) : "",
    experienceMax: req.experienceMax != null ? String(req.experienceMax) : "",
    salaryMin: req.salaryMin != null ? String(req.salaryMin) : "",
    salaryMax: req.salaryMax != null ? String(req.salaryMax) : "",
    salaryCurrency: normalizeSalaryCurrency(req.salaryCurrency),
    departmentName: req.departmentName ?? "",
    jobTitleName: req.jobTitleName ?? "",
    hiringManagerName: req.hiringManagerName ?? "",
    locationName: req.locationName ?? "",
    skills: req.skills
      ? req.skills
          .split(/[,;]/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
  };
}

function DocumentBody({ text }: { text: string }) {
  const rawLines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  while (i < rawLines.length) {
    const line = rawLines[i];
    if (/^\s*•\s/.test(line)) {
      const items: string[] = [];
      while (i < rawLines.length && /^\s*•\s/.test(rawLines[i])) {
        items.push(rawLines[i].replace(/^\s*•\s*/, "").trim());
        i++;
      }
      blocks.push(
        <ul
          key={blocks.length}
          className="list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-neutral-800 marker:text-neutral-400"
        >
          {items.map((t, j) => (
            <li key={j} className="pl-0.5">
              {t}
            </li>
          ))}
        </ul>
      );
      continue;
    }
    if (line.trim() === "") {
      i++;
      continue;
    }
    const para: string[] = [line.trim()];
    i++;
    while (i < rawLines.length && rawLines[i].trim() !== "" && !/^\s*•\s/.test(rawLines[i])) {
      para.push(rawLines[i].trim());
      i++;
    }
    blocks.push(
      <p key={blocks.length} className="text-[15px] leading-relaxed text-neutral-800">
        {para.join(" ")}
      </p>
    );
  }
  return <div className="space-y-3">{blocks}</div>;
}

function DocSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10 last:mb-0">
      <h2 className="text-lg font-semibold tracking-tight text-neutral-900">{title}</h2>
      <hr className="mt-2 border-0 border-t border-neutral-200" />
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function PublicCareersRequisitionPage() {
  const params = useParams();
  const id = params.id as string;

  const [req, setReq] = useState<PublicRequisition | null>(null);
  const employmentTypes: EmploymentTypeCatalogItem[] = [];
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await publicApiFetch<PublicRequisition>(`/api/recruitment/public/requisitions/${id}`);
      setReq(data);
    } catch (err) {
      setError(
        err instanceof Error && err.message.trim()
          ? err.message.trim()
          : "This job is not available for applications. It may still be pending approval, already closed, or the link is incorrect.",
      );
      setReq(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="border-b border-slate-200 bg-white px-4 py-4 shadow-sm">
          <div className="mx-auto flex max-w-3xl items-center justify-between">
            <span className="text-sm font-semibold text-slate-800">{APP_NAME}</span>
            <span className="text-xs text-slate-500">Careers</span>
          </div>
        </header>
        <div className="flex min-h-[40vh] items-center justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600/20 border-t-blue-600" />
        </div>
      </div>
    );
  }

  if (error || !req) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="border-b border-slate-200 bg-white px-4 py-4 shadow-sm">
          <div className="mx-auto flex max-w-3xl items-center justify-between">
            <span className="text-sm font-semibold text-slate-800">{APP_NAME}</span>
            <span className="text-xs text-slate-500">Careers</span>
          </div>
        </header>
        <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-16 text-center">
          <p className="text-red-600">{error || "Job not found."}</p>
          <Link href="/" className="text-sm font-medium text-blue-700 underline-offset-2 hover:underline">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  const empLabel = employmentTypeDisplayName(employmentTypes, req.employmentType);
  const displayText = req.description?.trim()
    ? req.description.trim()
    : generateRequisitionDescription(snapshotFromReq(req, empLabel));
  const parsed = parseRequisitionDescription(displayText);
  const visibleSections =
    parsed?.sections.filter((s) => s.title.trim().toLowerCase() !== "how to apply") ?? [];

  const roleDisplayLine =
    req.jobTitleName?.trim() && req.jobTitleName.trim() !== req.title.trim()
      ? `${req.title} (${req.jobTitleName.trim()})`
      : req.title;

  const openingsLine =
    req.vacancies > 1
      ? `${req.vacancies} openings`
      : req.vacancies === 1
        ? "1 opening"
        : "Openings TBD";

  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <header className="border-b border-slate-200 bg-white px-4 py-4 shadow-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <span className="text-sm font-semibold text-slate-800">{APP_NAME}</span>
          <span className="text-xs font-medium text-slate-500">Careers · Public posting</span>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl px-0 pt-6 sm:px-2">
        <article className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-md sm:rounded-2xl">
          <RequisitionDocumentHeader title={req.title} className="rounded-t-xl sm:rounded-t-2xl" />

          <div className="border-b border-neutral-100 px-6 py-6 sm:px-10 sm:py-8">
            <p className="text-sm text-neutral-600">
              Requisition <span className="font-mono text-neutral-900">{req.code}</span>
              {req.targetDate ? <> · Target {formatDate(req.targetDate)}</> : null} · {openingsLine}
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-neutral-900">{roleDisplayLine}</h1>
          </div>

          <div className="border-b border-neutral-100 px-6 py-8 sm:px-10 sm:py-10">
            {parsed ? (
              <>
                {parsed.preamble ? (
                  <div className="mb-10 whitespace-pre-line text-[15px] leading-relaxed text-neutral-700">
                    {parsed.preamble}
                  </div>
                ) : null}
                {visibleSections.map((sec) => (
                  <DocSection key={sec.title} title={sec.title}>
                    <DocumentBody text={sec.body} />
                  </DocSection>
                ))}
              </>
            ) : (
              <DocSection title="Overview">
                <DocumentBody text={displayText} />
              </DocSection>
            )}
          </div>

          <CandidateJobApplicationPanel
            requisitionId={req.id}
            requisitionTitle={req.title}
            applySource="Public careers link"
          />

          <footer className={`${gradientBarClass} rounded-b-xl sm:rounded-b-2xl !py-6 text-center`}>
            <p className="text-xs font-medium text-white/95 sm:text-sm">
              © {year} {APP_NAME}
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-white/75 sm:text-xs">
              Requisition <span className="font-mono text-white/90">{req.code}</span>
              {req.targetDate ? <> · Target {formatDate(req.targetDate)}</> : null} · Public careers posting
            </p>
          </footer>
        </article>
      </div>
    </div>
  );
}
