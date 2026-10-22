"use client";

import { useEffect, useState, useCallback, useRef, useMemo, type ReactNode } from "react";
import Link from "next/link";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { apiFetch, apiFetchBlob } from "@/lib/api";
import { downloadBlob } from "@/lib/template-pdf";
import { formatDate, formatDateTime } from "@/lib/date-utils";
import { resolveAssetUrl } from "@/config/constants";
import { ROUTES } from "@/config/routes";
import { useAuth } from "@/contexts/auth-context";
import { displayWorkEmail } from "@/lib/employee-email";
import { Modal } from "@/components/ui/Modal";
import { ListAutocompleteInput, SectionRecordHeaderActions, InlinePageAlert } from "@/components/ui";
import { appAlert, appConfirm } from "@/components/ui/appDialogs";
import { sanitizeSearchInput } from "@/lib/input-validation";
import {
  type EmploymentTypeCatalogItem,
  employmentTypeDisplayName,
} from "@/lib/employment-types";

function dash(v: string | null | undefined): string {
  const s = v?.trim();
  return s ? s : "—";
}

function fmtFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function mimeShort(contentType: string | null | undefined): string {
  const raw = contentType?.trim() ?? "";
  if (!raw) return "—";
  const map: Record<string, string> = {
    "application/pdf": "PDF",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
    "application/msword": "Word",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
    "image/jpeg": "JPEG",
    "image/png": "PNG",
  };
  return map[raw] ?? (raw.length > 28 ? `${raw.slice(0, 25)}…` : raw);
}

/** List row from GET /api/employees?search= */
interface EmployeeSearchHit {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string | null;
  jobTitleName: string | null;
  positionTitle: string | null;
  departmentName: string | null;
  profileImageUrl?: string | null;
}

interface DepartmentLookup {
  id: string;
  name: string;
}

interface EmployeeDetail {
  id: string;
  employeeCode: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  fullName: string;
  email: string;
  phone: string | null;
  addressStreet1: string | null;
  addressStreet2: string | null;
  city: string | null;
  country: string | null;
  stateProvince: string | null;
  zipPostalCode: string | null;
  district: string | null;
  pollingDivision: string | null;
  distanceToOffice: string | null;
  modeOfTransport: string | null;
  homeTelephone: string | null;
  workTelephone: string | null;
  otherEmail: string | null;
  permanentStreet1: string | null;
  permanentStreet2: string | null;
  permanentCity: string | null;
  permanentCountry: string | null;
  permanentStateProvince: string | null;
  permanentZipPostalCode: string | null;
  permanentDistrict: string | null;
  permanentPollingDivision: string | null;
  permanentDistanceToOffice: string | null;
  dateOfBirth: string;
  gender: string;
  maritalStatus: string | null;
  nationality: string | null;
  religion: string | null;
  ethnicity: string | null;
  otherId: string | null;
  fingerprintId: string | null;
  nationalId: string | null;
  tinNumber: string | null;
  epfNumber: string | null;
  etfNumber: string | null;
  driversLicenseNumber: string | null;
  driversLicenseType: string | null;
  licenseIssueDate: string | null;
  licenseExpiryDate: string | null;
  driversLicenseIssuingCountry: string | null;
  joinDate: string;
  probationEndDate: string | null;
  dateOfPermanency: string | null;
  terminationDate: string | null;
  terminationReason: string | null;
  status: string;
  employmentType: string;
  departmentId: string;
  departmentName: string | null;
  businessUnitId: string | null;
  businessUnitName: string | null;
  positionId: string | null;
  positionTitle: string | null;
  locationId: string | null;
  locationName: string | null;
  gradeId: string | null;
  gradeName: string | null;
  jobTitleId: string | null;
  jobTitleName: string | null;
  managerId: string | null;
  managerName: string | null;
  profileImageUrl: string | null;
  isTopOfHierarchy: boolean;
  isCashPayment?: boolean;
  hasDirectSupervisor: boolean;
}

interface EmergencyContactItem {
  id: string;
  name: string;
  relationship: string;
  homeTelephone: string | null;
  mobileTelephone: string | null;
  workTelephone: string | null;
}

interface DependentItem {
  id: string;
  firstName: string;
  lastName: string;
  relationship: string;
  dateOfBirth: string | null;
  maritalStatus: string | null;
  occupation: string | null;
  organization: string | null;
}

interface EducationItem {
  id: string;
  level: string;
  qualificationName: string | null;
  institute: string | null;
  major: string | null;
  year: string | null;
  gpaScore: string | null;
  startDate: string | null;
  endDate: string | null;
  remark: string | null;
}

interface SkillItem {
  id: string;
  skill: string;
  yearsOfExperience: string | null;
  comments: string | null;
}

interface SkillMasterItem {
  id: string;
  name: string;
  isActive?: boolean;
}

interface EmployeeCertRow {
  id: string;
  certificationName: string;
  obtainedDate: string;
  expiryDate: string | null;
  certificateNumber: string | null;
  status: string;
}

interface LanguageItem {
  id: string;
  language: string;
  skill: string;
  fluencyLevel: string;
  comments: string | null;
}

interface WorkExperienceItem {
  id: string;
  company: string;
  jobTitle: string;
  employmentType: string | null;
  fromDate: string | null;
  toDate: string | null;
  creditable: boolean;
  comment: string | null;
}

interface BankAccountItem {
  id: string;
  accountNumber: string;
  bankName: string | null;
  accountType: string;
  bankCode: string | null;
  branchCode: string | null;
  branchLocation: string | null;
}

interface ReportPerson {
  id: string;
  employeeCode: string;
  fullName: string;
  jobTitleName: string | null;
  reportingMethod: string;
}

interface Attachment {
  id: string;
  fileName: string;
  description: string | null;
  size: number;
  contentType: string;
  dateAdded: string;
  addedBy: string | null;
  attachmentTypeName?: string | null;
  expiryDate?: string | null;
}

interface TrainingAssignmentRow {
  id: string;
  courseTitle: string;
  courseCode: string;
  status: string;
  dueDate: string | null;
  assignedAt: string;
  completedAt: string | null;
}

interface SkillMatrixRow {
  id: string;
  skillName: string;
  proficiencyLevel: number;
  assessedAt: string | null;
  notes: string | null;
}

interface ImmigrationItem {
  id: string;
  documentType: string;
  number: string;
  issuedBy: string | null;
  issuedDate: string | null;
  expiryDate: string | null;
  eligibleReviewDate: string | null;
  eligibleStatus: string | null;
  comments: string | null;
}

interface BenefitData {
  id: string;
  insuranceProvider: string | null;
  coverageExtendedMedical: boolean;
  coverageDental: boolean;
  coverageVision: boolean;
  spousalCoverage: boolean;
  dependentsCovered: boolean;
}

interface DriverLicenseItem {
  id: string;
  number: string | null;
  licenseType: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  issuingCountry: string | null;
}

const card =
  "overflow-hidden rounded-[10px] border border-[var(--border)] bg-[var(--panel)]";
