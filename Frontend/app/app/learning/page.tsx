"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { Button } from "@/components/ui/Button";
import { CreateCourseModal } from "@/components/forms/CreateCourseModal";
import { apiFetch } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/date-utils";
import { DonutMixChart, formatInt, HorizontalCompareBars } from "@/lib/workspace-charts";

// ──────────────────────────── Types ────────────────────────────

interface Course {
  id: string;
  title: string;
  code: string;
  description: string | null;
  provider: string | null;
  durationHours: number;
  category: string | null;
  isMandatory: boolean;
  isActive: boolean;
}

interface CertSummary {
  certificationId: string;
  name: string;
  assignedCount: number;
  expiringWithin90Days: number;
}

interface SkillCov {
  skillId: string;
  skillName: string;
  employeeCountWithSkill: number;
  totalActiveEmployees: number;
}

interface SkillMatrixRow {
  id: string;
  employeeId: string;
  skillId: string;
  employeeName: string;
  skillName: string;
  proficiencyLevel: number;
  assessedAt: string | null;
  notes: string | null;
}

interface TrainingRow {
  id: string;
  employeeName: string;
  courseTitle: string;
  status: string;
  dueDate: string | null;
  assignedAt: string;
}

type PageTab = "dashboard" | "courses" | "certifications" | "skills" | "assignments";

const PAGE_TABS: { key: PageTab; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "courses", label: "Course catalog" },
  { key: "certifications", label: "Certifications" },
  { key: "skills", label: "Skills & matrix" },
  { key: "assignments", label: "Assignments" },
];

function CardHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
      <h2 className="text-[15px] font-bold text-slate-700">{title}</h2>
      {children}
    </div>
  );
}

function pct(n: number, d: number) {
  if (!d) return "0%";
  return `${Math.round((100 * n) / d)}%`;
}

// ──────────────────────────── Page ────────────────────────────

