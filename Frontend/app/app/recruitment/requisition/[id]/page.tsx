"use client";

import { useCallback, useEffect, useId, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { Button } from "@/components/ui/Button";
import { PersonNameInput, PhoneInput } from "@/components/ui";
import { isValidPhone, PHONE_VALIDATION_MESSAGE } from "@/lib/input-validation";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/date-utils";
import { ROUTES } from "@/config/routes";
import { APP_NAME } from "@/config/constants";
import { employmentTypeDisplayName, type EmploymentTypeCatalogItem } from "@/lib/employment-types";
import { generateRequisitionDescription, type RequisitionDescriptionSnapshot } from "@/lib/generate-requisition-description";
import { parseRequisitionDescription } from "@/lib/parse-requisition-description";

interface RequisitionDetail {
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
  skills?: string;
  closedAt?: string;
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
  candidateCount: number;
  applicationNotificationEmail?: string;
}

interface ApplyWithResumeApiResponse {
  candidate: Record<string, unknown>;
  emailNotification?: { status: string; message?: string | null };
}

/** Header + footer gradient (aligned with interview scheduled card). */
const gradientBarClass =
  "bg-gradient-to-r from-[#1a3a6e] via-[#1e4a8c] to-[#2e78e6] px-8 py-7 sm:px-10 sm:py-8";

function snapshotFromReq(req: RequisitionDetail, employmentTypeLabel: string): RequisitionDescriptionSnapshot {
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

/** Renders plain text with bullet lines as lists and other lines as paragraphs. */
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

export default function RequisitionDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [req, setReq] = useState<RequisitionDetail | null>(null);
  const [employmentTypes, setEmploymentTypes] = useState<EmploymentTypeCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [applyFirst, setApplyFirst] = useState("");
  const [applyLast, setApplyLast] = useState("");
  const [applyEmail, setApplyEmail] = useState("");
  const [applyPhone, setApplyPhone] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeDrag, setResumeDrag] = useState(false);
  const [applySubmitting, setApplySubmitting] = useState(false);
  const [applyMessage, setApplyMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [shareOrigin, setShareOrigin] = useState("");

  const resumeInputId = useId();

  useEffect(() => {
    setShareOrigin(typeof window !== "undefined" ? window.location.origin : "");
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await apiFetch<RequisitionDetail>(`/api/recruitment/requisitions/${id}`);
      setReq(data);
    } catch {
      setError("Could not load this requisition. It may have been removed, or the API is unavailable.");
      setReq(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    apiFetch<EmploymentTypeCatalogItem[]>("/api/organization/employment-statuses")
      .then(setEmploymentTypes)
      .catch(() => setEmploymentTypes([]));
  }, []);

  const pickResume = useCallback((file: File | null) => {
    if (!file) {
      setResumeFile(null);
      return;
    }
    const ok = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!ok) {
      setApplyMessage({ ok: false, text: "Please upload a PDF file for your resume." });
      return;
    }
    setResumeFile(file);
    setApplyMessage(null);
  }, []);

  const submitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!req) return;
    setApplyMessage(null);
    if (!resumeFile) {
      setApplyMessage({ ok: false, text: "Please upload your resume as a PDF." });
      return;
    }
    if (!applyFirst.trim() || !applyLast.trim() || !applyEmail.trim() || !applyPhone.trim()) {
      setApplyMessage({ ok: false, text: "Please fill in all required fields." });
      return;
    }
    if (!isValidPhone(applyPhone, true)) {
      setApplyMessage({ ok: false, text: PHONE_VALIDATION_MESSAGE });
      return;
    }
    const fullPhone = applyPhone.trim();
    setApplySubmitting(true);
    try {
      const fd = new FormData();
      fd.set("firstName", applyFirst.trim());
      fd.set("lastName", applyLast.trim());
      fd.set("email", applyEmail.trim());
      fd.set("phone", fullPhone);
      fd.set("requisitionId", req.id);
      fd.set("source", "Direct");
      fd.set("resume", resumeFile, resumeFile.name);
      const applyRes = await apiFetch<ApplyWithResumeApiResponse | Record<string, unknown>>(
        `/api/recruitment/candidates/apply`,
        { method: "POST", body: fd }
      );
      let hrEmailNote = "";
      if (applyRes && typeof applyRes === "object" && "emailNotification" in applyRes) {
        const en = (applyRes as ApplyWithResumeApiResponse).emailNotification;
        if (en && en.status !== "sent") {
          hrEmailNote =
            en.message?.trim() ||
            (en.status === "skipped_no_email_provider"
              ? "HR email was not sent: configure SendGrid:ApiKey (or SMTP) on the API server."
              : en.status === "skipped_no_inbox"
                ? "HR email was not sent: set the requisition’s application notification email or Recruitment:ApplicationNotificationEmail."
                : `HR notification status: ${en.status}.`);
        }
      }
      setApplyMessage({
        ok: true,
        text:
          "Application submitted. The hiring team will review your details." +
          (hrEmailNote ? `\n\n${hrEmailNote}` : ""),
      });
      setApplyFirst("");
      setApplyLast("");
      setApplyEmail("");
      setApplyPhone("");
      setResumeFile(null);
      await load();
    } catch (err) {
      setApplyMessage({
        ok: false,
        text: err instanceof Error ? err.message : "Could not submit application. Try again or contact HR.",
      });
    } finally {
      setApplySubmitting(false);
    }
  };

  const careersPublicUrl = shareOrigin ? `${shareOrigin}/careers/requisition/${id}` : "";

  if (loading) {
    return (
      <>
        <AppTopbar title="Recruitment & Hiring" subtitle="Loading requisition…" />
        <div className="flex min-h-[40vh] items-center justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600/20 border-t-blue-600" />
        </div>
      </>
    );
  }

  if (error || !req) {
    return (
      <>
        <AppTopbar title="Recruitment & Hiring" subtitle={error || "Requisition not found"} />
        <div className="flex flex-col items-center justify-center gap-4 py-16">
          <p className="text-center text-red-600">{error || "Requisition not found."}</p>
          <Link href={ROUTES.recruitment}>
            <Button variant="secondary" type="button">
              Back to Recruitment
            </Button>
          </Link>
        </div>
      </>
    );
  }

  const empLabel = employmentTypeDisplayName(employmentTypes, req.employmentType);
  const displayText = req.description?.trim()
    ? req.description.trim()
    : generateRequisitionDescription(snapshotFromReq(req, empLabel));
  const parsed = parseRequisitionDescription(displayText);

  /** Legacy generated text may still include “How to apply”; hide it — the apply form follows. */
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
    <>
      <AppTopbar title="Recruitment & Hiring" subtitle={`Requisition · ${req.code}`} />

      <div className="mx-auto w-full max-w-3xl px-0 pb-8 sm:px-2">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 text-sm text-neutral-600">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link href={ROUTES.recruitment} className="text-neutral-600 underline-offset-2 hover:text-neutral-900 hover:underline">
              Recruitment
            </Link>
            <span className="text-neutral-300">/</span>
            <span className="font-mono text-neutral-800">{req.code}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={ROUTES.recruitment}>
              <Button variant="secondary" type="button" className="text-sm">
                ← All requisitions
              </Button>
            </Link>
            <Button type="button" variant="secondary" className="text-sm" onClick={() => load()}>
              Refresh
            </Button>
          </div>
        </div>

        {careersPublicUrl ? (
          <section className="mb-6 rounded-xl border border-sky-200/80 bg-gradient-to-b from-sky-50/90 to-white px-4 py-4 shadow-sm sm:px-5">
            <h3 className="text-sm font-bold text-slate-800">Share this job</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
              Post the public link on LinkedIn, job boards, or WhatsApp. When someone applies through this link, their
              details appear in Recruitment → Candidates for this requisition (source:{" "}
              <span className="font-medium text-slate-700">Public careers link</span>). The link only works while this
              requisition is <span className="font-medium">Approved</span> and not <span className="font-medium">Closed</span>.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="text"
                readOnly
                value={careersPublicUrl}
                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-[11px] text-slate-800 sm:text-xs"
                aria-label="Public careers URL"
              />
              <button
                type="button"
                className="shrink-0 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(careersPublicUrl);
                  } catch {
                    /* ignore */
                  }
                }}
              >
                Copy link
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(
                [
                  {
                    label: "LinkedIn",
                    href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(careersPublicUrl)}`,
                  },
                  {
                    label: "Facebook",
                    href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(careersPublicUrl)}`,
                  },
                  {
                    label: "X / Twitter",
                    href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(careersPublicUrl)}&text=${encodeURIComponent(`Apply: ${req.title}`)}`,
                  },
                  {
                    label: "WhatsApp",
                    href: `https://wa.me/?text=${encodeURIComponent(`${req.title}\n${careersPublicUrl}`)}`,
                  },
                  {
                    label: "Email",
                    href: `mailto:?subject=${encodeURIComponent(`Job: ${req.title}`)}&body=${encodeURIComponent(`Apply here:\n${careersPublicUrl}`)}`,
                  },
                ] as const
              ).map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:border-sky-300 hover:bg-sky-50/60 hover:text-sky-900"
                >
                  {s.label}
                </a>
              ))}
            </div>
          </section>
        ) : null}

        <article className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-md sm:rounded-2xl">
          <header className={`${gradientBarClass} rounded-t-xl sm:rounded-t-2xl`}>
            <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">Job requisition</h2>
            <p className="mt-2 text-sm font-normal text-white/90">{APP_NAME}</p>
            <p className="mt-3 max-w-2xl text-base font-semibold leading-snug text-white sm:text-lg">{req.title}</p>
          </header>

          {/* 1 — Posting / overview (generated or edited description) */}
          <div className="border-b border-neutral-100 px-6 py-8 sm:px-10 sm:py-10">
            {parsed ? (
              <>
                {parsed.preamble ? (
                  <div className="mb-10 text-[15px] leading-relaxed text-neutral-700 whitespace-pre-line">{parsed.preamble}</div>
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

          {/* 2 — Apply for this job (candidate-style form) */}
          <div className="px-6 py-8 sm:px-10 sm:py-10">
            <h3 className="text-center text-xl font-semibold tracking-tight text-slate-900">Apply for this job</h3>
            <p className="mt-1 text-center text-sm text-slate-500">Submit your details for {req.title}</p>

            <form onSubmit={submitApplication} className="mx-auto mt-8 max-w-lg">
              <div className="space-y-6">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-800">
                    Resume/CV <span className="text-red-500">*</span>
                  </label>
                  <input id={resumeInputId} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => pickResume(e.target.files?.[0] ?? null)} />
                  <label
                    htmlFor={resumeInputId}
                    onDragOver={(ev) => {
                      ev.preventDefault();
                      setResumeDrag(true);
                    }}
                    onDragLeave={() => setResumeDrag(false)}
                    onDrop={(ev) => {
                      ev.preventDefault();
                      setResumeDrag(false);
                      const f = ev.dataTransfer.files?.[0];
                      if (f) pickResume(f);
                    }}
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
                      resumeDrag ? "border-blue-500 bg-blue-50/50" : "border-slate-300 bg-slate-50/80 hover:border-slate-400"
                    }`}
                  >
                    <svg className="mb-3 h-10 w-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <span className="text-sm font-medium text-slate-800">
                      Click or drag file to this area to upload your Resume.
                    </span>
                    <span className="mt-1 text-xs text-slate-500">Please make sure to upload a PDF.</span>
                    {resumeFile ? (
                      <span className="mt-2 font-mono text-sm text-blue-700">{resumeFile.name}</span>
                    ) : null}
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-slate-800">
                      First name <span className="text-red-500">*</span>
                    </span>
                    <PersonNameInput
                      value={applyFirst}
                      onChange={(e) => setApplyFirst(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      autoComplete="given-name"
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-slate-800">
                      Last name <span className="text-red-500">*</span>
                    </span>
                    <PersonNameInput
                      value={applyLast}
                      onChange={(e) => setApplyLast(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      autoComplete="family-name"
                      required
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-800">
                    Email <span className="text-red-500">*</span>
                  </span>
                  <input
                    type="email"
                    value={applyEmail}
                    onChange={(e) => setApplyEmail(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    autoComplete="email"
                    required
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-800">
                    Phone number <span className="text-red-500">*</span>
                  </span>
                  <PhoneInput
                    value={applyPhone}
                    onChange={(e) => setApplyPhone(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    autoComplete="tel"
                    required
                  />
                  <p className="mt-1.5 text-xs text-slate-500">Examples: +94112876663 or 0762535363 (8–15 digits).</p>
                </label>

                {applyMessage ? (
                  <p
                    className={`whitespace-pre-line text-sm ${applyMessage.ok ? "text-emerald-700" : "text-red-600"}`}
                    role="status"
                  >
                    {applyMessage.text}
                  </p>
                ) : null}

                <div className="pt-2">
                  <Button type="submit" className="w-full py-3 text-base font-semibold" disabled={applySubmitting}>
                    {applySubmitting ? "Submitting…" : "Submit Application"}
                  </Button>
                  <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-500 sm:text-xs">
                    By clicking &quot;Submit Application&quot;, you agree to receive job application updates from {APP_NAME} via email
                    and/or SMS where applicable. Message frequency may vary. Contact HR to update preferences.
                  </p>
                </div>
              </div>
            </form>
          </div>

          <footer className={`${gradientBarClass} rounded-b-xl sm:rounded-b-2xl !py-6 text-center`}>
            <p className="text-xs font-medium text-white/95 sm:text-sm">
              © {year} {APP_NAME}
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-white/75 sm:text-xs">
              Requisition <span className="font-mono text-white/90">{req.code}</span>
              {req.targetDate ? <> · Target {formatDate(req.targetDate)}</> : null} · Internal HR view
            </p>
          </footer>
        </article>
      </div>
    </>
  );
}
