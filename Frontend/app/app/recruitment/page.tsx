"use client";

import { appAlert, appConfirm, appPrompt } from "@/components/ui/appDialogs";
import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { Button } from "@/components/ui/Button";
import { TablePagination } from "@/components/ui/TablePagination";
import { DateTimePickerField, FormSelect, PersonNameInput, PhoneInput, type FormSelectOption } from "@/components/ui";
import { isValidPhone, PHONE_VALIDATION_MESSAGE } from "@/lib/input-validation";
import { CreateRequisitionModal } from "@/components/forms/CreateRequisitionModal";
import { Modal } from "@/components/ui/Modal";
import { apiFetch } from "@/lib/api";
import { formatBusinessDateTime, formatDate } from "@/lib/date-utils";
import { currencySelectOptions, DEFAULT_CURRENCY } from "@/lib/currencies";
import { type EmploymentTypeCatalogItem, employmentTypeSelectOptions } from "@/lib/employment-types";
import { useApplyFilter } from "@/lib/use-apply-filter";
import { ROUTES } from "@/config/routes";
import {
  defaultScheduleTitle,
  inferInterviewTypeFromTitle,
  INTERVIEW_TYPE_OPTS,
  resolveInterviewLocation,
  scheduleOnsiteLocationOptions,
  scheduleTitleOptions,
} from "@/lib/interview-scheduling";

interface Requisition {
  id: string; title: string; code: string; description?: string; vacancies: number;
  status: string; targetDate?: string; priority?: string; employmentType?: string;
  experienceMin?: number; experienceMax?: number; salaryMin?: number; salaryMax?: number; salaryCurrency?: string;
  skills?: string; closedAt?: string; departmentName?: string; departmentId: string;
  jobTitleName?: string; jobTitleId?: string; hiringManagerName?: string; hiringManagerId?: string;
  locationName?: string; locationId?: string; positionTitle?: string; positionId?: string;
  candidateCount: number;
  applicationNotificationEmail?: string;
}

interface Candidate {
  id: string; firstName: string; lastName: string; fullName: string; email: string;
  phone?: string; source: string; stage: string; appliedAt: string;
  currentTitle?: string; currentCompany?: string; expectedSalary?: number;
  noticePeriod?: string; rating?: number; tags?: string;
  requisitionId: string; requisitionTitle?: string;
}

interface Interview {
  id: string; title: string; scheduledAt: string; duration: number; location?: string;
  interviewType?: string; status: string; feedback?: string; overallRating?: number;
  recommendation?: string; interviewerName?: string; interviewerId?: string;
  candidateId: string; candidateName?: string; candidateStage?: string; requisitionTitle?: string;
}

interface OfferHistory {
  id: string;
  candidateId: string;
  candidateName?: string;
  requisitionTitle?: string;
  positionTitle?: string;
  salaryOffered: number;
  currency?: string;
  offerDate: string;
  expiryDate?: string;
  joiningDate?: string;
  status: string;
  acceptedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  hasLetter: boolean;
  updatedAt: string;
}

interface OfferDetail {
  id: string;
  candidateId: string;
  candidateName?: string;
  letterHtml?: string;
  salaryOffered: number;
  currency?: string;
  offerDate: string;
  status: string;
}

interface Dashboard {
  openRequisitions: number; totalCandidates: number; interviewsThisWeek: number;
  offersExtended: number; hiredThisMonth: number; avgTimeToHireDays: number;
  offerAcceptanceRate: number; pipelineByStage: Record<string, number>;
  upcomingInterviews: Interview[]; recentActivities: Activity[];
}

interface Activity {
  id: string; activityType: string; description: string;
  performedBy?: string; performedAt: string;
}

const TABS = ["Dashboard", "Requisitions", "Candidates", "Interviews", "Interview History", "Offer Letter History"] as const;
const STAGES = ["Sourced", "Screening", "Interview", "Evaluation", "Offer", "Hired"];
const STAGE_COLORS: Record<string, string> = {
  Sourced: "bg-gray-100 text-gray-700", Screening: "bg-blue-100 text-blue-700",
  Interview: "bg-yellow-100 text-yellow-700",
  Evaluation: "bg-purple-100 text-purple-700", Offer: "bg-orange-100 text-orange-700",
  Hired: "bg-green-100 text-green-700", Rejected: "bg-red-100 text-red-700",
  Withdrawn: "bg-gray-200 text-gray-500",
};

