"use client";

import { appAlert, appConfirm, appPrompt } from "@/components/ui/appDialogs";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { Button } from "@/components/ui/Button";
import { DatePickerField, DateTimePickerField, FormSelect, type FormSelectOption } from "@/components/ui";
import { CreateEmployeeModal } from "@/components/forms/CreateEmployeeModal";
import { apiFetch, apiFetchBlob } from "@/lib/api";
import { formatLocalDateToIso } from "@/lib/datePickerIso";
import { formatBusinessDateTime, formatDate, formatDateTime } from "@/lib/date-utils";
import {
  defaultScheduleTitle,
  inferInterviewTypeFromTitle,
  INTERVIEW_TYPE_OPTS,
  resolveInterviewLocation,
  scheduleOnsiteLocationOptions,
  scheduleTitleOptions,
} from "@/lib/interview-scheduling";

interface CandidateDetail {
  id: string; firstName: string; lastName: string; fullName: string; email: string;
  phone?: string; resumeUrl?: string; hasUploadedResume?: boolean; source: string; stage: string; appliedAt: string;
  currentTitle?: string; currentCompany?: string; expectedSalary?: number;
  noticePeriod?: string; notes?: string; rating?: number; rejectionReason?: string;
  tags?: string; requisitionId: string; requisitionTitle?: string; employeeId?: string;
  requisitionDepartmentId?: string; requisitionJobTitleId?: string;
  requisitionLocationId?: string; requisitionPositionId?: string;
  interviews: Interview[]; offer?: Offer; activities: Activity[];
}
interface Interview {
  id: string; title: string; scheduledAt: string; duration: number; location?: string;
  interviewType?: string; status: string; feedback?: string; overallRating?: number;
  recommendation?: string; interviewerName?: string; interviewerId?: string;
  candidateId: string; candidateName?: string; scorecards: Scorecard[];
}
interface Scorecard { id: string; criteria: string; rating: number; comment?: string; }
interface Offer {
  id: string; salaryOffered: number; currency?: string; offerDate: string;
  expiryDate?: string; status: string; remarks?: string; joiningDate?: string;
  offerLetterUrl?: string; letterHtml?: string; acceptedAt?: string; rejectedAt?: string;
  rejectionReason?: string; candidateId: string;
}
interface Activity { id: string; activityType: string; description: string; performedBy?: string; performedAt: string; }

const STAGE_COLORS: Record<string, string> = {
  Sourced: "bg-gray-100 text-gray-700", Screening: "bg-blue-100 text-blue-700",
  Interview: "bg-yellow-100 text-yellow-700",
  Evaluation: "bg-purple-100 text-purple-700", Offer: "bg-orange-100 text-orange-700",
  Hired: "bg-green-100 text-green-700", Rejected: "bg-red-100 text-red-700",
  Withdrawn: "bg-gray-200 text-gray-500",
};
const STAGES = ["Sourced", "Screening", "Interview", "Evaluation", "Offer", "Hired"];
const INPUT = "w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--primary)] outline-none";

