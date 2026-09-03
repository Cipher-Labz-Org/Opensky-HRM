"use client";

import { appAlert, appConfirm } from "@/components/ui/appDialogs";
import { useState, useEffect, useCallback, useMemo } from "react";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { DatePickerField, TablePagination } from "@/components/ui";
import { useClientPagination } from "@/lib/use-client-pagination";
import { FormSelect } from "@/components/ui/FormSelect";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/date-utils";
import { DonutMixChart, formatInt, HorizontalCompareBars } from "@/lib/workspace-charts";
import Link from "next/link";
import {
  DashboardCardHeader,
  DashboardKpiGrid,
} from "@/components/dashboard/DashboardUi";
import { OPENSKY_THEME } from "@/lib/opensky-theme";

// ── Types ─────────────────────────────────────────────────────

interface RatingScaleItem { id: string; value: number; label: string; description: string | null; color: string | null; }
interface RatingScale { id: string; name: string; description: string | null; isDefault: boolean; isActive: boolean; items: RatingScaleItem[]; }
interface CompetencyDto { id: string; name: string; description: string | null; sortOrder: number; categoryId: string; categoryName: string | null; }
interface CompetencyCategory { id: string; name: string; description: string | null; sortOrder: number; competencies: CompetencyDto[]; }

interface TemplateSectionItem { id: string; name: string; description: string | null; weight: number; sortOrder: number; competencyId: string | null; competencyName: string | null; }
interface TemplateSection { id: string; name: string; description: string | null; weight: number; sortOrder: number; items: TemplateSectionItem[]; }
interface AppraisalTemplate { id: string; name: string; description: string | null; isActive: boolean; ratingScaleId: string; ratingScaleName: string | null; sectionCount: number; sections: TemplateSection[]; }

interface AppraisalCycle { id: string; name: string; description: string | null; cycleType: string; startDate: string; endDate: string; phase: string; includeSelfAssessment: boolean; includeManagerReview: boolean; includePeerReview: boolean; includeDirectReportReview: boolean; includeExternalReview: boolean; includeGoals: boolean; selfWeight: number; managerWeight: number; peerWeight: number; directReportWeight: number; externalWeight: number; selfDeadline: string | null; managerDeadline: string | null; peerDeadline: string | null; completionDeadline: string | null; templateId: string; templateName: string | null; totalAppraisals: number; completedAppraisals: number; }

interface AppraisalReviewer { id: string; reviewerType: string; status: string; overallRating: number | null; reviewerEmployeeId: string; reviewerName: string; submittedAt: string | null; }
interface AppraisalDto { id: string; status: string; finalRating: number | null; employeeId: string; employeeName: string; employeeCode: string | null; departmentName: string | null; positionName: string | null; cycleId: string; cycleName: string; acknowledgedAt: string | null; reviewers: AppraisalReviewer[]; }

interface DashboardData { cycle: AppraisalCycle; totalEmployees: number; selfCompleted: number; managerCompleted: number; peerCompleted: number; fullyCompleted: number; acknowledged: number; ratingDistribution: { label: string; count: number }[]; departmentProgress: { department: string; total: number; completed: number; averageRating: number }[]; }

type Tab = "dashboard" | "cycles" | "setup";

const inputClass = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100";
const labelClass = "mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wide";

const PHASE_COLORS: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-600", SelfAssessment: "bg-blue-50 text-blue-700", ManagerReview: "bg-violet-50 text-violet-700",
  PeerReview: "bg-amber-50 text-amber-700", Calibration: "bg-orange-50 text-orange-700",
  Acknowledgement: "bg-cyan-50 text-cyan-700", Completed: "bg-emerald-50 text-emerald-700",
};
const PHASE_LABELS: Record<string, string> = {
  Draft: "Draft", SelfAssessment: "Self Assessment", ManagerReview: "Manager Review",
  PeerReview: "Peer / 360 Review", Calibration: "Calibration", Acknowledgement: "Acknowledgement", Completed: "Completed",
};

const setupActionBtn = {
  edit: "rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100",
  delete: "rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100",
  add: "rounded bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100",
};