const REQ_STATUS_FILTER_OPTS: FormSelectOption[] = [
  { value: "", label: "All Statuses" },
  { value: "Pending", label: "Pending" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" },
];

const REQ_PRIORITY_FILTER_OPTS: FormSelectOption[] = [
  { value: "", label: "All Priorities" },
  { value: "High", label: "High" },
  { value: "Medium", label: "Medium" },
  { value: "Low", label: "Low" },
];


const CANDIDATE_SOURCE_OPTS: FormSelectOption[] = [
  { value: "", label: "Select…" },
  { value: "Direct", label: "Direct Application" },
  { value: "Referral", label: "Referral" },
  { value: "LinkedIn", label: "LinkedIn" },
  { value: "Job Board", label: "Job Board" },
  { value: "Agency", label: "Agency" },
  { value: "Walk-in", label: "Walk-in" },
  { value: "Other", label: "Other" },
];

const REQ_PRIORITY_EDIT_OPTS: FormSelectOption[] = [
  { value: "", label: "Select…" },
  { value: "High", label: "High" },
  { value: "Medium", label: "Medium" },
  { value: "Low", label: "Low" },
];

/** Match Command Center (dashboard) card / KPI styling */
const kpiTileClass =
  "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md";
const panelClass = "rounded-2xl border border-slate-200 bg-white shadow-sm";
const inputClassSlate =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-[#2E7BBF] focus:ring-2 focus:ring-[#2E7BBF]/20";

export default function RecruitmentPage() {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Dashboard");
  const [showCreate, setShowCreate] = useState(false);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [requisitionPicklist, setRequisitionPicklist] = useState<Requisition[]>([]);
  const [reqPage, setReqPage] = useState(1);
  const [reqTotalCount, setReqTotalCount] = useState(0);
  const REQ_PAGE_SIZE = 10;
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candPage, setCandPage] = useState(1);
  const [candTotalCount, setCandTotalCount] = useState(0);
  const CAND_PAGE_SIZE = 20;
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [interviewHistory, setInterviewHistory] = useState<Interview[]>([]);
  const [offerHistory, setOfferHistory] = useState<OfferHistory[]>([]);
  const [viewOfferModal, setViewOfferModal] = useState<OfferDetail | null>(null);
  const [viewOfferLoading, setViewOfferLoading] = useState(false);
  const [filterReqStatus, setFilterReqStatus] = useState("");
  const [filterReqPriority, setFilterReqPriority] = useState("");
  const [filterCandStage, setFilterCandStage] = useState("");
  const [filterCandReq, setFilterCandReq] = useState("");
  const candSearchFilter = useApplyFilter();
  const [candidateView, setCandidateView] = useState<"kanban" | "table">("kanban");
  const [dragCandidate, setDragCandidate] = useState<string | null>(null);
  const [editReq, setEditReq] = useState<Requisition | null>(null);
  const [scheduleModal, setScheduleModal] = useState(false);
  const [scheduleForm, setScheduleForm] = useState<Partial<Interview & { candidateId: string }>>({});
  const [scheduleNotifyCandidateEmail, setScheduleNotifyCandidateEmail] = useState(true);
  const [scheduleNotifyInterviewerEmail, setScheduleNotifyInterviewerEmail] = useState(true);
  const [scheduleTitleManual, setScheduleTitleManual] = useState(false);
  const [scheduleMeetingLink, setScheduleMeetingLink] = useState("");
  const [scheduleLookups, setScheduleLookups] = useState<{
    locations: { id: string; name: string }[];
    interviewers: { id: string; name: string }[];
  }>({ locations: [], interviewers: [] });
  const [showAddCandidate, setShowAddCandidate] = useState(false);
  const [candidateForm, setCandidateForm] = useState({ firstName: "", lastName: "", email: "", phone: "", source: "", requisitionId: "", currentTitle: "", currentCompany: "", expectedSalary: "", noticePeriod: "", notes: "", tags: "" });

  const candReqFilterOpts = useMemo<FormSelectOption[]>(
    () => [{ value: "", label: "All Requisitions" }, ...requisitionPicklist.map((r) => ({ value: r.id, label: r.title }))],
    [requisitionPicklist]
  );

  const candStageFilterOpts = useMemo<FormSelectOption[]>(
    () => [{ value: "", label: "All Stages" }, ...STAGES.map((s) => ({ value: s, label: s }))],
    []
  );

  const scheduleCandidateOpts = useMemo<FormSelectOption[]>(
    () => [{ value: "", label: "Select candidate…" }, ...candidates.map((c) => ({ value: c.id, label: c.fullName }))],
    [candidates]
  );

  const addCandidateReqOpts = useMemo<FormSelectOption[]>(
    () => [{ value: "", label: "Select requisition…" }, ...requisitionPicklist.map((r) => ({ value: r.id, label: `${r.code} — ${r.title}` }))],
    [requisitionPicklist]
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

  const scheduleTitleOpts = useMemo(() => {
    const cand = candidates.find((c) => c.id === scheduleForm.candidateId);
    return scheduleTitleOptions(cand?.fullName);
  }, [candidates, scheduleForm.candidateId]);

  const scheduleTitleAutoKey = `${scheduleForm.candidateId ?? ""}|${scheduleForm.interviewType ?? ""}`;

  useEffect(() => {
    if (!scheduleModal || scheduleTitleManual) return;
    const cand = candidates.find((c) => c.id === scheduleForm.candidateId);
    const nextTitle = defaultScheduleTitle(scheduleForm.interviewType, cand?.fullName);
    setScheduleForm((prev) => (prev.title === nextTitle ? prev : { ...prev, title: nextTitle }));
  }, [scheduleModal, scheduleTitleManual, scheduleTitleAutoKey, candidates]);

  useEffect(() => {
    if (!scheduleModal) {
      setScheduleTitleManual(false);
      setScheduleMeetingLink("");
      setScheduleNotifyCandidateEmail(true);
      setScheduleNotifyInterviewerEmail(true);
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

  const loadDashboard = useCallback(async () => {
    try { setDashboard(await apiFetch<Dashboard>("/api/recruitment/dashboard")); } catch { /* */ }
  }, []);

  const loadRequisitionPicklist = useCallback(async () => {
    try {
      const res = await apiFetch<{ items: Requisition[] }>("/api/recruitment/requisitions?page=1&pageSize=500");
      setRequisitionPicklist(res.items ?? []);
    } catch { /* */ }
  }, []);

  const loadRequisitions = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(reqPage), pageSize: String(REQ_PAGE_SIZE) });
      if (filterReqStatus) params.set("status", filterReqStatus);
      if (filterReqPriority) params.set("priority", filterReqPriority);
      const res = await apiFetch<{ items: Requisition[]; totalCount: number }>(`/api/recruitment/requisitions?${params}`);
      setRequisitions(res.items ?? []);
      setReqTotalCount(res.totalCount ?? res.items?.length ?? 0);
    } catch { /* */ }
  }, [filterReqStatus, filterReqPriority, reqPage]);

  const loadCandidates = useCallback(async () => {
    try {
      const isKanban = candidateView === "kanban";
      const params = new URLSearchParams({
        page: String(isKanban ? 1 : candPage),
        pageSize: String(isKanban ? 500 : CAND_PAGE_SIZE),
      });
      if (filterCandStage) params.set("stage", filterCandStage);
      if (filterCandReq) params.set("requisitionId", filterCandReq);
      if (candSearchFilter.applied) params.set("search", candSearchFilter.applied);
      const res = await apiFetch<{ items: Candidate[]; totalCount: number }>(`/api/recruitment/candidates?${params}`);
      setCandidates(res.items ?? []);
      setCandTotalCount(res.totalCount ?? res.items?.length ?? 0);
    } catch { /* */ }
  }, [filterCandStage, filterCandReq, candSearchFilter.applied, candPage, candidateView]);

  const loadInterviews = useCallback(async () => {
    try { setInterviews(await apiFetch<Interview[]>("/api/recruitment/interviews/upcoming")); } catch { /* */ }
  }, []);

  const loadInterviewHistory = useCallback(async () => {
    try {
      setInterviewHistory(await apiFetch<Interview[]>("/api/recruitment/interviews/history?page=1&pageSize=50"));
    } catch { /* */ }
  }, []);

  const loadOfferHistory = useCallback(async () => {
    try {
      setOfferHistory(await apiFetch<OfferHistory[]>("/api/recruitment/offers/history?page=1&pageSize=50"));
    } catch { /* */ }
  }, []);

  async function handleViewOfferLetter(offerId: string) {
    setViewOfferLoading(true);
    try {
      const offer = await apiFetch<OfferDetail>(`/api/recruitment/offers/${offerId}`);
      setViewOfferModal(offer);
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Could not load offer letter.");
    } finally {
      setViewOfferLoading(false);
    }
  }

  useEffect(() => {
    if (tab === "Dashboard") loadDashboard();
    if (tab === "Requisitions") loadRequisitions();
    if (tab === "Candidates") { loadCandidates(); loadRequisitionPicklist(); }
    if (tab === "Interviews") { loadInterviews(); loadCandidates(); loadRequisitionPicklist(); }
    if (tab === "Interview History") loadInterviewHistory();
    if (tab === "Offer Letter History") loadOfferHistory();
  }, [tab, loadDashboard, loadRequisitions, loadCandidates, loadInterviews, loadInterviewHistory, loadOfferHistory, loadRequisitionPicklist]);

  useEffect(() => { setReqPage(1); }, [filterReqStatus, filterReqPriority]);
  useEffect(() => { setCandPage(1); }, [filterCandStage, filterCandReq, candSearchFilter.applied, candidateView]);

  const handleApproveReq = async (id: string) => {
    if (!(await appConfirm("Approve this requisition? Approved roles can proceed in the hiring pipeline."))) return;
    try {
      await apiFetch(`/api/recruitment/requisitions/${id}/approve`, { method: "POST" });
      loadRequisitions();
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Approve failed");
    }
  };

  const handleRejectReq = async (id: string) => {
    if (!(await appConfirm("Reject this requisition? It will be marked rejected and should not be used for new hiring."))) return;
    const remarks = await appPrompt("Add optional internal remarks for this rejection.", { title: "Rejection Remarks", confirmLabel: "Continue", placeholder: "Optional remarks..." });
    if (remarks === null) return;
    try {
      await apiFetch(`/api/recruitment/requisitions/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ remarks: remarks.trim() || null }),
      });
      loadRequisitions();
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Reject failed");
    }
  };

  const handleCloseReq = async (id: string) => {
    if (!(await appConfirm("Close this requisition? Use this when the role is filled or the search is stopped."))) return;
    try {
      await apiFetch(`/api/recruitment/requisitions/${id}/close`, { method: "POST" });
      loadRequisitions();
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Close failed");
    }
  };

  const handleDeleteReq = async (id: string) => {
    if (!(await appConfirm("Delete this requisition?"))) return;
    await apiFetch(`/api/recruitment/requisitions/${id}`, { method: "DELETE" });
    loadRequisitions();
  };

  const handleStageChange = async (candidateId: string, stage: string) => {
    await apiFetch(`/api/recruitment/candidates/${candidateId}/stage`, {
      method: "PUT", body: JSON.stringify({ stage }),
    });
    loadCandidates();
    loadDashboard();
  };

  const handleReinterview = async (candidateId: string, candidateName?: string, interviewerId?: string) => {
    try {
      await apiFetch(`/api/recruitment/candidates/${candidateId}/reinterview`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setScheduleForm({
        candidateId,
        title: defaultScheduleTitle("Onsite", candidateName),
        scheduledAt: "",
        duration: 60,
        location: "",
        interviewType: "Onsite",
        interviewerId: interviewerId ?? "",
        interviewerName: "",
      });
      setScheduleTitleManual(false);
      setScheduleMeetingLink("");
      setScheduleNotifyCandidateEmail(true);
      setScheduleNotifyInterviewerEmail(true);
      setScheduleModal(true);
      loadCandidates();
      loadDashboard();
    } catch (e) {
      await appAlert(e instanceof Error ? e.message : "Could not reopen candidate for interview.");
    }
  };

  const handleScheduleInterview = async () => {
    if (!scheduleForm.candidateId || !scheduleForm.title || !scheduleForm.scheduledAt) return;
    const locationResolved = resolveInterviewLocation(
      scheduleForm.interviewType,
      scheduleForm.location,
      scheduleMeetingLink,
    );
    const interviewer = scheduleLookups.interviewers.find((e) => e.id === scheduleForm.interviewerId);
    await apiFetch("/api/recruitment/interviews", {
      method: "POST",
      body: JSON.stringify({
        title: scheduleForm.title,
        scheduledAt: scheduleForm.scheduledAt,
        duration: scheduleForm.duration || 60,
        location: locationResolved,
        interviewType: scheduleForm.interviewType,
        candidateId: scheduleForm.candidateId,
        interviewerId: scheduleForm.interviewerId || null,
        interviewerName: interviewer?.name ?? scheduleForm.interviewerName ?? null,
        notifyCandidateByEmail: scheduleNotifyCandidateEmail,
        notifyInterviewerByEmail: scheduleNotifyInterviewerEmail,
      }),
    });
    setScheduleModal(false);
    setScheduleForm({});
    setScheduleMeetingLink("");
    loadInterviews();
    loadInterviewHistory();
    loadCandidates();
    loadDashboard();
  };

  const handleAddCandidate = async () => {
    if (!candidateForm.firstName || !candidateForm.lastName || !candidateForm.email || !candidateForm.requisitionId) return;
    if (candidateForm.phone.trim() && !isValidPhone(candidateForm.phone)) {
      await appAlert(PHONE_VALIDATION_MESSAGE);
      return;
    }
    await apiFetch("/api/recruitment/candidates", {
      method: "POST",
      body: JSON.stringify({
        firstName: candidateForm.firstName, lastName: candidateForm.lastName,
        email: candidateForm.email, phone: candidateForm.phone || null,
        source: candidateForm.source || "Direct", requisitionId: candidateForm.requisitionId,
        currentTitle: candidateForm.currentTitle || null, currentCompany: candidateForm.currentCompany || null,
        expectedSalary: candidateForm.expectedSalary ? Number(candidateForm.expectedSalary) : null,
        noticePeriod: candidateForm.noticePeriod || null, notes: candidateForm.notes || null,
        tags: candidateForm.tags || null,
      }),
    });
    setShowAddCandidate(false);
    setCandidateForm({ firstName: "", lastName: "", email: "", phone: "", source: "", requisitionId: "", currentTitle: "", currentCompany: "", expectedSalary: "", noticePeriod: "", notes: "", tags: "" });
    loadCandidates();
    loadDashboard();
  };

  const inputClass = inputClassSlate;

  return (
    <>
      <AppTopbar
        title="Recruitment & Hiring"
        subtitle="Live hiring metrics from your OpenSky HRM data (where your role and licenses allow)."
      />

      <div className="mt-6 flex flex-wrap gap-1.5 rounded-2xl border border-slate-200 bg-slate-50/90 p-1.5 shadow-sm">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
              tab === t
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/90"
                : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Dashboard Tab ──────────────────────────────────── */}
      {tab === "Dashboard" && !dashboard && (
        <p className="mt-6 rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500 shadow-sm">
          Loading recruitment metrics…
        </p>
      )}
      {tab === "Dashboard" && dashboard && (
        <div className="mt-6 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Open requisitions", value: dashboard.openRequisitions, sub: "Approved, open roles" },
              { label: "Candidates in pipeline", value: dashboard.totalCandidates, sub: "Across active requisitions" },
              { label: "Interviews this week", value: dashboard.interviewsThisWeek, sub: "Scheduled sessions" },
              { label: "Offers extended", value: dashboard.offersExtended, sub: "Pending decisions" },
            ].map((kpi) => (
              <div key={kpi.label} className={kpiTileClass}>
                <div className="text-xs font-medium uppercase tracking-wider text-slate-500">{kpi.label}</div>
                <div className="mt-2 text-3xl font-semibold leading-none text-slate-900">{kpi.value}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: "Hired this month", value: `${dashboard.hiredThisMonth}`, sub: "Successful placements" },
              { label: "Avg time to hire", value: `${dashboard.avgTimeToHireDays}d`, sub: "Rolling average" },
              { label: "Offer acceptance rate", value: `${dashboard.offerAcceptanceRate}%`, sub: "Accepted ÷ extended" },
            ].map((kpi) => (
              <div key={kpi.label} className={kpiTileClass}>
                <div className="text-xs font-medium uppercase tracking-wider text-slate-500">{kpi.label}</div>
                <div className="mt-2 text-3xl font-semibold leading-none text-slate-900">{kpi.value}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className={`${panelClass} p-5`}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-800">Pipeline funnel</h3>
                <span className="text-xs text-slate-500">By stage</span>
              </div>
              <div className="space-y-2.5">
                {STAGES.map((st) => {
                  const count = dashboard.pipelineByStage[st] || 0;
                  const max = Math.max(...Object.values(dashboard.pipelineByStage), 1);
                  const width = `${Math.max(8, Math.round((count / max) * 100))}%`;
                  return (
                    <div key={st} className="flex items-center gap-3">
                      <span className="w-28 shrink-0 text-xs text-slate-600">{st}</span>
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <div className="h-2 flex-1 rounded-full bg-slate-100">
                          <div
                            className="h-2 min-w-[6px] rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-all"
                            style={{ width: count > 0 ? width : "0%" }}
                          />
                        </div>
                        <span className="w-6 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-800">{count}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className={`${panelClass} p-5`}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-800">Upcoming interviews</h3>
                <span className="text-xs text-slate-500">Next five</span>
              </div>
              {dashboard.upcomingInterviews.length === 0 && (
                <p className="py-8 text-center text-sm text-slate-500">No upcoming interviews.</p>
              )}
              <div className="space-y-2">
                {dashboard.upcomingInterviews.slice(0, 5).map((iv) => (
                  <div
                    key={iv.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/90 px-3 py-2.5 transition hover:border-slate-300 hover:bg-slate-50/70"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-800">{iv.title}</div>
                      <div className="text-xs text-slate-500">
                        {iv.candidateName} · {formatBusinessDateTime(iv.scheduledAt)}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-800">
                      {iv.interviewType || "Interview"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {dashboard.recentActivities.length > 0 && (
            <div className={`${panelClass} p-5`}>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Recent activity</h3>
                  <p className="text-xs text-slate-500">Recruitment events</p>
                </div>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                  {dashboard.recentActivities.length} items
                </span>
              </div>
              <div className="max-h-[min(320px,50vh)] space-y-2.5 overflow-y-auto pr-1">
                {dashboard.recentActivities.map((a) => (
                  <div
                    key={a.id}
                    className="grid grid-cols-[88px_1fr] items-start gap-3 rounded-xl border border-slate-200/90 px-3 py-2.5 transition hover:border-slate-300 hover:bg-slate-50/70"
                  >
                    <div className="pt-0.5 text-[11px] font-medium text-slate-500">{formatBusinessDateTime(a.performedAt)}</div>
                    <div className="min-w-0">
                      <div className="mb-0.5 flex items-center gap-2">
                        <span
                          className={`inline-flex h-2 w-2 shrink-0 rounded-full ${
                            a.activityType === "Hired"
                              ? "bg-emerald-500"
                              : a.activityType === "StageChange"
                                ? "bg-[#2E7BBF]"
                                : "bg-slate-400"
                          }`}
                        />
                        <strong className="truncate text-sm text-slate-800">{a.activityType || "Activity"}</strong>
                      </div>
                      <div className="text-sm text-slate-600">{a.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Requisitions Tab ───────────────────────────────── */}
      {tab === "Requisitions" && (
        <div className="mt-6 space-y-4">
          <div className={`flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm`}>
            <div className="w-40 shrink-0">
              <FormSelect
                value={filterReqStatus}
                onValueChange={(v) => { setFilterReqStatus(v); setReqPage(1); }}
                options={REQ_STATUS_FILTER_OPTS}
                placeholder="All Statuses"
              />
            </div>
            <div className="w-40 shrink-0">
              <FormSelect
                value={filterReqPriority}
                onValueChange={(v) => { setFilterReqPriority(v); setReqPage(1); }}
                options={REQ_PRIORITY_FILTER_OPTS}
                placeholder="All Priorities"
              />
            </div>
            <div className="flex-1" />
            <Button onClick={() => setShowCreate(true)}>+ New Requisition</Button>
          </div>

          <div className={`${panelClass} overflow-x-auto`}>
            <table className="hris-table">
              <thead>
                <tr>
                  <th>Code</th><th>Title</th><th>Department</th><th>Vacancies</th>
                  <th>Priority</th><th>Status</th><th>Candidates</th><th>Target Date</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requisitions.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium">{r.code}</td>
                    <td>{r.title}</td>
                    <td>{r.departmentName}</td>
                    <td>{r.vacancies}</td>
                    <td>
                      {r.priority && (
                        <span className={`badge ${r.priority === "High" ? "badge-red" : r.priority === "Medium" ? "badge-yellow" : "badge-green"}`}>
                          {r.priority}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${r.status === "Approved" ? "badge-green" : r.status === "Rejected" ? "badge-red" : "badge-yellow"}`}>
                        {r.status}
                      </span>
                    </td>
                    <td>{r.candidateCount}</td>
                    <td>{r.targetDate ? formatDate(r.targetDate) : "-"}</td>
                    <td>
                      <div className="flex flex-wrap gap-x-2 gap-y-1">
                        <Link href={ROUTES.recruitmentRequisition(r.id)} className="text-xs text-slate-700 hover:underline">
                          View
                        </Link>
                        {r.status === "Pending" && (
                          <>
                            <button type="button" onClick={() => handleApproveReq(r.id)} className="text-xs text-green-600 hover:underline">Approve</button>
                            <button type="button" onClick={() => handleRejectReq(r.id)} className="text-xs text-rose-600 hover:underline">Reject</button>
                          </>
                        )}
                        <button onClick={() => setEditReq(r)} className="text-xs text-blue-600 hover:underline">Edit</button>
                        {r.status === "Approved" && !r.closedAt && (
                          <button onClick={() => handleCloseReq(r.id)} className="text-xs text-orange-600 hover:underline">Close</button>
                        )}
                        <button onClick={() => handleDeleteReq(r.id)} className="text-xs text-red-600 hover:underline">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {requisitions.length === 0 && (
                  <tr><td colSpan={9} className="text-center text-slate-500">No requisitions found</td></tr>
                )}
              </tbody>
            </table>
            <TablePagination
              page={reqPage}
              totalPages={Math.max(1, Math.ceil(reqTotalCount / REQ_PAGE_SIZE))}
              totalCount={reqTotalCount}
              pageSize={REQ_PAGE_SIZE}
              onPageChange={setReqPage}
              alwaysShow
            />
          </div>
        </div>
      )}

      {/* ── Candidates Tab ─────────────────────────────────── */}
      {tab === "Candidates" && (
        <div className="mt-6 space-y-4">
          <div className={`flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm`}>
            <input
              placeholder="Search candidates… (Enter)"
              value={candSearchFilter.input}
              onChange={(e) => candSearchFilter.setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  candSearchFilter.apply();
                  setCandPage(1);
                }
              }}
              className={`${inputClass} w-52`}
            />
            <div className="w-48 shrink-0">
              <FormSelect
                value={filterCandReq}
                onValueChange={setFilterCandReq}
                options={candReqFilterOpts}
                placeholder="All Requisitions"
              />
            </div>
            {candidateView === "table" && (
              <div className="w-40 shrink-0">
                <FormSelect
                  value={filterCandStage}
                  onValueChange={setFilterCandStage}
                  options={candStageFilterOpts}
                  placeholder="All Stages"
                />
              </div>
            )}
            <div className="flex-1" />
            <div className="flex items-center gap-0.5 rounded-xl border border-slate-200 bg-slate-50/80 p-0.5">
              <button
                type="button"
                onClick={() => setCandidateView("kanban")}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  candidateView === "kanban" ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-white/80"
                }`}
              >
                Kanban
              </button>
              <button
                type="button"
                onClick={() => setCandidateView("table")}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  candidateView === "table" ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-white/80"
                }`}
              >
                Table
              </button>
            </div>
            <Button onClick={() => setShowAddCandidate(true)}>+ Add Candidate</Button>
          </div>

          {candidateView === "kanban" ? (
            <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: 400 }}>
              {STAGES.map((stage) => {
                const stageCands = candidates.filter((c) => c.stage === stage);
                return (
                  <div
                    key={stage}
                    className="w-56 shrink-0 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 shadow-sm"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (dragCandidate) { handleStageChange(dragCandidate, stage); setDragCandidate(null); }
                    }}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STAGE_COLORS[stage] || "bg-slate-100 text-slate-700"}`}>
                        {stage}
                      </span>
                      <span className="text-xs font-medium text-slate-500">{stageCands.length}</span>
                    </div>
                    <div className="space-y-2">
                      {stageCands.map((c) => (
                        <Link key={c.id} href={`/app/recruitment/candidate/${c.id}`}>
                          <div
                            draggable
                            onDragStart={() => setDragCandidate(c.id)}
                            className="cursor-grab rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300 hover:shadow-md"
                          >
                            <div className="text-sm font-medium text-slate-800">{c.fullName}</div>
                            <div className="text-xs text-slate-500">{c.requisitionTitle}</div>
                            <div className="mt-1 flex items-center justify-between">
                              <span className="text-xs text-slate-500">{c.source}</span>
                              {c.rating ? <span className="text-xs text-amber-500">{"★".repeat(c.rating)}</span> : null}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={`${panelClass} overflow-x-auto`}>
              <table className="hris-table">
                <thead>
                  <tr>
                    <th>Name</th><th>Email</th><th>Requisition</th><th>Stage</th>
                    <th>Source</th><th>Rating</th><th>Applied</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/app/recruitment/candidate/${c.id}`} className="font-medium text-[#2E7BBF] hover:underline">
                          {c.fullName}
                        </Link>
                      </td>
                      <td>{c.email}</td>
                      <td>{c.requisitionTitle}</td>
                      <td>
                        <span className={`badge text-xs ${STAGE_COLORS[c.stage] || "bg-gray-100 text-gray-700"}`}>{c.stage}</span>
                      </td>
                      <td>{c.source}</td>
                      <td>{c.rating ? "★".repeat(c.rating) : "-"}</td>
                      <td>{formatBusinessDateTime(c.appliedAt)}</td>
                      <td>
                        <Link href={`/app/recruitment/candidate/${c.id}`} className="text-xs text-[#2E7BBF] hover:underline">View</Link>
                      </td>
                    </tr>
                  ))}
                  {candidates.length === 0 && (
                    <tr><td colSpan={8} className="text-center text-slate-500">No candidates found</td></tr>
                  )}
                </tbody>
              </table>
              <TablePagination
                page={candPage}
                totalPages={Math.max(1, Math.ceil(candTotalCount / CAND_PAGE_SIZE))}
                totalCount={candTotalCount}
                pageSize={CAND_PAGE_SIZE}
                onPageChange={setCandPage}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Interviews Tab ─────────────────────────────────── */}
      {tab === "Interviews" && (
        <div className="mt-6 space-y-4">
          <div className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm`}>
            <div>
              <h3 className="text-base font-semibold text-slate-800">Upcoming interviews</h3>
              <p className="text-xs text-slate-500">Scheduled sessions from the recruitment calendar</p>
            </div>
            <Button
              onClick={() => {
                setScheduleForm({ duration: 60 });
                setScheduleTitleManual(false);
                setScheduleMeetingLink("");
                setScheduleNotifyCandidateEmail(true);
                setScheduleNotifyInterviewerEmail(true);
                setScheduleModal(true);
              }}
            >
              + Schedule Interview
            </Button>
          </div>

          <div className={`${panelClass} overflow-x-auto`}>
            <table className="hris-table">
              <thead>
                <tr>
                  <th>Title</th><th>Candidate</th><th>Requisition</th>
                  <th>Scheduled</th><th>Duration</th><th>Interviewer</th>
                  <th>Type</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {interviews.map((iv) => (
                  <tr key={iv.id}>
                    <td className="font-medium">{iv.title}</td>
                    <td>{iv.candidateName}</td>
                    <td>{iv.requisitionTitle}</td>
                    <td>{formatBusinessDateTime(iv.scheduledAt)}</td>
                    <td>{iv.duration} min</td>
                    <td>{iv.interviewerName || "-"}</td>
                    <td>{iv.interviewType || "-"}</td>
                    <td>
                      <span className={`badge ${iv.status === "Completed" ? "badge-green" : iv.status === "Cancelled" ? "badge-red" : "badge-blue"}`}>
                        {iv.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {interviews.length === 0 && (
                  <tr><td colSpan={8} className="text-center text-slate-500">No upcoming interviews</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Offer Letter History Tab ───────────────────────── */}
      {tab === "Offer Letter History" && (
        <div className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div>
              <h3 className="text-base font-semibold text-slate-800">Offer letter history</h3>
              <p className="text-xs text-slate-500">Saved offer letters across all candidates</p>
            </div>
          </div>

          <div className={`${panelClass} overflow-x-auto`}>
            <table className="hris-table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Position</th>
                  <th>Requisition</th>
                  <th>Salary</th>
                  <th>Offer date</th>
                  <th>Joining date</th>
                  <th>Status</th>
                  <th>Letter</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {offerHistory.map((offer) => (
                  <tr key={offer.id}>
                    <td>
                      <Link href={`/app/recruitment/candidate/${offer.candidateId}`} className="font-medium text-[#2E7BBF] hover:underline">
                        {offer.candidateName || "—"}
                      </Link>
                    </td>
                    <td>{offer.positionTitle || "—"}</td>
                    <td>{offer.requisitionTitle || "—"}</td>
                    <td>{offer.currency ?? "LKR"} {offer.salaryOffered.toLocaleString()}</td>
                    <td>{formatDate(offer.offerDate)}</td>
                    <td>{offer.joiningDate ? formatDate(offer.joiningDate) : "—"}</td>
                    <td>
                      <span className={`badge ${
                        offer.status === "Approved" ? "badge-green"
                          : offer.status === "Rejected" ? "badge-red"
                            : "badge-yellow"
                      }`}>
                        {offer.status}
                      </span>
                    </td>
                    <td>{offer.hasLetter ? "Saved" : "—"}</td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        {offer.hasLetter && (
                          <button
                            type="button"
                            onClick={() => void handleViewOfferLetter(offer.id)}
                            disabled={viewOfferLoading}
                            className="text-sm font-medium text-[#2E7BBF] hover:underline disabled:opacity-50"
                          >
                            View letter
                          </button>
                        )}
                        <Link
                          href={`/app/recruitment/candidate/${offer.candidateId}`}
                          className="text-sm font-medium text-slate-600 hover:underline"
                        >
                          Open candidate
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
                {offerHistory.length === 0 && (
                  <tr><td colSpan={9} className="text-center text-slate-500">No offer letters yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Interview History Tab ──────────────────────────── */}
      {tab === "Interview History" && (
        <div className="mt-6 space-y-4">
          <div className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm`}>
            <div>
              <h3 className="text-base font-semibold text-slate-800">Interview history</h3>
              <p className="text-xs text-slate-500">Completed, cancelled, and past scheduled sessions</p>
            </div>
          </div>

          <div className={`${panelClass} overflow-x-auto`}>
            <table className="hris-table">
              <thead>
                <tr>
                  <th>Title</th><th>Candidate</th><th>Requisition</th>
                  <th>Scheduled</th><th>Duration</th><th>Interviewer</th>
                  <th>Type</th><th>Location / Link</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {interviewHistory.map((iv) => (
                  <tr key={iv.id}>
                    <td className="font-medium">{iv.title}</td>
                    <td>
                      {iv.candidateId ? (
                        <Link href={`/app/recruitment/candidate/${iv.candidateId}`} className="text-[#2E7BBF] hover:underline">
                          {iv.candidateName}
                        </Link>
                      ) : (iv.candidateName || "-")}
                    </td>
                    <td>{iv.requisitionTitle || "-"}</td>
                    <td>{formatBusinessDateTime(iv.scheduledAt)}</td>
                    <td>{iv.duration} min</td>
                    <td>{iv.interviewerName || "-"}</td>
                    <td>{iv.interviewType || "-"}</td>
                    <td className="max-w-[12rem] truncate" title={iv.location || undefined}>{iv.location || "-"}</td>
                    <td>
                      <span className={`badge ${iv.status === "Completed" ? "badge-green" : iv.status === "Cancelled" ? "badge-red" : "badge-yellow"}`}>
                        {iv.status}
                      </span>
                    </td>
                    <td>
                      {iv.candidateStage === "Rejected" && iv.candidateId && (
                        <button
                          type="button"
                          onClick={() => void handleReinterview(iv.candidateId, iv.candidateName, iv.interviewerId)}
                          className="text-sm font-medium text-[#2E7BBF] hover:underline"
                        >
                          Re-interview
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {interviewHistory.length === 0 && (
                  <tr><td colSpan={10} className="text-center text-slate-500">No interview history yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────── */}
      {viewOfferModal && (
        <Modal
          open
          wide
          title={`Offer letter — ${viewOfferModal.candidateName ?? "Candidate"}`}
          onClose={() => setViewOfferModal(null)}
        >
          <div className="space-y-3 px-1 pb-1">
            <div className="flex flex-wrap gap-4 text-sm text-slate-600">
              <span><strong className="text-slate-800">Salary:</strong> {viewOfferModal.currency ?? "LKR"} {viewOfferModal.salaryOffered.toLocaleString()}</span>
              <span><strong className="text-slate-800">Offer date:</strong> {formatDate(viewOfferModal.offerDate)}</span>
              <span><strong className="text-slate-800">Status:</strong> {viewOfferModal.status}</span>
            </div>
            {viewOfferModal.letterHtml?.trim() ? (
              <div
                className="prose prose-sm max-w-none rounded-xl border border-slate-200 bg-white p-4"
                dangerouslySetInnerHTML={{ __html: viewOfferModal.letterHtml }}
              />
            ) : (
              <p className="text-sm text-slate-500">No letter content saved for this offer.</p>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <Link
                href={`/app/recruitment/candidate/${viewOfferModal.candidateId}`}
                className="text-sm font-medium text-[#2E7BBF] hover:underline"
              >
                Open candidate offer
              </Link>
            </div>
          </div>
        </Modal>
      )}

      <CreateRequisitionModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(created) => {
          loadRequisitions();
          router.push(ROUTES.recruitmentRequisition(created.id));
        }}
      />

      {editReq && (
        <EditRequisitionModal
          requisition={editReq}
          onClose={() => setEditReq(null)}
          onSaved={() => { setEditReq(null); loadRequisitions(); }}
        />
      )}

      {scheduleModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 pt-16 pb-10"
          onClick={(e) => { if (e.target === e.currentTarget) setScheduleModal(false); }}>
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Schedule Interview</h2>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Candidate *</label>
                <FormSelect
                  value={scheduleForm.candidateId || ""}
                  onValueChange={(v) => setScheduleForm({ ...scheduleForm, candidateId: v })}
                  options={scheduleCandidateOpts}
                  placeholder="Select candidate…"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Title *</label>
                <FormSelect
                  value={scheduleForm.title || ""}
                  onValueChange={(v) => {
                    const cand = candidates.find((c) => c.id === scheduleForm.candidateId);
                    const inferred = inferInterviewTypeFromTitle(v, cand?.fullName);
                    if (inferred !== "Video") setScheduleMeetingLink("");
                    setScheduleTitleManual(false);
                    setScheduleForm((prev) => ({
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
                <p className="mt-1 text-[11px] text-slate-500">
                  Title and type stay in sync — change either field to update the other.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Date & Time *</label>
                  <DateTimePickerField
                    className={inputClass}
                    value={scheduleForm.scheduledAt ? String(scheduleForm.scheduledAt).slice(0, 16) : ""}
                    onChange={(v) => setScheduleForm({ ...scheduleForm, scheduledAt: v })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Duration (min)</label>
                  <input type="number" className={inputClass} value={scheduleForm.duration || 60}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, duration: Number(e.target.value) })} />
                </div>
              </div>
              <div className={`grid gap-3 ${scheduleForm.interviewType === "Phone" ? "grid-cols-1" : "sm:grid-cols-2"}`}>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Type</label>
                  <FormSelect
                    value={scheduleForm.interviewType || ""}
                    onValueChange={(v) => {
                      setScheduleTitleManual(false);
                      setScheduleForm((prev) => ({
                        ...prev,
                        interviewType: v,
                        location: v === "Onsite" ? prev.location : "",
                      }));
                      if (v !== "Video") setScheduleMeetingLink("");
                    }}
                    options={INTERVIEW_TYPE_OPTS}
                    placeholder="Select type…"
                  />
                </div>
                {scheduleForm.interviewType === "Video" && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Meeting link</label>
                    <input
                      className={inputClass}
                      placeholder="https://teams.microsoft.com/…"
                      value={scheduleMeetingLink}
                      onChange={(e) => setScheduleMeetingLink(e.target.value)}
                    />
                  </div>
                )}
                {scheduleForm.interviewType === "Onsite" && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Location</label>
                    <FormSelect
                      value={scheduleForm.location || ""}
                      onValueChange={(v) => setScheduleForm({ ...scheduleForm, location: v })}
                      options={scheduleOnsiteLocationOpts}
                      placeholder="Select location…"
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Interviewer</label>
                <FormSelect
                  value={scheduleForm.interviewerId || ""}
                  onValueChange={(v) =>
                    setScheduleForm({
                      ...scheduleForm,
                      interviewerId: v || undefined,
                      interviewerName: v ? scheduleLookups.interviewers.find((e) => e.id === v)?.name : undefined,
                    })
                  }
                  options={scheduleInterviewerOpts}
                  placeholder="Select interviewer…"
                />
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-3">
                <p className="mb-2 text-xs font-semibold text-slate-800">Email notifications</p>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-[#2E7BBF] focus:ring-[#2E7BBF]/25"
                    checked={scheduleNotifyCandidateEmail}
                    onChange={(e) => setScheduleNotifyCandidateEmail(e.target.checked)}
                  />
                  <span>
                    Email interview details to the candidate
                    {scheduleForm.candidateId ? (
                      <> ({candidates.find((c) => c.id === scheduleForm.candidateId)?.email || "no email on record"})</>
                    ) : (
                      <> (uses email on the candidate record)</>
                    )}
                  </span>
                </label>
                <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-[#2E7BBF] focus:ring-[#2E7BBF]/25"
                    checked={scheduleNotifyInterviewerEmail}
                    onChange={(e) => setScheduleNotifyInterviewerEmail(e.target.checked)}
                    disabled={!scheduleForm.interviewerId}
                  />
                  Send calendar-style details to interviewer (work email)
                </label>
                {!scheduleForm.interviewerId && (
                  <p className="mt-1 text-[11px] text-slate-500">Select an interviewer to enable interviewer email.</p>
                )}
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setScheduleModal(false)}>Cancel</Button>
              <Button onClick={handleScheduleInterview}>Schedule</Button>
            </div>
          </div>
        </div>
      )}

      {showAddCandidate && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 pt-16 pb-10"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddCandidate(false); }}>
          <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Add Candidate</h2>
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">First Name *</label>
                  <PersonNameInput className={inputClass} value={candidateForm.firstName}
                    onChange={(e) => setCandidateForm({ ...candidateForm, firstName: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Last Name *</label>
                  <PersonNameInput className={inputClass} value={candidateForm.lastName} autoComplete="family-name"
                    onChange={(e) => setCandidateForm({ ...candidateForm, lastName: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Email *</label>
                  <input type="email" pattern="[^\s@]+@[^\s@]+\.[^\s@]{2,}" title="Enter a valid email (e.g. name@example.com)" className={inputClass} value={candidateForm.email}
                    onChange={(e) => setCandidateForm({ ...candidateForm, email: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Phone</label>
                  <PhoneInput className={inputClass} value={candidateForm.phone}
                    onChange={(e) => setCandidateForm({ ...candidateForm, phone: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Requisition *</label>
                  <FormSelect
                    value={candidateForm.requisitionId}
                    onValueChange={(v) => setCandidateForm({ ...candidateForm, requisitionId: v })}
                    options={addCandidateReqOpts}
                    placeholder="Select requisition…"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Source</label>
                  <FormSelect
                    value={candidateForm.source}
                    onValueChange={(v) => setCandidateForm({ ...candidateForm, source: v })}
                    options={CANDIDATE_SOURCE_OPTS}
                    placeholder="Select…"
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Current Title</label>
                  <input className={inputClass} value={candidateForm.currentTitle}
                    onChange={(e) => setCandidateForm({ ...candidateForm, currentTitle: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Current Company</label>
                  <input className={inputClass} value={candidateForm.currentCompany}
                    onChange={(e) => setCandidateForm({ ...candidateForm, currentCompany: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Expected Salary</label>
                  <input type="number" className={inputClass} value={candidateForm.expectedSalary}
                    onChange={(e) => setCandidateForm({ ...candidateForm, expectedSalary: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Notice Period</label>
                  <input className={inputClass} placeholder="e.g. 30 days" value={candidateForm.noticePeriod}
                    onChange={(e) => setCandidateForm({ ...candidateForm, noticePeriod: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Tags</label>
                  <input className={inputClass} placeholder="React, C#, ..." value={candidateForm.tags}
                    onChange={(e) => setCandidateForm({ ...candidateForm, tags: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Notes</label>
                <textarea className={inputClass} rows={2} value={candidateForm.notes}
                  onChange={(e) => setCandidateForm({ ...candidateForm, notes: e.target.value })} />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowAddCandidate(false)}>Cancel</Button>
              <Button onClick={handleAddCandidate}>Add Candidate</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function EditRequisitionModal({ requisition, onClose, onSaved }: { requisition: Requisition; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ ...requisition });
  const [submitting, setSubmitting] = useState(false);
  const [employmentTypes, setEmploymentTypes] = useState<EmploymentTypeCatalogItem[]>([]);
  const inputClass = inputClassSlate;

  useEffect(() => {
    apiFetch<EmploymentTypeCatalogItem[]>("/api/organization/employment-statuses")
      .then(setEmploymentTypes)
      .catch(() => setEmploymentTypes([]));
  }, []);

  const employmentTypeOpts = useMemo(
    () => employmentTypeSelectOptions(employmentTypes, form.employmentType),
    [employmentTypes, form.employmentType]
  );

  const employmentTypeFormOpts = useMemo<FormSelectOption[]>(
    () => [{ value: "", label: "Select…" }, ...employmentTypeOpts],
    [employmentTypeOpts]
  );

  const handleSave = async () => {
    setSubmitting(true);
    try {
      await apiFetch(`/api/recruitment/requisitions/${requisition.id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: form.title, code: form.code, description: form.description,
          vacancies: form.vacancies, targetDate: form.targetDate || null,
          priority: form.priority || null, employmentType: form.employmentType || null,
          experienceMin: form.experienceMin, experienceMax: form.experienceMax,
          salaryMin: form.salaryMin, salaryMax: form.salaryMax, salaryCurrency: form.salaryCurrency || null,
          skills: form.skills || null,
          departmentId: form.departmentId, jobTitleId: form.jobTitleId || null,
          hiringManagerId: form.hiringManagerId || null, locationId: form.locationId || null,
          positionId: form.positionId || null,
          applicationNotificationEmail: form.applicationNotificationEmail?.trim() || null,
        }),
      });
      onSaved();
    } catch { /* */ } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 pt-16 pb-10"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Edit Requisition</h2>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Title</label>
            <input className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Description</label>
            <textarea className={inputClass} rows={2} value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Vacancies</label>
              <input type="number" className={inputClass} value={form.vacancies} onChange={(e) => setForm({ ...form, vacancies: Number(e.target.value) })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Priority</label>
              <FormSelect
                value={form.priority || ""}
                onValueChange={(v) => setForm({ ...form, priority: v })}
                options={REQ_PRIORITY_EDIT_OPTS}
                placeholder="Select…"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Employment Type</label>
              <FormSelect
                value={form.employmentType || ""}
                onValueChange={(v) => setForm({ ...form, employmentType: v })}
                options={employmentTypeFormOpts}
                placeholder="Select…"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Salary currency</label>
              <FormSelect
                value={form.salaryCurrency || DEFAULT_CURRENCY}
                onValueChange={(v) => setForm({ ...form, salaryCurrency: v })}
                options={currencySelectOptions()}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Salary Range (Min)</label>
              <input type="number" className={inputClass} value={form.salaryMin || ""} onChange={(e) => setForm({ ...form, salaryMin: Number(e.target.value) || undefined })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Salary Range (Max)</label>
              <input type="number" className={inputClass} value={form.salaryMax || ""} onChange={(e) => setForm({ ...form, salaryMax: Number(e.target.value) || undefined })} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Skills (comma-separated)</label>
            <input className={inputClass} value={form.skills || ""} onChange={(e) => setForm({ ...form, skills: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Application notification email</label>
            <input
              type="email"
              inputMode="email"
              className={inputClass}
              placeholder="hr@company.com — optional; uses global default if empty"
              value={form.applicationNotificationEmail || ""}
              onChange={(e) => setForm({ ...form, applicationNotificationEmail: e.target.value })}
            />
            <p className="mt-1 text-[11px] text-slate-500">
              New candidate applications for this requisition are emailed here via SendGrid when configured.
            </p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={submitting}>{submitting ? "Saving..." : "Save"}</Button>
        </div>
      </div>
    </div>
  );
}
