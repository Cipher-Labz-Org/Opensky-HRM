"use client";

import { appAlert } from "@/components/ui/appDialogs";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { DashboardCardHeader, DashboardKpiGrid } from "@/components/dashboard/DashboardUi";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/date-utils";
import { ROUTES } from "@/config/routes";
import { OPENSKY_THEME, softCardShadow } from "@/lib/opensky-theme";

interface AppraisalReviewer {
  id: string;
  reviewerType: string;
  status: string;
  overallRating: number | null;
  overallComments: string | null;
  submittedAt: string | null;
  reviewerEmployeeId: string;
  reviewerName: string;
  responseItems: {
    id: string;
    ratingValue: number | null;
    comment: string | null;
    templateSectionItemId: string;
    itemName: string | null;
    sectionName: string | null;
  }[];
}

interface AppraisalDetail {
  id: string;
  status: string;
  finalRating: number | null;
  finalComments: string | null;
  acknowledgedAt: string | null;
  acknowledgementComment: string | null;
  employeeId: string;
  employeeName: string;
  employeeCode: string | null;
  departmentName: string | null;
  positionName: string | null;
  cycleId: string;
  cycleName: string;
  reviewers: AppraisalReviewer[];
}

interface RatingScaleItem {
  value: number;
  label: string;
  description: string | null;
  color: string | null;
}

interface AppraisalFormItem {
  templateSectionItemId: string;
  name: string;
  description: string | null;
  weight: number;
  currentRating: number | null;
  currentComment: string | null;
  selfRating: number | null;
}

interface AppraisalFormSection {
  sectionId: string;
  name: string;
  description: string | null;
  weight: number;
  items: AppraisalFormItem[];
}

interface AppraisalForm {
  appraisalId: string;
  reviewerId: string;
  reviewerType: string;
  employeeName: string;
  cycleName: string;
  ratingScale: { items: RatingScaleItem[] };
  sections: AppraisalFormSection[];
}

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100";
const labelClass = "mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wide";

const T = OPENSKY_THEME;

const REVIEWER_LABELS: Record<string, string> = {
  Self: "Self assessment",
  Manager: "Manager review",
  Peer: "Peer review",
  DirectReport: "Direct report review",
  External: "External review",
};

const PHASE_COLORS: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-600",
  SelfAssessment: "bg-blue-50 text-blue-700",
  ManagerReview: "bg-violet-50 text-violet-700",
  PeerReview: "bg-amber-50 text-amber-700",
  Calibration: "bg-orange-50 text-orange-700",
  Acknowledgement: "bg-cyan-50 text-cyan-700",
  Completed: "bg-emerald-50 text-emerald-700",
};

const PHASE_LABELS: Record<string, string> = {
  Draft: "Draft",
  SelfAssessment: "Self Assessment",
  ManagerReview: "Manager Review",
  PeerReview: "Peer / 360 Review",
  Calibration: "Calibration",
  Acknowledgement: "Acknowledgement",
  Completed: "Completed",
};

