"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { Button } from "@/components/ui/Button";
import { DatePickerField, FormSelect, TablePagination, type FormSelectOption } from "@/components/ui";
import { Modal } from "@/components/ui/Modal";
import { appAlert, appConfirm } from "@/components/ui/appDialogs";
import { useClientPagination } from "@/lib/use-client-pagination";
import { CreateCourseModal } from "@/components/forms/CreateCourseModal";
import { EmployeeSearchCombobox } from "@/components/workforce/EmployeeSearchCombobox";
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
  employeeId: string;
  employeeName: string;
  courseId: string;
  courseTitle: string;
  courseCode: string;
  status: string;
  dueDate: string | null;
  assignedAt: string;
  completedAt: string | null;
  notes: string | null;
}

interface CertCatalogItem {
  id: string;
  name: string;
  issuingBody: string | null;
  description: string | null;
  isActive: boolean;
}

interface EmployeeCertListItem {
  id: string;
  employeeId: string;
  employeeName: string;
  certificationId: string;
  certificationName: string;
  obtainedDate: string;
  expiryDate: string | null;
  certificateNumber: string | null;
  status: string;
}

interface SkillCatalogItem {
  id: string;
  name: string;
  category: string | null;
}

interface EmployeeOption {
  id: string;
  firstName: string;
  lastName: string;
  employeeCode?: string;
  departmentId?: string;
}

interface DepartmentOption {
  id: string;
  name: string;
}

const inputClass =
  "w-full rounded-xl border border-slate-200/90 bg-white px-3.5 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-[#2E7BBF] focus:ring-2 focus:ring-[#2E7BBF]/20";
const labelClass = "mb-1 block text-xs font-semibold text-slate-600";

const CERT_STATUS_OPTIONS: FormSelectOption[] = [
  { value: "Active", label: "Active" },
  { value: "Expired", label: "Expired" },
  { value: "Revoked", label: "Revoked" },
];
const MATRIX_PROFICIENCY_OPTIONS: FormSelectOption[] = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }));
const ASSIGNMENT_STATUS_OPTIONS: FormSelectOption[] = [
  "Assigned", "InProgress", "Completed", "Waived", "Expired", "Failed",
].map((s) => ({ value: s, label: s }));
const ACTIVE_OPTIONS: FormSelectOption[] = [
  { value: "true", label: "Active" },
  { value: "false", label: "Inactive" },
];

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center justify-end gap-2">
      <button type="button" onClick={onEdit} className="text-slate-500 transition hover:text-amber-600" title="Edit">
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
      </button>
      <button type="button" onClick={onDelete} className="text-slate-400 transition hover:text-red-600" title="Delete">
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
      </button>
    </div>
  );
}