export default function CandidateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [candidate, setCandidate] = useState<CandidateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"overview" | "interviews" | "offer" | "activity">("overview");
  const [stageAction, setStageAction] = useState(false);
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [scheduleModal, setScheduleModal] = useState(false);
  const [interviewForm, setInterviewForm] = useState({
    title: "",
    scheduledAt: "",
    duration: 60,
    location: "",
    interviewType: "Onsite",
    interviewerId: "",
    interviewerName: "",
  });
  const [scheduleMeetingLink, setScheduleMeetingLink] = useState("");
  const [scheduleLookups, setScheduleLookups] = useState<{
    locations: { id: string; name: string }[];
    interviewers: { id: string; name: string }[];
  }>({ locations: [], interviewers: [] });
  const [notifyInterviewCandidateEmail, setNotifyInterviewCandidateEmail] = useState(true);
  const [notifyInterviewInterviewerEmail, setNotifyInterviewInterviewerEmail] = useState(true);
  const [convertEmployeeOpen, setConvertEmployeeOpen] = useState(false);
  const [offerForm, setOfferForm] = useState({
    positionTitle: "",
    salaryOffered: "",
    currency: "LKR",
    offerDate: new Date().toISOString().slice(0, 10),
    expiryDate: "",
    joiningDate: "",
    remarks: "",
  });
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [offerLetterHtml, setOfferLetterHtml] = useState("");
  const [offerLetterView, setOfferLetterView] = useState<"edit" | "preview">("edit");
  const [offerLetterLoading, setOfferLetterLoading] = useState(false);
  const [offerLetterSaving, setOfferLetterSaving] = useState(false);
  const [createOfferLoading, setCreateOfferLoading] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [resumeOpening, setResumeOpening] = useState(false);
  const [evaluationNote, setEvaluationNote] = useState("");
  const [evaluationNoteSaving, setEvaluationNoteSaving] = useState(false);

  const openStoredResumePdf = useCallback(async () => {
    if (!candidate?.id) return;
    setResumeOpening(true);
    try {
      const blob = await apiFetchBlob(`/api/recruitment/candidates/${candidate.id}/resume`);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
    } catch (e) {
      await appAlert(e instanceof Error ? e.message : "Could not open the resume PDF.");
    } finally {
      setResumeOpening(false);
    }
  }, [candidate?.id]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiFetch<CandidateDetail>(`/api/recruitment/candidates/${id}`);
      setCandidate(data);
    } catch { setError("Failed to load candidate details."); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const evaluationNotes = useMemo(
    () => (candidate?.activities ?? []).filter((a) => a.activityType === "EvaluationNote"),
    [candidate?.activities],
  );

  async function handleAddEvaluationNote() {
    const text = evaluationNote.trim();
    if (!text) return;
    setEvaluationNoteSaving(true);
    try {
      await apiFetch(`/api/recruitment/candidates/${id}/evaluation-notes`, {
        method: "POST",
        body: JSON.stringify({ note: text }),
      });
      setEvaluationNote("");
      await load();
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Could not save evaluation note.");
    } finally {
      setEvaluationNoteSaving(false);
    }
  }

  const offerLetterEditor = (opts: { showSave: boolean }) => (
    <div className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-[var(--text)]">Offer letter</h3>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Form fields above fill the letter automatically. Placeholders: {" "}
            <code className="text-[11px]">{"{{CandidateName}}"}</code> (candidate),{" "}
            <code className="text-[11px]">{"{{PositionTitle}}"}</code> (position),{" "}
            <code className="text-[11px]">{"{{SalaryFormatted}}"}</code> (salary + currency),{" "}
            <code className="text-[11px]">{"{{JoiningDate}}"}</code>,{" "}
            <code className="text-[11px]">{"{{RemarksHtml}}"}</code> (remarks)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => void handleResetOfferLetterTemplate()} disabled={offerLetterLoading}>
            Reset template
          </Button>
          <Button type="button" variant="secondary" onClick={() => void refreshOfferLetterPreview({ useCurrentAsTemplate: true })} disabled={offerLetterLoading}>
            {offerLetterLoading ? "Refreshing…" : "Refresh fields"}
          </Button>
          {opts.showSave && (
            <Button type="button" onClick={() => void handleSaveOfferLetter()} disabled={offerLetterSaving || !offerLetterHtml.trim()}>
              {offerLetterSaving ? "Saving…" : "Save letter"}
            </Button>
          )}
        </div>
      </div>
      <div className="mb-2 flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg)]/50 p-1 w-fit">
        <button type="button" onClick={() => setOfferLetterView("edit")}
          className={`rounded-md px-3 py-1.5 text-xs font-medium ${offerLetterView === "edit" ? "bg-white shadow-sm text-[var(--text)]" : "text-[var(--text-muted)]"}`}>
          Edit
        </button>
        <button type="button" onClick={() => setOfferLetterView("preview")}
          className={`rounded-md px-3 py-1.5 text-xs font-medium ${offerLetterView === "preview" ? "bg-white shadow-sm text-[var(--text)]" : "text-[var(--text-muted)]"}`}>
          Preview
        </button>
      </div>
      {offerLetterView === "edit" ? (
        <textarea
          value={offerLetterHtml}
          onChange={(e) => {
            offerLetterUserEdited.current = true;
            setOfferLetterHtml(e.target.value);
          }}
          className={`${INPUT} min-h-[280px] font-mono text-xs leading-relaxed`}
          placeholder="Offer letter HTML…"
        />
      ) : (
        <div
          className="prose prose-sm max-w-none min-h-[200px] rounded-xl border border-[var(--border)] bg-white p-4"
          dangerouslySetInnerHTML={{ __html: offerLetterHtml || "<p class='text-slate-500'>No letter content yet.</p>" }}
        />
      )}
    </div>
  );

  function activityTypeLabel(type: string): string {
    if (type === "EvaluationNote") return "Evaluation note";
    if (type === "StageChange") return "Stage change";
    if (type === "ApplicationUpdate") return "Application update";
    return type.replace(/([a-z])([A-Z])/g, "$1 $2");
  }

  const scheduleTitleOpts = useMemo(
    () => scheduleTitleOptions(candidate?.fullName),
    [candidate?.fullName],
  );

  const scheduleOnsiteLocationOpts = useMemo(
    () => scheduleOnsiteLocationOptions(scheduleLookups.locations),
    [scheduleLookups.locations],
  );

  const scheduleInterviewerOpts = useMemo<FormSelectOption[]>(
    () => [
      { value: "", label: "Select interviewer…" },
      ...scheduleLookups.interviewers.map((e) => ({ value: e.id, label: e.name })),
    ],
    [scheduleLookups.interviewers]
  );

  const convertEmployeeInitialValues = useMemo(() => {
    if (!candidate) return undefined;
    return {
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      email: candidate.email,
      phone: candidate.phone ?? "",
      joinDate: candidate.offer?.joiningDate?.slice(0, 10) || formatLocalDateToIso(new Date()),
      departmentId: candidate.requisitionDepartmentId ?? "",
      jobTitleId: candidate.requisitionJobTitleId ?? "",
      locationId: candidate.requisitionLocationId ?? "",
      positionId: candidate.requisitionPositionId ?? "",
    };
  }, [candidate]);

  useEffect(() => {
    if (!scheduleModal) {
      setScheduleMeetingLink("");
      setNotifyInterviewCandidateEmail(true);
      setNotifyInterviewInterviewerEmail(true);
      return;
    }
    let cancelled = false;
    Promise.all([
      apiFetch<{ id: string; name: string }[]>("/api/organization/locations").catch(() => []),
      apiFetch<{ items: { id: string; firstName: string; lastName: string; fullName?: string }[] }>(
        "/api/employees?pageSize=500&excludeTerminated=true"
      ).catch(() => ({ items: [] as { id: string; firstName: string; lastName: string; fullName?: string }[] })),
    ]).then(([locs, empRes]) => {
      if (cancelled) return;
      const items = empRes.items ?? [];
      setScheduleLookups({
        locations: Array.isArray(locs) ? locs : [],
        interviewers: items.map((e) => ({
          id: e.id,
          name: (e.fullName?.trim() || `${e.firstName ?? ""} ${e.lastName ?? ""}`.trim()) || e.id,
        })),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [scheduleModal]);

  function openScheduleModal() {
    const name = candidate?.fullName ?? "";
    setNotifyInterviewCandidateEmail(true);
    setNotifyInterviewInterviewerEmail(true);
    setScheduleMeetingLink("");
    setInterviewForm({
      title: defaultScheduleTitle("Onsite", name),
      scheduledAt: "",
      duration: 60,
      location: "",
      interviewType: "Onsite",
      interviewerId: "",
      interviewerName: "",
    });
    setScheduleModal(true);
  }

  const offerWorkflowOpened = useRef(false);
  const offerLetterUserEdited = useRef(false);
  const offerLetterSectionRef = useRef<HTMLDivElement>(null);

  function handleViewOffer() {
    setOfferLetterView("preview");
    window.setTimeout(() => {
      offerLetterSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  const initOfferForm = useCallback(() => {
    offerLetterUserEdited.current = false;
    setOfferLetterHtml("");
    setOfferForm((f) => ({
      ...f,
      positionTitle: candidate?.requisitionTitle ?? "",
      salaryOffered: f.salaryOffered || (candidate?.expectedSalary ? String(candidate.expectedSalary) : ""),
    }));
  }, [candidate?.expectedSalary, candidate?.requisitionTitle]);

  const openOfferWorkflow = useCallback(() => {
    setTab("offer");
    if (!candidate?.offer) {
      setShowOfferForm(true);
      initOfferForm();
    }
  }, [candidate?.offer, initOfferForm]);

  async function handleStageChange(newStage: string) {
    try {
      await apiFetch(`/api/recruitment/candidates/${id}/stage`, { method: "PUT", body: JSON.stringify({ stage: newStage }) });
      await load(); setStageAction(false);
      if (newStage === "Offer") openOfferWorkflow();
    } catch { /* */ }
  }

  async function handleReject() {
    try {
      await apiFetch(`/api/recruitment/candidates/${id}/reject`, { method: "POST", body: JSON.stringify({ reason: rejectReason }) });
      await load(); setRejectModal(false); setRejectReason("");
    } catch { /* */ }
  }

  async function handleReinterview() {
    try {
      await apiFetch(`/api/recruitment/candidates/${id}/reinterview`, { method: "POST", body: JSON.stringify({}) });
      await load();
      openScheduleModal();
    } catch (e) {
      await appAlert(e instanceof Error ? e.message : "Could not reopen candidate for interview.");
    }
  }

  async function handleScheduleInterview() {
    if (!interviewForm.title || !interviewForm.scheduledAt) return;
    const locationResolved = resolveInterviewLocation(
      interviewForm.interviewType,
      interviewForm.location,
      scheduleMeetingLink,
    );
    const interviewer = scheduleLookups.interviewers.find((e) => e.id === interviewForm.interviewerId);
    try {
      await apiFetch("/api/recruitment/interviews", {
        method: "POST",
        body: JSON.stringify({
          title: interviewForm.title,
          scheduledAt: interviewForm.scheduledAt,
          duration: interviewForm.duration,
          location: locationResolved,
          interviewType: interviewForm.interviewType || null,
          candidateId: id,
          interviewerId: interviewForm.interviewerId || null,
          interviewerName: interviewer?.name ?? (interviewForm.interviewerName || null),
          notifyCandidateByEmail: notifyInterviewCandidateEmail,
          notifyInterviewerByEmail: notifyInterviewInterviewerEmail && !!interviewForm.interviewerId,
        }),
      });
      setScheduleModal(false);
      setInterviewForm({
        title: "",
        scheduledAt: "",
        duration: 60,
        location: "",
        interviewType: "Onsite",
        interviewerId: "",
        interviewerName: "",
      });
      setScheduleMeetingLink("");
      setNotifyInterviewCandidateEmail(true);
      setNotifyInterviewInterviewerEmail(true);
      await load();
    } catch { /* */ }
  }

  const refreshOfferLetterPreview = useCallback(async (opts?: { templateHtml?: string; useCurrentAsTemplate?: boolean }) => {
    const activeOffer = candidate?.offer;
    const salary = activeOffer ? activeOffer.salaryOffered : (Number(offerForm.salaryOffered) || 0);
    setOfferLetterLoading(true);
    try {
      const res = await apiFetch<{ html: string }>("/api/recruitment/offers/letter-preview", {
        method: "POST",
        body: JSON.stringify({
          candidateId: id,
          salaryOffered: salary,
          currency: activeOffer?.currency ?? offerForm.currency,
          offerDate: activeOffer?.offerDate ?? offerForm.offerDate,
          expiryDate: (activeOffer?.expiryDate ?? offerForm.expiryDate) || null,
          joiningDate: (activeOffer?.joiningDate ?? offerForm.joiningDate) || null,
          remarks: (activeOffer?.remarks ?? offerForm.remarks) || null,
          positionTitle: activeOffer
            ? null
            : (offerForm.positionTitle.trim() || candidate?.requisitionTitle || null),
          templateHtml: opts?.useCurrentAsTemplate ? offerLetterHtml : opts?.templateHtml,
        }),
      });
      setOfferLetterHtml(res.html ?? "");
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Could not load offer letter template.");
    } finally {
      setOfferLetterLoading(false);
    }
  }, [id, offerForm, candidate?.offer, candidate?.requisitionTitle, offerLetterHtml]);

  useEffect(() => {
    if (candidate?.offer?.letterHtml) setOfferLetterHtml(candidate.offer.letterHtml);
  }, [candidate?.offer?.letterHtml]);

  useEffect(() => {
    if (!showOfferForm || candidate?.offer || offerLetterUserEdited.current) return;
    const handle = window.setTimeout(() => {
      void refreshOfferLetterPreview();
    }, 400);
    return () => window.clearTimeout(handle);
  }, [showOfferForm, candidate?.offer, offerForm, refreshOfferLetterPreview]);

  useEffect(() => {
    if (!candidate?.offer?.id || offerLetterHtml || offerLetterLoading) return;
    if (!candidate.offer.letterHtml) void refreshOfferLetterPreview();
  }, [candidate?.offer?.id, candidate?.offer?.letterHtml, offerLetterHtml, offerLetterLoading, refreshOfferLetterPreview]);

  useEffect(() => {
    if (!candidate || candidate.stage !== "Offer" || offerWorkflowOpened.current) return;
    offerWorkflowOpened.current = true;
    openOfferWorkflow();
  }, [candidate, openOfferWorkflow]);

  async function handleResetOfferLetterTemplate() {
    try {
      offerLetterUserEdited.current = false;
      const res = await apiFetch<{ html: string }>("/api/recruitment/offers/letter-template");
      await refreshOfferLetterPreview({ templateHtml: res.html });
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Could not load template.");
    }
  }

  async function handleSaveOfferLetter() {
    if (!candidate?.offer?.id || !offerLetterHtml.trim()) return;
    setOfferLetterSaving(true);
    try {
      await apiFetch(`/api/recruitment/offers/${candidate.offer.id}/letter`, {
        method: "PUT",
        body: JSON.stringify({ letterHtml: offerLetterHtml }),
      });
      await load();
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Could not save offer letter.");
    } finally {
      setOfferLetterSaving(false);
    }
  }

  async function handleCreateOffer() {
    if (!offerForm.positionTitle.trim()) {
      await appAlert("Position title is required for the offer letter.");
      return;
    }
    if (!offerForm.salaryOffered || Number(offerForm.salaryOffered) <= 0) {
      await appAlert("Enter a salary offered amount greater than zero.");
      return;
    }
    if (!offerForm.offerDate) {
      await appAlert("Offer date is required.");
      return;
    }
    if (!offerLetterHtml.trim()) {
      await appAlert("Offer letter is empty. Wait for the preview to load or click Refresh fields.");
      return;
    }
    const candidateEmail = candidate?.email?.trim();
    if (!candidateEmail) {
      await appAlert("This candidate has no email address. Add an email on the candidate profile before sharing an offer.");
      return;
    }
    if (!(await appConfirm(
      `Save this offer letter and email it to ${candidateEmail}?`,
      { title: "Share offer", confirmLabel: "Save & share" },
    ))) return;

    setCreateOfferLoading(true);
    try {
      const created = await apiFetch<Offer>("/api/recruitment/offers", {
        method: "POST",
        body: JSON.stringify({
          candidateId: id,
          salaryOffered: Number(offerForm.salaryOffered),
          currency: offerForm.currency,
          offerDate: offerForm.offerDate,
          expiryDate: offerForm.expiryDate || null,
          joiningDate: offerForm.joiningDate || null,
          remarks: offerForm.remarks || null,
          positionTitle: offerForm.positionTitle.trim() || null,
          letterHtml: offerLetterHtml.trim(),
        }),
      });
      await apiFetch(`/api/recruitment/offers/${created.id}/approve`, { method: "POST" });
      const sendRes = await apiFetch<{ message: string; emailConfigured: boolean }>(
        `/api/recruitment/offers/${created.id}/send-email`,
        { method: "POST" },
      );
      setShowOfferForm(false);
      setEmailSent(sendRes.emailConfigured);
      await load();
      setTab("offer");
      if (sendRes.emailConfigured) {
        await appAlert(`Offer saved and emailed to ${candidateEmail} with a PDF attachment.`);
      } else {
        await appAlert(
          "Offer saved and approved. Email was not sent because outbound email is not configured on the server. Set up SMTP or SendGrid, then use Share with candidate.",
        );
      }
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Failed to save or share offer");
    } finally {
      setCreateOfferLoading(false);
    }
  }

  async function handleSendOfferEmail() {
    if (!candidate?.offer) return;
    if (!(await appConfirm("Email this offer letter to the candidate? Save the letter first if you made changes."))) return;
    setSendingEmail(true); setEmailSent(false);
    try {
      await apiFetch(`/api/recruitment/offers/${candidate.offer.id}/send-email`, { method: "POST" });
      setEmailSent(true); await load();
    } catch (err) { await appAlert(err instanceof Error ? err.message : "Failed to send email"); }
    finally { setSendingEmail(false); }
  }

  async function handleApproveOffer() {
    if (!candidate?.offer) return;
    if (!(await appConfirm("Approve this offer internally? Only approved offers can be emailed; acceptance is recorded only after approval."))) return;
    setActionLoading(true);
    try {
      await apiFetch(`/api/recruitment/offers/${candidate.offer.id}/approve`, { method: "POST" });
      await load();
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Failed to approve offer");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAcceptOffer() {
    if (!candidate?.offer) return;
    if (candidate.offer.status !== "Approved") {
      await appAlert("Approve the offer first, then record the candidate’s acceptance.");
      return;
    }
    if (!(await appConfirm("Mark this offer as accepted? The candidate will be moved to Hired."))) return;
    setActionLoading(true);
    try {
      await apiFetch(`/api/recruitment/offers/${candidate.offer.id}/accept`, { method: "POST" });
      await load();
    } catch (err) { await appAlert(err instanceof Error ? err.message : "Failed to accept offer"); }
    finally { setActionLoading(false); }
  }

  async function handleRejectOffer() {
    if (!candidate?.offer) return;
    if (!(await appConfirm("Reject or withdraw this offer? Use this when the candidate declines or the offer is pulled."))) return;
    const reason = await appPrompt("Please provide the reason for rejecting this offer.", { title: "Reject Offer", confirmLabel: "Reject Offer", variant: "danger", placeholder: "Reason..." });
    if (reason === null) return;
    setActionLoading(true);
    try {
      await apiFetch(`/api/recruitment/offers/${candidate.offer.id}/reject`, { method: "POST", body: JSON.stringify({ reason }) });
      await load();
    } catch (err) { await appAlert(err instanceof Error ? err.message : "Failed to reject offer"); }
    finally { setActionLoading(false); }
  }

  if (loading) return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)]">
      <AppTopbar title="Candidate" subtitle="Loading…" />
      <div className="flex flex-1 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--primary)]/20 border-t-[var(--primary)]" />
      </div>
    </div>
  );

  if (error || !candidate) return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)]">
      <AppTopbar title="Candidate" subtitle={error || "Not found"} />
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <p className="text-red-500">{error || "Candidate not found"}</p>
        <Link href="/app/recruitment" className="text-[var(--primary)] hover:underline">Back to Recruitment</Link>
      </div>
    </div>
  );

  const c = candidate;
  const stageIdx = STAGES.indexOf(c.stage);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)]">
      <AppTopbar title={c.fullName} subtitle="Candidate profile" />
      <main className="flex-1 overflow-y-auto p-6">
        {/* Breadcrumb */}
        <div className="mb-4 flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <Link href="/app/recruitment" className="hover:text-[var(--primary)]">Recruitment</Link>
          <span>/</span>
          <span className="text-[var(--text)]">{c.fullName}</span>
        </div>

        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm lg:flex-row lg:items-start lg:justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-[var(--text)]">{c.fullName}</h1>
              <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${STAGE_COLORS[c.stage] ?? "bg-gray-100 text-gray-700"}`}>{c.stage}</span>
            </div>
            <p className="text-sm text-[var(--text-muted)]">
              {[c.currentTitle, c.currentCompany].filter(Boolean).join(" at ") || "No title"}
              {c.requisitionTitle && <> &middot; <span className="text-[var(--primary)]">{c.requisitionTitle}</span></>}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-[var(--text-muted)]">
              <span>{c.email}</span>
              {c.phone && <span>{c.phone}</span>}
              <span>Source: {c.source}</span>
              <span>Applied: {formatDateTime(c.appliedAt)}</span>
              {c.rating != null && <span>{"★".repeat(c.rating)}{"☆".repeat(5 - c.rating)}</span>}
            </div>
            {c.tags && (
              <div className="mt-2 flex flex-wrap gap-1">
                {c.tags.split(",").map((t) => (
                  <span key={t.trim()} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{t.trim()}</span>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {/* Hired stage */}
            {c.stage === "Hired" && (
              c.employeeId ? (
                <Link href={`/app/people/${c.employeeId}`}><Button>View Employee Profile</Button></Link>
              ) : (
                <Button onClick={() => setConvertEmployeeOpen(true)}>Convert to Employee</Button>
              )
            )}
            {/* Pre-Hired stages (not Rejected) */}
            {c.stage === "Rejected" && (
              <Button onClick={() => void handleReinterview()}>Re-interview</Button>
            )}
            {c.stage !== "Hired" && c.stage !== "Rejected" && (
              <>
                <div className="relative">
                  <Button variant="secondary" onClick={() => setStageAction(!stageAction)}>Move Stage</Button>
                  {stageAction && (
                    <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-xl border border-[var(--border)] bg-white shadow-lg">
                      {STAGES.filter((s) => s !== c.stage).map((s) => (
                        <button key={s} onClick={() => handleStageChange(s)}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--bg)] first:rounded-t-xl last:rounded-b-xl">{s}</button>
                      ))}
                    </div>
                  )}
                </div>
                {c.stage === "Interview" && (
                  <Button variant="secondary" onClick={openScheduleModal}>Schedule Interview</Button>
                )}
                {c.stage === "Offer" && (
                  <Button onClick={openOfferWorkflow}>{c.offer ? "Manage offer" : "Create offer"}</Button>
                )}
                <Button variant="secondary" className="text-red-600" onClick={() => setRejectModal(true)}>Reject</Button>
              </>
            )}
          </div>
        </div>

        {/* Stage Pipeline */}
        <div className="mb-6 flex items-center gap-1 rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm overflow-x-auto">
          {STAGES.map((s, i) => {
            const isCurrent = s === c.stage;
            const isPast = i < stageIdx;
            return (
              <div key={s} className="flex items-center gap-1 flex-1 min-w-0">
                <div className={`flex-1 rounded-lg px-3 py-2 text-center text-xs font-medium transition
                  ${isCurrent ? "bg-[var(--primary)] text-white" : isPast ? "bg-green-100 text-green-700" : "bg-gray-50 text-gray-400"}`}>{s}</div>
                {i < STAGES.length - 1 && <div className="text-gray-300">›</div>}
              </div>
            );
          })}
        </div>

        {/* Tabs */}
        <div className="mb-4 flex gap-1 rounded-xl border border-[var(--border)] bg-white p-1 shadow-sm w-fit">
          {(["overview", "interviews", "offer", "activity"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition
                ${tab === t ? "bg-[var(--primary)] text-white" : "text-[var(--text-muted)] hover:bg-[var(--bg)]"}`}>
              {t === "interviews" ? `Interviews (${c.interviews.length})` : t === "activity" ? `Activity (${c.activities.length})` : t}
            </button>
          ))}
        </div>

        {/* ═══ OVERVIEW TAB ═══ */}
        {tab === "overview" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-[var(--text)] uppercase tracking-wide">Personal Details</h3>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div><dt className="text-[var(--text-muted)]">First Name</dt><dd className="font-medium">{c.firstName}</dd></div>
                <div><dt className="text-[var(--text-muted)]">Last Name</dt><dd className="font-medium">{c.lastName}</dd></div>
                <div><dt className="text-[var(--text-muted)]">Email</dt><dd className="font-medium">{c.email}</dd></div>
                <div><dt className="text-[var(--text-muted)]">Phone</dt><dd className="font-medium">{c.phone || "—"}</dd></div>
                <div><dt className="text-[var(--text-muted)]">Current Title</dt><dd className="font-medium">{c.currentTitle || "—"}</dd></div>
                <div><dt className="text-[var(--text-muted)]">Current Company</dt><dd className="font-medium">{c.currentCompany || "—"}</dd></div>
                <div><dt className="text-[var(--text-muted)]">Expected Salary</dt><dd className="font-medium">{c.expectedSalary ? `LKR ${c.expectedSalary.toLocaleString()}` : "—"}</dd></div>
                <div><dt className="text-[var(--text-muted)]">Notice Period</dt><dd className="font-medium">{c.noticePeriod || "—"}</dd></div>
              </dl>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-[var(--text)] uppercase tracking-wide">Application Info</h3>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div><dt className="text-[var(--text-muted)]">Source</dt><dd className="font-medium">{c.source}</dd></div>
                <div><dt className="text-[var(--text-muted)]">Applied On</dt><dd className="font-medium">{formatDateTime(c.appliedAt)}</dd></div>
                <div><dt className="text-[var(--text-muted)]">Requisition</dt><dd className="font-medium text-[var(--primary)]">{c.requisitionTitle || "—"}</dd></div>
                <div><dt className="text-[var(--text-muted)]">Rating</dt><dd className="font-medium">{c.rating ? "★".repeat(c.rating) + "☆".repeat(5 - c.rating) : "Not rated"}</dd></div>
              </dl>
              {c.notes && <div className="mt-4"><dt className="text-sm text-[var(--text-muted)]">Notes</dt><dd className="mt-1 text-sm whitespace-pre-wrap">{c.notes}</dd></div>}
              {(c.hasUploadedResume || (c.resumeUrl && /^https?:\/\//i.test(c.resumeUrl))) && (
                <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-4">
                  {c.hasUploadedResume && (
                    <Button type="button" variant="secondary" disabled={resumeOpening} onClick={() => void openStoredResumePdf()}>
                      {resumeOpening ? "Opening…" : "View resume (PDF)"}
                    </Button>
                  )}
                  {c.resumeUrl && /^https?:\/\//i.test(c.resumeUrl) && (
                    <a
                      href={c.resumeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-[var(--primary)] underline-offset-2 hover:underline"
                    >
                      External resume link
                    </a>
                  )}
                  {c.resumeUrl && c.hasUploadedResume && !/^https?:\/\//i.test(c.resumeUrl) && (
                    <span className="text-xs text-[var(--text-muted)]">Original file name: {c.resumeUrl}</span>
                  )}
                </div>
              )}
              {c.rejectionReason && (
                <div className="mt-4 rounded-lg bg-red-50 p-3">
                  <dt className="text-sm font-medium text-red-700">Rejection Reason</dt>
                  <dd className="mt-1 text-sm text-red-600">{c.rejectionReason}</dd>
                </div>
              )}
            </div>

            {c.stage === "Offer" && (
              <div className="rounded-2xl border border-orange-200 bg-orange-50/50 p-6 shadow-sm lg:col-span-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--text)]">Offer letter</h3>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                      {c.offer
                        ? "Edit the offer letter, approve it, then share it with the candidate by email."
                        : "Create an offer with an editable letter template, then approve and email it to the candidate."}
                    </p>
                  </div>
                  <Button onClick={openOfferWorkflow}>{c.offer ? "Open offer" : "Create offer"}</Button>
                </div>
              </div>
            )}

            {(c.stage === "Evaluation" || evaluationNotes.length > 0) && (
              <div className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm lg:col-span-2">
                <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-[var(--text)]">Evaluation notes</h3>
                <p className="mb-4 text-xs text-[var(--text-muted)]">
                  While the candidate is in Evaluation, interviewers can add notes at any time — strengths, concerns, and why you recommend moving forward or not.
                </p>
                {c.stage === "Evaluation" && (
                  <div className="mb-4 space-y-2">
                    <textarea
                      value={evaluationNote}
                      onChange={(e) => setEvaluationNote(e.target.value)}
                      placeholder="e.g. Strong technical skills; concerns about notice period…"
                      className={`${INPUT} min-h-[88px]`}
                    />
                    <div className="flex justify-end">
                      <Button onClick={() => void handleAddEvaluationNote()} disabled={evaluationNoteSaving || !evaluationNote.trim()}>
                        {evaluationNoteSaving ? "Saving…" : "Add evaluation note"}
                      </Button>
                    </div>
                  </div>
                )}
                {evaluationNotes.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)]">No evaluation notes yet.</p>
                ) : (
                  <div className="space-y-3">
                    {evaluationNotes.map((a) => (
                      <div key={a.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg)]/40 px-4 py-3">
                        <p className="whitespace-pre-wrap text-sm text-[var(--text)]">{a.description}</p>
                        <p className="mt-1.5 text-xs text-[var(--text-muted)]">
                          {a.performedBy && <>{a.performedBy} · </>}
                          {formatBusinessDateTime(a.performedAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══ INTERVIEWS TAB ═══ */}
        {tab === "interviews" && (
          <div className="space-y-4">
            {c.interviews.length === 0 ? (
              <div className="rounded-2xl border border-[var(--border)] bg-white p-8 text-center text-[var(--text-muted)] shadow-sm">
                No interviews scheduled yet.
                {c.stage === "Interview" && (
                  <div className="mt-3"><Button variant="secondary" onClick={openScheduleModal}>Schedule Interview</Button></div>
                )}
                {c.stage === "Rejected" && (
                  <div className="mt-3"><Button onClick={() => void handleReinterview()}>Re-interview</Button></div>
                )}
              </div>
            ) : (
              <>
              {c.stage === "Rejected" && (
                <div className="flex justify-end">
                  <Button onClick={() => void handleReinterview()}>Re-interview</Button>
                </div>
              )}
              {c.interviews.map((iv) => (
              <div key={iv.id} className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-[var(--text)]">{iv.title}</h4>
                    <p className="text-sm text-[var(--text-muted)]">
                      {formatDateTime(iv.scheduledAt)} &middot; {iv.duration}min
                      {iv.location && <> &middot; {iv.location}</>}
                      {iv.interviewType && <> &middot; {iv.interviewType}</>}
                    </p>
                    {iv.interviewerName && <p className="text-sm text-[var(--text-muted)] mt-1">Interviewer: {iv.interviewerName}</p>}
                  </div>
                  <span className={`rounded-full px-3 py-0.5 text-xs font-semibold
                    ${iv.status === "Completed" ? "bg-green-100 text-green-700" : iv.status === "Cancelled" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
                    {iv.status}
                  </span>
                </div>
                {iv.feedback && <div className="mt-3 rounded-lg bg-gray-50 p-3 text-sm"><span className="font-medium">Feedback:</span> {iv.feedback}</div>}
                {iv.overallRating != null && (
                  <div className="mt-2 text-sm">Rating: {"★".repeat(iv.overallRating)}{"☆".repeat(5 - iv.overallRating)}{iv.recommendation && <> &middot; {iv.recommendation}</>}</div>
                )}
                {iv.scorecards.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-[var(--text-muted)] uppercase mb-1">Scorecard</p>
                    <div className="grid gap-1">
                      {iv.scorecards.map((sc) => (
                        <div key={sc.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-1.5">
                          <span>{sc.criteria}</span>
                          <span className="font-medium">{"★".repeat(sc.rating)}{"☆".repeat(5 - sc.rating)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
              </>
            )}
          </div>
        )}

        {/* ═══ OFFER TAB ═══ */}
        {tab === "offer" && (
          <div className="space-y-4">
            {c.offer && !(showOfferForm && c.offer.status === "Rejected") ? (
              <>
              <div className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-semibold">Offer Details</h3>
                  <span className={`rounded-full px-3 py-0.5 text-xs font-semibold
                    ${c.offer.status === "Approved" ? "bg-green-100 text-green-700" : c.offer.status === "Rejected" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
                    {c.offer.status}
                  </span>
                </div>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm lg:grid-cols-3">
                  <div><dt className="text-[var(--text-muted)]">Salary Offered</dt><dd className="font-medium">{c.offer.currency ?? "LKR"} {c.offer.salaryOffered.toLocaleString()}</dd></div>
                  <div><dt className="text-[var(--text-muted)]">Offer Date</dt><dd className="font-medium">{formatDate(c.offer.offerDate)}</dd></div>
                  {c.offer.expiryDate && <div><dt className="text-[var(--text-muted)]">Expiry</dt><dd className="font-medium">{formatDate(c.offer.expiryDate)}</dd></div>}
                  {c.offer.joiningDate && <div><dt className="text-[var(--text-muted)]">Joining Date</dt><dd className="font-medium">{formatDate(c.offer.joiningDate)}</dd></div>}
                  {c.offer.acceptedAt && <div><dt className="text-[var(--text-muted)]">Accepted</dt><dd className="font-medium text-green-600">{formatDateTime(c.offer.acceptedAt)}</dd></div>}
                  {c.offer.rejectedAt && <div><dt className="text-[var(--text-muted)]">Rejected</dt><dd className="font-medium text-red-600">{formatDateTime(c.offer.rejectedAt)}</dd></div>}
                </dl>
                {c.offer.remarks && <p className="mt-4 text-sm text-[var(--text-muted)]">{c.offer.remarks}</p>}
                {c.offer.rejectionReason && (
                  <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                    <span className="font-medium">Rejection Reason:</span> {c.offer.rejectionReason}
                  </div>
                )}

                {c.offer.status === "Rejected" && (
                  <div className="mt-6 pt-4 border-t border-[var(--border)]">
                    <Button onClick={() => { setShowOfferForm(true); initOfferForm(); }}>Send new offer</Button>
                  </div>
                )}

                {/* Offer action buttons */}
                {c.offer.status !== "Rejected" && (
                  <div className="mt-6 flex flex-wrap items-center gap-3 pt-4 border-t border-[var(--border)]">
                    <Button
                      variant="secondary"
                      onClick={handleViewOffer}
                      disabled={offerLetterLoading || (!offerLetterHtml.trim() && !c.offer.letterHtml)}
                    >
                      View offer
                    </Button>
                    {c.offer.status === "Pending" && (
                      <>
                        <Button onClick={handleApproveOffer} disabled={actionLoading}>
                          {actionLoading ? "Processing..." : "Approve offer"}
                        </Button>
                        <Button variant="secondary" className="text-red-600" onClick={handleRejectOffer} disabled={actionLoading}>
                          Reject offer
                        </Button>
                      </>
                    )}
                    {c.offer.status === "Approved" && !c.offer.acceptedAt && (
                      <>
                        <Button onClick={handleSendOfferEmail} disabled={sendingEmail || !offerLetterHtml.trim()}>
                          {sendingEmail ? "Sending..." : "Share with candidate"}
                        </Button>
                        <Button onClick={handleAcceptOffer} disabled={actionLoading}>
                          {actionLoading ? "Processing..." : "Mark as Accepted"}
                        </Button>
                        <Button variant="secondary" className="text-red-600" onClick={handleRejectOffer} disabled={actionLoading}>
                          Withdraw offer
                        </Button>
                      </>
                    )}
                    {emailSent && <span className="text-sm text-green-600 font-medium">Offer PDF emailed to {c.email}</span>}
                  </div>
                )}

                {c.offer.status === "Approved" && c.offer.acceptedAt && c.stage === "Offer" && (
                  <div className="mt-4 rounded-lg bg-green-50 p-4 text-sm text-green-700">
                    Offer accepted. The candidate will be moved to the <strong>Hired</strong> stage.
                  </div>
                )}
              </div>
              {c.offer.status !== "Rejected" && (
                <div ref={offerLetterSectionRef}>
                  {offerLetterEditor({ showSave: true })}
                </div>
              )}
              </>
            ) : (
              <div className="rounded-2xl border border-[var(--border)] bg-white shadow-sm">
                {showOfferForm ? (
                  <div className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Create Offer</h3>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium mb-1">Candidate Name</label>
                          <input type="text" value={c.fullName} readOnly className={`${INPUT} bg-[var(--bg)]/60 text-[var(--text-muted)]`} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Position Title *</label>
                          <input
                            type="text"
                            value={offerForm.positionTitle}
                            onChange={(e) => setOfferForm({ ...offerForm, positionTitle: e.target.value })}
                            placeholder="e.g. Senior Software Engineer"
                            className={INPUT}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium mb-1">Salary Offered *</label>
                          <input type="number" value={offerForm.salaryOffered} onChange={(e) => setOfferForm({ ...offerForm, salaryOffered: e.target.value })}
                            placeholder="e.g. 150000" className={INPUT} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Currency</label>
                          <select value={offerForm.currency} onChange={(e) => setOfferForm({ ...offerForm, currency: e.target.value })} className={INPUT}>
                            <option>LKR</option><option>USD</option><option>EUR</option><option>GBP</option><option>AUD</option>
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-sm font-medium mb-1">Offer Date *</label>
                          <DatePickerField value={offerForm.offerDate} onChange={(v) => setOfferForm({ ...offerForm, offerDate: v })} className={INPUT} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Expiry Date</label>
                          <DatePickerField value={offerForm.expiryDate} onChange={(v) => setOfferForm({ ...offerForm, expiryDate: v })} className={INPUT} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Joining Date</label>
                          <DatePickerField value={offerForm.joiningDate} onChange={(v) => setOfferForm({ ...offerForm, joiningDate: v })} className={INPUT} />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Remarks</label>
                        <textarea value={offerForm.remarks} onChange={(e) => setOfferForm({ ...offerForm, remarks: e.target.value })}
                          placeholder="Additional notes about the offer..." className={`${INPUT} min-h-[80px]`} />
                      </div>
                      {offerLetterEditor({ showSave: false })}
                    </div>
                    <div className="mt-5 flex justify-end gap-3">
                      <Button variant="secondary" onClick={() => setShowOfferForm(false)} disabled={createOfferLoading}>Cancel</Button>
                      <Button onClick={() => void handleCreateOffer()} disabled={createOfferLoading || offerLetterLoading}>
                        {createOfferLoading ? "Saving…" : "Save & share with candidate"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center text-[var(--text-muted)]">
                    No offer created yet.
                    <div className="mt-3"><Button onClick={() => { setShowOfferForm(true); initOfferForm(); }}>Create Offer</Button></div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══ ACTIVITY TAB ═══ */}
        {tab === "activity" && (
          <div className="rounded-2xl border border-[var(--border)] bg-white shadow-sm">
            {c.activities.length === 0 ? (
              <div className="p-8 text-center text-[var(--text-muted)]">No activity recorded.</div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {c.activities.map((a) => (
                  <div key={a.id} className="flex items-start gap-4 px-6 py-4">
                    <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--primary)]" />
                    <div className="flex-1">
                      <p className="text-sm text-[var(--text)]">{a.description}</p>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">{a.performedBy && <>{a.performedBy} &middot; </>}{formatBusinessDateTime(a.performedAt)}</p>
                    </div>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{activityTypeLabel(a.activityType)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ═══ REJECT MODAL ═══ */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-24"
          onClick={(e) => { if (e.target === e.currentTarget) setRejectModal(false); }}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold">Reject Candidate</h2>
            <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason for rejection..."
              className={`${INPUT} min-h-[100px]`} />
            <div className="mt-4 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setRejectModal(false)}>Cancel</Button>
              <Button className="bg-red-600 hover:bg-red-700" onClick={handleReject}>Reject</Button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ SCHEDULE INTERVIEW MODAL ═══ */}
      {scheduleModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 pt-16 pb-10"
          onClick={(e) => { if (e.target === e.currentTarget) setScheduleModal(false); }}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold">Schedule Interview</h2>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Title *</label>
                <FormSelect
                  value={interviewForm.title}
                  onValueChange={(v) => {
                    const inferred = inferInterviewTypeFromTitle(v, candidate?.fullName);
                    if (inferred !== "Video") setScheduleMeetingLink("");
                    setInterviewForm((prev) => ({
                      ...prev,
                      title: v,
                      ...(inferred !== null
                        ? { interviewType: inferred, location: inferred === "Onsite" ? prev.location : "" }
                        : {}),
                    }));
                  }}
                  options={scheduleTitleOpts}
                  placeholder="Select title…"
                />
                <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                  Title and type stay in sync — change either field to update the other.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Date & Time *</label>
                  <DateTimePickerField value={interviewForm.scheduledAt} onChange={(v) => setInterviewForm({ ...interviewForm, scheduledAt: v })} className={INPUT} /></div>
                <div><label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Duration (min)</label>
                  <input type="number" value={interviewForm.duration} onChange={(e) => setInterviewForm({ ...interviewForm, duration: Number(e.target.value) })} className={INPUT} /></div>
              </div>
              <div className={`grid gap-3 ${interviewForm.interviewType === "Phone" ? "grid-cols-1" : "grid-cols-2"}`}>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Type</label>
                  <FormSelect
                    value={interviewForm.interviewType || ""}
                    onValueChange={(v) => {
                      const name = candidate?.fullName ?? "";
                      setInterviewForm((prev) => ({
                        ...prev,
                        interviewType: v,
                        title: defaultScheduleTitle(v || undefined, name),
                        location: v === "Onsite" ? prev.location : "",
                      }));
                      if (v !== "Video") setScheduleMeetingLink("");
                    }}
                    options={INTERVIEW_TYPE_OPTS}
                    placeholder="Select type…"
                  />
                </div>
                {interviewForm.interviewType === "Video" && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Meeting link</label>
                    <input
                      className={INPUT}
                      placeholder="https://teams.microsoft.com/…"
                      value={scheduleMeetingLink}
                      onChange={(e) => setScheduleMeetingLink(e.target.value)}
                    />
                  </div>
                )}
                {interviewForm.interviewType === "Onsite" && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Location</label>
                    <FormSelect
                      value={interviewForm.location || ""}
                      onValueChange={(v) => setInterviewForm({ ...interviewForm, location: v })}
                      options={scheduleOnsiteLocationOpts}
                      placeholder="Select location…"
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Interviewer</label>
                <FormSelect
                  value={interviewForm.interviewerId || ""}
                  onValueChange={(v) =>
                    setInterviewForm({
                      ...interviewForm,
                      interviewerId: v,
                      interviewerName: v ? scheduleLookups.interviewers.find((e) => e.id === v)?.name ?? "" : "",
                    })
                  }
                  options={scheduleInterviewerOpts}
                  placeholder="Select interviewer…"
                />
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--soft)]/50 px-3 py-3">
                <p className="mb-2 text-xs font-semibold text-[var(--text)]">Email notifications</p>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text)]">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]/25"
                    checked={notifyInterviewCandidateEmail}
                    onChange={(e) => setNotifyInterviewCandidateEmail(e.target.checked)}
                  />
                  <span>
                    Email interview details to {c.email ? <strong>{c.email}</strong> : "the candidate"}
                  </span>
                </label>
                <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-[var(--text)]">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]/25"
                    disabled={!interviewForm.interviewerId}
                    checked={notifyInterviewInterviewerEmail && !!interviewForm.interviewerId}
                    onChange={(e) => setNotifyInterviewInterviewerEmail(e.target.checked)}
                  />
                  <span>Email interview details to the interviewer (employee work email)</span>
                </label>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setScheduleModal(false)}>Cancel</Button>
              <Button onClick={handleScheduleInterview}>Schedule</Button>
            </div>
          </div>
        </div>
      )}

      <CreateEmployeeModal
        open={convertEmployeeOpen}
        onClose={() => setConvertEmployeeOpen(false)}
        candidateId={id}
        title="Convert to Employee"
        submitLabel="Convert to Employee"
        initialValues={convertEmployeeInitialValues}
        onConverted={async (result) => {
          await load();
          const onboardingNote = result.onboardingStarted ? " Onboarding tasks have been created." : "";
          await appAlert(`${c.fullName} has been converted to an employee.${onboardingNote}`, { title: "Employee created" });
          router.push(`/app/people/${result.employeeId}`);
        }}
      />
    </div>
  );
}
