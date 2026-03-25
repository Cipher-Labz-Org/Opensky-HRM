"use client";

import { useCallback, useEffect, useState } from "react";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { Button } from "@/components/ui/Button";
import { CreateCourseModal } from "@/components/forms/CreateCourseModal";
import { apiFetch } from "@/lib/api";

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
  const expiringSoon = certSummaries.reduce((s, r) => s + r.expiringWithin90Days, 0);

  const kpis = [
    {
      label: "Active courses",
      value: activeCourses.length,
      icon: "M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v15.128c.918-.304 1.927-.472 3-.472s2.082.168 3 .472V4.512A8.966 8.966 0 0012 6.042z",
      color: "bg-blue-100 text-blue-600",
    },
    {
      label: "Open assignments",
      value: openAssignments.length,
      icon: "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z",
      color: "bg-amber-100 text-amber-600",
    },
    {
      label: "Cert. types tracked",
      value: certSummaries.length,
      icon: "M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z",
      color: "bg-green-100 text-green-600",
    },
    {
      label: "Expiring ≤90 days",
      value: expiringSoon,
      icon: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z",
      color: "bg-purple-100 text-purple-600",
    },
  ];

  return (
    <>
      <AppTopbar
        title="Learning & Skills"
        subtitle="Course catalog, training assignments, certifications, and skill matrix."
      />

      <div className="mb-5 flex items-center gap-2 flex-wrap">
        {PAGE_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setPageTab(t.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${pageTab === t.key ? "bg-blue-600 text-white shadow" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
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
            <div className="py-10 text-center text-sm text-slate-400">Loading…</div>
          ) : (
            <>
          <div className="mb-6 flex items-center justify-between">
            <div className="text-sm text-slate-500">
              {loading ? "Refreshing…" : `${courses.length} course(s) in catalog`}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => refresh()}>
                Refresh
              </Button>
              <Button onClick={() => setShowCreate(true)}>+ New course</Button>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {kpis.map((k) => (
              <div key={k.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${k.color}`}>
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d={k.icon} />
                    </svg>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800">{k.value}</p>
                    <p className="text-xs text-slate-500">{k.label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
              <CardHeader title="Open training assignments" />
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
                          <td className="px-4 py-3 text-slate-600">
                            {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <CardHeader title="Quick actions" />
              <div className="space-y-3 p-6">
                <button
                  type="button"
                  onClick={() => setPageTab("courses")}
                  className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3.5 text-left transition hover:bg-slate-50"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100">
                    <svg className="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Manage catalog</p>
                    <p className="text-xs text-slate-400">View and add courses</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setPageTab("assignments")}
                  className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3.5 text-left transition hover:bg-slate-50"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100">
                    <svg className="h-4 w-4 text-amber-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">All assignments</p>
                    <p className="text-xs text-slate-400">Review training status</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
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
                          {m.assessedAt ? new Date(m.assessedAt).toLocaleDateString() : "—"}
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
                        {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {t.assignedAt ? new Date(t.assignedAt).toLocaleDateString() : "—"}
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