const cardHead = "border-b border-[var(--border)] px-5 py-3";
const cardTitle = "text-sm font-semibold tracking-tight text-[var(--text)]";
const labelCls =
  "text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]";
const valueCls = "mt-0.5 text-sm font-medium text-[var(--text)]";
const fieldClass =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--btn-primary)] focus:ring-2 focus:ring-[var(--btn-ring)]";

function BioSection({
  id,
  title,
  children,
  headerExtra,
}: {
  id: string;
  title: string;
  children: ReactNode;
  headerExtra?: ReactNode;
}) {
  return (
    <section id={id} className={`${card} scroll-mt-36`}>
      <div className={`${cardHead} flex items-center justify-between gap-3`}>
        <h2 className={cardTitle}>{title}</h2>
        {headerExtra}
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

const skillInputClass =
  fieldClass + " placeholder:text-[var(--muted)]";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className={labelCls}>{label}</div>
      <div className={valueCls}>{children}</div>
    </div>
  );
}

function DataTable({
  columns,
  rows,
  empty,
}: {
  columns: { key: string; header: string; className?: string }[];
  rows: Record<string, ReactNode>[];
  empty: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-400">{empty}</p>;
  }
  return (
    <div className="overflow-x-auto rounded-[10px] border border-[var(--border)]">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--soft)] text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            {columns.map((c) => (
              <th key={c.key} className={`px-4 py-2.5 ${c.className ?? ""}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-[var(--line2,var(--border))] last:border-0 hover:bg-[var(--soft)]">
              {columns.map((c) => (
                <td key={c.key} className={`px-4 py-2.5 text-[var(--text)] ${c.className ?? ""}`}>
                  {row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function downloadEmployeeFile(endpoint: string, fileName: string) {
  try {
    downloadBlob(await apiFetchBlob(endpoint), fileName || "download");
  } catch (err) {
    await appAlert(err instanceof Error ? err.message : "Could not download the file.");
  }
}

export default function EmployeeProfilePage() {
  const { user, isLoading: authLoading, getPeopleReadScope, getModuleReadScope, hasPermission, isAdmin } = useAuth();
  const employeeId = user?.employeeId ?? null;
  const bioScope = getModuleReadScope("EmployeeBio") ?? getPeopleReadScope();
  const canSearchOthers = bioScope === "Team" || bioScope === "All";
  const canFilterByDepartment = isAdmin && canSearchOthers;

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [dirSearch, setDirSearch] = useState("");
  const [dirDepartmentId, setDirDepartmentId] = useState("");
  const [departments, setDepartments] = useState<DepartmentLookup[]>([]);
  const [dirResults, setDirResults] = useState<EmployeeSearchHit[]>([]);
  const [dirOpen, setDirOpen] = useState(false);
  const [dirLoading, setDirLoading] = useState(false);
  const [activeEmployeeCount, setActiveEmployeeCount] = useState<number | null>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const dirSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirSearchRef = useRef("");
  const dirDepartmentIdRef = useRef("");

  const effectiveEmployeeId = selectedEmployeeId ?? employeeId;
  const isOwnProfile = !!employeeId && effectiveEmployeeId === employeeId;
  const canManageSkills =
    isOwnProfile && (hasPermission("People", "Create") || hasPermission("People", "Update"));

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emp, setEmp] = useState<EmployeeDetail | null>(null);
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContactItem[]>([]);
  const [dependents, setDependents] = useState<DependentItem[]>([]);
  const [educations, setEducations] = useState<EducationItem[]>([]);
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [showSkillModal, setShowSkillModal] = useState(false);
  const [skillSaving, setSkillSaving] = useState(false);
  const [editingSkill, setEditingSkill] = useState<SkillItem | null>(null);
  const [skillName, setSkillName] = useState("");
  const [skillYears, setSkillYears] = useState("");
  const [skillComments, setSkillComments] = useState("");
  const [skillMasterList, setSkillMasterList] = useState<SkillMasterItem[]>([]);
  const skillCatalogNames = useMemo(() => {
    const names = new Set(skillMasterList.map((s) => s.name.trim()).filter(Boolean));
    skills.forEach((s) => {
      const n = s.skill.trim();
      if (n) names.add(n);
    });
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [skillMasterList, skills]);
  const [certRows, setCertRows] = useState<EmployeeCertRow[]>([]);
  const [languages, setLanguages] = useState<LanguageItem[]>([]);
  const [workExperiences, setWorkExperiences] = useState<WorkExperienceItem[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccountItem[]>([]);
  const [supervisors, setSupervisors] = useState<ReportPerson[]>([]);
  const [subordinates, setSubordinates] = useState<ReportPerson[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [trainingRows, setTrainingRows] = useState<TrainingAssignmentRow[]>([]);
  const [matrixRows, setMatrixRows] = useState<SkillMatrixRow[]>([]);
  const [immigrations, setImmigrations] = useState<ImmigrationItem[]>([]);
  const [immDocs, setImmDocs] = useState<Attachment[]>([]);
  const [benefits, setBenefits] = useState<BenefitData[]>([]);
  const [driverLicenses, setDriverLicenses] = useState<DriverLicenseItem[]>([]);
  const [employmentTypes, setEmploymentTypes] = useState<EmploymentTypeCatalogItem[]>([]);

  const resetProfileState = useCallback(() => {
    setEmp(null);
    setEmergencyContacts([]);
    setDependents([]);
    setEducations([]);
    setSkills([]);
    setCertRows([]);
    setLanguages([]);
    setWorkExperiences([]);
    setBankAccounts([]);
    setSupervisors([]);
    setSubordinates([]);
    setAttachments([]);
    setTrainingRows([]);
    setMatrixRows([]);
    setImmigrations([]);
    setImmDocs([]);
    setBenefits([]);
    setDriverLicenses([]);
  }, []);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const e = await apiFetch<EmployeeDetail>(`/api/employees/${id}`);
      setEmp(e);

      const [
        ec,
        dep,
        edu,
        sk,
        cert,
        lang,
        we,
        ba,
        sup,
        sub,
        att,
        train,
        imm,
        idocs,
        ben,
        dls,
      ] = await Promise.all([
        apiFetch<EmergencyContactItem[]>(`/api/employees/${id}/emergency-contacts`).catch(() => []),
        apiFetch<DependentItem[]>(`/api/employees/${id}/dependents`).catch(() => []),
        apiFetch<EducationItem[]>(`/api/employees/${id}/educations`).catch(() => []),
        apiFetch<SkillItem[]>(`/api/employees/${id}/skills`).catch(() => []),
        apiFetch<EmployeeCertRow[]>(`/api/employees/${id}/certifications`).catch(() => []),
        apiFetch<LanguageItem[]>(`/api/employees/${id}/languages`).catch(() => []),
        apiFetch<WorkExperienceItem[]>(`/api/employees/${id}/work-experiences`).catch(() => []),
        apiFetch<BankAccountItem[]>(`/api/employees/${id}/bank-accounts`).catch(() => []),
        apiFetch<ReportPerson[]>(`/api/employees/${id}/supervisors`).catch(() => []),
        apiFetch<ReportPerson[]>(`/api/employees/${id}/subordinates`).catch(() => []),
        apiFetch<Attachment[]>(`/api/employees/${id}/attachments`).catch(() => []),
        apiFetch<TrainingAssignmentRow[]>(`/api/employees/${id}/training-assignments`).catch(() => []),
        apiFetch<ImmigrationItem[]>(`/api/employees/${id}/immigrations`).catch(() => []),
        apiFetch<Attachment[]>(`/api/employees/${id}/immigration-documents`).catch(() => []),
        apiFetch<BenefitData[]>(`/api/employees/${id}/benefits`).catch(() => []),
        apiFetch<DriverLicenseItem[]>(`/api/employees/${id}/driver-licenses`).catch(() => []),
      ]);

      setEmergencyContacts(ec);
      setDependents(dep);
      setEducations(edu);
      setSkills(sk);
      setCertRows(cert);
      setLanguages(lang);
      setWorkExperiences(we);
      setBankAccounts(ba);
      setSupervisors(sup);
      setSubordinates(sub);
      setAttachments(att);
      setTrainingRows(train);
      setImmigrations(imm);
      setImmDocs(idocs);
      setBenefits(ben);
      setDriverLicenses(dls);

      apiFetch<SkillMasterItem[]>("/api/employees/skills-catalog")
        .then((rows) => setSkillMasterList(rows.filter((r) => r.isActive !== false)))
        .catch(() => setSkillMasterList([]));

      try {
        const mx = await apiFetch<
          { id: string; skillName: string; proficiencyLevel: number; assessedAt: string | null; notes: string | null }[]
        >(`/api/learning/skill-matrix?employeeId=${id}`);
        setMatrixRows(mx.map((r) => ({ id: r.id, skillName: r.skillName, proficiencyLevel: r.proficiencyLevel, assessedAt: r.assessedAt, notes: r.notes })));
      } catch {
        setMatrixRows([]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load profile.");
      setEmp(null);
    } finally {
      setLoading(false);
    }
  }, []);

  function openSkillModal(sk?: SkillItem) {
    if (sk) {
      setEditingSkill(sk);
      setSkillName(sk.skill);
      setSkillYears(sk.yearsOfExperience ?? "");
      setSkillComments(sk.comments ?? "");
    } else {
      setEditingSkill(null);
      setSkillName("");
      setSkillYears("");
      setSkillComments("");
    }
    setShowSkillModal(true);
  }

  function closeSkillModal() {
    setShowSkillModal(false);
    setEditingSkill(null);
  }

  async function saveSkill() {
    if (!effectiveEmployeeId || !skillName.trim() || !skillYears.trim()) return;
    setSkillSaving(true);
    try {
      const body = {
        skill: skillName.trim(),
        yearsOfExperience: skillYears.trim(),
        comments: skillComments || null,
      };
      if (editingSkill) {
        const updated = await apiFetch<SkillItem>(
          `/api/employees/${effectiveEmployeeId}/skills/${editingSkill.id}`,
          { method: "PUT", body: JSON.stringify(body) },
        );
        setSkills((prev) => prev.map((s) => (s.id === editingSkill.id ? updated : s)));
      } else {
        const created = await apiFetch<SkillItem>(`/api/employees/${effectiveEmployeeId}/skills`, {
          method: "POST",
          body: JSON.stringify(body),
        });
        setSkills((prev) => [created, ...prev]);
      }
      closeSkillModal();
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Failed to save skill");
    } finally {
      setSkillSaving(false);
    }
  }

  async function deleteSkill(skillId: string) {
    if (!effectiveEmployeeId) return;
    if (!(await appConfirm("Delete this skill?"))) return;
    try {
      await apiFetch(`/api/employees/${effectiveEmployeeId}/skills/${skillId}`, { method: "DELETE" });
      setSkills((prev) => prev.filter((s) => s.id !== skillId));
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    apiFetch<EmploymentTypeCatalogItem[]>("/api/organization/employment-statuses")
      .then(setEmploymentTypes)
      .catch(() => setEmploymentTypes([]));
  }, []);

  useEffect(() => {
    if (!canFilterByDepartment) {
      setDepartments([]);
      setDirDepartmentId("");
      dirDepartmentIdRef.current = "";
      setActiveEmployeeCount(null);
      return;
    }
    apiFetch<DepartmentLookup[]>("/api/organization/departments")
      .then(setDepartments)
      .catch(() => setDepartments([]));
    apiFetch<{ totalCount: number }>(
      "/api/employees?pageSize=1&excludeTerminated=true&accessModule=EmployeeBio",
    )
      .then((res) => setActiveEmployeeCount(res.totalCount ?? 0))
      .catch(() => setActiveEmployeeCount(null));
  }, [canFilterByDepartment]);

  useEffect(() => {
    dirSearchRef.current = dirSearch;
  }, [dirSearch]);

  useEffect(() => {
    dirDepartmentIdRef.current = dirDepartmentId;
  }, [dirDepartmentId]);

  useEffect(() => {
    if (authLoading) return;
    if (!effectiveEmployeeId) {
      setLoading(false);
      setError(null);
      resetProfileState();
      return;
    }
    load(effectiveEmployeeId);
  }, [authLoading, effectiveEmployeeId, load, resetProfileState]);

  useEffect(() => {
    if (!dirOpen) return;
    function handleClick(e: MouseEvent) {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) setDirOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dirOpen]);

  const fetchDirectoryResults = useCallback(async (query: string, departmentId: string) => {
    const trimmed = query.trim();
    if (!trimmed && !departmentId) {
      setDirResults([]);
      setDirOpen(false);
      return;
    }
    setDirLoading(true);
    try {
      const params = new URLSearchParams({ pageSize: "10" });
      if (trimmed) params.set("search", trimmed);
      if (departmentId) params.set("departmentId", departmentId);
      params.set("accessModule", "EmployeeBio");
      const res = await apiFetch<{ items: EmployeeSearchHit[] }>(`/api/employees?${params}`);
      setDirResults(res.items ?? []);
      setDirOpen(true);
    } catch {
      setDirResults([]);
      setDirOpen(false);
    } finally {
      setDirLoading(false);
    }
  }, []);

  function handleDirSearchInput(query: string) {
    const sanitized = sanitizeSearchInput(query);
    setDirSearch(sanitized);
    dirSearchRef.current = sanitized;
    if (dirSearchTimer.current) clearTimeout(dirSearchTimer.current);
    dirSearchTimer.current = setTimeout(() => {
      void fetchDirectoryResults(sanitized, dirDepartmentIdRef.current);
    }, 300);
  }

  function handleDirDepartmentChange(departmentId: string) {
    setDirDepartmentId(departmentId);
    dirDepartmentIdRef.current = departmentId;
    if (dirSearchTimer.current) clearTimeout(dirSearchTimer.current);
    void fetchDirectoryResults(dirSearchRef.current, departmentId);
  }

  function clearDirectoryFilters() {
    setDirSearch("");
    setDirDepartmentId("");
    dirSearchRef.current = "";
    dirDepartmentIdRef.current = "";
    setDirResults([]);
    setDirOpen(false);
    if (dirSearchTimer.current) clearTimeout(dirSearchTimer.current);
  }

  function pickDirectoryEmployee(hit: EmployeeSearchHit) {
    setSelectedEmployeeId(hit.id);
    setDirSearch("");
    setDirResults([]);
    setDirOpen(false);
  }

  function clearToMyRecord() {
    setSelectedEmployeeId(null);
    setDirSearch("");
    setDirResults([]);
    setDirOpen(false);
  }

  const isViewingOtherPerson =
    effectiveEmployeeId != null &&
    (employeeId == null || effectiveEmployeeId !== employeeId);

  const pageTitle =
    !effectiveEmployeeId && canSearchOthers
      ? "Employee bio"
      : isViewingOtherPerson
        ? "Employee bio"
        : "My employee bio";

  const pageSubtitle = (() => {
    if (!effectiveEmployeeId && canSearchOthers) {
      return canFilterByDepartment
        ? "Search by name or employee code, and filter by department to open a read-only bio."
        : "Search for an employee to view their read-only bio.";
    }
    if (!effectiveEmployeeId) {
      return "Your HR record at a glance.";
    }
    if (isViewingOtherPerson && emp) {
      return `Viewing ${emp.fullName} · read-only summary.`;
    }
    if (isViewingOtherPerson) {
      return "Loading read-only summary…";
    }
    return "Read-only summary of your record. Updates are done through HR or your manager.";
  })();

  const showMyRecordButton =
    !!employeeId &&
    canSearchOthers &&
    (selectedEmployeeId != null || (effectiveEmployeeId != null && effectiveEmployeeId !== employeeId));

  const showDirectoryReset =
    canFilterByDepartment && (dirSearch.trim().length > 0 || dirDepartmentId.length > 0);

  const hasDirectoryFilters = dirSearch.trim().length > 0 || dirDepartmentId.length > 0;
  const selectedDepartmentName =
    departments.find((d) => d.id === dirDepartmentId)?.name ?? null;

  const directorySearchBar = !canSearchOthers ? null : (
    <div
      ref={searchWrapRef}
      className={`relative mb-6 rounded-[10px] border border-[var(--border)] bg-[var(--panel)] p-4 ${dirOpen ? "z-50" : "z-20"}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="relative w-full overflow-visible sm:w-72">
          <label htmlFor="emp-bio-search" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Find employee
          </label>
          <input
            id="emp-bio-search"
            type="search"
            autoComplete="off"
            placeholder="Name or employee code…"
            value={dirSearch}
            onChange={(e) => handleDirSearchInput(e.target.value)}
            className={fieldClass}
          />
          {dirOpen && effectiveEmployeeId && (
            <ul className="absolute left-0 right-0 top-full z-[60] mt-1 max-h-64 overflow-auto rounded-lg border border-[var(--border)] bg-[var(--panel)] py-1 shadow-xl sm:min-w-[18rem]">
              {dirLoading && <li className="px-4 py-3 text-sm text-slate-500">Searching…</li>}
              {!dirLoading && dirResults.length === 0 && (
                <li className="px-4 py-3 text-sm text-slate-500">No matches</li>
              )}
              {!dirLoading &&
                dirResults.map((h) => (
                  <li key={h.id} className="border-b border-slate-50 last:border-0">
                    <button
                      type="button"
                      className="flex w-full flex-col items-start gap-0.5 px-4 py-2.5 text-left text-sm transition hover:bg-slate-50"
                      onClick={() => pickDirectoryEmployee(h)}
                    >
                      <span className="font-medium text-slate-800">{h.fullName}</span>
                      <span className="text-xs text-slate-500">
                        {h.employeeCode}
                        {h.jobTitleName || h.positionTitle
                          ? ` · ${h.jobTitleName ?? h.positionTitle}`
                          : ""}
                        {h.departmentName ? ` · ${h.departmentName}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </div>
        {canFilterByDepartment && (
          <div className="w-full sm:w-52">
            <label htmlFor="emp-bio-department" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Department
            </label>
            <select
              id="emp-bio-department"
              value={dirDepartmentId}
              onChange={(e) => handleDirDepartmentChange(e.target.value)}
              className={fieldClass}
            >
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {showDirectoryReset && (
            <button
              type="button"
              onClick={clearDirectoryFilters}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-[#2B7DE9]/40 hover:text-[#1565C9]"
            >
              Reset filters
            </button>
          )}
          {showMyRecordButton && (
            <button
              type="button"
              onClick={clearToMyRecord}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-[#2B7DE9]/40 hover:text-[#1565C9]"
            >
              View my record
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const employeeBioLandingPanel = (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
      <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2B7DE9] to-indigo-600 text-xl text-white shadow-sm">
            👤
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Find a read-only employee bio</h2>
            <p className="mt-1 text-sm text-slate-600">
              Search by name or employee code{canFilterByDepartment ? ", or narrow by department" : ""}, then open the summary below.
            </p>
          </div>
        </div>
        <ol className="mt-6 space-y-3">
          <li className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2B7DE9]/10 text-xs font-bold text-[#1565C9]">1</span>
            <div>
              <p className="text-sm font-medium text-slate-800">Search for an employee</p>
              <p className="mt-0.5 text-xs text-slate-500">Type a name, code, or email fragment in the field above.</p>
            </div>
          </li>
          {canFilterByDepartment && (
            <li className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2B7DE9]/10 text-xs font-bold text-[#1565C9]">2</span>
              <div>
                <p className="text-sm font-medium text-slate-800">Filter by department</p>
                <p className="mt-0.5 text-xs text-slate-500">Use the department dropdown to focus on one team.</p>
              </div>
            </li>
          )}
          <li className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2B7DE9]/10 text-xs font-bold text-[#1565C9]">
              {canFilterByDepartment ? "3" : "2"}
            </span>
            <div>
              <p className="text-sm font-medium text-slate-800">Open the bio summary</p>
              <p className="mt-0.5 text-xs text-slate-500">Select a person from the matching results to view their record.</p>
            </div>
          </li>
        </ol>
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Quick links</h3>
        <p className="mt-1 text-xs text-slate-500">Jump to related People modules.</p>
        <div className="mt-4 grid gap-2.5">
          <Link
            href={ROUTES.people}
            className="group flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/50 px-4 py-3 transition hover:border-[#2B7DE9]/35 hover:bg-white hover:shadow-sm"
          >
            <div>
              <div className="text-sm font-semibold text-slate-800">People Hub</div>
              <p className="mt-0.5 text-xs text-slate-500">Full profiles, edits, and HR actions</p>
            </div>
            <span className="text-slate-400 transition group-hover:text-[#1565C9]">→</span>
          </Link>
          <Link
            href={ROUTES.orgStructure}
            className="group flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/50 px-4 py-3 transition hover:border-[#2B7DE9]/35 hover:bg-white hover:shadow-sm"
          >
            <div>
              <div className="text-sm font-semibold text-slate-800">Org Structure</div>
              <p className="mt-0.5 text-xs text-slate-500">Departments, locations, and reporting lines</p>
            </div>
            <span className="text-slate-400 transition group-hover:text-[#1565C9]">→</span>
          </Link>
          <Link
            href={ROUTES.reports}
            className="group flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/50 px-4 py-3 transition hover:border-[#2B7DE9]/35 hover:bg-white hover:shadow-sm"
          >
            <div>
              <div className="text-sm font-semibold text-slate-800">Reports</div>
              <p className="mt-0.5 text-xs text-slate-500">Workforce listings and exports</p>
            </div>
            <span className="text-slate-400 transition group-hover:text-[#1565C9]">→</span>
          </Link>
        </div>
        {canFilterByDepartment && (activeEmployeeCount != null || departments.length > 0) && (
          <div className="mt-5 grid grid-cols-2 gap-2.5">
            {activeEmployeeCount != null && (
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3 text-center">
                <div className="text-lg font-bold text-slate-900">{activeEmployeeCount}</div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Active employees</div>
              </div>
            )}
            {departments.length > 0 && (
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3 text-center">
                <div className="text-lg font-bold text-slate-900">{departments.length}</div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Departments</div>
              </div>
            )}
          </div>
        )}
      </section>

      {hasDirectoryFilters && (
        <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm lg:col-span-2">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-sm font-semibold text-slate-900">Matching employees</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {dirSearch.trim()
                ? `Results for “${dirSearch.trim()}”`
                : selectedDepartmentName
                  ? `Employees in ${selectedDepartmentName}`
                  : "Filtered results"}
            </p>
          </div>
          {dirLoading ? (
            <div className="flex min-h-[160px] items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#2B7DE9]" />
            </div>
          ) : dirResults.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm font-medium text-slate-800">No employees match your filters.</p>
              <p className="mt-1 text-sm text-slate-500">Try another search term or department.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {dirResults.map((hit) => (
                <li key={hit.id}>
                  <button
                    type="button"
                    onClick={() => pickDirectoryEmployee(hit)}
                    className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-slate-50"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#2B7DE9] to-indigo-600 text-xs font-bold text-white">
                      {`${hit.firstName[0] ?? ""}${hit.lastName[0] ?? ""}`.toUpperCase() || "?"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-900">{hit.fullName}</span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500">
                        {hit.employeeCode}
                        {hit.jobTitleName || hit.positionTitle
                          ? ` · ${hit.jobTitleName ?? hit.positionTitle}`
                          : ""}
                        {hit.departmentName ? ` · ${hit.departmentName}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-[#1565C9]">Open bio →</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );

  const initials = emp
    ? `${emp.firstName[0] ?? ""}${emp.lastName[0] ?? ""}`.toUpperCase() || "?"
    : "?";

  const toc = [
    { id: "bio-personal", label: "Personal" },
    { id: "bio-contact", label: "Contact" },
    { id: "bio-job", label: "Job" },
    { id: "bio-emergency", label: "Emergency" },
    { id: "bio-dependents", label: "Dependents" },
    { id: "bio-education", label: "Education" },
    { id: "bio-qualifications", label: "Qualifications" },
    { id: "bio-skills", label: "Skills" },
    { id: "bio-certs", label: "Certifications" },
    { id: "bio-languages", label: "Languages" },
    { id: "bio-work", label: "Experience" },
    { id: "bio-training", label: "Training" },
    { id: "bio-matrix", label: "Skill matrix" },
    { id: "bio-bank", label: "Bank" },
    { id: "bio-reporting", label: "Reporting" },
    { id: "bio-benefits", label: "Benefits" },
    { id: "bio-license", label: "License & IDs" },
    { id: "bio-immigration", label: "Immigration" },
    { id: "bio-files", label: "Files" },
  ];

  if (authLoading) {
    return (
      <>
        <AppTopbar title="Employee bio" subtitle="Your HR record at a glance." />
        <div className="flex min-h-[320px] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-[#2B7DE9]" />
        </div>
      </>
    );
  }

  if (!effectiveEmployeeId && !canSearchOthers) {
    return (
      <>
        <AppTopbar title="My employee bio" subtitle="Your HR record at a glance." />
        <div className="mx-auto max-w-lg rounded-2xl border border-amber-200/80 bg-amber-50/50 px-6 py-8 text-center">
          <p className="text-sm font-medium text-amber-900">No employee profile is linked to this account.</p>
          <p className="mt-2 text-sm text-amber-800/90">Ask HR to link your user to an employee record, or use People Hub if you manage other employees.</p>
          <Link
            href={ROUTES.people}
            className="mt-4 inline-flex rounded-xl border border-[#2B7DE9]/30 bg-white/80 px-4 py-2 text-sm font-semibold text-[#1565C9] shadow-sm backdrop-blur-sm transition hover:bg-white"
          >
            Open People Hub
          </Link>
        </div>
      </>
    );
  }

  if (!effectiveEmployeeId && canSearchOthers) {
    return (
      <>
        <AppTopbar title={pageTitle} subtitle={pageSubtitle} />
        {directorySearchBar}
        {employeeBioLandingPanel}
      </>
    );
  }

  if (loading) {
    return (
      <>
        <AppTopbar title={pageTitle} subtitle={pageSubtitle} />
        {directorySearchBar}
        <div className="flex min-h-[280px] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-[#2B7DE9]" />
        </div>
      </>
    );
  }

  if (error || !emp) {
    return (
      <>
        <AppTopbar title={pageTitle} subtitle={pageSubtitle} />
        {directorySearchBar}
        <InlinePageAlert message={error ?? "Profile unavailable."} className="rounded-2xl border border-red-200 bg-red-50/60 px-5 py-4 text-sm text-red-800 scroll-mt-20" />
      </>
    );
  }

  return (
    <>
      <AppTopbar title={pageTitle} subtitle={pageSubtitle} />

      {directorySearchBar}

      <nav
        className="sticky top-0 z-40 mb-5 flex flex-col gap-3 border-b border-[var(--border)] bg-[var(--bg)] py-3 sm:flex-row sm:items-center sm:justify-between"
        aria-label="Bio sections"
      >
        <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
          {toc.map((t) => (
            <a
              key={t.id}
              href={`#${t.id}`}
              className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] transition hover:text-[var(--text)]"
            >
              {t.label}
            </a>
          ))}
        </div>
        <Link
          href={`${ROUTES.people}/${emp.id}`}
          className="shrink-0 self-start rounded-lg bg-[var(--btn-primary)] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[var(--btn-primary-hover)] sm:self-auto"
        >
          Open full profile
        </Link>
      </nav>

      <div className={`${card} mb-6`}>
        <div className="flex flex-col gap-5 px-5 py-5 sm:flex-row sm:items-center sm:px-6">
          {emp.profileImageUrl ? (
            <img
              src={resolveAssetUrl(emp.profileImageUrl) ?? ""}
              alt=""
              className="h-16 w-16 shrink-0 rounded-xl border border-[var(--border)] object-cover"
            />
          ) : (
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-[var(--btn-primary)] text-lg font-semibold text-white">
              {initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold tracking-tight text-[var(--text)]">{emp.fullName}</h2>
            <p className="mt-1 text-[13px] text-[var(--muted)]">
              <span className="font-mono text-[var(--text)]">{emp.employeeCode}</span>
              <span className="mx-2">·</span>
              {dash(emp.jobTitleName ?? emp.positionTitle)}
              <span className="mx-2">·</span>
              {dash(emp.departmentName)}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/30">
                {emp.status}
              </span>
              <span className="rounded-full bg-[var(--soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--text)] ring-1 ring-[var(--border)]">
                {employmentTypeDisplayName(employmentTypes, emp.employmentType)}
              </span>
              {emp.locationName && (
                <span className="rounded-full bg-[var(--soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--text)] ring-1 ring-[var(--border)]">
                  {emp.locationName}
                </span>
              )}
              {emp.gradeName && (
                <span className="rounded-full bg-[var(--primary-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--primary)] ring-1 ring-[var(--border)]">
                  {emp.gradeName}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6 pb-12">
        <BioSection id="bio-personal" title="Personal & identity">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Date of birth">{formatDate(emp.dateOfBirth)}</Field>
            <Field label="Gender">{dash(emp.gender)}</Field>
            <Field label="Marital status">{dash(emp.maritalStatus)}</Field>
            <Field label="Nationality">{dash(emp.nationality)}</Field>
            <Field label="Religion">{dash(emp.religion)}</Field>
            <Field label="Ethnicity">{dash(emp.ethnicity)}</Field>
            <Field label="Other ID">{dash(emp.otherId)}</Field>
            <Field label="Fingerprint ID">{dash(emp.fingerprintId)}</Field>
            <Field label="National / ID no.">{dash(emp.nationalId)}</Field>
            <Field label="TIN">{dash(emp.tinNumber)}</Field>
          </div>
        </BioSection>

        <BioSection id="bio-contact" title="Contact details">
          <h3 className="mb-4 text-xs font-bold uppercase tracking-wide text-slate-400">Reach you</h3>
          <div className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Work email">{dash(displayWorkEmail(emp.email) || null)}</Field>
            <Field label="Personal email">{dash(emp.otherEmail)}</Field>
            <Field label="Mobile">{dash(emp.phone)}</Field>
            <Field label="Home telephone">{dash(emp.homeTelephone)}</Field>
            <Field label="Work telephone">{dash(emp.workTelephone)}</Field>
          </div>
          <h3 className="mb-4 text-xs font-bold uppercase tracking-wide text-slate-400">Current address</h3>
          <div className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Street 1">{dash(emp.addressStreet1)}</Field>
            <Field label="Street 2">{dash(emp.addressStreet2)}</Field>
            <Field label="City">{dash(emp.city)}</Field>
            <Field label="District">{dash(emp.district)}</Field>
            <Field label="State / province">{dash(emp.stateProvince)}</Field>
            <Field label="ZIP / postal">{dash(emp.zipPostalCode)}</Field>
            <Field label="Country">{dash(emp.country)}</Field>
            <Field label="Polling division">{dash(emp.pollingDivision)}</Field>
            <Field label="Distance to Office(KM)">{dash(emp.distanceToOffice)}</Field>
            <Field label="Mode of transport">{dash(emp.modeOfTransport)}</Field>
          </div>
          <h3 className="mb-4 text-xs font-bold uppercase tracking-wide text-slate-400">Permanent address</h3>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Street 1">{dash(emp.permanentStreet1)}</Field>
            <Field label="Street 2">{dash(emp.permanentStreet2)}</Field>
            <Field label="City">{dash(emp.permanentCity)}</Field>
            <Field label="District">{dash(emp.permanentDistrict)}</Field>
            <Field label="State / province">{dash(emp.permanentStateProvince)}</Field>
            <Field label="ZIP / postal">{dash(emp.permanentZipPostalCode)}</Field>
            <Field label="Country">{dash(emp.permanentCountry)}</Field>
            <Field label="Polling division">{dash(emp.permanentPollingDivision)}</Field>
            <Field label="Distance to Office(KM)">{dash(emp.permanentDistanceToOffice)}</Field>
          </div>
        </BioSection>

        <BioSection id="bio-job" title="Job & organization">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Joined">{formatDate(emp.joinDate)}</Field>
            <Field label="Probation end">{emp.probationEndDate ? formatDate(emp.probationEndDate) : "—"}</Field>
            <Field label="Date of permanency">{emp.dateOfPermanency ? formatDate(emp.dateOfPermanency) : "—"}</Field>
            <Field label="Job title">{dash(emp.jobTitleName ?? emp.positionTitle)}</Field>
            <Field label="Department">{dash(emp.departmentName)}</Field>
            <Field label="Business unit">{dash(emp.businessUnitName)}</Field>
            <Field label="Location">{dash(emp.locationName)}</Field>
            <Field label="Grade / band">{dash(emp.gradeName)}</Field>
            <Field label="Manager">{dash(emp.managerName)}</Field>
            <Field label="Top of hierarchy">{emp.isTopOfHierarchy ? "Yes" : "No"}</Field>
            <Field label="Direct supervisor recorded">{emp.hasDirectSupervisor ? "Yes" : "No"}</Field>
            {emp.terminationDate && (
              <>
                <Field label="Termination date">{formatDate(emp.terminationDate)}</Field>
                <Field label="Termination reason">{dash(emp.terminationReason)}</Field>
              </>
            )}
          </div>
        </BioSection>

        <BioSection id="bio-emergency" title="Emergency contacts">
          <DataTable
            empty="No emergency contacts on file."
            columns={[
              { key: "name", header: "Name" },
              { key: "rel", header: "Relationship" },
              { key: "home", header: "Home" },
              { key: "mobile", header: "Mobile" },
              { key: "work", header: "Work" },
            ]}
            rows={emergencyContacts.map((r) => ({
              name: r.name,
              rel: r.relationship,
              home: dash(r.homeTelephone),
              mobile: dash(r.mobileTelephone),
              work: dash(r.workTelephone),
            }))}
          />
        </BioSection>

        <BioSection id="bio-dependents" title="Dependents">
          <DataTable
            empty="No dependents on file."
            columns={[
              { key: "name", header: "Name" },
              { key: "rel", header: "Relationship" },
              { key: "dob", header: "Date of birth" },
              { key: "ms", header: "Marital status" },
              { key: "job", header: "Occupation" },
            ]}
            rows={dependents.map((r) => ({
              name: `${r.firstName} ${r.lastName}`,
              rel: r.relationship,
              dob: r.dateOfBirth ? formatDate(r.dateOfBirth) : "—",
              ms: dash(r.maritalStatus),
              job: dash(r.occupation),
            }))}
          />
        </BioSection>

        <BioSection id="bio-education" title="Education">
          <DataTable
            empty="No education records."
            columns={[
              { key: "level", header: "Level" },
              { key: "inst", header: "Institute" },
              { key: "major", header: "Major" },
              { key: "year", header: "Year" },
              { key: "gpa", header: "GPA / score" },
              { key: "period", header: "Study period" },
            ]}
            rows={educations.map((r) => ({
              level: r.level,
              inst: dash(r.institute),
              major: dash(r.major),
              year: dash(r.year),
              gpa: dash(r.gpaScore),
              period:
                r.startDate || r.endDate
                  ? `${r.startDate ? formatDate(r.startDate) : "—"} – ${r.endDate ? formatDate(r.endDate) : "—"}`
                  : "—",
            }))}
          />
        </BioSection>

        <BioSection id="bio-qualifications" title="Qualifications">
          <DataTable
            empty="No qualifications on file."
            columns={[
              { key: "qual", header: "Qualification" },
              { key: "level", header: "Level" },
              { key: "inst", header: "Institute" },
              { key: "major", header: "Major / field" },
              { key: "year", header: "Year" },
              { key: "period", header: "Completed" },
            ]}
            rows={educations.map((r) => ({
              qual: dash(r.qualificationName),
              level: r.level,
              inst: dash(r.institute),
              major: dash(r.major),
              year: dash(r.year),
              period:
                r.startDate || r.endDate
                  ? `${r.startDate ? formatDate(r.startDate) : "—"} – ${r.endDate ? formatDate(r.endDate) : "—"}`
                  : "—",
            }))}
          />
        </BioSection>

        <BioSection
          id="bio-skills"
          title="Skills"
          headerExtra={
            canManageSkills ? (
              <SectionRecordHeaderActions count={skills.length} onAdd={() => openSkillModal()} addTitle="Add skill" />
            ) : undefined
          }
        >
          {skills.length === 0 ? (
            <p className="text-sm text-slate-400">{canManageSkills ? "No skills added." : "No skills listed."}</p>
          ) : canManageSkills ? (
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50/90 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2.5">Skill</th>
                    <th className="px-4 py-2.5">Years</th>
                    <th className="px-4 py-2.5">Comments</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {skills.map((r) => (
                    <tr key={r.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 font-medium text-slate-800">{r.skill}</td>
                      <td className="px-4 py-2.5 text-slate-700">{dash(r.yearsOfExperience)}</td>
                      <td className="max-w-xs truncate px-4 py-2.5 text-slate-700">{dash(r.comments)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openSkillModal(r)}
                            className="text-slate-500 transition hover:text-amber-600"
                            title="Edit"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteSkill(r.id)}
                            className="text-slate-400 transition hover:text-red-600"
                            title="Delete"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <DataTable
              empty="No skills listed."
              columns={[
                { key: "skill", header: "Skill" },
                { key: "yrs", header: "Years" },
                { key: "note", header: "Comments" },
              ]}
              rows={skills.map((r) => ({
                skill: r.skill,
                yrs: dash(r.yearsOfExperience),
                note: dash(r.comments),
              }))}
            />
          )}
        </BioSection>

        <BioSection id="bio-certs" title="Certifications">
          <DataTable
            empty="No certifications."
            columns={[
              { key: "name", header: "Certification" },
              { key: "obt", header: "Obtained" },
              { key: "exp", header: "Expires" },
              { key: "num", header: "Certificate #" },
              { key: "st", header: "Status" },
            ]}
            rows={certRows.map((r) => ({
              name: r.certificationName,
              obt: formatDate(r.obtainedDate),
              exp: r.expiryDate ? formatDate(r.expiryDate) : "—",
              num: dash(r.certificateNumber),
              st: r.status,
            }))}
          />
        </BioSection>

        <BioSection id="bio-languages" title="Languages">
          <DataTable
            empty="No languages recorded."
            columns={[
              { key: "lang", header: "Language" },
              { key: "mode", header: "Modes" },
              { key: "flu", header: "Fluency" },
            ]}
            rows={languages.map((r) => ({
              lang: r.language,
              mode: r.skill,
              flu: r.fluencyLevel,
            }))}
          />
        </BioSection>

        <BioSection id="bio-work" title="Work experience">
          <DataTable
            empty="No prior experience recorded."
            columns={[
              { key: "co", header: "Company" },
              { key: "title", header: "Role" },
              { key: "type", header: "Employment type" },
              { key: "from", header: "From" },
              { key: "to", header: "To" },
              { key: "cred", header: "Creditable" },
            ]}
            rows={workExperiences.map((r) => ({
              co: r.company,
              title: r.jobTitle,
              type: employmentTypeDisplayName(employmentTypes, r.employmentType),
              from: r.fromDate ? formatDate(r.fromDate) : "—",
              to: r.toDate ? formatDate(r.toDate) : "—",
              cred: r.creditable ? "Yes" : "No",
            }))}
          />
        </BioSection>

        <BioSection id="bio-training" title="Training assignments">
          <DataTable
            empty="No training assignments."
            columns={[
              { key: "course", header: "Course" },
              { key: "code", header: "Code" },
              { key: "st", header: "Status" },
              { key: "due", header: "Due" },
              { key: "done", header: "Completed" },
            ]}
            rows={trainingRows.map((r) => ({
              course: r.courseTitle,
              code: r.courseCode,
              st: r.status,
              due: r.dueDate ? formatDate(r.dueDate) : "—",
              done: r.completedAt ? formatDateTime(r.completedAt) : "—",
            }))}
          />
        </BioSection>

        <BioSection id="bio-matrix" title="Learning skill matrix">
          <DataTable
            empty="No skill matrix entries."
            columns={[
              { key: "sk", header: "Skill" },
              { key: "lvl", header: "Level" },
              { key: "when", header: "Assessed" },
              { key: "notes", header: "Notes" },
            ]}
            rows={matrixRows.map((r) => ({
              sk: r.skillName,
              lvl: String(r.proficiencyLevel),
              when: r.assessedAt ? formatDate(r.assessedAt) : "—",
              notes: dash(r.notes),
            }))}
          />
        </BioSection>

        <BioSection id="bio-bank" title="Bank accounts (direct deposit)">
          <div className="mb-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Payment method">{emp.isCashPayment ? "Cash payment" : "Bank payment"}</Field>
          </div>
          <DataTable
            empty="No bank accounts."
            columns={[
              { key: "bank", header: "Bank" },
              { key: "type", header: "Type" },
              { key: "acct", header: "Account" },
              { key: "branch", header: "Branch" },
            ]}
            rows={bankAccounts.map((r) => ({
              bank: dash(r.bankName),
              type: r.accountType,
              acct: r.accountNumber,
              branch: dash(r.branchLocation ?? r.branchCode),
            }))}
          />
        </BioSection>

        <BioSection id="bio-reporting" title="Reporting lines">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Supervisors</h3>
          <DataTable
            empty="No supervisors listed."
            columns={[
              { key: "name", header: "Name" },
              { key: "code", header: "Code" },
              { key: "jt", header: "Job title" },
              { key: "meth", header: "Method" },
            ]}
            rows={supervisors.map((r) => ({
              name: r.fullName,
              code: r.employeeCode,
              jt: dash(r.jobTitleName),
              meth: r.reportingMethod,
            }))}
          />
          <h3 className="mb-3 mt-8 text-xs font-bold uppercase tracking-wide text-slate-400">Subordinates</h3>
          <DataTable
            empty="No subordinates listed."
            columns={[
              { key: "name", header: "Name" },
              { key: "code", header: "Code" },
              { key: "jt", header: "Job title" },
              { key: "meth", header: "Method" },
            ]}
            rows={subordinates.map((r) => ({
              name: r.fullName,
              code: r.employeeCode,
              jt: dash(r.jobTitleName),
              meth: r.reportingMethod,
            }))}
          />
        </BioSection>

        <BioSection id="bio-benefits" title="Benefits snapshot">
          <DataTable
            empty="No benefits data available."
            columns={[
              { key: "provider", header: "Insurance provider" },
              { key: "coverage", header: "Coverage" },
              { key: "spousal", header: "Spousal" },
              { key: "deps", header: "Dependents" },
            ]}
            rows={benefits.map((b) => ({
              provider: dash(b.insuranceProvider),
              coverage: [
                b.coverageExtendedMedical ? "Extended Medical" : null,
                b.coverageDental ? "Dental" : null,
                b.coverageVision ? "Vision" : null,
              ].filter(Boolean).join(", ") || "—",
              spousal: b.spousalCoverage ? "Yes" : "No",
              deps: b.dependentsCovered ? "Yes" : "No",
            }))}
          />
        </BioSection>

        <BioSection id="bio-license" title="EPF / ETF & driver’s license">
          <div className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="EPF number">{dash(emp.epfNumber)}</Field>
            <Field label="ETF number">{dash(emp.etfNumber)}</Field>
          </div>
          <DataTable
            empty="No driver's license records."
            columns={[
              { key: "num", header: "Number" },
              { key: "type", header: "Type" },
              { key: "iss", header: "Issue date" },
              { key: "exp", header: "Expiry date" },
              { key: "country", header: "Issuing country" },
            ]}
            rows={driverLicenses.map((dl) => ({
              num: dash(dl.number),
              type: dash(dl.licenseType),
              iss: dl.issueDate ? formatDate(dl.issueDate) : "—",
              exp: dl.expiryDate ? formatDate(dl.expiryDate) : "—",
              country: dash(dl.issuingCountry),
            }))}
          />
        </BioSection>

        <BioSection id="bio-immigration" title="Immigration">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Documents</h3>
          <DataTable
            empty="No immigration documents."
            columns={[
              { key: "type", header: "Type" },
              { key: "num", header: "Number" },
              { key: "by", header: "Issued by" },
              { key: "iss", header: "Issued" },
              { key: "exp", header: "Expires" },
              { key: "st", header: "Status" },
            ]}
            rows={immigrations.map((r) => ({
              type: r.documentType,
              num: r.number,
              by: dash(r.issuedBy),
              iss: r.issuedDate ? formatDate(r.issuedDate) : "—",
              exp: r.expiryDate ? formatDate(r.expiryDate) : "—",
              st: dash(r.eligibleStatus),
            }))}
          />
          {immDocs.length > 0 && (
            <>
              <h3 className="mb-3 mt-8 text-xs font-bold uppercase tracking-wide text-slate-400">Attached files</h3>
              <ul className="space-y-2">
                {immDocs.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-2 text-sm">
                    <span className="font-medium text-slate-800">{d.fileName}</span>
                    <button
                      type="button"
                      onClick={() =>
                        void downloadEmployeeFile(`/api/employees/${emp.id}/immigration-documents/${d.id}/download`, d.fileName)
                      }
                      className="text-xs font-semibold text-[#2B7DE9] hover:underline"
                    >
                      Download
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </BioSection>

        <BioSection id="bio-files" title="Profile attachments">
          {attachments.length === 0 ? (
            <p className="text-sm text-slate-400">No attachments.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50/90 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2.5">File</th>
                    <th className="px-4 py-2.5">Type</th>
                    <th className="px-4 py-2.5">Size</th>
                    <th className="px-4 py-2.5">Format</th>
                    <th className="px-4 py-2.5">Added</th>
                    <th className="px-4 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {attachments.map((a) => (
                    <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="max-w-[200px] truncate px-4 py-2.5 font-medium text-slate-800" title={a.fileName}>
                        {a.fileName}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{dash(a.attachmentTypeName)}</td>
                      <td className="px-4 py-2.5 tabular-nums text-slate-600">{fmtFileSize(a.size)}</td>
                      <td className="px-4 py-2.5 text-slate-600" title={a.contentType}>
                        {mimeShort(a.contentType)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{formatDateTime(a.dateAdded)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            void downloadEmployeeFile(`/api/employees/${emp.id}/attachments/${a.id}/download`, a.fileName)
                          }
                          className="text-xs font-semibold text-[#2B7DE9] hover:underline"
                        >
                          Download
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </BioSection>
      </div>

      <Modal open={showSkillModal} onClose={closeSkillModal} title="">
        <div>
          <h3 className="text-lg font-semibold text-slate-700">{editingSkill ? "Edit Skill" : "Add Skill"}</h3>
          <p className="mt-1 text-sm text-slate-500">
            Pick a skill from the list or type any skill name that is not listed yet.
          </p>
          <div className="mt-3 grid gap-x-6 gap-y-4 border-t border-slate-200 pt-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-semibold text-slate-600">
                Skill<span className="text-red-500">*</span>
              </label>
              <ListAutocompleteInput
                name="skillName"
                value={skillName}
                onChange={setSkillName}
                options={skillCatalogNames}
                className={skillInputClass}
                placeholder={skillCatalogNames.length ? "Choose from list or type a skill" : "Type a skill name"}
                showAllOnFocus
                maxSuggestions={200}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-600">
                Years of Experience<span className="text-red-500">*</span>
              </label>
              <input
                value={skillYears}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "" || /^\d+$/.test(v)) setSkillYears(v);
                }}
                inputMode="numeric"
                pattern="[0-9]*"
                className={skillInputClass}
                required
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="mb-1 block text-sm font-semibold text-slate-600">Comments</label>
            <textarea
              value={skillComments}
              onChange={(e) => setSkillComments(e.target.value)}
              rows={4}
              className={skillInputClass + " resize-y"}
            />
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
            <span className="text-xs text-red-400">* Required</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={closeSkillModal}
                className="rounded-full border border-slate-300 px-6 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveSkill()}
                disabled={!skillName.trim() || !skillYears.trim() || skillSaving}
                className="rounded-full bg-green-500 px-8 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-600 disabled:opacity-50"
              >
                {skillSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
