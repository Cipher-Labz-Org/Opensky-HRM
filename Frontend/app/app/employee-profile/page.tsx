"use client";

import { useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import Link from "next/link";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { apiFetch } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/date-utils";
import { API_BASE_URL } from "@/config/constants";
import { ROUTES } from "@/config/routes";
import { useAuth } from "@/contexts/auth-context";
import { type EmploymentTypeCatalogItem, employmentTypeDisplayName } from "@/lib/employment-types";

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
  amount: number;
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
  insuranceProvider: string | null;
  coverageExtendedMedical: boolean;
  coverageDental: boolean;
  coverageVision: boolean;
  spousalCoverage: boolean;
  dependentsCovered: boolean;
}

const card =
  "overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06),0_8px_24px_-4px_rgba(15,23,42,0.08)]";
const cardHead =
  "border-b border-slate-200/55 bg-gradient-to-b from-white/90 via-slate-50/40 to-slate-100/20 px-5 py-3.5 backdrop-blur-xl";
const cardTitle = "text-sm font-bold tracking-tight text-slate-800";
const labelCls =
  "text-[11px] font-semibold uppercase tracking-wider text-slate-400";
const valueCls = "mt-0.5 text-sm font-medium text-slate-800";

function BioSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className={`${card} scroll-mt-36`}>
      <div className={cardHead}>
        <h2 className={cardTitle}>{title}</h2>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

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
    <div className="overflow-x-auto rounded-xl border border-slate-100">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200/80 bg-slate-50/90 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {columns.map((c) => (
              <th key={c.key} className={`px-4 py-2.5 ${c.className ?? ""}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
              {columns.map((c) => (
                <td key={c.key} className={`px-4 py-2.5 text-slate-700 ${c.className ?? ""}`}>
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

export default function EmployeeProfilePage() {
  const { user, isLoading: authLoading, getPeopleReadScope } = useAuth();
  const employeeId = user?.employeeId ?? null;
  const peopleScope = getPeopleReadScope();
  const canSearchOthers = peopleScope === "Team" || peopleScope === "All";

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [dirSearch, setDirSearch] = useState("");
  const [dirResults, setDirResults] = useState<EmployeeSearchHit[]>([]);
  const [dirOpen, setDirOpen] = useState(false);
  const [dirLoading, setDirLoading] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const dirSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const effectiveEmployeeId = selectedEmployeeId ?? employeeId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emp, setEmp] = useState<EmployeeDetail | null>(null);
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContactItem[]>([]);
  const [dependents, setDependents] = useState<DependentItem[]>([]);
  const [educations, setEducations] = useState<EducationItem[]>([]);
  const [skills, setSkills] = useState<SkillItem[]>([]);
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
  const [benefit, setBenefit] = useState<BenefitData | null>(null);
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
    setBenefit(null);
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
        apiFetch<BenefitData>(`/api/employees/${id}/benefit`).catch(() => null),
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
      setBenefit(ben);

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

  useEffect(() => {
    apiFetch<EmploymentTypeCatalogItem[]>("/api/organization/employment-statuses")
      .then(setEmploymentTypes)
      .catch(() => setEmploymentTypes([]));
  }, []);

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

  function handleDirSearchInput(query: string) {
    setDirSearch(query);
    if (dirSearchTimer.current) clearTimeout(dirSearchTimer.current);
    if (!query.trim()) {
      setDirResults([]);
      setDirOpen(false);
      return;
    }
    dirSearchTimer.current = setTimeout(async () => {
      setDirLoading(true);
      try {
        const res = await apiFetch<{ items: EmployeeSearchHit[] }>(
          `/api/employees?search=${encodeURIComponent(query.trim())}&pageSize=10`
        );
        setDirResults(res.items ?? []);
        setDirOpen(true);
      } catch {
        setDirResults([]);
      } finally {
        setDirLoading(false);
      }
    }, 300);
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
      return "Search for an employee to view their read-only bio.";
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

  const directorySearchBar = !canSearchOthers ? null : (
    <div
      ref={searchWrapRef}
      className={`relative mb-6 rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm backdrop-blur-sm ${dirOpen ? "z-50" : "z-20"}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="relative min-w-0 flex-1 overflow-visible">
          <label htmlFor="emp-bio-search" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Find employee
          </label>
          <input
            id="emp-bio-search"
            type="search"
            autoComplete="off"
            placeholder="Name or employee code…"
            value={dirSearch}
            onChange={(e) => handleDirSearchInput(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-[#2B7DE9] focus:ring-2 focus:ring-[#2B7DE9]/20"
          />
          {dirOpen && (
            <ul className="absolute left-0 right-0 top-full z-[60] mt-1 max-h-64 overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl ring-1 ring-slate-900/5">
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
        {showMyRecordButton && (
          <button
            type="button"
            onClick={clearToMyRecord}
            className="shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-[#2B7DE9]/40 hover:text-[#1565C9]"
          >
            View my record
          </button>
        )}
      </div>
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
        <div className="mx-auto max-w-lg rounded-2xl border border-slate-200/80 bg-slate-50/50 px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-800">No employee selected</p>
          <p className="mt-2 text-sm text-slate-600">Use the search above to open someone&apos;s read-only bio.</p>
          <Link
            href={ROUTES.people}
            className="mt-5 inline-flex rounded-xl border border-[#2B7DE9]/30 bg-white/80 px-4 py-2 text-sm font-semibold text-[#1565C9] shadow-sm backdrop-blur-sm transition hover:bg-white"
          >
            Open People Hub
          </Link>
        </div>
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
        <div className="rounded-2xl border border-red-200 bg-red-50/60 px-5 py-4 text-sm text-red-800">{error ?? "Profile unavailable."}</div>
      </>
    );
  }

  return (
    <>
      <AppTopbar title={pageTitle} subtitle={pageSubtitle} />

      {directorySearchBar}

      <nav
        className="sticky top-[52px] z-40 -mx-7 mb-6 flex flex-col gap-2 border-b border-slate-200/90 bg-white/95 py-2.5 pl-7 pr-7 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-white/85 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
        aria-label="Bio sections"
      >
        <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300/80">
          {toc.map((t) => (
            <a
              key={t.id}
              href={`#${t.id}`}
              className="shrink-0 rounded-full border border-slate-200/60 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:border-[#2B7DE9]/35 hover:text-[#1565C9]"
            >
              {t.label}
            </a>
          ))}
        </div>
        <Link
          href={`${ROUTES.people}/${emp.id}`}
          className="shrink-0 self-start rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 sm:self-auto"
        >
          Open full profile (edit)
        </Link>
      </nav>

      {/* Hero */}
      <div
        className={`${card} mb-8`}
      >
        <div className="relative overflow-hidden px-6 py-8 sm:px-10 sm:py-10">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-sky-50/90 via-white to-indigo-50/40" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
            {emp.profileImageUrl ? (
              <img
                src={`${API_BASE_URL}${emp.profileImageUrl}`}
                alt=""
                className="h-28 w-28 shrink-0 rounded-2xl border-4 border-white object-cover shadow-lg shadow-slate-900/10"
              />
            ) : (
              <div className="grid h-28 w-28 shrink-0 place-items-center rounded-2xl border-4 border-white bg-gradient-to-br from-[#2B7DE9] to-indigo-600 text-3xl font-bold text-white shadow-lg shadow-indigo-500/25">
                {initials}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{emp.fullName}</h1>
              <p className="mt-1 text-sm text-slate-600">
                <span className="font-mono font-medium text-slate-800">{emp.employeeCode}</span>
                <span className="mx-2 text-slate-300">·</span>
                {dash(emp.jobTitleName ?? emp.positionTitle)}
                <span className="mx-2 text-slate-300">·</span>
                {dash(emp.departmentName)}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200/60">
                  {emp.status}
                </span>
                <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200/80 backdrop-blur-sm">
                  {employmentTypeDisplayName(employmentTypes, emp.employmentType)}
                </span>
                {emp.locationName && (
                  <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200/80 backdrop-blur-sm">
                    {emp.locationName}
                  </span>
                )}
                {emp.gradeName && (
                  <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-900 ring-1 ring-indigo-200/60">
                    {emp.gradeName}
                  </span>
                )}
              </div>
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
            <Field label="National / ID no.">{dash(emp.nationalId)}</Field>
            <Field label="TIN">{dash(emp.tinNumber)}</Field>
          </div>
        </BioSection>

        <BioSection id="bio-contact" title="Contact details">
          <h3 className="mb-4 text-xs font-bold uppercase tracking-wide text-slate-400">Reach you</h3>
          <div className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Work email">{dash(emp.email)}</Field>
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
            <Field label="Distance to office">{dash(emp.distanceToOffice)}</Field>
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
            <Field label="Distance to office">{dash(emp.permanentDistanceToOffice)}</Field>
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

        <BioSection id="bio-skills" title="Skills">
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
          <DataTable
            empty="No bank accounts."
            columns={[
              { key: "bank", header: "Bank" },
              { key: "type", header: "Type" },
              { key: "acct", header: "Account" },
              { key: "amt", header: "Amount" },
              { key: "branch", header: "Branch" },
            ]}
            rows={bankAccounts.map((r) => ({
              bank: dash(r.bankName),
              type: r.accountType,
              acct: r.accountNumber,
              amt: String(r.amount),
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
          {benefit ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Insurance provider">{dash(benefit.insuranceProvider)}</Field>
              <Field label="Extended medical">{benefit.coverageExtendedMedical ? "Yes" : "No"}</Field>
              <Field label="Dental">{benefit.coverageDental ? "Yes" : "No"}</Field>
              <Field label="Vision">{benefit.coverageVision ? "Yes" : "No"}</Field>
              <Field label="Spousal coverage">{benefit.spousalCoverage ? "Yes" : "No"}</Field>
              <Field label="Dependents covered">{benefit.dependentsCovered ? "Yes" : "No"}</Field>
            </div>
          ) : (
            <p className="text-sm text-slate-400">No benefits data available.</p>
          )}
        </BioSection>

        <BioSection id="bio-license" title="EPF / ETF & driver’s license">
          <div className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="EPF number">{dash(emp.epfNumber)}</Field>
            <Field label="ETF number">{dash(emp.etfNumber)}</Field>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="License number">{dash(emp.driversLicenseNumber)}</Field>
            <Field label="License type">{dash(emp.driversLicenseType)}</Field>
            <Field label="Issue date">{emp.licenseIssueDate ? formatDate(emp.licenseIssueDate) : "—"}</Field>
            <Field label="Expiry date">{emp.licenseExpiryDate ? formatDate(emp.licenseExpiryDate) : "—"}</Field>
            <Field label="Issuing country">{dash(emp.driversLicenseIssuingCountry)}</Field>
          </div>
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
                    <a
                      href={`${API_BASE_URL}/api/employees/${emp.id}/immigration-documents/${d.id}/download`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-[#2B7DE9] hover:underline"
                    >
                      Download
                    </a>
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
                        <a
                          href={`${API_BASE_URL}/api/employees/${emp.id}/attachments/${a.id}/download`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-[#2B7DE9] hover:underline"
                        >
                          Download
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </BioSection>
      </div>
    </>
  );
}
