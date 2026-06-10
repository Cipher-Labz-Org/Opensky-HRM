"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { PersonNameInput, PhoneInput } from "@/components/ui";
import { isValidPhone, PHONE_VALIDATION_MESSAGE } from "@/lib/input-validation";
import { type ApiFetchOptions, publicApiFetch } from "@/lib/api";
import { APP_NAME, getApiBaseUrl } from "@/config/constants";
import { formatDate } from "@/lib/date-utils";
import {
  loadSavedJobApplication,
  saveJobApplication,
  type SavedJobApplication,
} from "@/lib/job-application-storage";

export interface PublicCandidateApplication {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  stage: string;
  appliedAt: string;
  requisitionId: string;
  requisitionTitle?: string | null;
  hasUploadedResume: boolean;
  resumeFileName?: string | null;
  canEdit: boolean;
}

interface ApplyWithResumeApiResponse {
  candidate: { id?: string; email?: string };
  emailNotification?: { status: string; message?: string | null };
}

type PanelMode = "apply" | "view" | "edit" | "lookup";

type FetchFn = <T>(endpoint: string, options?: ApiFetchOptions) => Promise<T>;

interface Props {
  requisitionId: string;
  requisitionTitle: string;
  applySource: string;
  fetchFn?: FetchFn;
  onSubmitted?: () => void;
}

function extractCandidateFromApplyResponse(res: unknown): { id: string; email: string } | null {
  if (!res || typeof res !== "object") return null;
  const candidate = (res as ApplyWithResumeApiResponse).candidate;
  if (!candidate || typeof candidate !== "object") return null;
  const id = "id" in candidate && typeof candidate.id === "string" ? candidate.id : null;
  const email = "email" in candidate && typeof candidate.email === "string" ? candidate.email : null;
  if (!id || !email) return null;
  return { id, email };
}