export default function PerformancePage() {
  const [tab, setTab] = useState<Tab>("dashboard");

  // Data
  const [cycles, setCycles] = useState<AppraisalCycle[]>([]);
  const [scales, setScales] = useState<RatingScale[]>([]);
  const [categories, setCategories] = useState<CompetencyCategory[]>([]);
  const [templates, setTemplates] = useState<AppraisalTemplate[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [cycleAppraisals, setCycleAppraisals] = useState<AppraisalDto[]>([]);
  const cycleAppraisalsPager = useClientPagination(cycleAppraisals);

  // Modals
  const [showScaleModal, setShowScaleModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showCompetencyModal, setShowCompetencyModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showCycleModal, setShowCycleModal] = useState(false);

  // Scale form
  const [editScaleId, setEditScaleId] = useState<string | null>(null);
  const [scaleName, setScaleName] = useState("");
  const [scaleDesc, setScaleDesc] = useState("");
  const [scaleDefault, setScaleDefault] = useState(false);
  const [scaleItems, setScaleItems] = useState<{ value: number; label: string; description: string; color: string }[]>([]);

  // Category form
  const [editCatId, setEditCatId] = useState<string | null>(null);
  const [catName, setCatName] = useState("");
  const [catDesc, setCatDesc] = useState("");
  const [catSort, setCatSort] = useState(0);

  // Competency form
  const [editCompId, setEditCompId] = useState<string | null>(null);
  const [compName, setCompName] = useState("");
  const [compDesc, setCompDesc] = useState("");
  const [compSort, setCompSort] = useState(0);
  const [compCatId, setCompCatId] = useState("");

  // Template form
  const [editTplId, setEditTplId] = useState<string | null>(null);
  const [tplName, setTplName] = useState("");
  const [tplDesc, setTplDesc] = useState("");
  const [tplScaleId, setTplScaleId] = useState("");
  const [tplSections, setTplSections] = useState<{ name: string; description: string; weight: number; sortOrder: number; items: { name: string; description: string; weight: number; sortOrder: number; competencyId: string }[] }[]>([]);

  // Cycle form
  const [editCycleId, setEditCycleId] = useState<string | null>(null);
  const [cycleName, setCycleName] = useState("");
  const [cycleDesc, setCycleDesc] = useState("");
  const [cycleType, setCycleType] = useState("Annual");
  const [cycleStart, setCycleStart] = useState("");
  const [cycleEnd, setCycleEnd] = useState("");
  const [cycleTplId, setCycleTplId] = useState("");
  const [cycleSelf, setCycleSelf] = useState(true);
  const [cycleMgr, setCycleMgr] = useState(true);
  const [cyclePeer, setCyclePeer] = useState(false);
  const [cycleDr, setCycleDr] = useState(false);
  const [cycleExt, setCycleExt] = useState(false);
  const [cycleGoals, setCycleGoals] = useState(true);
  const [cycleSW, setCycleSW] = useState(10);
  const [cycleMW, setCycleMW] = useState(40);
  const [cyclePW, setCyclePW] = useState(25);
  const [cycleDW, setCycleDW] = useState(15);
  const [cycleEW, setCycleEW] = useState(10);
  const [cycleSelfDl, setCycleSelfDl] = useState("");
  const [cycleMgrDl, setCycleMgrDl] = useState("");
  const [cyclePeerDl, setCyclePeerDl] = useState("");
  const [cycleCompDl, setCycleCompDl] = useState("");

  const [saving, setSaving] = useState(false);

  // Loaders
  const loadScales = useCallback(() => apiFetch<RatingScale[]>("/api/appraisal/rating-scales").then(setScales).catch(() => {}), []);
  const loadCategories = useCallback(() => apiFetch<CompetencyCategory[]>("/api/appraisal/competency-categories").then(setCategories).catch(() => {}), []);
  const loadTemplates = useCallback(() => apiFetch<AppraisalTemplate[]>("/api/appraisal/templates").then(setTemplates).catch(() => {}), []);
  const loadCycles = useCallback(() => apiFetch<AppraisalCycle[]>("/api/appraisal/cycles").then(setCycles).catch(() => {}), []);

  useEffect(() => { loadScales(); loadCategories(); loadTemplates(); loadCycles(); }, [loadScales, loadCategories, loadTemplates, loadCycles]);

  useEffect(() => {
    if (selectedCycleId) {
      apiFetch<DashboardData>(`/api/appraisal/cycles/${selectedCycleId}/dashboard`).then(setDashboard).catch(() => {});
      apiFetch<AppraisalDto[]>(`/api/appraisal/cycles/${selectedCycleId}/appraisals`).then(setCycleAppraisals).catch(() => {});
    }
  }, [selectedCycleId]);

  useEffect(() => {
    if (cycles.length > 0 && !selectedCycleId) {
      const active = cycles.find(c => c.phase !== "Draft" && c.phase !== "Completed") ?? cycles[0];
      setSelectedCycleId(active.id);
    }
  }, [cycles, selectedCycleId]);

  // ── Scale CRUD ────────────────────────────────────────────────

  function openCreateScale() {
    setEditScaleId(null); setScaleName(""); setScaleDesc(""); setScaleDefault(false);
    setScaleItems([{ value: 1, label: "", description: "", color: "#ef4444" }, { value: 2, label: "", description: "", color: "#f97316" }, { value: 3, label: "", description: "", color: "#eab308" }, { value: 4, label: "", description: "", color: "#22c55e" }, { value: 5, label: "", description: "", color: "#3b82f6" }]);
    setShowScaleModal(true);
  }

  function openEditScale(s: RatingScale) {
    setEditScaleId(s.id); setScaleName(s.name); setScaleDesc(s.description ?? ""); setScaleDefault(s.isDefault);
    setScaleItems(s.items.map(i => ({ value: i.value, label: i.label, description: i.description ?? "", color: i.color ?? "" })));
    setShowScaleModal(true);
  }

  async function saveScale() {
    if (!scaleDesc.trim()) {
      await appAlert("Description is required.");
      return;
    }
    setSaving(true);
    const payload = { name: scaleName, description: scaleDesc.trim(), isDefault: scaleDefault, items: scaleItems.filter(i => i.label) };
    try {
      if (editScaleId) await apiFetch(`/api/appraisal/rating-scales/${editScaleId}`, { method: "PUT", body: JSON.stringify(payload) });
      else await apiFetch("/api/appraisal/rating-scales", { method: "POST", body: JSON.stringify(payload) });
      setShowScaleModal(false); loadScales();
    } catch (e) { await appAlert(e instanceof Error ? e.message : "Failed"); }
    setSaving(false);
  }

  async function deleteScale(id: string) {
    if (!(await appConfirm("Delete this rating scale?"))) return;
    try { await apiFetch(`/api/appraisal/rating-scales/${id}`, { method: "DELETE" }); loadScales(); }
    catch (e) { await appAlert(e instanceof Error ? e.message : "Failed"); }
  }

  // ── Category CRUD ─────────────────────────────────────────────

  function openCreateCategory() { setEditCatId(null); setCatName(""); setCatDesc(""); setCatSort(0); setShowCategoryModal(true); }
  function openEditCategory(c: CompetencyCategory) { setEditCatId(c.id); setCatName(c.name); setCatDesc(c.description ?? ""); setCatSort(c.sortOrder); setShowCategoryModal(true); }

  async function saveCategory() {
    if (!catDesc.trim()) {
      await appAlert("Description is required.");
      return;
    }
    setSaving(true);
    const payload = { name: catName, description: catDesc.trim(), sortOrder: catSort };
    try {
      if (editCatId) await apiFetch(`/api/appraisal/competency-categories/${editCatId}`, { method: "PUT", body: JSON.stringify(payload) });
      else await apiFetch("/api/appraisal/competency-categories", { method: "POST", body: JSON.stringify(payload) });
      setShowCategoryModal(false); loadCategories();
    } catch (e) { await appAlert(e instanceof Error ? e.message : "Failed"); }
    setSaving(false);
  }

  // ── Competency CRUD ───────────────────────────────────────────

  function openCreateCompetency(catId: string) { setEditCompId(null); setCompName(""); setCompDesc(""); setCompSort(0); setCompCatId(catId); setShowCompetencyModal(true); }
  function openEditCompetency(c: CompetencyDto) { setEditCompId(c.id); setCompName(c.name); setCompDesc(c.description ?? ""); setCompSort(c.sortOrder); setCompCatId(c.categoryId); setShowCompetencyModal(true); }

  async function saveCompetency() {
    if (!compDesc.trim()) {
      await appAlert("Description is required.");
      return;
    }
    setSaving(true);
    const payload = { name: compName, description: compDesc.trim(), sortOrder: compSort, categoryId: compCatId };
    try {
      if (editCompId) await apiFetch(`/api/appraisal/competencies/${editCompId}`, { method: "PUT", body: JSON.stringify(payload) });
      else await apiFetch("/api/appraisal/competencies", { method: "POST", body: JSON.stringify(payload) });
      setShowCompetencyModal(false); loadCategories();
    } catch (e) { await appAlert(e instanceof Error ? e.message : "Failed"); }
    setSaving(false);
  }

  async function deleteCompetency(id: string) {
    if (!(await appConfirm("Delete this competency?"))) return;
    await apiFetch(`/api/appraisal/competencies/${id}`, { method: "DELETE" }).catch(() => {});
    loadCategories();
  }

  // ── Template CRUD ─────────────────────────────────────────────

  function openCreateTemplate() {
    setEditTplId(null); setTplName(""); setTplDesc(""); setTplScaleId(scales[0]?.id ?? "");
    setTplSections([{ name: "Core Competencies", description: "", weight: 50, sortOrder: 1, items: [] }, { name: "Functional KPIs", description: "", weight: 50, sortOrder: 2, items: [] }]);
    setShowTemplateModal(true);
  }

  function openEditTemplate(t: AppraisalTemplate) {
    setEditTplId(t.id); setTplName(t.name); setTplDesc(t.description ?? ""); setTplScaleId(t.ratingScaleId);
    setTplSections(t.sections.map(s => ({ name: s.name, description: s.description ?? "", weight: s.weight, sortOrder: s.sortOrder, items: s.items.map(i => ({ name: i.name, description: i.description ?? "", weight: i.weight, sortOrder: i.sortOrder, competencyId: i.competencyId ?? "" })) })));
    setShowTemplateModal(true);
  }

  async function saveTemplate() {
    if (!tplDesc.trim()) {
      await appAlert("Description is required.");
      return;
    }
    setSaving(true);
    const payload = { name: tplName, description: tplDesc.trim(), ratingScaleId: tplScaleId, sections: tplSections.map(s => ({ ...s, description: s.description || null, items: s.items.map(i => ({ ...i, description: i.description || null, competencyId: i.competencyId || null })) })) };
    try {
      if (editTplId) await apiFetch(`/api/appraisal/templates/${editTplId}`, { method: "PUT", body: JSON.stringify(payload) });
      else await apiFetch("/api/appraisal/templates", { method: "POST", body: JSON.stringify(payload) });
      setShowTemplateModal(false); loadTemplates();
    } catch (e) { await appAlert(e instanceof Error ? e.message : "Failed"); }
    setSaving(false);
  }

  async function deleteTemplate(id: string) {
    if (!(await appConfirm("Delete this template?"))) return;
    try { await apiFetch(`/api/appraisal/templates/${id}`, { method: "DELETE" }); loadTemplates(); }
    catch (e) { await appAlert(e instanceof Error ? e.message : "Failed"); }
  }

  // ── Cycle CRUD ────────────────────────────────────────────────

  function openCreateCycle() {
    setEditCycleId(null); setCycleName(""); setCycleDesc(""); setCycleType("Annual"); setCycleStart(""); setCycleEnd("");
    setCycleTplId(templates[0]?.id ?? ""); setCycleSelf(true); setCycleMgr(true); setCyclePeer(false); setCycleDr(false); setCycleExt(false); setCycleGoals(true);
    setCycleSW(10); setCycleMW(40); setCyclePW(25); setCycleDW(15); setCycleEW(10);
    setCycleSelfDl(""); setCycleMgrDl(""); setCyclePeerDl(""); setCycleCompDl("");
    setShowCycleModal(true);
  }

  function openEditCycle(c: AppraisalCycle) {
    setEditCycleId(c.id); setCycleName(c.name); setCycleDesc(c.description ?? ""); setCycleType(c.cycleType);
    setCycleStart(c.startDate.slice(0, 10)); setCycleEnd(c.endDate.slice(0, 10));
    setCycleTplId(c.templateId); setCycleSelf(c.includeSelfAssessment); setCycleMgr(c.includeManagerReview);
    setCyclePeer(c.includePeerReview); setCycleDr(c.includeDirectReportReview); setCycleExt(c.includeExternalReview); setCycleGoals(c.includeGoals);
    setCycleSW(c.selfWeight); setCycleMW(c.managerWeight); setCyclePW(c.peerWeight); setCycleDW(c.directReportWeight); setCycleEW(c.externalWeight);
    setCycleSelfDl(c.selfDeadline?.slice(0, 10) ?? ""); setCycleMgrDl(c.managerDeadline?.slice(0, 10) ?? "");
    setCyclePeerDl(c.peerDeadline?.slice(0, 10) ?? ""); setCycleCompDl(c.completionDeadline?.slice(0, 10) ?? "");
    setShowCycleModal(true);
  }

  async function saveCycle() {
    if (!cycleDesc.trim()) {
      await appAlert("Description is required.");
      return;
    }
    setSaving(true);
    const payload = {
      name: cycleName, description: cycleDesc.trim(), cycleType: cycleType, startDate: cycleStart, endDate: cycleEnd, templateId: cycleTplId,
      includeSelfAssessment: cycleSelf, includeManagerReview: cycleMgr, includePeerReview: cyclePeer, includeDirectReportReview: cycleDr, includeExternalReview: cycleExt, includeGoals: cycleGoals,
      selfWeight: cycleSW, managerWeight: cycleMW, peerWeight: cyclePW, directReportWeight: cycleDW, externalWeight: cycleEW,
      selfDeadline: cycleSelfDl || null, managerDeadline: cycleMgrDl || null, peerDeadline: cyclePeerDl || null, completionDeadline: cycleCompDl || null,
    };
    try {
      if (editCycleId) await apiFetch(`/api/appraisal/cycles/${editCycleId}`, { method: "PUT", body: JSON.stringify(payload) });
      else await apiFetch("/api/appraisal/cycles", { method: "POST", body: JSON.stringify(payload) });
      setShowCycleModal(false); loadCycles();
    } catch (e) { await appAlert(e instanceof Error ? e.message : "Failed"); }
    setSaving(false);
  }

  async function activateCycle(id: string) {
    if (!(await appConfirm("Activate this cycle? Appraisals will be created for all active employees."))) return;
    try { await apiFetch(`/api/appraisal/cycles/${id}/activate`, { method: "POST" }); loadCycles(); setSelectedCycleId(id); }
    catch (e) { await appAlert(e instanceof Error ? e.message : "Failed"); }
  }

  async function advanceCycle(id: string) {
    if (!(await appConfirm("Advance this cycle to the next phase?"))) return;
    try { await apiFetch(`/api/appraisal/cycles/${id}/advance`, { method: "POST" }); loadCycles(); setSelectedCycleId(id); }
    catch (e) { await appAlert(e instanceof Error ? e.message : "Failed"); }
  }

  async function deleteCycle(id: string) {
    if (!(await appConfirm("Delete this cycle?"))) return;
    try { await apiFetch(`/api/appraisal/cycles/${id}`, { method: "DELETE" }); loadCycles(); if (selectedCycleId === id) setSelectedCycleId(null); }
    catch (e) { await appAlert(e instanceof Error ? e.message : "Failed"); }
  }

  // ── All competencies flat list for template builder ──────────
  const allCompetencies = categories.flatMap(c => c.competencies);

  // ── Section/Item helpers ──────────────────────────────────────
  function addSection() { setTplSections([...tplSections, { name: "", description: "", weight: 0, sortOrder: tplSections.length + 1, items: [] }]); }
  function removeSection(idx: number) { setTplSections(tplSections.filter((_, i) => i !== idx)); }
  function updateSection(idx: number, field: string, value: string | number) { setTplSections(tplSections.map((s, i) => i === idx ? { ...s, [field]: value } : s)); }
  function addItem(secIdx: number) { setTplSections(tplSections.map((s, i) => i === secIdx ? { ...s, items: [...s.items, { name: "", description: "", weight: 0, sortOrder: s.items.length + 1, competencyId: "" }] } : s)); }
  function removeItem(secIdx: number, itemIdx: number) { setTplSections(tplSections.map((s, si) => si === secIdx ? { ...s, items: s.items.filter((_, ii) => ii !== itemIdx) } : s)); }
  function updateItem(secIdx: number, itemIdx: number, field: string, value: string | number) { setTplSections(tplSections.map((s, si) => si === secIdx ? { ...s, items: s.items.map((it, ii) => ii === itemIdx ? { ...it, [field]: value } : it) } : s)); }

  const selectedCycle = cycles.find(c => c.id === selectedCycleId);

  const deptBars = useMemo(() => {
    if (!dashboard?.departmentProgress?.length) return [];
    const colors = ["#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#0ea5e9"];
    return dashboard.departmentProgress.map((d, i) => ({
      label: d.department || "—",
      value: d.completed,
      color: colors[i % colors.length],
    }));
  }, [dashboard]);

  const ratingBars = useMemo(() => {
    if (!dashboard?.ratingDistribution?.length) return [];
    const colors = ["#94a3b8", "#64748b", "#3b82f6", "#22c55e", "#eab308", "#f97316", "#ef4444"];
    return dashboard.ratingDistribution.map((r, i) => ({
      label: r.label,
      value: r.count,
      color: colors[i % colors.length],
    }));
  }, [dashboard]);

  const ratingDonut = useMemo(() => ratingBars.filter((x) => x.value > 0), [ratingBars]);

  const pipelineBars = useMemo(() => {
    if (!dashboard) return [];
    return [
      { label: "Self completed", value: dashboard.selfCompleted, color: "#3b82f6" },
      { label: "Manager completed", value: dashboard.managerCompleted, color: "#8b5cf6" },
      { label: "Peer completed", value: dashboard.peerCompleted, color: "#f59e0b" },
      { label: "Fully completed", value: dashboard.fullyCompleted, color: "#22c55e" },
    ];
  }, [dashboard]);

  const dashboardKpis = useMemo(() => {
    if (!dashboard || !selectedCycle) return [];
    const t = dashboard.totalEmployees;
    const pct = (n: number) => (t > 0 ? `${Math.round((n / t) * 100)}%` : "—");
    return [
      {
        label: "Total employees",
        value: formatInt(t),
        sub: `${selectedCycle.name} · ${formatDate(selectedCycle.startDate)} – ${formatDate(selectedCycle.endDate)}`,
      },
      {
        label: "Self completed",
        value: formatInt(dashboard.selfCompleted),
        sub: `${pct(dashboard.selfCompleted)} of roster in this cycle`,
      },
      {
        label: "Manager completed",
        value: formatInt(dashboard.managerCompleted),
        sub: `${pct(dashboard.managerCompleted)} with manager review done`,
      },
      {
        label: "Fully completed",
        value: formatInt(dashboard.fullyCompleted),
        sub: `${pct(dashboard.fullyCompleted)} appraisal${dashboard.fullyCompleted === 1 ? "" : "s"} closed end-to-end`,
      },
    ];
  }, [dashboard, selectedCycle]);

  const hasInsightCharts =
    deptBars.length > 0 || ratingDonut.length > 0 || pipelineBars.some((x) => x.value > 0);

  const managerPending =
    dashboard && dashboard.selfCompleted > 0 && dashboard.managerCompleted < dashboard.totalEmployees;

  return (
    <>
      <AppTopbar
        title="Performance Appraisal"
        subtitle="Track review cycles, monitor progress, and manage appraisal setup."
      />

      <div className="mt-6 mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
          {(
            [
              ["dashboard", "Dashboard"],
              ["cycles", "Appraisal Cycles"],
              ["setup", "Setup"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                tab === key ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === "cycles" && <Button onClick={openCreateCycle}>+ New Cycle</Button>}
      </div>

      {tab === "dashboard" && (
        <div className="space-y-6">
          {cycles.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
              <p className="text-sm font-medium text-slate-700">No appraisal cycles yet</p>
              <p className="mt-1 text-sm text-slate-500">Create a cycle to start reviews for your team.</p>
              <Button className="mt-4" onClick={() => { setTab("cycles"); openCreateCycle(); }}>
                Create first cycle
              </Button>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-wrap items-end gap-4">
                  <div className="min-w-[14rem] flex-1 sm:max-w-md">
                    <label className={labelClass}>Review cycle</label>
                    <FormSelect
                      value={selectedCycleId ?? ""}
                      onValueChange={setSelectedCycleId}
                      options={cycles.map((c) => ({
                        value: c.id,
                        label: `${c.name} · ${PHASE_LABELS[c.phase] ?? c.phase}`,
                      }))}
                      className="h-[42px]"
                    />
                  </div>
                  {selectedCycle && (
                    <div className="flex flex-wrap items-center gap-2 pb-0.5">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${PHASE_COLORS[selectedCycle.phase] ?? "bg-slate-100 text-slate-600"}`}
                      >
                        {PHASE_LABELS[selectedCycle.phase] ?? selectedCycle.phase}
                      </span>
                      <span className="text-xs text-slate-500">
                        {formatDate(selectedCycle.startDate)} – {formatDate(selectedCycle.endDate)}
                      </span>
                    </div>
                  )}
                  {selectedCycle && selectedCycle.phase !== "Completed" && selectedCycle.phase !== "Draft" && (
                    <Button className="ml-auto min-h-0 rounded-lg px-3 py-1.5 text-xs" onClick={() => advanceCycle(selectedCycle.id)}>
                      Advance phase
                    </Button>
                  )}
                </div>

                {selectedCycle && (
                  <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-4">
                    {["SelfAssessment", "ManagerReview", "PeerReview", "Calibration", "Acknowledgement", "Completed"].map((p, i, arr) => {
                      const phases = arr;
                      const currentIdx = phases.indexOf(selectedCycle.phase);
                      const isActive = i <= currentIdx;
                      const isCurrent = p === selectedCycle.phase;
                      if (p === "PeerReview" && !selectedCycle.includePeerReview) return null;
                      return (
                        <div key={p} className="flex items-center gap-1.5">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                              isCurrent
                                ? PHASE_COLORS[p] ?? "bg-slate-100 text-slate-600"
                                : isActive
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-50 text-slate-400"
                            }`}
                          >
                            {isActive && !isCurrent ? "✓ " : ""}
                            {PHASE_LABELS[p] ?? p}
                          </span>
                          {i < phases.length - 1 && (
                            <span className={`hidden h-px w-4 sm:inline-block ${isActive ? "bg-emerald-300" : "bg-slate-200"}`} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {dashboard && selectedCycle ? (
                <>
                  <DashboardKpiGrid items={dashboardKpis} />

                  {managerPending && (
                    <div
                      className="rounded-2xl border px-4 py-3 text-sm"
                      style={{ borderColor: OPENSKY_THEME.border, backgroundColor: OPENSKY_THEME.actionSoft, color: OPENSKY_THEME.navy }}
                    >
                      <strong>Manager reviews pending.</strong>{" "}
                      {dashboard.selfCompleted} self-assessments submitted — {dashboard.totalEmployees - dashboard.managerCompleted} manager
                      review{dashboard.totalEmployees - dashboard.managerCompleted === 1 ? "" : "s"} still open.
                    </div>
                  )}

                  {hasInsightCharts ? (
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <DashboardCardHeader title="Review pipeline" subtitle="Completion by review stage" compact />
                        <div className="mt-4">
                          <HorizontalCompareBars items={pipelineBars} />
                        </div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <DashboardCardHeader
                          title={ratingDonut.length > 0 ? "Rating distribution" : "Department progress"}
                          subtitle={ratingDonut.length > 0 ? "Submitted ratings in this cycle" : "Completed appraisals by department"}
                          compact
                        />
                        <div className="mt-4">
                          {ratingDonut.length > 0 ? (
                            <DonutMixChart values={ratingDonut} />
                          ) : deptBars.length > 0 ? (
                            <HorizontalCompareBars items={deptBars} />
                          ) : (
                            <p className="py-6 text-center text-sm text-slate-500">Charts populate as reviews are submitted.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                      <DashboardCardHeader
                        title="Employee appraisals"
                        subtitle={`${cycleAppraisals.length} employee${cycleAppraisals.length === 1 ? "" : "s"} in this cycle`}
                        compact
                      />
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[720px] text-sm">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50/80 text-left">
                            <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Employee</th>
                            <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Department</th>
                            <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Status</th>
                            <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Self</th>
                            <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Manager</th>
                            <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Rating</th>
                            <th className="w-16 px-4 py-2.5" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {cycleAppraisalsPager.pageItems.map((a) => {
                            const selfR = a.reviewers.find((r) => r.reviewerType === "Self");
                            const mgrR = a.reviewers.find((r) => r.reviewerType === "Manager");
                            return (
                              <tr key={a.id} className="transition hover:bg-slate-50/60">
                                <td className="px-4 py-3 font-medium text-slate-800">
                                  {a.employeeName}
                                  {a.employeeCode && (
                                    <span className="ml-1 font-normal text-slate-400">{a.employeeCode}</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-slate-600">{a.departmentName ?? "—"}</td>
                                <td className="px-4 py-3">
                                  <span
                                    className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${PHASE_COLORS[a.status] ?? "bg-slate-100 text-slate-600"}`}
                                  >
                                    {PHASE_LABELS[a.status] ?? a.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  {selfR ? <StatusBadge status={selfR.status} rating={selfR.overallRating} /> : "—"}
                                </td>
                                <td className="px-4 py-3">
                                  {mgrR ? <StatusBadge status={mgrR.status} rating={mgrR.overallRating} /> : "—"}
                                </td>
                                <td className="px-4 py-3 font-semibold text-slate-700">{a.finalRating?.toFixed(1) ?? "—"}</td>
                                <td className="px-4 py-3">
                                  <Link href={`/app/performance/appraisal/${a.id}`} className="text-xs font-medium text-blue-600 hover:underline">
                                    Open
                                  </Link>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <TablePagination
                      page={cycleAppraisalsPager.page}
                      totalPages={cycleAppraisalsPager.totalPages}
                      totalCount={cycleAppraisalsPager.totalCount}
                      pageSize={cycleAppraisalsPager.pageSize}
                      onPageChange={cycleAppraisalsPager.setPage}
                    />
                    {cycleAppraisals.length === 0 && (
                      <div className="border-t border-slate-100 py-12 text-center text-sm text-slate-500">
                        No appraisals yet. Activate the cycle from the Appraisal Cycles tab.
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center text-sm text-slate-500 shadow-sm">
                  Loading cycle dashboard…
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === "cycles" && (
        <section className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="px-6 py-2.5 font-semibold text-slate-600">Name</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-600">Description</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-600">Type</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-600">Phase</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-600">Start</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-600">End</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-600">Template</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-600">Employees</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-600">Progress</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cycles.length === 0 && (
                    <tr><td colSpan={10} className="px-6 py-8 text-center text-slate-400">No appraisal cycles. Create your first one.</td></tr>
                  )}
                  {cycles.map(c => {
                    const progress = c.totalAppraisals > 0 ? Math.round((c.completedAppraisals / c.totalAppraisals) * 100) : 0;
                    return (
                      <tr key={c.id} className="hover:bg-slate-50/50 align-top">
                        <td className="px-6 py-3 font-medium text-slate-700">{c.name}</td>
                        <td className="px-4 py-3 text-slate-600 max-w-xs">{c.description ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{c.cycleType}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${PHASE_COLORS[c.phase] ?? "bg-slate-100 text-slate-600"}`}>
                            {PHASE_LABELS[c.phase] ?? c.phase}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{formatDate(c.startDate)}</td>
                        <td className="px-4 py-3 text-slate-600">{formatDate(c.endDate)}</td>
                        <td className="px-4 py-3 text-slate-600">{c.templateName ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{c.totalAppraisals}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {c.totalAppraisals > 0 ? `${progress}%` : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            {c.phase === "Draft" && (
                              <>
                                <button type="button" onClick={() => activateCycle(c.id)} className={setupActionBtn.add}>Activate</button>
                                <button type="button" onClick={() => openEditCycle(c)} className={setupActionBtn.edit}>Edit</button>
                                <button type="button" onClick={() => deleteCycle(c.id)} className={setupActionBtn.delete}>Delete</button>
                              </>
                            )}
                            {c.phase !== "Draft" && c.phase !== "Completed" && (
                              <button type="button" onClick={() => advanceCycle(c.id)} className="rounded bg-violet-50 px-2 py-1 text-xs font-medium text-violet-700 hover:bg-violet-100">Advance</button>
                            )}
                            <button type="button" onClick={() => { setSelectedCycleId(c.id); setTab("dashboard"); }} className="rounded bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100">Dashboard</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {tab === "setup" && (
        <div className="space-y-8">
          {/* Rating Scales */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900">Rating scales</h2>
              <Button onClick={openCreateScale}>+ New Scale</Button>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left">
                      <th className="px-6 py-2.5 font-semibold text-slate-600">Name</th>
                      <th className="px-4 py-2.5 font-semibold text-slate-600">Description</th>
                      <th className="px-4 py-2.5 font-semibold text-slate-600">Levels</th>
                      <th className="px-4 py-2.5 font-semibold text-slate-600">Default</th>
                      <th className="px-4 py-2.5 font-semibold text-slate-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {scales.length === 0 && (
                      <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400">No rating scales defined yet.</td></tr>
                    )}
                    {scales.map(s => (
                      <tr key={s.id} className="hover:bg-slate-50/50">
                        <td className="px-6 py-3 font-medium text-slate-700">{s.name}</td>
                        <td className="px-4 py-3 text-slate-600 max-w-xs">{s.description ?? "—"}</td>
                        <td className="px-4 py-3">
                          {s.items.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {s.items.map(i => (
                                <span key={i.id} className="inline-flex items-center gap-1 rounded-lg border border-slate-100 px-2 py-0.5 text-xs text-slate-700">
                                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: i.color ?? "#94a3b8" }} />
                                  {i.value}. {i.label}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">{s.isDefault ? <span className="text-green-600">Yes</span> : <span className="text-slate-400">No</span>}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button type="button" onClick={() => openEditScale(s)} className={setupActionBtn.edit}>Edit</button>
                            <button type="button" onClick={() => deleteScale(s.id)} className={setupActionBtn.delete}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Competencies */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900">Competencies</h2>
              <Button onClick={openCreateCategory}>+ New Category</Button>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left">
                      <th className="px-6 py-2.5 font-semibold text-slate-600">Category</th>
                      <th className="px-4 py-2.5 font-semibold text-slate-600">Description</th>
                      <th className="px-4 py-2.5 font-semibold text-slate-600">Competencies</th>
                      <th className="px-4 py-2.5 font-semibold text-slate-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {categories.length === 0 && (
                      <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-400">No competency categories defined yet.</td></tr>
                    )}
                    {categories.map(cat => (
                      <tr key={cat.id} className="hover:bg-slate-50/50">
                        <td className="px-6 py-3 font-medium text-slate-700">{cat.name}</td>
                        <td className="px-4 py-3 text-slate-600 max-w-xs">{cat.description ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{cat.competencies.length}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button type="button" onClick={() => openCreateCompetency(cat.id)} className={setupActionBtn.add}>Add</button>
                            <button type="button" onClick={() => openEditCategory(cat)} className={setupActionBtn.edit}>Edit</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Templates */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900">Templates</h2>
              <Button onClick={openCreateTemplate}>+ New Template</Button>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left">
                      <th className="px-6 py-2.5 font-semibold text-slate-600">Name</th>
                      <th className="px-4 py-2.5 font-semibold text-slate-600">Description</th>
                      <th className="px-4 py-2.5 font-semibold text-slate-600">Rating scale</th>
                      <th className="px-4 py-2.5 font-semibold text-slate-600">Sections</th>
                      <th className="px-4 py-2.5 font-semibold text-slate-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {templates.length === 0 && (
                      <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400">No appraisal templates yet.</td></tr>
                    )}
                    {templates.map(t => (
                      <tr key={t.id} className="hover:bg-slate-50/50 align-top">
                        <td className="px-6 py-3 font-medium text-slate-700">{t.name}</td>
                        <td className="px-4 py-3 text-slate-600 max-w-xs">{t.description ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{t.ratingScaleName ?? "—"}</td>
                        <td className="px-4 py-3">
                          {t.sections.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {t.sections.map(s => (
                                <span key={s.id} className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
                                  {s.name} <span className="text-slate-400">({s.weight}%, {s.items.length} items)</span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button type="button" onClick={() => openEditTemplate(t)} className={setupActionBtn.edit}>Edit</button>
                            <button type="button" onClick={() => deleteTemplate(t.id)} className={setupActionBtn.delete}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          MODALS
         ═══════════════════════════════════════════════════════════ */}

      {/* Rating Scale Modal */}
      <Modal open={showScaleModal} onClose={() => setShowScaleModal(false)} title={editScaleId ? "Edit Rating Scale" : "New Rating Scale"} wide>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelClass}>Name *</label><input value={scaleName} onChange={e => setScaleName(e.target.value)} className={inputClass} required /></div>
            <div><label className={labelClass}>Description *</label><textarea value={scaleDesc} onChange={e => setScaleDesc(e.target.value)} rows={2} className={inputClass} required /></div>
          </div>
          <label className="flex items-center gap-2"><input type="checkbox" checked={scaleDefault} onChange={e => setScaleDefault(e.target.checked)} className="h-4 w-4 rounded" /><span className="text-sm text-slate-600">Set as default scale</span></label>
          <div>
            <label className={labelClass}>Scale Items</label>
            <div className="space-y-2">
              {scaleItems.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="number" value={item.value} onChange={e => { const n = [...scaleItems]; n[i] = { ...n[i], value: Number(e.target.value) }; setScaleItems(n); }} className={inputClass + " w-16"} />
                  <input value={item.label} onChange={e => { const n = [...scaleItems]; n[i] = { ...n[i], label: e.target.value }; setScaleItems(n); }} className={inputClass} placeholder="Label" />
                  <input value={item.description} onChange={e => { const n = [...scaleItems]; n[i] = { ...n[i], description: e.target.value }; setScaleItems(n); }} className={inputClass} placeholder="Description" />
                  <input type="color" value={item.color} onChange={e => { const n = [...scaleItems]; n[i] = { ...n[i], color: e.target.value }; setScaleItems(n); }} className="h-9 w-9 rounded border border-slate-200 p-0.5 cursor-pointer" />
                  <button onClick={() => setScaleItems(scaleItems.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500"><svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                </div>
              ))}
            </div>
            <button onClick={() => setScaleItems([...scaleItems, { value: scaleItems.length + 1, label: "", description: "", color: "#94a3b8" }])} className="mt-2 text-xs text-blue-600 hover:underline">+ Add Level</button>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowScaleModal(false)} className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={saveScale} disabled={!scaleName.trim() || !scaleDesc.trim() || saving} className="rounded-full bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
          </div>
        </div>
      </Modal>

      {/* Category Modal */}
      <Modal open={showCategoryModal} onClose={() => setShowCategoryModal(false)} title={editCatId ? "Edit Category" : "New Category"}>
        <div className="space-y-4">
          <div><label className={labelClass}>Name *</label><input value={catName} onChange={e => setCatName(e.target.value)} className={inputClass} required /></div>
          <div><label className={labelClass}>Description *</label><textarea value={catDesc} onChange={e => setCatDesc(e.target.value)} rows={2} className={inputClass} required /></div>
          <div><label className={labelClass}>Sort Order</label><input type="number" value={catSort} onChange={e => setCatSort(Number(e.target.value))} className={inputClass + " w-24"} /></div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowCategoryModal(false)} className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={saveCategory} disabled={!catName.trim() || !catDesc.trim() || saving} className="rounded-full bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
          </div>
        </div>
      </Modal>

      {/* Competency Modal */}
      <Modal open={showCompetencyModal} onClose={() => setShowCompetencyModal(false)} title={editCompId ? "Edit Competency" : "New Competency"}>
        <div className="space-y-4">
          <div><label className={labelClass}>Name</label><input value={compName} onChange={e => setCompName(e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>Description *</label><textarea value={compDesc} onChange={e => setCompDesc(e.target.value)} rows={2} className={inputClass} required /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelClass}>Category</label><select value={compCatId} onChange={e => setCompCatId(e.target.value)} className={inputClass}>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div><label className={labelClass}>Sort Order</label><input type="number" value={compSort} onChange={e => setCompSort(Number(e.target.value))} className={inputClass} /></div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowCompetencyModal(false)} className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={saveCompetency} disabled={!compName.trim() || !compDesc.trim() || saving} className="rounded-full bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
          </div>
        </div>
      </Modal>

      {/* Template Modal */}
      <Modal open={showTemplateModal} onClose={() => setShowTemplateModal(false)} title={editTplId ? "Edit Template" : "New Template"} wide>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelClass}>Name *</label><input value={tplName} onChange={e => setTplName(e.target.value)} className={inputClass} required /></div>
            <div><label className={labelClass}>Rating Scale *</label><select value={tplScaleId} onChange={e => setTplScaleId(e.target.value)} className={inputClass} required>{scales.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          </div>
          <div><label className={labelClass}>Description *</label><textarea value={tplDesc} onChange={e => setTplDesc(e.target.value)} rows={2} className={inputClass} required /></div>

          <div>
            <label className={labelClass}>Sections</label>
            {tplSections.map((sec, si) => (
              <div key={si} className="mb-4 rounded-lg border border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <input value={sec.name} onChange={e => updateSection(si, "name", e.target.value)} className={inputClass + " flex-1"} placeholder="Section name" />
                  <input type="number" value={sec.weight} onChange={e => updateSection(si, "weight", Number(e.target.value))} className={inputClass + " w-20"} placeholder="Wt %" />
                  <button onClick={() => removeSection(si)} className="text-slate-400 hover:text-red-500"><svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                </div>
                {sec.items.map((item, ii) => (
                  <div key={ii} className="flex items-center gap-2 mb-2 pl-4">
                    <input value={item.name} onChange={e => updateItem(si, ii, "name", e.target.value)} className={inputClass + " flex-1"} placeholder="Item name" />
                    <select value={item.competencyId} onChange={e => updateItem(si, ii, "competencyId", e.target.value)} className={inputClass + " w-40"}>
                      <option value="">No competency</option>
                      {allCompetencies.map(c => <option key={c.id} value={c.id}>{c.categoryName}: {c.name}</option>)}
                    </select>
                    <input type="number" value={item.weight} onChange={e => updateItem(si, ii, "weight", Number(e.target.value))} className={inputClass + " w-16"} placeholder="Wt" />
                    <button onClick={() => removeItem(si, ii)} className="text-slate-400 hover:text-red-500"><svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                  </div>
                ))}
                <button onClick={() => addItem(si)} className="pl-4 text-xs text-blue-600 hover:underline">+ Add Item</button>
              </div>
            ))}
            <button onClick={addSection} className="text-xs text-blue-600 hover:underline">+ Add Section</button>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowTemplateModal(false)} className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={saveTemplate} disabled={!tplName.trim() || !tplDesc.trim() || !tplScaleId || saving} className="rounded-full bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
          </div>
        </div>
      </Modal>

      {/* Cycle Modal */}
      <Modal open={showCycleModal} onClose={() => setShowCycleModal(false)} title={editCycleId ? "Edit Cycle" : "New Appraisal Cycle"} wide>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelClass}>Name *</label><input value={cycleName} onChange={e => setCycleName(e.target.value)} className={inputClass} placeholder="e.g. Annual Review 2026" required /></div>
            <div>
              <label className={labelClass}>Type</label>
              <FormSelect
                value={cycleType}
                onValueChange={setCycleType}
                options={[
                  { value: "Annual", label: "Annual" },
                  { value: "Semi-Annual", label: "Semi-Annual" },
                  { value: "Quarterly", label: "Quarterly" },
                  { value: "Probation", label: "Probation" },
                  { value: "Project", label: "Project" },
                ]}
                className="h-[42px]"
              />
            </div>
          </div>
          <div><label className={labelClass}>Description *</label><textarea value={cycleDesc} onChange={e => setCycleDesc(e.target.value)} rows={2} className={inputClass} required /></div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className={labelClass}>Start Date</label><DatePickerField value={cycleStart} onChange={setCycleStart} className={inputClass} /></div>
            <div><label className={labelClass}>End Date</label><DatePickerField value={cycleEnd} onChange={setCycleEnd} className={inputClass} /></div>
            <div>
              <label className={labelClass}>Template</label>
              <FormSelect
                value={cycleTplId}
                onValueChange={setCycleTplId}
                options={templates.map((t) => ({ value: t.id, label: t.name }))}
                placeholder="Select template"
                className="h-[42px]"
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Reviewer Types</label>
            <div className="flex flex-wrap gap-4 mt-1">
              {[
                { label: "Self Assessment", val: cycleSelf, set: setCycleSelf },
                { label: "Manager Review", val: cycleMgr, set: setCycleMgr },
                { label: "Peer Review", val: cyclePeer, set: setCyclePeer },
                { label: "Direct Report Review", val: cycleDr, set: setCycleDr },
                { label: "External Review", val: cycleExt, set: setCycleExt },
                { label: "Include Goals", val: cycleGoals, set: setCycleGoals },
              ].map(({ label, val, set }) => (
                <label key={label} className="flex items-center gap-2"><input type="checkbox" checked={val} onChange={e => set(e.target.checked)} className="h-4 w-4 rounded" /><span className="text-sm text-slate-600">{label}</span></label>
              ))}
            </div>
          </div>

          <div>
            <label className={labelClass}>Reviewer Weights (%)</label>
            <div className="grid grid-cols-5 gap-3">
              <div><label className="text-[10px] text-slate-400">Self</label><input type="number" value={cycleSW} onChange={e => setCycleSW(Number(e.target.value))} className={inputClass} /></div>
              <div><label className="text-[10px] text-slate-400">Manager</label><input type="number" value={cycleMW} onChange={e => setCycleMW(Number(e.target.value))} className={inputClass} /></div>
              <div><label className="text-[10px] text-slate-400">Peer</label><input type="number" value={cyclePW} onChange={e => setCyclePW(Number(e.target.value))} className={inputClass} /></div>
              <div><label className="text-[10px] text-slate-400">Direct Report</label><input type="number" value={cycleDW} onChange={e => setCycleDW(Number(e.target.value))} className={inputClass} /></div>
              <div><label className="text-[10px] text-slate-400">External</label><input type="number" value={cycleEW} onChange={e => setCycleEW(Number(e.target.value))} className={inputClass} /></div>
            </div>
          </div>

          <div>
            <label className={labelClass}>Phase Deadlines</label>
            <div className="grid grid-cols-4 gap-3">
              <div><label className="text-[10px] text-slate-400">Self Assessment</label><DatePickerField value={cycleSelfDl} onChange={setCycleSelfDl} className={inputClass} /></div>
              <div><label className="text-[10px] text-slate-400">Manager Review</label><DatePickerField value={cycleMgrDl} onChange={setCycleMgrDl} className={inputClass} /></div>
              <div><label className="text-[10px] text-slate-400">Peer Review</label><DatePickerField value={cyclePeerDl} onChange={setCyclePeerDl} className={inputClass} /></div>
              <div><label className="text-[10px] text-slate-400">Completion</label><DatePickerField value={cycleCompDl} onChange={setCycleCompDl} className={inputClass} /></div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowCycleModal(false)} className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={saveCycle} disabled={!cycleName.trim() || !cycleDesc.trim() || !cycleTplId || saving} className="rounded-full bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function StatusBadge({ status, rating }: { status: string; rating: number | null }) {
  if (status === "Submitted") return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">{rating?.toFixed(1) ?? "Done"}</span>;
  if (status === "InProgress") return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600">In Progress</span>;
  return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-400">Pending</span>;
}
