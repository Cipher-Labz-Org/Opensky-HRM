"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { Button } from "@/components/ui/Button";
import { DateTimePickerField } from "@/components/ui";
import { CreateRequisitionModal } from "@/components/forms/CreateRequisitionModal";
import { apiFetch } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/date-utils";
import { type EmploymentTypeCatalogItem, employmentTypeSelectOptions } from "@/lib/employment-types";

interface Requisition {
  id: string; title: string; code: string; description?: string; vacancies: number;
  status: string; targetDate?: string; priority?: string; employmentType?: string;
  experienceMin?: number; experienceMax?: number; salaryMin?: number; salaryMax?: number;
  skills?: string; closedAt?: string; departmentName?: string; departmentId: string;
  jobTitleName?: string; jobTitleId?: string; hiringManagerName?: string; hiringManagerId?: string;
  locationName?: string; locationId?: string; positionTitle?: string; positionId?: string;
  candidateCount: number;
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
  candidateId: string; candidateName?: string; requisitionTitle?: string;
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

const TABS = ["Dashboard", "Requisitions", "Candidates", "Interviews"] as const;
const STAGES = ["Sourced", "Screening", "Phone Screen", "Interview", "Evaluation", "Offer", "Hired"];
const STAGE_COLORS: Record<string, string> = {
  Sourced: "bg-gray-100 text-gray-700", Screening: "bg-blue-100 text-blue-700",
  "Phone Screen": "bg-indigo-100 text-indigo-700", Interview: "bg-yellow-100 text-yellow-700",
  Evaluation: "bg-purple-100 text-purple-700", Offer: "bg-orange-100 text-orange-700",
  Hired: "bg-green-100 text-green-700", Rejected: "bg-red-100 text-red-700",
  Withdrawn: "bg-gray-200 text-gray-500",
};

export default function RecruitmentPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Dashboard");
  const [showCreate, setShowCreate] = useState(false);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [filterReqStatus, setFilterReqStatus] = useState("");
  const [filterReqPriority, setFilterReqPriority] = useState("");
  const [filterCandStage, setFilterCandStage] = useState("");
  const [filterCandReq, setFilterCandReq] = useState("");
  const [filterCandSearch, setFilterCandSearch] = useState("");
  const [candidateView, setCandidateView] = useState<"kanban" | "table">("kanban");
  const [dragCandidate, setDragCandidate] = useState<string | null>(null);
  const [editReq, setEditReq] = useState<Requisition | null>(null);
  const [scheduleModal, setScheduleModal] = useState(false);
  const [scheduleForm, setScheduleForm] = useState<Partial<Interview & { candidateId: string }>>({});
  const [showAddCandidate, setShowAddCandidate] = useState(false);
  const [candidateForm, setCandidateForm] = useState({ firstName: "", lastName: "", email: "", phone: "", source: "", requisitionId: "", currentTitle: "", currentCompany: "", expectedSalary: "", noticePeriod: "", notes: "", tags: "" });

  const loadDashboard = useCallback(async () => {
    try { setDashboard(await apiFetch<Dashboard>("/api/recruitment/dashboard")); } catch { /* */ }
  }, []);

  const loadRequisitions = useCallback(async () => {
    try {
      const params = new URLSearchParams({ pageSize: "100" });
      if (filterReqStatus) params.set("status", filterReqStatus);
      if (filterReqPriority) params.set("priority", filterReqPriority);
      const res = await apiFetch<{ items: Requisition[] }>(`/api/recruitment/requisitions?${params}`);
      setRequisitions(res.items);
    } catch { /* */ }
  }, [filterReqStatus, filterReqPriority]);

  const loadCandidates = useCallback(async () => {
    try {
      const params = new URLSearchParams({ pageSize: "200" });
      if (filterCandStage) params.set("stage", filterCandStage);
      if (filterCandReq) params.set("requisitionId", filterCandReq);
      if (filterCandSearch) params.set("search", filterCandSearch);
      const res = await apiFetch<{ items: Candidate[] }>(`/api/recruitment/candidates?${params}`);
      setCandidates(res.items);
    } catch { /* */ }
  }, [filterCandStage, filterCandReq, filterCandSearch]);