export function CandidateJobApplicationPanel({
  requisitionId,
  requisitionTitle,
  applySource,
  fetchFn = publicApiFetch,
  onSubmitted,
}: Props) {
  const api = fetchFn;

  const [mode, setMode] = useState<PanelMode>("apply");
  const [saved, setSaved] = useState<SavedJobApplication | null>(null);
  const [application, setApplication] = useState<PublicCandidateApplication | null>(null);

  const [applyFirst, setApplyFirst] = useState("");
  const [applyLast, setApplyLast] = useState("");
  const [applyEmail, setApplyEmail] = useState("");
  const [applyPhone, setApplyPhone] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeDrag, setResumeDrag] = useState(false);
  const [applySubmitting, setApplySubmitting] = useState(false);
  const [applyMessage, setApplyMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const [lookupEmail, setLookupEmail] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [formResetKey, setFormResetKey] = useState(0);

  const resumeInputId = useId();

  const clearApplyForm = useCallback(() => {
    setApplyFirst("");
    setApplyLast("");
    setApplyEmail("");
    setApplyPhone("");
    setResumeFile(null);
    setResumeDrag(false);
    setFormResetKey((k) => k + 1);
  }, []);

  useEffect(() => {
    const entry = loadSavedJobApplication(requisitionId);
    setSaved(entry);
    if (entry) setLookupEmail(entry.email);
  }, [requisitionId]);

  const fillFormFromApplication = useCallback((app: PublicCandidateApplication) => {
    setApplyFirst(app.firstName);
    setApplyLast(app.lastName);
    setApplyEmail(app.email);
    setApplyPhone(app.phone ?? "");
    setResumeFile(null);
  }, []);

  const loadApplication = useCallback(
    async (candidateId: string, email: string) => {
      const app = await api<PublicCandidateApplication>(
        `/api/recruitment/public/applications/${candidateId}?email=${encodeURIComponent(email.trim())}`,
      );
      setApplication(app);
      fillFormFromApplication(app);
      const entry: SavedJobApplication = { candidateId: app.id, requisitionId, email: app.email };
      saveJobApplication(entry);
      setSaved(entry);
      setMode("view");
      setApplyMessage(null);
      return app;
    },
    [api, fillFormFromApplication, requisitionId],
  );

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
    setApplySubmitting(true);
    try {
      const fd = new FormData();
      fd.set("firstName", applyFirst.trim());
      fd.set("lastName", applyLast.trim());
      fd.set("email", applyEmail.trim());
      fd.set("phone", applyPhone.trim());
      fd.set("requisitionId", requisitionId);
      fd.set("source", applySource);
      fd.set("resume", resumeFile, resumeFile.name);
      const applyRes = await api<ApplyWithResumeApiResponse | Record<string, unknown>>(
        `/api/recruitment/candidates/apply`,
        { method: "POST", body: fd },
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
      const created = extractCandidateFromApplyResponse(applyRes);
      if (created) {
        const entry: SavedJobApplication = {
          candidateId: created.id,
          requisitionId,
          email: applyEmail.trim(),
        };
        saveJobApplication(entry);
        setSaved(entry);
        await loadApplication(created.id, applyEmail.trim());
        onSubmitted?.();
      }
      setApplyMessage({
        ok: true,
        text:
          "Application submitted. The hiring team will review your details." +
          (hrEmailNote ? `\n\n${hrEmailNote}` : ""),
      });
      if (!created) {
        clearApplyForm();
      }
    } catch (err) {
      setApplyMessage({
        ok: false,
        text: err instanceof Error ? err.message : "Could not submit application. Try again or contact HR.",
      });
    } finally {
      setApplySubmitting(false);
    }
  };

  const submitUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!application) return;
    setApplyMessage(null);
    if (!applyFirst.trim() || !applyLast.trim() || !applyEmail.trim() || !applyPhone.trim()) {
      setApplyMessage({ ok: false, text: "Please fill in all required fields." });
      return;
    }
    if (!isValidPhone(applyPhone, true)) {
      setApplyMessage({ ok: false, text: PHONE_VALIDATION_MESSAGE });
      return;
    }
    setApplySubmitting(true);
    try {
      const fd = new FormData();
      fd.set("email", application.email);
      fd.set("firstName", applyFirst.trim());
      fd.set("lastName", applyLast.trim());
      fd.set("phone", applyPhone.trim());
      if (resumeFile) fd.set("resume", resumeFile, resumeFile.name);
      const updated = await api<PublicCandidateApplication>(
        `/api/recruitment/public/applications/${application.id}`,
        { method: "PUT", body: fd },
      );
      setApplication(updated);
      fillFormFromApplication(updated);
      setMode("view");
      setApplyMessage({ ok: true, text: "Your application has been updated." });
    } catch (err) {
      setApplyMessage({
        ok: false,
        text: err instanceof Error ? err.message : "Could not update application. Try again or contact HR.",
      });
    } finally {
      setApplySubmitting(false);
    }
  };

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = lookupEmail.trim();
    if (!email) {
      setApplyMessage({ ok: false, text: "Enter the email address you used when applying." });
      return;
    }
    setLookupLoading(true);
    setApplyMessage(null);
    try {
      if (saved?.candidateId) {
        await loadApplication(saved.candidateId, email);
        return;
      }
      const app = await api<PublicCandidateApplication>(
        `/api/recruitment/public/applications/lookup?requisitionId=${encodeURIComponent(requisitionId)}&email=${encodeURIComponent(email)}`,
      );
      setApplication(app);
      fillFormFromApplication(app);
      saveJobApplication({ candidateId: app.id, requisitionId, email: app.email });
      setSaved({ candidateId: app.id, requisitionId, email: app.email });
      setMode("view");
    } catch (err) {
      setApplyMessage({
        ok: false,
        text: err instanceof Error ? err.message : "No application found for that email.",
      });
    } finally {
      setLookupLoading(false);
    }
  };

  const resumeDownloadUrl =
    application?.hasUploadedResume && application.email
      ? `${getApiBaseUrl()}/api/recruitment/public/applications/${application.id}/resume?email=${encodeURIComponent(application.email)}`
      : null;

  const inputClass =
    "w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

  return (
    <div className="px-6 py-8 sm:px-10 sm:py-10">
      <h3 className="text-center text-xl font-semibold tracking-tight text-slate-900">Apply for this job</h3>
      <p className="mt-1 text-center text-sm text-slate-500">Submit your details for {requisitionTitle}</p>

      <div className="mx-auto mt-6 flex max-w-lg flex-wrap items-center justify-center gap-2">
        {saved && mode === "apply" ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => void loadApplication(saved.candidateId, saved.email).catch((err) => {
              setApplyMessage({
                ok: false,
                text: err instanceof Error ? err.message : "Could not load your application.",
              });
            })}
          >
            View my application
          </Button>
        ) : null}
        {mode === "apply" ? (
          <Button type="button" variant="secondary" onClick={() => setMode("lookup")}>
            Already applied?
          </Button>
        ) : mode !== "apply" ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              clearApplyForm();
              setMode("apply");
              setApplyMessage(null);
            }}
          >
            New application
          </Button>
        ) : null}
      </div>

      {mode === "lookup" ? (
        <form onSubmit={handleLookup} className="mx-auto mt-6 max-w-lg space-y-4">
          <p className="text-sm text-slate-600">Enter the email you used when applying to view your submission.</p>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-800">Email</span>
            <input
              type="email"
              value={lookupEmail}
              onChange={(e) => setLookupEmail(e.target.value)}
              className={inputClass}
              autoComplete="email"
              required
            />
          </label>
          {applyMessage ? (
            <p className={`text-sm ${applyMessage.ok ? "text-emerald-700" : "text-red-600"}`} role="status">
              {applyMessage.text}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={lookupLoading}>
              {lookupLoading ? "Loading…" : "View application"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setMode("apply")}>
              Back
            </Button>
          </div>
        </form>
      ) : null}

      {mode === "view" && application ? (
        <div className="mx-auto mt-8 max-w-lg space-y-5 rounded-xl border border-slate-200 bg-slate-50/60 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="text-lg font-semibold text-slate-900">Your application</h4>
              <p className="mt-1 text-sm text-slate-500">
                Submitted {formatDate(application.appliedAt)} · Status: {application.stage}
              </p>
            </div>
            {application.canEdit ? (
              <Button type="button" variant="secondary" onClick={() => setMode("edit")}>
                Edit
              </Button>
            ) : null}
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">First name</dt>
              <dd className="mt-0.5 font-medium text-slate-900">{application.firstName}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Last name</dt>
              <dd className="mt-0.5 font-medium text-slate-900">{application.lastName}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Email</dt>
              <dd className="mt-0.5 font-medium text-slate-900">{application.email}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Phone</dt>
              <dd className="mt-0.5 font-medium text-slate-900">{application.phone || "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Resume</dt>
              <dd className="mt-0.5">
                {application.hasUploadedResume && resumeDownloadUrl ? (
                  <a
                    href={resumeDownloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-blue-700 hover:underline"
                  >
                    {application.resumeFileName || "View resume (PDF)"}
                  </a>
                ) : (
                  <span className="text-slate-600">No resume on file</span>
                )}
              </dd>
            </div>
          </dl>
          {!application.canEdit ? (
            <p className="text-xs text-slate-500">
              This application can no longer be edited online. Contact HR if you need to make changes.
            </p>
          ) : null}
          {applyMessage ? (
            <p className={`text-sm ${applyMessage.ok ? "text-emerald-700" : "text-red-600"}`} role="status">
              {applyMessage.text}
            </p>
          ) : null}
        </div>
      ) : null}

      {(mode === "apply" || mode === "edit") ? (
        <form onSubmit={mode === "edit" ? submitUpdate : submitApplication} className="mx-auto mt-8 max-w-lg">
          {mode === "edit" ? (
            <p className="mb-4 text-sm text-slate-600">Update your details below. Upload a new PDF only if you want to replace your resume.</p>
          ) : null}
          <div className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-800">
                Resume/CV {mode === "apply" ? <span className="text-red-500">*</span> : null}
              </label>
              <input
                key={formResetKey}
                id={resumeInputId}
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                onChange={(e) => pickResume(e.target.files?.[0] ?? null)}
              />
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
                  {mode === "edit" && application?.hasUploadedResume
                    ? "Click or drag to replace your resume (optional)."
                    : "Click or drag file to this area to upload your Resume."}
                </span>
                <span className="mt-1 text-xs text-slate-500">Please make sure to upload a PDF.</span>
                {resumeFile ? <span className="mt-2 font-mono text-sm text-blue-700">{resumeFile.name}</span> : null}
                {mode === "edit" && !resumeFile && application?.resumeFileName ? (
                  <span className="mt-2 text-xs text-slate-500">Current: {application.resumeFileName}</span>
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
                  className={inputClass}
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
                  className={inputClass}
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
                className={inputClass}
                autoComplete="email"
                required
                readOnly={mode === "edit"}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-800">
                Phone number <span className="text-red-500">*</span>
              </span>
              <PhoneInput
                value={applyPhone}
                onChange={(e) => setApplyPhone(e.target.value)}
                className={inputClass}
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

            <div className="flex flex-wrap gap-2 pt-2">
              {mode === "edit" ? (
                <>
                  <Button type="submit" className="flex-1 py-3 text-base font-semibold" disabled={applySubmitting}>
                    {applySubmitting ? "Saving…" : "Save changes"}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setMode("view")}>
                    Cancel
                  </Button>
                </>
              ) : (
                <Button type="submit" className="w-full py-3 text-base font-semibold" disabled={applySubmitting}>
                  {applySubmitting ? "Submitting…" : "Submit Application"}
                </Button>
              )}
            </div>
            {mode === "apply" ? (
              <p className="text-center text-[11px] leading-relaxed text-slate-500 sm:text-xs">
                By clicking &quot;Submit Application&quot;, you agree to receive job application updates from {APP_NAME} via email
                and/or SMS where applicable. Message frequency may vary. Contact HR to update preferences.
              </p>
            ) : null}
          </div>
        </form>
      ) : null}
    </div>
  );
}