export default function LearningPage() {
  const [pageTab, setPageTab] = useState<PageTab>("dashboard");
  const [showCreate, setShowCreate] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [certSummaries, setCertSummaries] = useState<CertSummary[]>([]);
  const [skillCov, setSkillCov] = useState<SkillCov[]>([]);
  const [matrixRows, setMatrixRows] = useState<SkillMatrixRow[]>([]);
  const [trainingAssignments, setTrainingAssignments] = useState<TrainingRow[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadErr(null);
    async function safe<T>(path: string, fallback: T): Promise<T> {
      try {
        return await apiFetch<T>(path);
      } catch {
        return fallback;
      }
    }

    try {
      const c = await apiFetch<Course[]>("/api/learning/courses");
      setCourses(c);
      const [cs, sc, sm, ta] = await Promise.all([
        safe<CertSummary[]>("/api/learning/certification-summaries", []),
        safe<SkillCov[]>("/api/learning/skill-coverage", []),
        safe<SkillMatrixRow[]>("/api/learning/skill-matrix", []),
        safe<TrainingRow[]>("/api/learning/training-assignments?overdueOnly=false", []),
      ]);
      setCertSummaries(cs);
      setSkillCov(sc);
      setMatrixRows(sm);
      setTrainingAssignments(ta);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Failed to load learning data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const activeCourses = courses.filter((x) => x.isActive);
  const openAssignments = trainingAssignments.filter(
    (t) => t.status === "Assigned" || t.status === "InProgress",
  );

  const dashboardKpis = useMemo(() => {
    const total = courses.length;
    const act = courses.filter((x) => x.isActive).length;
    const open = trainingAssignments.filter((t) => t.status === "Assigned" || t.status === "InProgress").length;
    const exp = certSummaries.reduce((s, r) => s + r.expiringWithin90Days, 0);
    return [
      {
        label: "Active courses",
        value: formatInt(act),
        sub: `${formatInt(total)} total in catalog`,
      },
      {
        label: "Open assignments",
        value: formatInt(open),
        sub: "Assigned or in progress",
      },
      {
        label: "Certification types",
        value: formatInt(certSummaries.length),
        sub: "Tracked in compliance view",
      },
      {
        label: "Certs expiring ≤90d",
        value: formatInt(exp),
        sub: "Across all certification types",
      },
    ];
  }, [courses, trainingAssignments, certSummaries]);

  const skillCoverageBars = useMemo(() => {
    const colors = ["#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#0ea5e9", "#22c55e", "#f59e0b"];
    return [...skillCov]
      .sort((a, b) => b.employeeCountWithSkill - a.employeeCountWithSkill)
      .slice(0, 8)
      .map((s, i) => ({
        label: s.skillName,
        value: s.employeeCountWithSkill,
        color: colors[i % colors.length],
      }));
  }, [skillCov]);

  const certExpiryBars = useMemo(() => {
    return certSummaries
      .filter((c) => c.expiringWithin90Days > 0)
      .sort((a, b) => b.expiringWithin90Days - a.expiringWithin90Days)
      .slice(0, 10)
      .map((c) => ({
        label: c.name.length > 28 ? `${c.name.slice(0, 26)}…` : c.name,
        value: c.expiringWithin90Days,
        color: "#f59e0b",
      }));
  }, [certSummaries]);

  const certAssignedDonut = useMemo(() => {
    const palette = ["#22c55e", "#3b82f6", "#8b5cf6", "#f59e0b", "#14b8a6", "#ec4899", "#64748b", "#eab308"];
    return certSummaries
      .filter((c) => c.assignedCount > 0)
      .slice(0, 8)
      .map((c, i) => ({
        label: c.name.length > 22 ? `${c.name.slice(0, 20)}…` : c.name,
        value: c.assignedCount,
        color: palette[i % palette.length],
      }));
  }, [certSummaries]);

  const assignmentStatusBars = useMemo(() => {
    const tally = new Map<string, number>();
    for (const t of trainingAssignments) {
      const s = t.status || "Unknown";
      tally.set(s, (tally.get(s) ?? 0) + 1);
    }
    const palette = ["#3b82f6", "#f59e0b", "#22c55e", "#94a3b8", "#ef4444", "#8b5cf6"];
    return Array.from(tally.entries())
      .map(([label, value], i) => ({ label, value, color: palette[i % palette.length] }))
      .sort((a, b) => b.value - a.value);
  }, [trainingAssignments]);

  const assignmentTimeline = useMemo(() => {
    return [...trainingAssignments]
      .sort((a, b) => new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime())
      .slice(0, 8)
      .map((t) => ({
        at: t.assignedAt,
        title: `${t.employeeName} · ${t.courseTitle}`,
        body: `${t.status}${t.dueDate ? ` · Due ${formatDate(t.dueDate)}` : ""}`,
      }));
  }, [trainingAssignments]);

  return (
    <>
      <AppTopbar
        title="Learning & Skills"
        subtitle="Course catalog, training assignments, certifications, and skill matrix."
      />

      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 px-7 py-8 text-slate-900 shadow-sm">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-sky-100/50 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 h-72 w-72 rounded-full bg-indigo-100/40 blur-3xl" />
        <div className="relative z-10">
          <p className="mb-2 inline-flex rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
            Learning workspace
          </p>
          <h2 className="text-2xl font-semibold leading-tight text-slate-900 lg:text-3xl">Skills & development intelligence</h2>
          <p className="mt-3 max-w-2xl text-sm text-slate-600">
            Catalog health, training pipeline, certifications, and skill coverage — same visual language as your Command
            Center dashboard. Use the tabs below for deep lists and maintenance.
          </p>
        </div>
      </section>

      <div className="mt-6 mb-6 flex flex-wrap gap-2">
        {PAGE_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setPageTab(t.key)}
            className={`rounded-xl border px-3.5 py-2.5 text-xs font-semibold transition sm:px-4 sm:text-sm ${
              pageTab === t.key
                ? "border-slate-300 bg-white text-slate-900 shadow-sm"
                : "border-slate-200/90 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loadErr && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{loadErr}</div>
      )}

      <CreateCourseModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={() => refresh()} />

      {pageTab === "dashboard" && (
        <div className="space-y-6">
          {loading && courses.length === 0 && !loadErr ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" />
              ))}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <div className="text-sm text-slate-600">
                  {loading ? "Refreshing…" : `${formatInt(courses.length)} course(s) in catalog`}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" className="min-h-0 rounded-lg px-3 py-1.5 text-xs" onClick={() => refresh()}>
                    Refresh
                  </Button>
                  <Button className="min-h-0 rounded-lg px-3 py-1.5 text-xs" onClick={() => setShowCreate(true)}>
                    + New course
                  </Button>
                </div>
              </div>

              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {dashboardKpis.map((kpi) => (
                  <div
                    key={kpi.label}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="text-xs font-medium uppercase tracking-wider text-slate-500">{kpi.label}</div>
                    <div className="mt-2 text-3xl font-semibold leading-none text-slate-900">{kpi.value}</div>
                    <div className="mt-2 text-xs text-slate-600">{kpi.sub}</div>
                  </div>
                ))}
              </div>

              <div className="grid gap-6 lg:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-base font-semibold text-slate-800">Skill coverage</h3>
                    <span className="text-xs text-slate-500">Top skills</span>
                  </div>
                  {skillCoverageBars.length === 0 ? (
                    <p className="py-8 text-center text-sm text-slate-500">No skill coverage data.</p>
                  ) : (
                    <HorizontalCompareBars items={skillCoverageBars} />
                  )}
                  <p className="mt-2 text-[11px] text-slate-500">Employees with skill recorded (active roster context from API).</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-base font-semibold text-slate-800">Assignment status</h3>
                    <span className="text-xs text-slate-500">All rows</span>
                  </div>
                  {assignmentStatusBars.length === 0 ? (
                    <p className="py-8 text-center text-sm text-slate-500">No assignments loaded.</p>
                  ) : (
                    <HorizontalCompareBars items={assignmentStatusBars} />
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-base font-semibold text-slate-800">Cert. assignments</h3>
                    <span className="text-xs text-slate-500">By type</span>
                  </div>
                  {certAssignedDonut.length === 0 ? (
                    <p className="py-8 text-center text-sm text-slate-500">No certification assignments.</p>
                  ) : (
                    <DonutMixChart values={certAssignedDonut} />
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-slate-800">Certifications expiring (90d)</h3>
                  <span className="text-xs text-slate-500">Where &gt; 0</span>
                </div>
                {certExpiryBars.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500">No expiring certifications in the next 90 days.</p>
                ) : (
                  <HorizontalCompareBars items={certExpiryBars} />
                )}
              </div>

              <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">Recent assignments</h3>
                      <p className="text-xs text-slate-500">Latest by assigned date</p>
                    </div>
                    <Button className="min-h-0 rounded-lg px-3 py-1.5 text-xs" onClick={() => setPageTab("assignments")}>
                      All assignments
                    </Button>
                  </div>
                  {assignmentTimeline.length === 0 ? (
                    <p className="py-10 text-center text-sm text-slate-500">No training assignments yet.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {assignmentTimeline.map((ev, i) => (
                        <div
                          key={`${ev.at}-${i}`}
                          className="group grid grid-cols-[88px_1fr] items-start gap-3 rounded-xl border border-slate-200/90 px-3 py-2.5 transition hover:border-slate-300 hover:bg-slate-50/70"
                        >
                          <div className="pt-0.5 text-[11px] font-medium text-slate-500">{formatDateTime(ev.at)}</div>
                          <div className="min-w-0">
                            <div className="mb-0.5 flex items-center gap-2">
                              <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-teal-500" />
                              <strong className="truncate text-sm text-slate-800">{ev.title}</strong>
                            </div>
                            <div className="line-clamp-2 text-sm text-slate-600">{ev.body}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4">
                    <h3 className="text-base font-semibold text-slate-900">Quick actions</h3>
                    <p className="text-xs text-slate-500">Jump to learning workflows</p>
                  </div>
                  <div className="grid gap-2.5">
                    {(
                      [
                        ["courses", "Course catalog", "View and add courses"],
                        ["assignments", "Assignments", "Review training status"],
                        ["certifications", "Certifications", "Compliance and expiry"],
                        ["skills", "Skills & matrix", "Coverage and proficiency"],
                      ] as const
                    ).map(([key, title, sub]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setPageTab(key)}
                        className="group rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-800">{title}</div>
                            <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">{sub}</div>
                          </div>
                          <span className="mt-0.5 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700">
                            →
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-4">
                  <h4 className="text-base font-semibold text-slate-900">Open training assignments</h4>
                  <p className="text-xs text-slate-500">Assigned or in progress (up to 12 rows)</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-left">
                        <th className="px-6 py-2.5 font-semibold text-slate-600">Employee</th>
                        <th className="px-4 py-2.5 font-semibold text-slate-600">Course</th>
                        <th className="px-4 py-2.5 font-semibold text-slate-600">Status</th>
                        <th className="px-4 py-2.5 font-semibold text-slate-600">Due</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {openAssignments.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-6 text-center text-slate-400">
                            No open assignments.
                          </td>
                        </tr>
                      ) : (
                        openAssignments.slice(0, 12).map((t) => (
                          <tr key={t.id} className="hover:bg-slate-50/50">
                            <td className="px-6 py-3 font-medium text-slate-700">{t.employeeName}</td>
                            <td className="px-4 py-3 text-slate-600">{t.courseTitle}</td>
                            <td className="px-4 py-3 text-slate-600">{t.status}</td>
                            <td className="px-4 py-3 text-slate-600">{formatDate(t.dueDate)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <p className="footer-note">
                Charts use the same payloads as the list tabs. Skill coverage shows the top eight skills by employee count;
                certification donut includes up to eight types with assignments.
              </p>
            </>
          )}
        </div>
      )}

      {pageTab === "courses" && (
        <div className="space-y-6">
          <div className="mb-6 flex items-center justify-between">
            <div className="text-sm text-slate-500">{activeCourses.length} active in catalog</div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => refresh()}>
                Refresh
              </Button>
              <Button onClick={() => setShowCreate(true)}>+ New course</Button>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <CardHeader title="Course catalog" />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="px-6 py-2.5 font-semibold text-slate-600">Title</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-600">Code</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-600">Category</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-600">Hours</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-600">Mandatory</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {courses.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-6 text-center text-slate-400">
                        {loading ? "Loading…" : "No courses yet."}
                      </td>
                    </tr>
                  ) : (
                    courses.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/50">
                        <td className="px-6 py-3 font-medium text-slate-700">{c.title}</td>
                        <td className="px-4 py-3 text-slate-600">{c.code}</td>
                        <td className="px-4 py-3 text-slate-600">{c.category ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{c.durationHours}</td>
                        <td className="px-4 py-3 text-slate-600">{c.isMandatory ? "Yes" : "No"}</td>
                        <td className="px-4 py-3 text-slate-600">{c.isActive ? "Active" : "Inactive"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {pageTab === "certifications" && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <CardHeader title="Certification tracker" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-6 py-2.5 font-semibold text-slate-600">Certification</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Assigned</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Expiring (90d)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {certSummaries.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-6 text-center text-slate-400">
                      No certification data.
                    </td>
                  </tr>
                ) : (
                  certSummaries.map((r) => (
                    <tr key={r.certificationId} className="hover:bg-slate-50/50">
                      <td className="px-6 py-3 font-medium text-slate-700">{r.name}</td>
                      <td className="px-4 py-3 text-slate-600">{r.assignedCount}</td>
                      <td className="px-4 py-3 text-slate-600">{r.expiringWithin90Days}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pageTab === "skills" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <CardHeader title="Skill coverage" />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="px-6 py-2.5 font-semibold text-slate-600">Skill</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-600">Employees</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-600">Coverage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {skillCov.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-6 text-center text-slate-400">
                        No matrix entries.
                      </td>
                    </tr>
                  ) : (
                    skillCov.slice(0, 40).map((r) => (
                      <tr key={r.skillId} className="hover:bg-slate-50/50">
                        <td className="px-6 py-3 font-medium text-slate-700">{r.skillName}</td>
                        <td className="px-4 py-3 text-slate-600">{r.employeeCountWithSkill}</td>
                        <td className="px-4 py-3 text-slate-600">{pct(r.employeeCountWithSkill, r.totalActiveEmployees)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <CardHeader title="Skill matrix" />
            <div className="max-h-[480px] overflow-x-auto overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="sticky top-0 bg-slate-50 text-left">
                    <th className="px-6 py-2.5 font-semibold text-slate-600">Employee</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-600">Skill</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-600">Level</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-600">Assessed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {matrixRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-6 text-center text-slate-400">
                        No rows (check People read scope).
                      </td>
                    </tr>
                  ) : (
                    matrixRows.slice(0, 150).map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/50">
                        <td className="px-6 py-3 font-medium text-slate-700">{m.employeeName}</td>
                        <td className="px-4 py-3 text-slate-600">{m.skillName}</td>
                        <td className="px-4 py-3 text-slate-600">{m.proficiencyLevel}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {formatDateTime(m.assessedAt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {pageTab === "assignments" && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <CardHeader title="Training assignments" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-6 py-2.5 font-semibold text-slate-600">Employee</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Course</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Due</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Assigned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trainingAssignments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-6 text-center text-slate-400">
                      No assignments.
                    </td>
                  </tr>
                ) : (
                  trainingAssignments.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-3 font-medium text-slate-700">{t.employeeName}</td>
                      <td className="px-4 py-3 text-slate-600">{t.courseTitle}</td>
                      <td className="px-4 py-3 text-slate-600">{t.status}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatDate(t.dueDate)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatDateTime(t.assignedAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