  const loadInterviews = useCallback(async () => {
    try { setInterviews(await apiFetch<Interview[]>("/api/recruitment/interviews/upcoming")); } catch { /* */ }
  }, []);

  useEffect(() => {
    if (tab === "Dashboard") loadDashboard();
    if (tab === "Requisitions") loadRequisitions();
    if (tab === "Candidates") { loadCandidates(); loadRequisitions(); }
    if (tab === "Interviews") { loadInterviews(); loadCandidates(); }
  }, [tab, loadDashboard, loadRequisitions, loadCandidates, loadInterviews]);

  const handleApproveReq = async (id: string) => {
    await apiFetch(`/api/recruitment/requisitions/${id}/approve`, { method: "POST" });
    loadRequisitions();
  };

  const handleCloseReq = async (id: string) => {
    await apiFetch(`/api/recruitment/requisitions/${id}/close`, { method: "POST" });
    loadRequisitions();
  };

  const handleDeleteReq = async (id: string) => {
    if (!confirm("Delete this requisition?")) return;
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

  const handleScheduleInterview = async () => {
    if (!scheduleForm.candidateId || !scheduleForm.title || !scheduleForm.scheduledAt) return;
    await apiFetch("/api/recruitment/interviews", {
      method: "POST",
      body: JSON.stringify({
        title: scheduleForm.title, scheduledAt: scheduleForm.scheduledAt,
        duration: scheduleForm.duration || 60, location: scheduleForm.location,
        interviewType: scheduleForm.interviewType, candidateId: scheduleForm.candidateId,
        interviewerName: scheduleForm.interviewerName,
      }),
    });
    setScheduleModal(false);
    setScheduleForm({});
    loadInterviews();
  };

  const handleAddCandidate = async () => {
    if (!candidateForm.firstName || !candidateForm.lastName || !candidateForm.email || !candidateForm.requisitionId) return;
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

  const inputClass = "w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20";

  return (
    <>
      <AppTopbar
        title="Recruitment & Hiring"
        subtitle="Requisitions, candidate pipeline, interviews, offers, and hiring analytics."
      />

      <div className="mb-4 flex items-center gap-2 border-b border-[var(--border)]">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium transition ${tab === t ? "border-b-2 border-[var(--primary)] text-[var(--primary)]" : "text-[var(--text-muted)] hover:text-[var(--text)]"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* ── Dashboard Tab ──────────────────────────────────── */}
      {tab === "Dashboard" && dashboard && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Open Requisitions", value: dashboard.openRequisitions },
              { label: "Candidates in Pipeline", value: dashboard.totalCandidates },
              { label: "Interviews This Week", value: dashboard.interviewsThisWeek },
              { label: "Offers Extended", value: dashboard.offersExtended },
            ].map((kpi) => (
              <div key={kpi.label} className="hris-card kpi-card">
                <div className="kpi-label">{kpi.label}</div>
                <div className="kpi-value">{kpi.value}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="hris-card kpi-card">
              <div className="kpi-label">Hired This Month</div>
              <div className="kpi-value">{dashboard.hiredThisMonth}</div>
            </div>
            <div className="hris-card kpi-card">
              <div className="kpi-label">Avg Time to Hire</div>
              <div className="kpi-value">{dashboard.avgTimeToHireDays}d</div>
            </div>
            <div className="hris-card kpi-card">
              <div className="kpi-label">Offer Acceptance Rate</div>
              <div className="kpi-value">{dashboard.offerAcceptanceRate}%</div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="hris-card">
              <h3 className="mb-3 text-sm font-semibold text-[var(--text)]">Pipeline Funnel</h3>
              <div className="space-y-2">
                {STAGES.map((st) => {
                  const count = dashboard.pipelineByStage[st] || 0;
                  const max = Math.max(...Object.values(dashboard.pipelineByStage), 1);
                  return (
                    <div key={st} className="flex items-center gap-3">
                      <span className="w-24 text-xs text-[var(--text-muted)]">{st}</span>
                      <div className="flex-1 rounded-full bg-gray-100 h-5">
                        <div className="h-5 rounded-full bg-[var(--primary)] flex items-center justify-end pr-2 text-xs text-white font-medium"
                          style={{ width: `${Math.max((count / max) * 100, count > 0 ? 8 : 0)}%`, minWidth: count > 0 ? 30 : 0 }}>
                          {count > 0 && count}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="hris-card">
              <h3 className="mb-3 text-sm font-semibold text-[var(--text)]">Upcoming Interviews</h3>
              {dashboard.upcomingInterviews.length === 0 && <p className="text-sm text-[var(--text-muted)]">No upcoming interviews</p>}
              <div className="space-y-2">
                {dashboard.upcomingInterviews.slice(0, 5).map((iv) => (
                  <div key={iv.id} className="flex items-center justify-between rounded-xl border border-[var(--border)] p-3">
                    <div>
                      <div className="text-sm font-medium">{iv.title}</div>
                      <div className="text-xs text-[var(--text-muted)]">{iv.candidateName} &bull; {formatDateTime(iv.scheduledAt)}</div>
                    </div>
                    <span className="badge badge-blue">{iv.interviewType || "Interview"}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {dashboard.recentActivities.length > 0 && (
            <div className="hris-card">
              <h3 className="mb-3 text-sm font-semibold text-[var(--text)]">Recent Activity</h3>
              <div className="space-y-2">
                {dashboard.recentActivities.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 text-sm">
                    <span className={`inline-block w-2 h-2 rounded-full ${a.activityType === "Hired" ? "bg-green-500" : a.activityType === "StageChange" ? "bg-blue-500" : "bg-gray-400"}`} />
                    <span className="flex-1">{a.description}</span>
                    <span className="text-xs text-[var(--text-muted)]">{formatDateTime(a.performedAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Requisitions Tab ───────────────────────────────── */}
      {tab === "Requisitions" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <select value={filterReqStatus} onChange={(e) => setFilterReqStatus(e.target.value)} className={`${inputClass} w-40`}>
              <option value="">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
            <select value={filterReqPriority} onChange={(e) => setFilterReqPriority(e.target.value)} className={`${inputClass} w-40`}>
              <option value="">All Priorities</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
            <div className="flex-1" />
            <Button onClick={() => setShowCreate(true)}>+ New Requisition</Button>
          </div>

          <div className="overflow-x-auto">
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
                      <div className="flex gap-1">
                        {r.status === "Pending" && (
                          <button onClick={() => handleApproveReq(r.id)} className="text-xs text-green-600 hover:underline">Approve</button>
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
                  <tr><td colSpan={9} className="text-center text-[var(--text-muted)]">No requisitions found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Candidates Tab ─────────────────────────────────── */}
      {tab === "Candidates" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <input placeholder="Search candidates..." value={filterCandSearch}
              onChange={(e) => setFilterCandSearch(e.target.value)}
              className={`${inputClass} w-52`} />
            <select value={filterCandReq} onChange={(e) => setFilterCandReq(e.target.value)} className={`${inputClass} w-48`}>
              <option value="">All Requisitions</option>
              {requisitions.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
            </select>
            {candidateView === "table" && (
              <select value={filterCandStage} onChange={(e) => setFilterCandStage(e.target.value)} className={`${inputClass} w-40`}>
                <option value="">All Stages</option>
                {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            <div className="flex-1" />
            <div className="flex items-center gap-1 rounded-xl border border-[var(--border)] p-0.5">
              <button onClick={() => setCandidateView("kanban")}
                className={`px-3 py-1 rounded-lg text-xs font-medium ${candidateView === "kanban" ? "bg-[var(--primary)] text-white" : "text-[var(--text-muted)]"}`}>
                Kanban
              </button>
              <button onClick={() => setCandidateView("table")}
                className={`px-3 py-1 rounded-lg text-xs font-medium ${candidateView === "table" ? "bg-[var(--primary)] text-white" : "text-[var(--text-muted)]"}`}>
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
                  <div key={stage}
                    className="flex-shrink-0 w-56 rounded-2xl bg-gray-50 border border-[var(--border)] p-3"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (dragCandidate) { handleStageChange(dragCandidate, stage); setDragCandidate(null); }
                    }}>
                    <div className="mb-3 flex items-center justify-between">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STAGE_COLORS[stage] || "bg-gray-100 text-gray-700"}`}>
                        {stage}
                      </span>
                      <span className="text-xs text-[var(--text-muted)]">{stageCands.length}</span>
                    </div>
                    <div className="space-y-2">
                      {stageCands.map((c) => (
                        <Link key={c.id} href={`/app/recruitment/candidate/${c.id}`}>
                          <div draggable onDragStart={() => setDragCandidate(c.id)}
                            className="cursor-grab rounded-xl bg-white p-3 shadow-sm border border-[var(--border)] hover:shadow-md transition">
                            <div className="text-sm font-medium text-[var(--text)]">{c.fullName}</div>
                            <div className="text-xs text-[var(--text-muted)]">{c.requisitionTitle}</div>
                            <div className="mt-1 flex items-center justify-between">
                              <span className="text-xs text-[var(--text-muted)]">{c.source}</span>
                              {c.rating && (
                                <span className="text-xs text-yellow-500">{"★".repeat(c.rating)}</span>
                              )}
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
            <div className="overflow-x-auto">
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
                        <Link href={`/app/recruitment/candidate/${c.id}`} className="text-[var(--primary)] hover:underline font-medium">
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
                      <td>{formatDateTime(c.appliedAt)}</td>
                      <td>
                        <Link href={`/app/recruitment/candidate/${c.id}`} className="text-xs text-blue-600 hover:underline">View</Link>
                      </td>
                    </tr>
                  ))}
                  {candidates.length === 0 && (
                    <tr><td colSpan={8} className="text-center text-[var(--text-muted)]">No candidates found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Interviews Tab ─────────────────────────────────── */}
      {tab === "Interviews" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--text)]">Upcoming Interviews</h3>
            <Button onClick={() => setScheduleModal(true)}>+ Schedule Interview</Button>
          </div>

          <div className="overflow-x-auto">
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
                    <td>{formatDateTime(iv.scheduledAt)}</td>
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
                  <tr><td colSpan={8} className="text-center text-[var(--text-muted)]">No upcoming interviews</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────── */}
      <CreateRequisitionModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => { loadRequisitions(); setTab("Requisitions"); }}
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
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold">Schedule Interview</h2>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Candidate *</label>
                <select className={inputClass} value={scheduleForm.candidateId || ""}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, candidateId: e.target.value })}>
                  <option value="">Select candidate...</option>
                  {candidates.map((c) => <option key={c.id} value={c.id}>{c.fullName}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Title *</label>
                <input className={inputClass} placeholder="Technical Round 1"
                  value={scheduleForm.title || ""}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, title: e.target.value })} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Date & Time *</label>
                  <DateTimePickerField
                    className={inputClass}
                    value={scheduleForm.scheduledAt ? String(scheduleForm.scheduledAt).slice(0, 16) : ""}
                    onChange={(v) => setScheduleForm({ ...scheduleForm, scheduledAt: v })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Duration (min)</label>
                  <input type="number" className={inputClass} value={scheduleForm.duration || 60}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, duration: Number(e.target.value) })} />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Type</label>
                  <select className={inputClass} value={scheduleForm.interviewType || ""}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, interviewType: e.target.value })}>
                    <option value="">Select...</option>
                    <option value="Phone">Phone</option>
                    <option value="Video">Video</option>
                    <option value="Onsite">Onsite</option>
                    <option value="Technical">Technical</option>
                    <option value="HR">HR</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Location</label>
                  <input className={inputClass} placeholder="Room / Link"
                    value={scheduleForm.location || ""}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, location: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Interviewer</label>
                <input className={inputClass} placeholder="Interviewer name"
                  value={scheduleForm.interviewerName || ""}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, interviewerName: e.target.value })} />
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
          <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold">Add Candidate</h2>
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">First Name *</label>
                  <input className={inputClass} value={candidateForm.firstName}
                    onChange={(e) => setCandidateForm({ ...candidateForm, firstName: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Last Name *</label>
                  <input className={inputClass} value={candidateForm.lastName}
                    onChange={(e) => setCandidateForm({ ...candidateForm, lastName: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Email *</label>
                  <input type="email" pattern="[^\s@]+@[^\s@]+\.[^\s@]{2,}" title="Enter a valid email (e.g. name@example.com)" className={inputClass} value={candidateForm.email}
                    onChange={(e) => setCandidateForm({ ...candidateForm, email: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Phone</label>
                  <input className={inputClass} value={candidateForm.phone}
                    onChange={(e) => setCandidateForm({ ...candidateForm, phone: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Requisition *</label>
                  <select className={inputClass} value={candidateForm.requisitionId}
                    onChange={(e) => setCandidateForm({ ...candidateForm, requisitionId: e.target.value })}>
                    <option value="">Select requisition...</option>
                    {requisitions.map((r) => <option key={r.id} value={r.id}>{r.code} — {r.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Source</label>
                  <select className={inputClass} value={candidateForm.source}
                    onChange={(e) => setCandidateForm({ ...candidateForm, source: e.target.value })}>
                    <option value="">Select...</option>
                    <option value="Direct">Direct Application</option>
                    <option value="Referral">Referral</option>
                    <option value="LinkedIn">LinkedIn</option>
                    <option value="Job Board">Job Board</option>
                    <option value="Agency">Agency</option>
                    <option value="Walk-in">Walk-in</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Current Title</label>
                  <input className={inputClass} value={candidateForm.currentTitle}
                    onChange={(e) => setCandidateForm({ ...candidateForm, currentTitle: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Current Company</label>
                  <input className={inputClass} value={candidateForm.currentCompany}
                    onChange={(e) => setCandidateForm({ ...candidateForm, currentCompany: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Expected Salary</label>
                  <input type="number" className={inputClass} value={candidateForm.expectedSalary}
                    onChange={(e) => setCandidateForm({ ...candidateForm, expectedSalary: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Notice Period</label>
                  <input className={inputClass} placeholder="e.g. 30 days" value={candidateForm.noticePeriod}
                    onChange={(e) => setCandidateForm({ ...candidateForm, noticePeriod: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Tags</label>
                  <input className={inputClass} placeholder="React, C#, ..." value={candidateForm.tags}
                    onChange={(e) => setCandidateForm({ ...candidateForm, tags: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Notes</label>
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
  const inputClass = "w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20";

  useEffect(() => {
    apiFetch<EmploymentTypeCatalogItem[]>("/api/organization/employment-statuses")
      .then(setEmploymentTypes)
      .catch(() => setEmploymentTypes([]));
  }, []);

  const employmentTypeOpts = useMemo(
    () => employmentTypeSelectOptions(employmentTypes, form.employmentType),
    [employmentTypes, form.employmentType]
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
          salaryMin: form.salaryMin, salaryMax: form.salaryMax, skills: form.skills || null,
          departmentId: form.departmentId, jobTitleId: form.jobTitleId || null,
          hiringManagerId: form.hiringManagerId || null, locationId: form.locationId || null,
          positionId: form.positionId || null,
        }),
      });
      onSaved();
    } catch { /* */ } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 pt-16 pb-10"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold">Edit Requisition</h2>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Title</label>
              <input className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Code</label>
              <input className={inputClass} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Description</label>
            <textarea className={inputClass} rows={2} value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Vacancies</label>
              <input type="number" className={inputClass} value={form.vacancies} onChange={(e) => setForm({ ...form, vacancies: Number(e.target.value) })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Priority</label>
              <select className={inputClass} value={form.priority || ""} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                <option value="">Select...</option>
                <option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Employment Type</label>
              <select className={inputClass} value={form.employmentType || ""} onChange={(e) => setForm({ ...form, employmentType: e.target.value })}>
                <option value="">Select...</option>
                {employmentTypeOpts.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Salary Range (Min)</label>
              <input type="number" className={inputClass} value={form.salaryMin || ""} onChange={(e) => setForm({ ...form, salaryMin: Number(e.target.value) || undefined })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Salary Range (Max)</label>
              <input type="number" className={inputClass} value={form.salaryMax || ""} onChange={(e) => setForm({ ...form, salaryMax: Number(e.target.value) || undefined })} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Skills (comma-separated)</label>
            <input className={inputClass} value={form.skills || ""} onChange={(e) => setForm({ ...form, skills: e.target.value })} />
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