const REVIEWER_ACCENTS: Record<string, { stripe: string; soft: string; text: string; glyph: string }> = {
  Self: { stripe: "#3b82f6", soft: "#eff6ff", text: "#1d4ed8", glyph: "S" },
  Manager: { stripe: "#8b5cf6", soft: "#f5f3ff", text: "#6d28d9", glyph: "M" },
  Peer: { stripe: "#f59e0b", soft: "#fffbeb", text: "#b45309", glyph: "P" },
  DirectReport: { stripe: "#14b8a6", soft: "#f0fdfa", text: "#0f766e", glyph: "D" },
  External: { stripe: "#64748b", soft: "#f8fafc", text: "#475569", glyph: "E" },
};

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default function AppraisalDetailPage() {
  const params = useParams();
  const appraisalId = typeof params.id === "string" ? params.id : "";

  const [appraisal, setAppraisal] = useState<AppraisalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedReviewerId, setExpandedReviewerId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [activeReviewerId, setActiveReviewerId] = useState<string | null>(null);
  const [form, setForm] = useState<AppraisalForm | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [overallComments, setOverallComments] = useState("");
  const [ratings, setRatings] = useState<Record<string, { rating: number | null; comment: string }>>({});

  const loadAppraisal = useCallback(async () => {
    if (!appraisalId) return;
    setLoading(true);
    try {
      const data = await apiFetch<AppraisalDetail>(`/api/appraisal/${appraisalId}`);
      setAppraisal(data);
    } catch (e) {
      await appAlert(e instanceof Error ? e.message : "Failed to load appraisal.");
      setAppraisal(null);
    } finally {
      setLoading(false);
    }
  }, [appraisalId]);

  useEffect(() => {
    void loadAppraisal();
  }, [loadAppraisal]);

  const openReviewForm = async (reviewerId: string) => {
    setActiveReviewerId(reviewerId);
    setFormOpen(true);
    setFormLoading(true);
    setForm(null);
    setOverallComments("");
    setRatings({});
    try {
      const data = await apiFetch<AppraisalForm>(`/api/appraisal/${appraisalId}/form/${reviewerId}`);
      setForm(data);
      setOverallComments(
        appraisal?.reviewers.find((r) => r.id === reviewerId)?.overallComments ?? ""
      );
      const initial: Record<string, { rating: number | null; comment: string }> = {};
      for (const section of data.sections) {
        for (const item of section.items) {
          initial[item.templateSectionItemId] = {
            rating: item.currentRating,
            comment: item.currentComment ?? "",
          };
        }
      }
      setRatings(initial);
    } catch (e) {
      await appAlert(e instanceof Error ? e.message : "Failed to load review form.");
      setFormOpen(false);
    } finally {
      setFormLoading(false);
    }
  };

  const submitReview = async (isFinal: boolean) => {
    if (!activeReviewerId || !form) return;
    setSaving(true);
    try {
      await apiFetch(`/api/appraisal/${appraisalId}/respond/${activeReviewerId}`, {
        method: "POST",
        body: JSON.stringify({
          overallComments: overallComments.trim() || null,
          ratings: Object.entries(ratings).map(([templateSectionItemId, v]) => ({
            templateSectionItemId,
            ratingValue: v.rating,
            comment: v.comment.trim() || null,
          })),
          isFinal,
        }),
      });
      setFormOpen(false);
      await loadAppraisal();
    } catch (e) {
      await appAlert(e instanceof Error ? e.message : "Failed to save review.");
    } finally {
      setSaving(false);
    }
  };

  const sortedReviewers = useMemo(() => {
    if (!appraisal) return [];
    const order = ["Self", "Manager", "Peer", "DirectReport", "External"];
    return [...appraisal.reviewers].sort(
      (a, b) => order.indexOf(a.reviewerType) - order.indexOf(b.reviewerType)
    );
  }, [appraisal]);

  const reviewStats = useMemo(() => {
    if (!appraisal) return { done: 0, total: 0, pct: 0 };
    const total = appraisal.reviewers.length;
    const done = appraisal.reviewers.filter((r) => r.status === "Submitted").length;
    return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
  }, [appraisal]);

  const detailKpis = useMemo(() => {
    if (!appraisal) return [];
    const self = appraisal.reviewers.find((r) => r.reviewerType === "Self");
    const mgr = appraisal.reviewers.find((r) => r.reviewerType === "Manager");
    return [
      {
        label: "Reviews completed",
        value: `${reviewStats.done}/${reviewStats.total}`,
        sub: `${reviewStats.pct}% of assigned reviewers submitted`,
      },
      {
        label: "Self rating",
        value: self?.overallRating != null ? self.overallRating.toFixed(1) : "—",
        sub: self?.status === "Submitted" ? `Submitted ${self.submittedAt ? formatDate(self.submittedAt) : ""}` : "Awaiting self assessment",
      },
      {
        label: "Manager review",
        value: mgr?.overallRating != null ? mgr.overallRating.toFixed(1) : mgr?.status === "InProgress" ? "…" : "—",
        sub: mgr ? (mgr.status === "Submitted" ? `${mgr.reviewerName} · done` : `${mgr.reviewerName} · pending`) : "No manager assigned",
      },
      {
        label: "Final rating",
        value: appraisal.finalRating != null ? appraisal.finalRating.toFixed(1) : "—",
        sub: appraisal.finalRating != null ? "Calibrated score" : "Not finalized yet",
      },
    ];
  }, [appraisal, reviewStats]);

  if (loading) {
    return (
      <>
        <AppTopbar title="Performance Appraisal" subtitle="Loading employee review…" />
        <div className="mt-8 flex flex-col items-center justify-center gap-4 py-20">
          <div
            className="h-12 w-12 animate-spin rounded-full border-4 border-t-transparent"
            style={{ borderColor: `${T.action}33`, borderTopColor: T.action }}
          />
          <p className="text-sm font-medium" style={{ color: T.muted }}>
            Loading appraisal details…
          </p>
        </div>
      </>
    );
  }

  if (!appraisal) {
    return (
      <>
        <AppTopbar title="Appraisal not found" />
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-slate-600">This appraisal could not be found or you do not have access.</p>
          <Link href={ROUTES.performance} className="mt-4 inline-block text-sm font-medium text-blue-600 hover:underline">
            Back to Performance Appraisal
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <AppTopbar title="Performance Appraisal" subtitle={`${appraisal.cycleName} · employee review`} />

      <Link
        href={ROUTES.performance}
        className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold transition hover:underline"
        style={{ color: T.navyMid }}
      >
        <span aria-hidden>←</span>
        Back to dashboard
      </Link>

      {/* Compact profile strip — stats live in KPI row below */}
      <div
        className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 sm:gap-4"
        style={{ borderColor: T.border, backgroundColor: T.surface, boxShadow: softCardShadow }}
      >
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold"
          style={{ backgroundColor: T.accentSoft, color: T.navy }}
        >
          {getInitials(appraisal.employeeName)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2 className="text-base font-bold leading-tight sm:text-lg" style={{ color: T.navy }}>
              {appraisal.employeeName}
            </h2>
            {(appraisal.departmentName || appraisal.positionName) && (
              <span className="hidden text-xs sm:inline" style={{ color: T.muted }}>
                · {[appraisal.positionName, appraisal.departmentName].filter(Boolean).join(" · ")}
              </span>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${PHASE_COLORS[appraisal.status] ?? "bg-slate-100 text-slate-600"}`}
            >
              {PHASE_LABELS[appraisal.status] ?? appraisal.status}
            </span>
            {appraisal.employeeCode && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{ backgroundColor: T.soft, color: T.muted }}
              >
                #{appraisal.employeeCode}
              </span>
            )}
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ backgroundColor: T.actionSoft, color: T.navyMid }}
            >
              <CalendarIcon />
              {appraisal.cycleName}
            </span>
            {appraisal.acknowledgedAt && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                <CheckIcon className="h-3 w-3" />
                Acknowledged
              </span>
            )}
          </div>
        </div>

        <div
          className="flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold"
          style={{ backgroundColor: reviewStats.pct === 100 ? T.accentSoft : T.actionSoft, color: T.navy }}
        >
          <span style={{ color: T.muted }}>Progress</span>
          <span style={{ color: reviewStats.pct === 100 ? "#5FA022" : T.navyMid }}>{reviewStats.pct}%</span>
          <span className="font-normal" style={{ color: T.muted }}>
            ({reviewStats.done}/{reviewStats.total})
          </span>
        </div>
      </div>

      <DashboardKpiGrid items={detailKpis} />

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        {/* Reviewers — main column */}
        <div
          className="overflow-hidden rounded-[22px] border lg:col-span-3"
          style={{ borderColor: T.border, backgroundColor: T.surface, boxShadow: softCardShadow }}
        >
          <div className="border-b px-5 py-4" style={{ borderColor: T.border, backgroundColor: T.soft }}>
            <DashboardCardHeader
              title="Review pipeline"
              subtitle="Track each reviewer’s progress and open their assessment form."
              icon={<UsersIcon />}
              iconBg={T.actionSoft}
              iconColor={T.action}
              compact
            />
          </div>

          <div className="space-y-3 p-4">
            {sortedReviewers.map((reviewer, index) => {
              const expanded = expandedReviewerId === reviewer.id;
              const hasResponses = reviewer.responseItems.length > 0;
              const accent = REVIEWER_ACCENTS[reviewer.reviewerType] ?? REVIEWER_ACCENTS.External;
              const isLast = index === sortedReviewers.length - 1;

              return (
                <div key={reviewer.id} className="relative pl-8">
                  {!isLast && (
                    <span
                      className="absolute left-[15px] top-10 h-[calc(100%+0.75rem)] w-0.5"
                      style={{ backgroundColor: reviewer.status === "Submitted" ? accent.stripe : T.border }}
                      aria-hidden
                    />
                  )}
                  <span
                    className="absolute left-0 top-3 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ring-4 ring-white"
                    style={{
                      backgroundColor: reviewer.status === "Submitted" ? accent.stripe : accent.soft,
                      color: reviewer.status === "Submitted" ? "#fff" : accent.text,
                    }}
                  >
                    {reviewer.status === "Submitted" ? <CheckIcon className="h-3.5 w-3.5" /> : accent.glyph}
                  </span>

                  <div
                    className="overflow-hidden rounded-2xl border transition hover:shadow-md"
                    style={{ borderColor: T.border, backgroundColor: T.surface }}
                  >
                    <div
                      className="flex flex-wrap items-center gap-3 px-4 py-4"
                      style={{ borderLeft: `4px solid ${accent.stripe}` }}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold" style={{ color: T.navy }}>
                          {REVIEWER_LABELS[reviewer.reviewerType] ?? reviewer.reviewerType}
                        </p>
                        <p className="text-xs" style={{ color: T.muted }}>
                          {reviewer.reviewerName}
                        </p>
                      </div>

                      {reviewer.overallRating != null && (
                        <ScoreDisplay rating={reviewer.overallRating} accent={accent} />
                      )}

                      <StatusBadge status={reviewer.status} rating={reviewer.overallRating} />

                      {reviewer.submittedAt && (
                        <span className="text-[11px]" style={{ color: T.muted }}>
                          {formatDate(reviewer.submittedAt)}
                        </span>
                      )}

                      <div className="flex flex-wrap gap-2">
                        {hasResponses && (
                          <button
                            type="button"
                            onClick={() => setExpandedReviewerId(expanded ? null : reviewer.id)}
                            className="rounded-full border px-3 py-1.5 text-xs font-semibold transition hover:bg-slate-50"
                            style={{ borderColor: T.border, color: T.navyMid }}
                          >
                            {expanded ? "Hide details" : "View responses"}
                          </button>
                        )}
                        {reviewer.status !== "Submitted" ? (
                          <Button className="!rounded-full !px-4 !py-1.5 !text-xs" onClick={() => void openReviewForm(reviewer.id)}>
                            {reviewer.status === "InProgress" ? "Continue" : "Start review"}
                          </Button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void openReviewForm(reviewer.id)}
                            className="rounded-full px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
                            style={{ backgroundColor: accent.stripe }}
                          >
                            Open form
                          </button>
                        )}
                      </div>
                    </div>

                    {expanded && hasResponses && (
                      <div className="border-t px-4 py-4" style={{ borderColor: T.border, backgroundColor: T.soft }}>
                        {reviewer.overallComments && (
                          <div
                            className="mb-4 rounded-xl border px-4 py-3 text-sm italic"
                            style={{ borderColor: T.border, backgroundColor: T.surface, color: T.muted }}
                          >
                            &ldquo;{reviewer.overallComments}&rdquo;
                          </div>
                        )}
                        <div className="grid gap-2 sm:grid-cols-2">
                          {reviewer.responseItems.map((item) => (
                            <div
                              key={item.id}
                              className="rounded-xl border px-3 py-2.5"
                              style={{ borderColor: T.border, backgroundColor: T.surface }}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  {item.sectionName && (
                                    <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: T.muted }}>
                                      {item.sectionName}
                                    </p>
                                  )}
                                  <p className="text-sm font-medium" style={{ color: T.navy }}>
                                    {item.itemName ?? "Competency"}
                                  </p>
                                </div>
                                {item.ratingValue != null ? (
                                  <ScoreDisplay rating={item.ratingValue} accent={accent} compact />
                                ) : (
                                  <span className="text-sm font-medium" style={{ color: T.muted }}>
                                    —
                                  </span>
                                )}
                              </div>
                              {item.comment && (
                                <p className="mt-1.5 text-xs leading-relaxed" style={{ color: T.muted }}>
                                  {item.comment}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {sortedReviewers.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-sm font-medium" style={{ color: T.navy }}>
                  No reviewers yet
                </p>
                <p className="mt-1 text-xs" style={{ color: T.muted }}>
                  Reviewers are assigned when the cycle is activated.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Side panel */}
        <div className="space-y-4 lg:col-span-2">
          <div
            className="rounded-[22px] border p-5"
            style={{ borderColor: T.border, backgroundColor: T.surface, boxShadow: softCardShadow }}
          >
            <DashboardCardHeader
              title="Appraisal summary"
              subtitle="Key details for this review record."
              icon={<DocIcon />}
              iconBg={T.accentSoft}
              iconColor={T.accent}
              compact
            />
            <dl className="mt-4 space-y-3">
              {[
                { label: "Employee", value: appraisal.employeeName },
                { label: "Department", value: appraisal.departmentName ?? "—" },
                { label: "Position", value: appraisal.positionName ?? "—" },
                { label: "Review cycle", value: appraisal.cycleName },
                { label: "Current phase", value: PHASE_LABELS[appraisal.status] ?? appraisal.status },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5"
                  style={{ backgroundColor: T.soft }}
                >
                  <dt className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: T.muted }}>
                    {row.label}
                  </dt>
                  <dd className="text-right text-sm font-medium" style={{ color: T.navy }}>
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {(appraisal.finalComments || appraisal.acknowledgementComment) && (
            <div
              className="rounded-[22px] border p-5"
              style={{ borderColor: T.border, backgroundColor: T.surface, boxShadow: softCardShadow }}
            >
              <DashboardCardHeader title="Notes" subtitle="Final and acknowledgement comments." compact />
              {appraisal.finalComments && (
                <p className="mt-3 rounded-xl px-3 py-2.5 text-sm" style={{ backgroundColor: T.actionSoft, color: T.navy }}>
                  <span className="font-semibold">Final: </span>
                  {appraisal.finalComments}
                </p>
              )}
              {appraisal.acknowledgementComment && (
                <p className="mt-2 rounded-xl px-3 py-2.5 text-sm" style={{ backgroundColor: T.accentSoft, color: T.navy }}>
                  <span className="font-semibold">Acknowledgement: </span>
                  {appraisal.acknowledgementComment}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={form ? `${REVIEWER_LABELS[form.reviewerType] ?? form.reviewerType} — ${form.employeeName}` : "Review form"}
        wide
      >
        {formLoading || !form ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
          </div>
        ) : (
          <div className="max-h-[70vh] space-y-6 overflow-y-auto pr-1">
            {form.sections.map((section) => (
              <div key={section.sectionId} className="rounded-xl border border-slate-200 p-4">
                <h3 className="font-semibold text-slate-800">{section.name}</h3>
                {section.description && <p className="mt-1 text-xs text-slate-500">{section.description}</p>}
                <div className="mt-4 space-y-4">
                  {section.items.map((item) => {
                    const entry = ratings[item.templateSectionItemId] ?? { rating: null, comment: "" };
                    return (
                      <div key={item.templateSectionItemId} className="rounded-lg bg-slate-50 p-3">
                        <p className="text-sm font-medium text-slate-800">{item.name}</p>
                        {item.description && <p className="mt-0.5 text-xs text-slate-500">{item.description}</p>}
                        {item.selfRating != null && form.reviewerType !== "Self" && (
                          <p className="mt-1 text-xs text-slate-400">Self rating: {item.selfRating}</p>
                        )}
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className={labelClass}>Rating</label>
                            <select
                              value={entry.rating ?? ""}
                              onChange={(e) =>
                                setRatings((prev) => ({
                                  ...prev,
                                  [item.templateSectionItemId]: {
                                    ...entry,
                                    rating: e.target.value ? Number(e.target.value) : null,
                                  },
                                }))
                              }
                              className={inputClass}
                            >
                              <option value="">Select…</option>
                              {form.ratingScale.items.map((scaleItem) => (
                                <option key={scaleItem.value} value={scaleItem.value}>
                                  {scaleItem.value} — {scaleItem.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className={labelClass}>Comment</label>
                            <input
                              type="text"
                              value={entry.comment}
                              onChange={(e) =>
                                setRatings((prev) => ({
                                  ...prev,
                                  [item.templateSectionItemId]: { ...entry, comment: e.target.value },
                                }))
                              }
                              className={inputClass}
                              placeholder="Optional"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            <div>
              <label className={labelClass}>Overall comments</label>
              <textarea
                value={overallComments}
                onChange={(e) => setOverallComments(e.target.value)}
                rows={3}
                className={inputClass}
                placeholder="Summary comments for this review"
              />
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void submitReview(false)}
                className="rounded-full border border-blue-200 bg-blue-50 px-5 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save draft"}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void submitReview(true)}
                className="rounded-full bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Submitting…" : "Submit review"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

function ScoreDisplay({
  rating,
  accent,
  compact = false,
}: {
  rating: number;
  accent: { stripe: string; soft: string; text: string };
  compact?: boolean;
}) {
  const maxStars = 5;
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl text-center ${compact ? "min-w-[3.25rem] px-2 py-1.5" : "min-w-[4.5rem] px-3 py-2"}`}
      style={{ backgroundColor: accent.soft }}
    >
      <div className="flex items-center gap-0.5">
        <StarIcon filled className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} color={accent.stripe} />
        <span className={`font-bold leading-none ${compact ? "text-xs" : "text-sm"}`} style={{ color: accent.text }}>
          {rating.toFixed(1)}
        </span>
      </div>
      {!compact && (
        <div className="mt-1 flex gap-px" aria-label={`${rating} out of ${maxStars} stars`}>
          {Array.from({ length: maxStars }, (_, i) => (
            <StarIcon key={i} filled={i < Math.round(rating)} className="h-2.5 w-2.5" color={accent.stripe} />
          ))}
        </div>
      )}
      {!compact && (
        <span className="mt-0.5 text-[9px] uppercase tracking-wide" style={{ color: T.muted }}>
          score
        </span>
      )}
    </div>
  );
}

function StarIcon({
  filled = false,
  className = "h-4 w-4",
  color = "#f59e0b",
}: {
  filled?: boolean;
  className?: string;
  color?: string;
}) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden>
      {filled ? (
        <path
          fill={color}
          d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 0 0 .95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 0 0-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 0 0-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 0 0-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 0 0 .951-.69l1.07-3.292Z"
        />
      ) : (
        <path
          fill="none"
          stroke={color}
          strokeOpacity={0.35}
          strokeWidth={1.5}
          d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 0 0 .95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 0 0-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 0 0-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 0 0-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 0 0 .951-.69l1.07-3.292Z"
        />
      )}
    </svg>
  );
}