function employeeLabel(e: EmployeeOption) {
  const name = `${e.firstName} ${e.lastName}`.trim();
  return e.employeeCode ? `${name} (${e.employeeCode})` : name;
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
  const [certCatalog, setCertCatalog] = useState<CertCatalogItem[]>([]);
  const [employeeCerts, setEmployeeCerts] = useState<EmployeeCertListItem[]>([]);
  const [skillsCatalog, setSkillsCatalog] = useState<SkillCatalogItem[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [showCertTypeModal, setShowCertTypeModal] = useState(false);
  const [certTypeSaving, setCertTypeSaving] = useState(false);
  const [editingCertType, setEditingCertType] = useState<CertCatalogItem | null>(null);
  const [certTypeName, setCertTypeName] = useState("");
  const [certTypeIssuer, setCertTypeIssuer] = useState("");
  const [certTypeDesc, setCertTypeDesc] = useState("");
  const [certTypeActive, setCertTypeActive] = useState("true");

  const [showEmpCertModal, setShowEmpCertModal] = useState(false);
  const [empCertSaving, setEmpCertSaving] = useState(false);
  const [editingEmpCert, setEditingEmpCert] = useState<EmployeeCertListItem | null>(null);
  const [empCertEmployeeId, setEmpCertEmployeeId] = useState("");
  const [empCertTypeId, setEmpCertTypeId] = useState("");
  const [empCertObtained, setEmpCertObtained] = useState("");
  const [empCertExpiry, setEmpCertExpiry] = useState("");
  const [empCertNumber, setEmpCertNumber] = useState("");
  const [empCertStatus, setEmpCertStatus] = useState("Active");
  const [employeeOptions, setEmployeeOptions] = useState<EmployeeOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);

  const [showSkillModal, setShowSkillModal] = useState(false);
  const [skillSaving, setSkillSaving] = useState(false);
  const [editingSkill, setEditingSkill] = useState<SkillCatalogItem | null>(null);
  const [skillName, setSkillName] = useState("");
  const [skillCategory, setSkillCategory] = useState("");
  const [skillActive, setSkillActive] = useState("true");

  const [showMatrixModal, setShowMatrixModal] = useState(false);
  const [matrixSaving, setMatrixSaving] = useState(false);
  const [editingMatrix, setEditingMatrix] = useState<SkillMatrixRow | null>(null);
  const [matrixEmployeeId, setMatrixEmployeeId] = useState("");
  const [matrixSkillId, setMatrixSkillId] = useState("");
  const [matrixProficiency, setMatrixProficiency] = useState("3");
  const [matrixAssessedAt, setMatrixAssessedAt] = useState("");
  const [matrixNotes, setMatrixNotes] = useState("");

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignSaving, setAssignSaving] = useState(false);
  const [editingAssign, setEditingAssign] = useState<TrainingRow | null>(null);
  const [assignEmployeeId, setAssignEmployeeId] = useState("");
  const [assignDepartmentFilter, setAssignDepartmentFilter] = useState("");
  const [assignCourseId, setAssignCourseId] = useState("");
  const [assignDue, setAssignDue] = useState("");
  const [assignStatus, setAssignStatus] = useState("Assigned");
  const [assignNotes, setAssignNotes] = useState("");

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
      const [cs, sc, sm, ta, cc, ec, sk] = await Promise.all([
        safe<CertSummary[]>("/api/learning/certification-summaries", []),
        safe<SkillCov[]>("/api/learning/skill-coverage", []),
        safe<SkillMatrixRow[]>("/api/learning/skill-matrix", []),
        safe<TrainingRow[]>("/api/learning/training-assignments?overdueOnly=false", []),
        safe<CertCatalogItem[]>("/api/learning/certifications", []),
        safe<EmployeeCertListItem[]>("/api/learning/employee-certifications", []),
        safe<SkillCatalogItem[]>("/api/learning/skills", []),
      ]);
      setCertSummaries(cs);
      setSkillCov(sc);
      setMatrixRows(sm);
      setTrainingAssignments(ta);
      setCertCatalog(cc);
      setEmployeeCerts(ec);
      setSkillsCatalog(sk);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Failed to load learning data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    apiFetch<DepartmentOption[]>("/api/organization/departments")
      .then(setDepartments)
      .catch(() => setDepartments([]));
  }, []);

  const activeCourses = courses.filter((x) => x.isActive);
  const openAssignments = trainingAssignments.filter(
    (t) => t.status === "Assigned" || t.status === "InProgress",
  );
  const openAssignmentsPager = useClientPagination(openAssignments);
  const coursesPager = useClientPagination(courses);
  const certSummariesPager = useClientPagination(certSummaries);
  const skillCovPager = useClientPagination(skillCov);
  const matrixRowsPager = useClientPagination(matrixRows);
  const certCatalogPager = useClientPagination(certCatalog);
  const employeeCertsPager = useClientPagination(employeeCerts);
  const skillsCatalogPager = useClientPagination(skillsCatalog);
  const trainingAssignmentsPager = useClientPagination(trainingAssignments);

  const employeeFormOptions = useMemo<FormSelectOption[]>(
    () => employeeOptions.map((e) => ({ value: e.id, label: employeeLabel(e) })),
    [employeeOptions],
  );
  const assignDepartmentOptions = useMemo<FormSelectOption[]>(
    () => [{ value: "", label: "All departments" }, ...departments.map((d) => ({ value: d.id, label: d.name }))],
    [departments],
  );
  const activeCertTypeOptions = useMemo<FormSelectOption[]>(
    () => certCatalog.filter((c) => c.isActive).map((c) => ({ value: c.id, label: c.issuingBody ? `${c.name} (${c.issuingBody})` : c.name })),
    [certCatalog],
  );
  const activeCourseOptions = useMemo<FormSelectOption[]>(
    () => courses.filter((c) => c.isActive).map((c) => ({ value: c.id, label: `${c.title} (${c.code})` })),
    [courses],
  );
  const skillCatalogOptions = useMemo<FormSelectOption[]>(
    () => skillsCatalog.map((s) => ({ value: s.id, label: s.category ? `${s.name} (${s.category})` : s.name })),
    [skillsCatalog],
  );

  async function loadEmployeeOptions() {
    const res = await apiFetch<{
      items: { id: string; firstName: string; lastName: string; employeeCode?: string; departmentId?: string }[];
    }>("/api/employees?pageSize=500&excludeTerminated=true");
    const items: EmployeeOption[] = (res.items ?? []).map((e) => ({
      id: e.id,
      firstName: e.firstName,
      lastName: e.lastName,
      employeeCode: e.employeeCode,
      departmentId: e.departmentId,
    }));
    setEmployeeOptions(items);
    return items;
  }

  function onAssignDepartmentChange(departmentId: string) {
    setAssignDepartmentFilter(departmentId);
    setAssignEmployeeId("");
  }

  function openCertTypeModal(item?: CertCatalogItem) {
    if (item) {
      setEditingCertType(item);
      setCertTypeName(item.name);
      setCertTypeIssuer(item.issuingBody ?? "");
      setCertTypeDesc(item.description ?? "");
      setCertTypeActive(String(item.isActive));
    } else {
      setEditingCertType(null);
      setCertTypeName("");
      setCertTypeIssuer("");
      setCertTypeDesc("");
      setCertTypeActive("true");
    }
    setShowCertTypeModal(true);
  }

  async function saveCertType() {
    if (!certTypeName.trim()) return;
    setCertTypeSaving(true);
    try {
      const body = {
        name: certTypeName.trim(),
        issuingBody: certTypeIssuer.trim() || null,
        description: certTypeDesc.trim() || null,
        isActive: certTypeActive === "true",
      };
      if (editingCertType) {
        await apiFetch(`/api/learning/certifications/${editingCertType.id}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await apiFetch("/api/learning/certifications", { method: "POST", body: JSON.stringify(body) });
      }
      setShowCertTypeModal(false);
      await refresh();
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Failed to save certification type");
    } finally {
      setCertTypeSaving(false);
    }
  }

  async function deleteCertType(id: string) {
    if (!(await appConfirm("Delete this certification type?"))) return;
    try {
      await apiFetch(`/api/learning/certifications/${id}`, { method: "DELETE" });
      await refresh();
    } catch {
      await appAlert("Failed to delete certification type");
    }
  }

  async function openEmpCertModal(item?: EmployeeCertListItem) {
    try {
      const emps = employeeOptions.length ? employeeOptions : await loadEmployeeOptions();
      const types = certCatalog.filter((c) => c.isActive);
      if (!item && types.length === 0) {
        await appAlert("Add a certification type first.");
        return;
      }
      if (!item && emps.length === 0) {
        await appAlert("No employees available.");
        return;
      }
      if (item) {
        setEditingEmpCert(item);
        setEmpCertEmployeeId(item.employeeId);
        setEmpCertTypeId(item.certificationId);
        setEmpCertObtained(item.obtainedDate?.slice(0, 10) ?? "");
        setEmpCertExpiry(item.expiryDate?.slice(0, 10) ?? "");
        setEmpCertNumber(item.certificateNumber ?? "");
        setEmpCertStatus(item.status || "Active");
      } else {
        setEditingEmpCert(null);
        setEmpCertEmployeeId(emps[0]!.id);
        setEmpCertTypeId(types[0]!.id);
        setEmpCertObtained("");
        setEmpCertExpiry("");
        setEmpCertNumber("");
        setEmpCertStatus("Active");
      }
      setShowEmpCertModal(true);
    } catch {
      await appAlert("Could not load employees.");
    }
  }

  async function saveEmpCert() {
    if (!empCertObtained.trim() || (!editingEmpCert && (!empCertEmployeeId || !empCertTypeId))) return;
    setEmpCertSaving(true);
    try {
      const employeeId = editingEmpCert?.employeeId ?? empCertEmployeeId;
      const body = {
        certificationId: editingEmpCert?.certificationId ?? empCertTypeId,
        obtainedDate: new Date(empCertObtained).toISOString(),
        expiryDate: empCertExpiry ? new Date(empCertExpiry).toISOString() : null,
        certificateNumber: empCertNumber.trim() || null,
        status: empCertStatus || "Active",
      };
      if (editingEmpCert) {
        await apiFetch(`/api/employees/${employeeId}/certifications/${editingEmpCert.id}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await apiFetch(`/api/employees/${employeeId}/certifications`, { method: "POST", body: JSON.stringify(body) });
      }
      setShowEmpCertModal(false);
      await refresh();
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Failed to save employee certification");
    } finally {
      setEmpCertSaving(false);
    }
  }

  async function deleteEmpCert(item: EmployeeCertListItem) {
    if (!(await appConfirm("Remove this employee certification?"))) return;
    try {
      await apiFetch(`/api/employees/${item.employeeId}/certifications/${item.id}`, { method: "DELETE" });
      await refresh();
    } catch {
      await appAlert("Failed to delete employee certification");
    }
  }

  function openSkillModal(item?: SkillCatalogItem) {
    if (item) {
      setEditingSkill(item);
      setSkillName(item.name);
      setSkillCategory(item.category ?? "");
      setSkillActive("true");
    } else {
      setEditingSkill(null);
      setSkillName("");
      setSkillCategory("");
      setSkillActive("true");
    }
    setShowSkillModal(true);
  }

  async function saveSkillCatalog() {
    if (!skillName.trim()) return;
    setSkillSaving(true);
    try {
      const body = { name: skillName.trim(), category: skillCategory.trim() || null, description: null, isActive: skillActive === "true" };
      if (editingSkill) {
        await apiFetch(`/api/learning/skills/${editingSkill.id}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await apiFetch("/api/learning/skills", { method: "POST", body: JSON.stringify(body) });
      }
      setShowSkillModal(false);
      await refresh();
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Failed to save skill");
    } finally {
      setSkillSaving(false);
    }
  }

  async function deleteSkillCatalog(id: string) {
    if (!(await appConfirm("Delete this skill from the catalog?"))) return;
    try {
      await apiFetch(`/api/learning/skills/${id}`, { method: "DELETE" });
      await refresh();
    } catch {
      await appAlert("Failed to delete skill");
    }
  }

  async function openMatrixModal(row?: SkillMatrixRow) {
    try {
      const emps = employeeOptions.length ? employeeOptions : await loadEmployeeOptions();
      if (!row && skillsCatalog.length === 0) {
        await appAlert("Add skills to the catalog first.");
        return;
      }
      if (!row && emps.length === 0) {
        await appAlert("No employees available.");
        return;
      }
      if (row) {
        setEditingMatrix(row);
        setMatrixEmployeeId(row.employeeId);
        setMatrixSkillId(row.skillId);
        setMatrixProficiency(String(row.proficiencyLevel));
        setMatrixAssessedAt(row.assessedAt?.slice(0, 10) ?? "");
        setMatrixNotes(row.notes ?? "");
      } else {
        setEditingMatrix(null);
        setMatrixEmployeeId(emps[0]!.id);
        setMatrixSkillId(skillsCatalog[0]!.id);
        setMatrixProficiency("3");
        setMatrixAssessedAt("");
        setMatrixNotes("");
      }
      setShowMatrixModal(true);
    } catch {
      await appAlert("Could not load employees.");
    }
  }

  async function saveMatrixEntry() {
    if (!matrixProficiency.trim() || (!editingMatrix && (!matrixEmployeeId || !matrixSkillId))) return;
    setMatrixSaving(true);
    try {
      const assessedPayload = matrixAssessedAt ? new Date(matrixAssessedAt).toISOString() : null;
      const notesPayload = matrixNotes.trim() || null;
      if (editingMatrix) {
        await apiFetch(`/api/learning/skill-matrix/${editingMatrix.id}`, {
          method: "PUT",
          body: JSON.stringify({ proficiencyLevel: Number(matrixProficiency), assessedAt: assessedPayload, notes: notesPayload }),
        });
      } else {
        await apiFetch("/api/learning/skill-matrix", {
          method: "POST",
          body: JSON.stringify({
            employeeId: matrixEmployeeId,
            skillId: matrixSkillId,
            proficiencyLevel: Number(matrixProficiency),
            assessedAt: assessedPayload,
            notes: notesPayload,
          }),
        });
      }
      setShowMatrixModal(false);
      await refresh();
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Failed to save skill matrix entry");
    } finally {
      setMatrixSaving(false);
    }
  }

  async function deleteMatrixEntry(id: string) {
    if (!(await appConfirm("Remove this skill matrix entry?"))) return;
    try {
      await apiFetch(`/api/learning/skill-matrix/${id}`, { method: "DELETE" });
      await refresh();
    } catch {
      await appAlert("Failed to delete skill matrix entry");
    }
  }

  async function openAssignModal(row?: TrainingRow) {
    try {
      const activeCourses = courses.filter((c) => c.isActive);
      if (!row && activeCourses.length === 0) {
        await appAlert("Add an active course to the catalog first.");
        return;
      }
      if (row) {
        setEditingAssign(row);
        setAssignEmployeeId(row.employeeId);
        setAssignCourseId(row.courseId);
        setAssignDue(row.dueDate?.slice(0, 10) ?? "");
        setAssignStatus(row.status || "Assigned");
        setAssignNotes(row.notes ?? "");
      } else {
        setEditingAssign(null);
        setAssignDepartmentFilter("");
        setAssignEmployeeId("");
        setAssignCourseId(activeCourses[0]!.id);
        setAssignDue("");
        setAssignStatus("Assigned");
        setAssignNotes("");
      }
      setShowAssignModal(true);
    } catch {
      await appAlert("Could not open assignment form.");
    }
  }

  async function saveAssignment(e: FormEvent) {
    e.preventDefault();
    setAssignSaving(true);
    try {
      if (editingAssign) {
        await apiFetch(`/api/learning/training-assignments/${editingAssign.id}`, {
          method: "PUT",
          body: JSON.stringify({
            status: assignStatus,
            dueDate: assignDue ? new Date(assignDue).toISOString() : null,
            completedAt: editingAssign.completedAt,
            notes: assignNotes.trim() || null,
          }),
        });
      } else {
        await apiFetch("/api/learning/training-assignments", {
          method: "POST",
          body: JSON.stringify({
            employeeId: assignEmployeeId,
            courseId: assignCourseId,
            dueDate: assignDue ? new Date(assignDue).toISOString() : null,
            notes: assignNotes.trim() || null,
          }),
        });
      }
      setShowAssignModal(false);
      await refresh();
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Failed to save assignment");
    } finally {
      setAssignSaving(false);
    }
  }

  async function deleteAssignment(row: TrainingRow) {
    if (!(await appConfirm("Delete this training assignment?"))) return;
    try {
      await apiFetch(`/api/learning/training-assignments/${row.id}`, { method: "DELETE" });
      await refresh();
    } catch {
      await appAlert("Failed to delete assignment");
    }
  }

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
                  </div>
                ))}
              </div>

              <div className="grid gap-6 lg:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-base font-semibold text-slate-800">Skill coverage</h3>
                  </div>
                  {skillCoverageBars.length === 0 ? (
                    <p className="py-8 text-center text-sm text-slate-500">No skill coverage data.</p>
                  ) : (
                    <HorizontalCompareBars items={skillCoverageBars} />
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-base font-semibold text-slate-800">Assignment status</h3>
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
                  </div>
                  <div className="grid gap-2.5">
                    {(
                      [
                        ["courses", "Course catalog", "View and add courses"],
                        ["assignments", "Assignments", "Review training status"],
                        ["certifications", "Certifications", "Compliance and expiry"],
                        ["skills", "Skills & matrix", "Coverage and proficiency"],
                      ] as const
                    ).map(([key, title]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setPageTab(key)}
                        className="group rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-800">{title}</div>
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
                        openAssignmentsPager.pageItems.map((t) => (
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
                <TablePagination page={openAssignmentsPager.page} totalPages={openAssignmentsPager.totalPages} totalCount={openAssignmentsPager.totalCount} pageSize={openAssignmentsPager.pageSize} onPageChange={openAssignmentsPager.setPage} />
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
                    coursesPager.pageItems.map((c) => (
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
            <TablePagination page={coursesPager.page} totalPages={coursesPager.totalPages} totalCount={coursesPager.totalCount} pageSize={coursesPager.pageSize} onPageChange={coursesPager.setPage} />
          </div>
        </div>
      )}

      {pageTab === "certifications" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <CardHeader title="Certification types">
              <Button className="min-h-0 rounded-lg px-3 py-1.5 text-xs" onClick={() => openCertTypeModal()}>+ New type</Button>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="px-6 py-2.5 font-semibold text-slate-600">Name</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-600">Issuing body</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-600">Status</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {certCatalog.length === 0 ? (
                    <tr><td colSpan={4} className="px-6 py-6 text-center text-slate-400">No certification types yet.</td></tr>
                  ) : (
                    certCatalogPager.pageItems.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/50">
                        <td className="px-6 py-3 font-medium text-slate-700">{c.name}</td>
                        <td className="px-4 py-3 text-slate-600">{c.issuingBody ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{c.isActive ? "Active" : "Inactive"}</td>
                        <td className="px-4 py-3"><RowActions onEdit={() => openCertTypeModal(c)} onDelete={() => void deleteCertType(c.id)} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <TablePagination page={certCatalogPager.page} totalPages={certCatalogPager.totalPages} totalCount={certCatalogPager.totalCount} pageSize={certCatalogPager.pageSize} onPageChange={certCatalogPager.setPage} />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <CardHeader title="Employee certifications">
              <Button className="min-h-0 rounded-lg px-3 py-1.5 text-xs" onClick={() => void openEmpCertModal()}>+ Assign certification</Button>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="px-6 py-2.5 font-semibold text-slate-600">Employee</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-600">Certification</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-600">Obtained</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-600">Expires</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-600">Status</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employeeCerts.length === 0 ? (
                    <tr><td colSpan={6} className="px-6 py-6 text-center text-slate-400">No employee certifications yet.</td></tr>
                  ) : (
                    employeeCertsPager.pageItems.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/50">
                        <td className="px-6 py-3 font-medium text-slate-700">{r.employeeName}</td>
                        <td className="px-4 py-3 text-slate-600">{r.certificationName}</td>
                        <td className="px-4 py-3 text-slate-600">{formatDate(r.obtainedDate)}</td>
                        <td className="px-4 py-3 text-slate-600">{formatDate(r.expiryDate)}</td>
                        <td className="px-4 py-3 text-slate-600">{r.status}</td>
                        <td className="px-4 py-3"><RowActions onEdit={() => void openEmpCertModal(r)} onDelete={() => void deleteEmpCert(r)} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <TablePagination page={employeeCertsPager.page} totalPages={employeeCertsPager.totalPages} totalCount={employeeCertsPager.totalCount} pageSize={employeeCertsPager.pageSize} onPageChange={employeeCertsPager.setPage} />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <CardHeader title="Compliance summary" />
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
                    <tr><td colSpan={3} className="px-6 py-6 text-center text-slate-400">No certification data.</td></tr>
                  ) : (
                    certSummariesPager.pageItems.map((r) => (
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
            <TablePagination page={certSummariesPager.page} totalPages={certSummariesPager.totalPages} totalCount={certSummariesPager.totalCount} pageSize={certSummariesPager.pageSize} onPageChange={certSummariesPager.setPage} />
          </div>
        </div>
      )}

      {pageTab === "skills" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <CardHeader title="Skills catalog">
              <Button className="min-h-0 rounded-lg px-3 py-1.5 text-xs" onClick={() => openSkillModal()}>+ New skill</Button>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="px-6 py-2.5 font-semibold text-slate-600">Skill</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-600">Category</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {skillsCatalog.length === 0 ? (
                    <tr><td colSpan={3} className="px-6 py-6 text-center text-slate-400">No skills in catalog yet.</td></tr>
                  ) : (
                    skillsCatalogPager.pageItems.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/50">
                        <td className="px-6 py-3 font-medium text-slate-700">{s.name}</td>
                        <td className="px-4 py-3 text-slate-600">{s.category ?? "—"}</td>
                        <td className="px-4 py-3"><RowActions onEdit={() => openSkillModal(s)} onDelete={() => void deleteSkillCatalog(s.id)} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <TablePagination page={skillsCatalogPager.page} totalPages={skillsCatalogPager.totalPages} totalCount={skillsCatalogPager.totalCount} pageSize={skillsCatalogPager.pageSize} onPageChange={skillsCatalogPager.setPage} />
          </div>

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
                    skillCovPager.pageItems.map((r) => (
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
            <TablePagination page={skillCovPager.page} totalPages={skillCovPager.totalPages} totalCount={skillCovPager.totalCount} pageSize={skillCovPager.pageSize} onPageChange={skillCovPager.setPage} />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <CardHeader title="Skill matrix">
              <Button className="min-h-0 rounded-lg px-3 py-1.5 text-xs" onClick={() => void openMatrixModal()}>+ Add entry</Button>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="sticky top-0 bg-slate-50 text-left">
                    <th className="px-6 py-2.5 font-semibold text-slate-600">Employee</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-600">Skill</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-600">Level</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-600">Assessed</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-600">Notes</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {matrixRows.length === 0 ? (
                    <tr><td colSpan={6} className="px-6 py-6 text-center text-slate-400">No matrix entries yet.</td></tr>
                  ) : (
                    matrixRowsPager.pageItems.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/50">
                        <td className="px-6 py-3 font-medium text-slate-700">{m.employeeName}</td>
                        <td className="px-4 py-3 text-slate-600">{m.skillName}</td>
                        <td className="px-4 py-3 text-slate-600">{m.proficiencyLevel}</td>
                        <td className="px-4 py-3 text-slate-600">{formatDateTime(m.assessedAt)}</td>
                        <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{m.notes ?? "—"}</td>
                        <td className="px-4 py-3"><RowActions onEdit={() => void openMatrixModal(m)} onDelete={() => void deleteMatrixEntry(m.id)} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <TablePagination page={matrixRowsPager.page} totalPages={matrixRowsPager.totalPages} totalCount={matrixRowsPager.totalCount} pageSize={matrixRowsPager.pageSize} onPageChange={matrixRowsPager.setPage} />
          </div>
        </div>
      )}

      {pageTab === "assignments" && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <CardHeader title="Training assignments">
            <Button className="min-h-0 rounded-lg px-3 py-1.5 text-xs" onClick={() => void openAssignModal()}>+ New assignment</Button>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-6 py-2.5 font-semibold text-slate-600">Employee</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Course</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Due</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600">Assigned</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trainingAssignments.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-6 text-center text-slate-400">No assignments.</td></tr>
                ) : (
                  trainingAssignmentsPager.pageItems.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-3 font-medium text-slate-700">{t.employeeName}</td>
                      <td className="px-4 py-3 text-slate-600">{t.courseTitle}</td>
                      <td className="px-4 py-3 text-slate-600">{t.status}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(t.dueDate)}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDateTime(t.assignedAt)}</td>
                      <td className="px-4 py-3"><RowActions onEdit={() => void openAssignModal(t)} onDelete={() => void deleteAssignment(t)} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <TablePagination page={trainingAssignmentsPager.page} totalPages={trainingAssignmentsPager.totalPages} totalCount={trainingAssignmentsPager.totalCount} pageSize={trainingAssignmentsPager.pageSize} onPageChange={trainingAssignmentsPager.setPage} />
        </div>
      )}

      <Modal open={showCertTypeModal} onClose={() => setShowCertTypeModal(false)} title={editingCertType ? "Edit certification type" : "New certification type"}>
        <div className="space-y-4">
          <div><label className={labelClass}>Name *</label><input value={certTypeName} onChange={(e) => setCertTypeName(e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>Issuing body</label><input value={certTypeIssuer} onChange={(e) => setCertTypeIssuer(e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>Description</label><textarea value={certTypeDesc} onChange={(e) => setCertTypeDesc(e.target.value)} rows={2} className={inputClass + " resize-y"} /></div>
          <div><label className={labelClass}>Status</label><FormSelect value={certTypeActive} onValueChange={setCertTypeActive} options={ACTIVE_OPTIONS} /></div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowCertTypeModal(false)}>Cancel</Button>
            <Button onClick={() => void saveCertType()} disabled={!certTypeName.trim() || certTypeSaving}>{certTypeSaving ? "Saving…" : "Save"}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={showEmpCertModal} onClose={() => setShowEmpCertModal(false)} title={editingEmpCert ? "Edit employee certification" : "Assign certification"} wide>
        <div className="grid gap-4 sm:grid-cols-2">
          {!editingEmpCert && (
            <>
              <div className="sm:col-span-2"><label className={labelClass}>Employee *</label><FormSelect value={empCertEmployeeId} onValueChange={setEmpCertEmployeeId} options={employeeFormOptions} placeholder="-- Select --" /></div>
              <div className="sm:col-span-2"><label className={labelClass}>Certification type *</label><FormSelect value={empCertTypeId} onValueChange={setEmpCertTypeId} options={activeCertTypeOptions} placeholder="-- Select --" /></div>
            </>
          )}
          {editingEmpCert && (
            <div className="sm:col-span-2"><label className={labelClass}>Record</label><input readOnly value={`${editingEmpCert.employeeName} · ${editingEmpCert.certificationName}`} className={inputClass + " bg-slate-50"} /></div>
          )}
          <div><label className={labelClass}>Obtained *</label><DatePickerField value={empCertObtained} onChange={setEmpCertObtained} max={empCertExpiry || undefined} className={inputClass} /></div>
          <div><label className={labelClass}>Expires</label><DatePickerField value={empCertExpiry} onChange={setEmpCertExpiry} min={empCertObtained || undefined} className={inputClass} /></div>
          <div><label className={labelClass}>Certificate number</label><input value={empCertNumber} onChange={(e) => setEmpCertNumber(e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>Status</label><FormSelect value={empCertStatus} onValueChange={setEmpCertStatus} options={CERT_STATUS_OPTIONS} /></div>
        </div>
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowEmpCertModal(false)}>Cancel</Button>
          <Button onClick={() => void saveEmpCert()} disabled={!empCertObtained.trim() || empCertSaving}>{empCertSaving ? "Saving…" : "Save"}</Button>
        </div>
      </Modal>

      <Modal open={showSkillModal} onClose={() => setShowSkillModal(false)} title={editingSkill ? "Edit skill" : "New skill"}>
        <div className="space-y-4">
          <div><label className={labelClass}>Name *</label><input value={skillName} onChange={(e) => setSkillName(e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>Category</label><input value={skillCategory} onChange={(e) => setSkillCategory(e.target.value)} className={inputClass} placeholder="e.g. Technical" /></div>
          <div><label className={labelClass}>Status</label><FormSelect value={skillActive} onValueChange={setSkillActive} options={ACTIVE_OPTIONS} /></div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowSkillModal(false)}>Cancel</Button>
            <Button onClick={() => void saveSkillCatalog()} disabled={!skillName.trim() || skillSaving}>{skillSaving ? "Saving…" : "Save"}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={showMatrixModal} onClose={() => setShowMatrixModal(false)} title={editingMatrix ? "Edit matrix entry" : "Add matrix entry"} wide>
        <div className="grid gap-4 sm:grid-cols-2">
          {!editingMatrix && (
            <>
              <div><label className={labelClass}>Employee *</label><FormSelect value={matrixEmployeeId} onValueChange={setMatrixEmployeeId} options={employeeFormOptions} placeholder="-- Select --" /></div>
              <div><label className={labelClass}>Skill *</label><FormSelect value={matrixSkillId} onValueChange={setMatrixSkillId} options={skillCatalogOptions} placeholder="-- Select --" /></div>
            </>
          )}
          {editingMatrix && (
            <div className="sm:col-span-2"><label className={labelClass}>Entry</label><input readOnly value={`${editingMatrix.employeeName} · ${editingMatrix.skillName}`} className={inputClass + " bg-slate-50"} /></div>
          )}
          <div><label className={labelClass}>Proficiency (1–5) *</label><FormSelect value={matrixProficiency} onValueChange={setMatrixProficiency} options={MATRIX_PROFICIENCY_OPTIONS} /></div>
          <div><label className={labelClass}>Assessed</label><DatePickerField value={matrixAssessedAt} onChange={setMatrixAssessedAt} className={inputClass} /></div>
          <div className="sm:col-span-2"><label className={labelClass}>Notes</label><textarea value={matrixNotes} onChange={(e) => setMatrixNotes(e.target.value)} rows={2} className={inputClass + " resize-y"} /></div>
        </div>
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowMatrixModal(false)}>Cancel</Button>
          <Button onClick={() => void saveMatrixEntry()} disabled={!matrixProficiency || matrixSaving}>{matrixSaving ? "Saving…" : "Save"}</Button>
        </div>
      </Modal>

      <Modal open={showAssignModal} onClose={() => setShowAssignModal(false)} title={editingAssign ? "Edit assignment" : "New assignment"} wide>
        <form onSubmit={saveAssignment} className="grid gap-4 sm:grid-cols-2">
          {!editingAssign && (
            <>
              <div className="sm:col-span-2">
                <label className={labelClass}>Department</label>
                <FormSelect
                  value={assignDepartmentFilter}
                  onValueChange={onAssignDepartmentChange}
                  options={assignDepartmentOptions}
                  placeholder="All departments"
                />
                <p className="mt-1 text-xs text-slate-500">Narrow the employee list by department.</p>
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Employee *</label>
                <EmployeeSearchCombobox
                  key={assignDepartmentFilter || "all"}
                  value={assignEmployeeId}
                  departmentId={assignDepartmentFilter || undefined}
                  placeholder="Type name or employee ID…"
                  onPick={(emp) => setAssignEmployeeId(emp?.id ?? "")}
                />
                <p className="mt-1 text-xs text-slate-500">Start typing to search; results respect the department filter above.</p>
              </div>
              <div className="sm:col-span-2"><label className={labelClass}>Course *</label><FormSelect value={assignCourseId} onValueChange={setAssignCourseId} options={activeCourseOptions} placeholder="-- Select --" /></div>
            </>
          )}
          {editingAssign && (
            <div className="sm:col-span-2"><label className={labelClass}>Assignment</label><input readOnly value={`${editingAssign.employeeName} · ${editingAssign.courseTitle}`} className={inputClass + " bg-slate-50"} /></div>
          )}
          <div><label className={labelClass}>Status</label><FormSelect value={assignStatus} onValueChange={setAssignStatus} options={ASSIGNMENT_STATUS_OPTIONS} /></div>
          <div><label className={labelClass}>Due date</label><DatePickerField value={assignDue} onChange={setAssignDue} className={inputClass} /></div>
          <div className="sm:col-span-2"><label className={labelClass}>Notes</label><textarea value={assignNotes} onChange={(e) => setAssignNotes(e.target.value)} rows={2} className={inputClass + " resize-y"} /></div>
          <div className="sm:col-span-2 flex justify-end gap-3">
            <Button variant="secondary" type="button" onClick={() => setShowAssignModal(false)}>Cancel</Button>
            <Button type="submit" disabled={assignSaving || (!editingAssign && (!assignEmployeeId || !assignCourseId))}>{assignSaving ? "Saving…" : "Save"}</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