function StatusBadge({ status, rating }: { status: string; rating: number | null }) {
  if (status === "Submitted")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-100">
        {rating != null ? (
          <>
            <StarIcon filled className="h-3 w-3" color="#059669" />
            {rating.toFixed(1)} · Done
          </>
        ) : (
          "Submitted"
        )}
      </span>
    );
  if (status === "InProgress")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-700 ring-1 ring-amber-100">
        In progress
      </span>
    );
  const phaseLabel = PHASE_LABELS[status];
  if (phaseLabel)
    return (
      <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${PHASE_COLORS[status] ?? "bg-slate-100 text-slate-600"}`}>
        {phaseLabel}
      </span>
    );
  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500 ring-1 ring-slate-200">
      {status || "Pending"}
    </span>
  );
}

function CheckIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.25 7.25a1 1 0 0 1-1.414 0l-3.25-3.25a1 1 0 1 1 1.414-1.414l2.543 2.543 6.543-6.543a1 1 0 0 1 1.414 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M5.75 2a.75.75 0 0 0-.75.75V4H3.5A1.5 1.5 0 0 0 2 5.5v10A1.5 1.5 0 0 0 3.5 17h13a1.5 1.5 0 0 0 1.5-1.5v-10A1.5 1.5 0 0 0 16.5 4h-1.5V2.75a.75.75 0 0 0-1.5 0V4h-4V2.75A.75.75 0 0 0 8 2h-.25ZM4 7.5v8a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 .5-.5v-8H4Z" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M7 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM14.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM1.615 16.428a1.224 1.224 0 0 1-.569-1.175 6.002 6.002 0 0 1 11.908 0c0 .458-.204.892-.569 1.175A9.953 9.953 0 0 1 7 18a9.953 9.953 0 0 1-5.385-1.572ZM14.5 11.25a4.75 4.75 0 0 0-2.606.787 8.002 8.002 0 0 1 3.212 3.212A4.75 4.75 0 0 0 14.5 11.25Z" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M15.98 4.377a1.25 1.25 0 0 0-1.25-1.25h-5.5A1.75 1.75 0 0 0 7.5 4.75v12.5c0 .966.784 1.75 1.75 1.75h7.5A1.75 1.75 0 0 0 18.5 17V5.627a1.25 1.25 0 0 0-.52-1.01l-2-1.25ZM9.25 4.75a.25.25 0 0 1 .25-.25h5.5a.25.25 0 0 1 .25.25v12.5a.25.25 0 0 1-.25.25h-5.5a.25.25 0 0 1-.25-.25V4.75Z" />
    </svg>
  );
}
