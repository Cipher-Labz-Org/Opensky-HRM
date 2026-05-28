"use client";

import { useState, useEffect, useCallback, useRef, useMemo, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { DatePickerField, FormSelect, type FormSelectOption } from "@/components/ui";
import { COUNTRY_NAMES, NATIONALITY_NAMES } from "@/lib/people-form-lists";
import { apiFetch } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/date-utils";
import { formatLocalDateToIso } from "@/lib/datePickerIso";
import { API_BASE_URL } from "@/config/constants";
import { ROUTES } from "@/config/routes";
import { BirthdaysCompanyNoticesWidget } from "@/components/employee-profile/BirthdaysCompanyNoticesWidget";
import {
  type EmploymentTypeCatalogItem,
  employmentTypeDisplayName,
  employmentTypeOptionsFromCatalog,
  defaultEmploymentTypeCode,
  isKnownEmploymentTypeCode,
} from "@/lib/employment-types";

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
  jobTitleDescription?: string | null;
  managerId: string | null;
  managerName: string | null;
  profileImageUrl: string | null;
  isTopOfHierarchy: boolean;
  hasDirectSupervisor: boolean;
}

interface AttachmentTypeItem {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  isActive: boolean;
  sortOrder: number;
}

interface Attachment {
  id: string;
  employeeId: string;
  fileName: string;
  description: string | null;
  size: number;
  contentType: string;
  dateAdded: string;
  addedBy: string | null;
  attachmentTypeId?: string | null;
  attachmentTypeName?: string | null;
  expiryDate?: string | null;
}

interface ReportPerson {
  id: string;
  supervisorId?: string;
  employeeId?: string;
  employeeCode: string;
  fullName: string;
  jobTitleName: string | null;
  reportingMethod: string;
}

interface EmergencyContactItem {
  id: string;
  employeeId: string;
  name: string;
  relationship: string;
  homeTelephone: string | null;
  mobileTelephone: string | null;
  workTelephone: string | null;
}

interface DependentItem {
  id: string;
  employeeId: string;
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
  employeeId: string;
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
  employeeId: string;
  skill: string;
  yearsOfExperience: string | null;
  comments: string | null;
}

interface SkillMasterItem {
  id: string;
  name: string;
  category?: string | null;
  description?: string | null;
  isActive?: boolean;
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

interface EmployeeCertRow {
  id: string;
  certificationId: string;
  certificationName: string;
  obtainedDate: string;
  expiryDate: string | null;
  certificateNumber: string | null;
  status: string;
}

interface SkillMatrixRow {
  id: string;
  skillName: string;
  proficiencyLevel: number;
  assessedAt: string | null;
  notes: string | null;
}

interface CourseOption {
  id: string;
  title: string;
  code: string;
  isActive: boolean;
}

interface LanguageItem {
  id: string;
  employeeId: string;
  language: string;
  skill: string;
  fluencyLevel: string;
  comments: string | null;
}

interface ImmigrationItem {
  id: string;
  employeeId: string;
  documentType: string;
  number: string;
  issuedBy: string | null;
  issuedDate: string | null;
  expiryDate: string | null;
  eligibleReviewDate: string | null;
  eligibleStatus: string | null;
  comments: string | null;
}

interface WorkExperienceItem {
  id: string;
  employeeId: string;
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
  employeeId: string;
  accountNumber: string;
  bankName: string | null;
  accountType: string;
  bankCode: string | null;
  branchCode: string | null;
  branchLocation: string | null;
}

interface BenefitData {
  id?: string;
  employeeId: string;
  insuranceProvider: string | null;
  coverageExtendedMedical: boolean;
  coverageDental: boolean;
  coverageVision: boolean;
  spousalCoverage: boolean;
  dependentsCovered: boolean;
}

interface Lookup { id: string; name: string }
interface StatusLookup extends Lookup { code: string }

interface WidgetDef { id: string; label: string; icon: string; color: string }

/** Pending onboarding/offboarding rows for the profile employee (from employee-tasks API). */
interface PendingLifecycleTaskRow {
  id: string;
  kind: string;
  title: string;
  category: string;
  dueDate: string | null;
  assignmentType: string;
  assignedToUserId: string | null;
  assignedToUserName: string | null;
}

const ALL_WIDGETS: WidgetDef[] = [
  { id: "about", label: "About", color: "bg-slate-600", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
  { id: "quickAccess", label: "Quick Access", color: "bg-slate-600", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" },
  {
    id: "birthdaysNotices",
    label: "Birthdays & notices",
    color: "bg-rose-500",
    icon: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
  },
  { id: "lifecycle", label: "Employee Lifecycle", color: "bg-sky-600", icon: "M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" },
  {
    id: "pendingLifecycleTasks",
    label: "Onboarding & offboarding",
    color: "bg-teal-600",
    icon: "M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
  },
  { id: "leaveBalance", label: "Leave Balance", color: "bg-indigo-500", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
  { id: "leaveList", label: "Leave List", color: "bg-violet-500", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
  { id: "timesheets", label: "Timesheets", color: "bg-teal-500", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
];
const ALL_WIDGET_IDS = new Set(ALL_WIDGETS.map((w) => w.id));

function normalizeVisibleWidgetIds(ids: string[]): string[] {
  return ids.filter((id) => ALL_WIDGET_IDS.has(id));
}

const DEFAULT_VISIBLE = [
  "about",
  "quickAccess",
  "birthdaysNotices",
  "lifecycle",
  "pendingLifecycleTasks",
  "leaveBalance",
  "leaveList",
  "timesheets",
];

const lifecycleColors: Record<string, string> = { Active: "bg-emerald-500", OnNotice: "bg-amber-500", Resigned: "bg-orange-500", Terminated: "bg-red-500", Retired: "bg-slate-400", Deceased: "bg-slate-400", Absconded: "bg-red-500" };
const lifecycleLabels: Record<string, string> = { Active: "Active", OnNotice: "On Notice", Resigned: "Resigned", Terminated: "Terminated", Retired: "Retired", Deceased: "Deceased", Absconded: "Absconded" };

/** Human-readable tenure from join date to end date (or today if end is omitted). */
function formatTenureSpan(joinDateIso: string, endDateIso?: string | null): string {
  const start = new Date(joinDateIso.split("T")[0]);
  const end = endDateIso ? new Date(endDateIso.split("T")[0]) : new Date();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return "—";
  let y = end.getFullYear() - start.getFullYear();
  let mo = end.getMonth() - start.getMonth();
  const d = end.getDate() - start.getDate();
  if (d < 0) mo -= 1;
  if (mo < 0) {
    y -= 1;
    mo += 12;
  }
  const parts: string[] = [];
  if (y > 0) parts.push(`${y} year${y === 1 ? "" : "s"}`);
  if (mo > 0) parts.push(`${mo} month${mo === 1 ? "" : "s"}`);
  if (parts.length === 0) return "< 1 month";
  return parts.join(", ");
}

/** Canonical ladder: Intern → … → Director (template duration bands). */
const CAREER_STEPS = [
  {
    id: "intern",
    label: "Intern",
    durationBand: "Duration: 3–6 months",
  },
  {
    id: "junior",
    label: "Junior",
    durationBand: "Duration: 6–12 months",
  },
  {
    id: "mid",
    label: "Mid-Level",
    durationBand: "Duration: 18–36 months",
  },
  {
    id: "senior",
    label: "Senior",
    durationBand: "Duration: 24–48 months",
  },
  {
    id: "team_lead",
    label: "Team Lead",
    durationBand: "Duration: 12–24 months",
  },
  {
    id: "manager",
    label: "Manager",
    durationBand: "Duration: 24–60 months",
  },
  {
    id: "director",
    label: "Director",
    durationBand: "Duration: Varies by organization",
  },
] as const;

interface CareerPathRow {
  id: string;
  ladderLabel: string;
  displayTitle: string;
  monthRange: string;
  yearRange: string;
  actualTenure: string;
  durationBand: string;
  isCurrent: boolean;
}

function parseLocalDay(iso: string): Date {
  const [y, m, d] = iso.split("T")[0].split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toLocalIsoDate(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

function formatMonthYearLocal(d: Date): string {
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function formatYearLocal(d: Date): string {
  return String(d.getFullYear());
}

function segmentRangeLocal(join: Date, end: Date, n: number, k: number): [Date, Date] {
  const j = join.getTime();
  const e = end.getTime();
  const span = Math.max(0, e - j);
  const start = new Date(j + (span * k) / n);
  if (k === n - 1) return [start, new Date(end)];
  const segEnd = new Date(j + (span * (k + 1)) / n);
  return [start, segEnd];
}

function inferCareerLevelFromGrade(gradeName: string | null | undefined): number | null {
  if (!gradeName?.trim()) return null;
  const g = gradeName.toLowerCase();
  if (/\b(intern|trainee|l\s*0|level\s*0)\b/i.test(g)) return 0;
  if (/\b(junior|l\s*1|level\s*1|graduate)\b/i.test(g)) return 1;
  if (/\b(mid|l\s*2|level\s*2|intermediate)\b/i.test(g)) return 2;
  if (/\b(senior|l\s*3|level\s*3)\b/i.test(g)) return 3;
  if (/\b(team\s*lead|l\s*4|level\s*4)\b/i.test(g)) return 4;
  if (/\b(manager|l\s*5|level\s*5|head\s+of)\b/i.test(g)) return 5;
  if (/\b(director|l\s*6|level\s*6|vp|vice\s*president|chief)\b/i.test(g)) return 6;
  return null;
}

function inferCareerLevelFromKeywords(
  jobTitle: string | null | undefined,
  positionTitle: string | null | undefined,
  gradeName: string | null | undefined,
): number {
  const t = `${jobTitle ?? ""} ${positionTitle ?? ""} ${gradeName ?? ""}`.toLowerCase();
  if (!t.trim()) return 2;
  const ordered: { level: number; pats: RegExp[] }[] = [
    {
      level: 6,
      pats: [/\bdirector\b/, /\bvice\s*president\b/, /\bvp\b/, /\bchief\b/, /\bceo\b/, /\bcto\b/, /\bcfo\b/, /\bcoo\b/, /\bexecutive\b/],
    },
    {
      level: 5,
      pats: [/\bmanager\b/, /\bpeople\s+manager\b/, /\bengineering\s+manager\b/, /\bhead\s+of\b/],
    },
    { level: 4, pats: [/\bteam\s+lead\b/, /\bsquad\s+lead\b/, /\bchapter\s+lead\b/, /\btech\s+lead\b/] },
    { level: 3, pats: [/\bsenior\b/, /\bsr\.?\b/, /\bprincipal\b/, /\bstaff\s+engineer\b/, /\barchitect\b/] },
    { level: 2, pats: [/\bmid-level\b/, /\bmid\s+level\b/, /\bintermediate\b/] },
    { level: 1, pats: [/\bjunior\b/, /\bjr\.?\b/, /\bgraduate\b/, /\bentry[-\s]?level\b/, /\bassociate\b/] },
    { level: 0, pats: [/\bintern\b/, /\btrainee\b/, /\bapprentice\b/] },
  ];
  for (const { level, pats } of ordered) {
    if (pats.some((p) => p.test(t))) return level;
  }
  const g = inferCareerLevelFromGrade(gradeName);
  return g ?? 2;
}

function buildCareerProgressionRows(emp: EmployeeDetail): CareerPathRow[] {
  const join = parseLocalDay(emp.joinDate);
  const end = emp.terminationDate ? parseLocalDay(emp.terminationDate) : new Date();
  if (Number.isNaN(join.getTime()) || Number.isNaN(end.getTime()) || end < join) return [];

  const level = Math.min(
    6,
    Math.max(0, inferCareerLevelFromKeywords(emp.jobTitleName, emp.positionTitle, emp.gradeName)),
  );
  const n = level + 1;
  const rows: CareerPathRow[] = [];

  for (let k = n - 1; k >= 0; k--) {
    const step = CAREER_STEPS[k];
    const [a, b] = segmentRangeLocal(join, end, n, k);
    const isCurrent = k === level;
    const displayTitle = isCurrent ? (emp.jobTitleName ?? emp.positionTitle ?? step.label) : step.label;
    const ya = formatYearLocal(a);
    const yb = formatYearLocal(b);
    const yearRange = ya === yb ? ya : `${ya} – ${yb}`;
    const monthRange = `${formatMonthYearLocal(a)} – ${formatMonthYearLocal(b)}`;
    const actualTenure = formatTenureSpan(toLocalIsoDate(a), toLocalIsoDate(b));

    rows.push({
      id: `career-${step.id}-${k}`,
      ladderLabel: step.label,
      displayTitle,
      monthRange,
      yearRange,
      actualTenure,
      durationBand: step.durationBand,
      isCurrent,
    });
  }
  return rows;
}

const genderOptions = ["Male", "Female", "Other"];
const sriLankaDistricts = ["Ampara","Anuradhapura","Badulla","Batticaloa","Colombo","Galle","Gampaha","Hambantota","Jaffna","Kalutara","Kandy","Kegalle","Kilinochchi","Kurunegala","Mannar","Matale","Matara","Monaragala","Mullaitivu","Nuwara Eliya","Polonnaruwa","Puttalam","Ratnapura","Trincomalee","Vavuniya"];

function selectOpts(list: ReadonlyArray<string>): FormSelectOption[] {
  return list.map((v) => ({ value: v, label: v }));
}
function selectOptsOptional(placeholder: string, list: ReadonlyArray<string>): FormSelectOption[] {
  return [{ value: "", label: placeholder }, ...selectOpts(list)];
}

const MARITAL_VALUES = ["Single", "Married", "Divorced", "Widowed", "Separated"] as const;
const RELIGION_VALUES = ["Buddhism", "Christianity", "Hinduism", "Islam", "Judaism", "Sikhism", "Bahá'í", "Jainism", "Shinto", "Taoism", "Zoroastrianism", "Other", "Prefer not to say"] as const;
const ETHNICITY_VALUES = ["Asian", "Black / African", "Hispanic / Latino", "Middle Eastern / North African", "Native American / Indigenous", "Pacific Islander", "White / Caucasian", "Mixed / Multiracial", "Other", "Prefer not to say"] as const;
const MARITAL_OPTIONS = selectOptsOptional("--Select--", MARITAL_VALUES);
const NATIONALITY_OPTIONS = selectOptsOptional("--Select--", NATIONALITY_NAMES);
const RELIGION_OPTIONS = selectOptsOptional("--Select--", RELIGION_VALUES);
const ETHNICITY_OPTIONS = selectOptsOptional("--Select--", ETHNICITY_VALUES);
const COUNTRY_OPTIONS = selectOptsOptional("--Select--", COUNTRY_NAMES);
const COUNTRY_OPTIONS_ISSUING = selectOptsOptional("-- Select --", COUNTRY_NAMES);
const SL_DISTRICT_OPTIONS = selectOptsOptional("-- Select --", sriLankaDistricts);
const MODE_TRANSPORT_OPTIONS = selectOptsOptional("-- Select --", ["Own Vehicle", "Company Vehicle", "Public Transport", "Bicycle", "Walking", "Ride Sharing", "Other"]);
const GENDER_SELECT_OPTIONS = selectOpts(genderOptions);
const DEP_RELATIONSHIP_OPTIONS = selectOptsOptional("-- Select --", ["Child", "Spouse", "Parent", "Sibling", "Other"]);
const EDU_LEVEL_OPTIONS = selectOptsOptional("-- Select --", ["High School", "Diploma", "Associate", "Bachelor", "Master", "Doctorate", "Certificate", "Other"]);
const LANGUAGE_NAME_OPTIONS = selectOptsOptional("-- Select --", [
  "Arabic", "Bengali", "Chinese", "Dutch", "English", "French", "German", "Hindi", "Italian", "Japanese", "Korean", "Malay", "Portuguese", "Russian", "Sinhala", "Spanish", "Tamil", "Turkish", "Urdu", "Other",
]);
const LANGUAGE_FLUENCY_OPTIONS = selectOpts(["Beginner", "Elementary", "Intermediate", "Upper Intermediate", "Advanced", "Native"]);
const REPORTING_METHOD_OPTIONS = selectOptsOptional("-- Select --", ["Direct", "Indirect", "Other"]);
const BA_BANK_OPTIONS = selectOptsOptional("-- Select --", [
  "Bank of Ceylon",
  "People's Bank",
  "Commercial Bank",
  "Hatton National Bank",
  "Sampath Bank",
  "Seylan Bank",
  "Nations Trust Bank",
  "DFCC Bank",
  "National Development Bank",
  "Pan Asia Banking Corporation",
  "Union Bank",
  "Amana Bank",
  "Cargills Bank",
  "HSBC",
  "Standard Chartered Bank",
  "Citibank",
  "Deutsche Bank",
  "Other",
]);
const BA_ACCOUNT_TYPE_OPTIONS = selectOpts(["Checking", "Savings", "Current", "Fixed Deposit", "Other"]);
const BENEFIT_INSURER_OPTIONS = selectOptsOptional("-- Select --", [
  "Aetna",
  "Blue Cross Blue Shield",
  "Cigna",
  "Humana",
  "Kaiser Permanente",
  "Liberty Mutual",
  "MetLife",
  "State Farm",
  "UnitedHealthcare",
  "Other",
]);
const IMM_ISSUER_OPTIONS = selectOptsOptional("-- Select --", [
  "Afghanistan",
  "Australia",
  "Bangladesh",
  "Canada",
  "China",
  "France",
  "Germany",
  "India",
  "Japan",
  "Malaysia",
  "Pakistan",
  "Qatar",
  "Saudi Arabia",
  "Singapore",
  "Sri Lanka",
  "UAE",
  "United Kingdom",
  "United States",
  "Other",
]);
const YES_NO_OPTIONS: FormSelectOption[] = [
  { value: "No", label: "No" },
  { value: "Yes", label: "Yes" },
];

/** Map stored skill text (legacy dropdown or comma/&-separated) to checkboxes. */
function parseEmployeeLanguageSkill(skill: string): { reading: boolean; writing: boolean; speaking: boolean } {
  const u = skill.trim().toUpperCase();
  if (!u) return { reading: false, writing: false, speaking: false };
  if (u === "ALL") return { reading: true, writing: true, speaking: true };
  return {
    reading: u.includes("READING"),
    writing: u.includes("WRITING"),
    speaking: u.includes("SPEAKING"),
  };
}

/** Build API skill string from checkboxes (matches prior "All" / single / combined options). */
function buildEmployeeLanguageSkill(reading: boolean, writing: boolean, speaking: boolean): string {
  if (reading && writing && speaking) return "All";
  const parts: string[] = [];
  if (reading) parts.push("Reading");
  if (writing) parts.push("Writing");
  if (speaking) parts.push("Speaking");
  return parts.join(", ");
}

/** YYYY-MM-DD for date field max=... using local calendar date (no UTC shift). */
function dateInputMaxTodayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const DRIVERS_LICENSE_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "-- Select --" },
  { value: "LightVehicle", label: "Light vehicle / Car" },
  { value: "Motorcycle", label: "Motorcycle" },
  { value: "HeavyVehicle", label: "Heavy vehicle / Truck" },
  { value: "Commercial", label: "Commercial (passenger / goods)" },
  { value: "Other", label: "Other" },
];

type PageTab = "profile" | "personal" | "job" | "contactDetails" | "emergencyContacts" | "dependents" | "qualifications" | "workExperience" | "driversLicense" | "bankAccount" | "reportTo" | "benefits" | "immigration";
const PAGE_TABS: { key: PageTab; label: string }[] = [
  { key: "profile", label: "Profile" },
  { key: "personal", label: "Personal Details" },
  { key: "job", label: "Job" },
  { key: "contactDetails", label: "Contact Details" },
  { key: "emergencyContacts", label: "Emergency Contacts" },
  { key: "dependents", label: "Dependents" },
  { key: "qualifications", label: "Qualifications" },
  { key: "workExperience", label: "Work Experience" },
  { key: "driversLicense", label: "Driver's License" },
  { key: "bankAccount", label: "Bank Details" },
  { key: "reportTo", label: "Report To" },
  { key: "benefits", label: "Benefits" },
  { key: "immigration", label: "Immigration Docs" },
];
const VISIBLE_TAB_COUNT = 3;
const PRIMARY_TABS = PAGE_TABS.slice(0, VISIBLE_TAB_COUNT);
const OVERFLOW_TABS = PAGE_TABS.slice(VISIBLE_TAB_COUNT);

/** Short MIME / content-type label for tables; full value in tooltip when truncated or mapped. */
function attachmentMimeLabel(contentType: string | null | undefined): { label: string; title?: string } {
  const raw = contentType?.trim() ?? "";
  if (!raw) return { label: "—" };
  const map: Record<string, string> = {
    "application/pdf": "PDF",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word (.docx)",
    "application/msword": "Word (.doc)",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel (.xlsx)",
    "application/vnd.ms-excel": "Excel (.xls)",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PowerPoint (.pptx)",
    "application/vnd.ms-powerpoint": "PowerPoint (.ppt)",
    "text/plain": "Plain text",
    "text/csv": "CSV",
    "text/html": "HTML",
    "image/jpeg": "JPEG",
    "image/png": "PNG",
    "image/gif": "GIF",
    "image/webp": "WebP",
    "image/svg+xml": "SVG",
    "application/zip": "ZIP",
    "application/x-zip-compressed": "ZIP",
  };
  const friendly = map[raw];
  if (friendly) return { label: friendly, title: raw };
  if (raw.length > 32) return { label: `${raw.slice(0, 29)}…`, title: raw };
  return { label: raw };
}

/** Frosted header row inside section cards (OpenSky / glass) */
const sectionCardHeaderRow =
  "flex items-center justify-between border-b border-slate-200/55 bg-gradient-to-b from-white/90 via-slate-50/40 to-slate-100/20 px-6 py-4 backdrop-blur-xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.92)]";
const sectionCardHeaderRowSm =
  "flex items-center justify-between border-b border-slate-200/55 bg-gradient-to-b from-white/90 via-slate-50/40 to-slate-100/20 px-5 py-3 backdrop-blur-xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.92)]";
const sectionCardHeaderRowGap =
  "flex items-center gap-2.5 border-b border-slate-200/55 bg-gradient-to-b from-white/90 via-slate-50/40 to-slate-100/20 px-6 py-4 backdrop-blur-xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.92)]";
const sectionHeaderAddBtn =
  "grid h-9 w-9 place-items-center rounded-full border border-[#2B7DE9]/30 bg-white/65 text-[#2B7DE9] shadow-sm shadow-sky-500/15 backdrop-blur-md transition hover:border-[#2B7DE9]/50 hover:bg-white/95 hover:shadow-md active:scale-95";
const sectionHeaderAddTextBtn =
  "rounded-xl border border-[#2B7DE9]/30 bg-white/70 px-4 py-2 text-xs font-bold uppercase tracking-wide text-[#2B7DE9] shadow-sm shadow-sky-500/10 backdrop-blur-md transition hover:border-[#2B7DE9]/50 hover:bg-white/95 hover:shadow-md active:scale-[0.98]";

const SECTION_ICON_GLASS: Record<string, { shell: string; ink: string }> = {
  "bg-slate-600": { shell: "border-slate-200/70 bg-slate-500/[0.09]", ink: "text-slate-600" },
  "bg-blue-500": { shell: "border-blue-200/55 bg-blue-500/12", ink: "text-blue-600" },
  "bg-green-500": { shell: "border-emerald-200/55 bg-emerald-500/12", ink: "text-emerald-600" },
  "bg-amber-500": { shell: "border-amber-200/55 bg-amber-500/12", ink: "text-amber-600" },
  "bg-indigo-500": { shell: "border-indigo-200/55 bg-indigo-500/12", ink: "text-indigo-600" },
  "bg-violet-500": { shell: "border-violet-200/55 bg-violet-500/12", ink: "text-violet-600" },
  "bg-teal-500": { shell: "border-teal-200/55 bg-teal-500/12", ink: "text-teal-600" },
  "bg-cyan-500": { shell: "border-cyan-200/55 bg-cyan-500/12", ink: "text-cyan-600" },
  "bg-emerald-500": { shell: "border-emerald-200/55 bg-emerald-500/12", ink: "text-emerald-600" },
  "bg-orange-500": { shell: "border-orange-200/55 bg-orange-500/12", ink: "text-orange-600" },
  "bg-red-500": { shell: "border-red-200/55 bg-red-500/12", ink: "text-red-600" },
  "bg-purple-500": { shell: "border-purple-200/55 bg-purple-500/12", ink: "text-purple-600" },
  "bg-rose-500": { shell: "border-rose-200/55 bg-rose-500/12", ink: "text-rose-600" },
};

function SectionIcon({ path, color }: { path: string; color: string }) {
  const g = SECTION_ICON_GLASS[color] ?? SECTION_ICON_GLASS["bg-indigo-500"];
  return (
    <div
      className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl border shadow-sm backdrop-blur-md ring-1 ring-inset ring-white/70 ${g.shell}`}
    >
      <svg className={`h-[18px] w-[18px] ${g.ink}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d={path} />
      </svg>
    </div>
  );
}

function WidgetGear({ onRemove }: { onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-20 min-w-[120px] rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          <button type="button" onClick={() => { onRemove(); setOpen(false); }} className="flex w-full items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={onToggle}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${on ? "bg-orange-400" : "bg-slate-200"}`}>
      <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform ${on ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex py-0.5">
      <span className="w-24 shrink-0 text-xs text-slate-400">{label}:</span>
      <span className="text-xs font-medium text-slate-700 break-words">{value}</span>
    </div>
  );
}

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [emp, setEmp] = useState<EmployeeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageTab, setPageTab] = useState<PageTab>("profile");
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const [topSearch, setTopSearch] = useState("");
  const [topSearchResults, setTopSearchResults] = useState<{ id: string; fullName: string; employeeCode: string }[]>([]);
  const [topSearchOpen, setTopSearchOpen] = useState(false);
  const topSearchRef = useRef<HTMLDivElement>(null);
  const topSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [pdFirstName, setPdFirstName] = useState("");
  const [pdMiddleName, setPdMiddleName] = useState("");
  const [pdLastName, setPdLastName] = useState("");

  const [pdFullName, setPdFullName] = useState("");
  const [pdNameWithInitials, setPdNameWithInitials] = useState("");

  const [showTerminateModal, setShowTerminateModal] = useState(false);
  const [termReason, setTermReason] = useState("");
  const [termDate, setTermDate] = useState(new Date().toISOString().split("T")[0]);
  const [termNote, setTermNote] = useState("");
  const [termSaving, setTermSaving] = useState(false);
  const [withOffboarding, setWithOffboarding] = useState(true);
  const [offboardingTemplates, setOffboardingTemplates] = useState<{ id: string; name: string; description?: string; itemCount: number }[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [showReactivateModal, setShowReactivateModal] = useState(false);
  const [showDocPopover, setShowDocPopover] = useState(false);
  const docPopoverRef = useRef<HTMLDivElement>(null);
  const [reactActivateNow, setReactActivateNow] = useState(false);
  const [reactUpdateJoinDate, setReactUpdateJoinDate] = useState(true);
  const [reactDate, setReactDate] = useState(new Date().toISOString().split("T")[0]);
  const [reactHour, setReactHour] = useState("00");
  const [reactMinute, setReactMinute] = useState("00");
  const [reactTimezone, setReactTimezone] = useState("(GMT+05:30) GMT+05:30");
  const [reactWithOnboarding, setReactWithOnboarding] = useState(false);
  const [reactSaving, setReactSaving] = useState(false);

  const [departments, setDepartments] = useState<Lookup[]>([]);
  const [businessUnits, setBusinessUnits] = useState<Lookup[]>([]);
  const [locations, setLocations] = useState<Lookup[]>([]);
  const [grades, setGrades] = useState<Lookup[]>([]);
  const [jobTitles, setJobTitles] = useState<Lookup[]>([]);
  const [employeeStatuses, setEmployeeStatuses] = useState<StatusLookup[]>([]);
  const [employmentTypes, setEmploymentTypes] = useState<EmploymentTypeCatalogItem[]>([]);
  /** Job tab dates — controlled so the pickers stay editable when parent re-renders (defaultValue-only pickers could appear stuck). */
  const [jobFormJoinDate, setJobFormJoinDate] = useState("");
  const [jobFormProbationEnd, setJobFormProbationEnd] = useState("");
  const [jobFormPermanency, setJobFormPermanency] = useState("");
  const [supervisorPickList, setSupervisorPickList] = useState<Lookup[]>([]);
  const [subordinatePickList, setSubordinatePickList] = useState<Lookup[]>([]);

  const [visibleWidgets, setVisibleWidgets] = useState<string[]>(DEFAULT_VISIBLE);
  const [showConfig, setShowConfig] = useState(false);
  const [draftWidgets, setDraftWidgets] = useState<string[]>(DEFAULT_VISIBLE);
  const [configSaving, setConfigSaving] = useState(false);


  const [pendingLifecycleLoading, setPendingLifecycleLoading] = useState(false);
  const [pendingLifecycleErr, setPendingLifecycleErr] = useState<string | null>(null);
  const [pendingOnboarding, setPendingOnboarding] = useState<PendingLifecycleTaskRow[]>([]);
  const [pendingOffboarding, setPendingOffboarding] = useState<PendingLifecycleTaskRow[]>([]);

  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoSaving, setPhotoSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachUploading, setAttachUploading] = useState(false);
  const [showAttachModal, setShowAttachModal] = useState(false);
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [attachDesc, setAttachDesc] = useState("");
  const [attachTypeId, setAttachTypeId] = useState("");
  const [attachExpiry, setAttachExpiry] = useState("");
  const [attachmentTypeMasters, setAttachmentTypeMasters] = useState<AttachmentTypeItem[]>([]);
  const attachFileRef = useRef<HTMLInputElement>(null);
  const [editingAttach, setEditingAttach] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editAttachTypeId, setEditAttachTypeId] = useState("");
  const [editAttachExpiry, setEditAttachExpiry] = useState("");
  const [supervisors, setSupervisors] = useState<ReportPerson[]>([]);
  const [subordinates, setSubordinates] = useState<ReportPerson[]>([]);
  const [showAddSupervisor, setShowAddSupervisor] = useState(false);
  const [showAddSubordinate, setShowAddSubordinate] = useState(false);
  const [addReportMethod, setAddReportMethod] = useState("");
  const [addReportPersonId, setAddReportPersonId] = useState("");
  const [addReportSaving, setAddReportSaving] = useState(false);

  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContactItem[]>([]);
  const [showEcModal, setShowEcModal] = useState(false);
  const [ecSaving, setEcSaving] = useState(false);
  const [editingEc, setEditingEc] = useState<EmergencyContactItem | null>(null);
  const [ecName, setEcName] = useState("");
  const [ecRelationship, setEcRelationship] = useState("");
  const [ecHome, setEcHome] = useState("");
  const [ecMobile, setEcMobile] = useState("");
  const [ecWork, setEcWork] = useState("");

  const [dependents, setDependents] = useState<DependentItem[]>([]);
  const [showDepModal, setShowDepModal] = useState(false);
  const [depSaving, setDepSaving] = useState(false);
  const [editingDep, setEditingDep] = useState<DependentItem | null>(null);
  const [depFirstName, setDepFirstName] = useState("");
  const [depLastName, setDepLastName] = useState("");
  const [depRelationship, setDepRelationship] = useState("");
  const [depDob, setDepDob] = useState("");
  const [depMaritalStatus, setDepMaritalStatus] = useState("");
  const [depOccupation, setDepOccupation] = useState("");
  const [depOrganization, setDepOrganization] = useState("");

  const [educations, setEducations] = useState<EducationItem[]>([]);
  const [showEduModal, setShowEduModal] = useState(false);
  const [eduSaving, setEduSaving] = useState(false);
  const [editingEdu, setEditingEdu] = useState<EducationItem | null>(null);
  const [eduLevel, setEduLevel] = useState("");
  const [eduQualName, setEduQualName] = useState("");
  const [eduInstitute, setEduInstitute] = useState("");
  const [eduMajor, setEduMajor] = useState("");
  const [eduYear, setEduYear] = useState("");
  const [eduGpa, setEduGpa] = useState("");
  const [eduStartDate, setEduStartDate] = useState("");
  const [eduEndDate, setEduEndDate] = useState("");
  const [eduRemark, setEduRemark] = useState("");

  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [showSkillModal, setShowSkillModal] = useState(false);
  const [skillSaving, setSkillSaving] = useState(false);
  const [editingSkill, setEditingSkill] = useState<SkillItem | null>(null);
  const [skillName, setSkillName] = useState("");
  const [skillYears, setSkillYears] = useState("");
  const [skillComments, setSkillComments] = useState("");
  const [skillMasterList, setSkillMasterList] = useState<SkillMasterItem[]>([]);

  const [trainingRows, setTrainingRows] = useState<TrainingAssignmentRow[]>([]);
  const [certRows, setCertRows] = useState<EmployeeCertRow[]>([]);
  const [matrixRows, setMatrixRows] = useState<SkillMatrixRow[]>([]);
  const [showTrainAssignModal, setShowTrainAssignModal] = useState(false);
  const [coursesCatalog, setCoursesCatalog] = useState<CourseOption[]>([]);
  const [trainCourseId, setTrainCourseId] = useState("");
  const [trainDue, setTrainDue] = useState("");
  const [trainSaving, setTrainSaving] = useState(false);

  const [languages, setLanguages] = useState<LanguageItem[]>([]);
  const [showLangModal, setShowLangModal] = useState(false);
  const [langSaving, setLangSaving] = useState(false);
  const [editingLang, setEditingLang] = useState<LanguageItem | null>(null);
  const [langName, setLangName] = useState("");
  const [langReading, setLangReading] = useState(false);
  const [langWriting, setLangWriting] = useState(false);
  const [langSpeaking, setLangSpeaking] = useState(false);
  const [langFluency, setLangFluency] = useState("Intermediate");
  const [langComments, setLangComments] = useState("");

  const [benefitInsurer, setBenefitInsurer] = useState("");
  const [benefitExtMed, setBenefitExtMed] = useState(false);
  const [benefitDental, setBenefitDental] = useState(false);
  const [benefitVision, setBenefitVision] = useState(false);
  const [benefitSpousal, setBenefitSpousal] = useState(false);
  const [benefitDeps, setBenefitDeps] = useState(false);
  const [benefitSaving, setBenefitSaving] = useState(false);

  const [immigrations, setImmigrations] = useState<ImmigrationItem[]>([]);
  const [showImmModal, setShowImmModal] = useState(false);
  const [immSaving, setImmSaving] = useState(false);
  const [editingImm, setEditingImm] = useState<ImmigrationItem | null>(null);
  const [immDocType, setImmDocType] = useState("Passport");
  const [immNumber, setImmNumber] = useState("");
  const [immIssuedBy, setImmIssuedBy] = useState("");
  const [immIssuedDate, setImmIssuedDate] = useState("");
  const [immExpiryDate, setImmExpiryDate] = useState("");
  const [immReviewDate, setImmReviewDate] = useState("");
  const [immStatus, setImmStatus] = useState("");
  const [immComments, setImmComments] = useState("");

  const [immDocs, setImmDocs] = useState<Attachment[]>([]);
  const [showImmDocModal, setShowImmDocModal] = useState(false);
  const [immDocUploading, setImmDocUploading] = useState(false);
  const [immDocFile, setImmDocFile] = useState<File | null>(null);
  const [immDocDesc, setImmDocDesc] = useState("");
  const immDocFileRef = useRef<HTMLInputElement>(null);

  const [workExperiences, setWorkExperiences] = useState<WorkExperienceItem[]>([]);
  const [showWeModal, setShowWeModal] = useState(false);
  const [weSaving, setWeSaving] = useState(false);
  const [editingWe, setEditingWe] = useState<WorkExperienceItem | null>(null);
  const [weCompany, setWeCompany] = useState("");
  const [weJobTitle, setWeJobTitle] = useState("");
  const [weEmploymentType, setWeEmploymentType] = useState("");
  const [weFromDate, setWeFromDate] = useState("");
  const [weToDate, setWeToDate] = useState("");
  const [weCreditable, setWeCreditable] = useState(false);
  const [weComment, setWeComment] = useState("");

  const [dlType, setDlType] = useState("");
  const [dlIssue, setDlIssue] = useState("");
  const [dlExpiry, setDlExpiry] = useState("");

  const [bankAccounts, setBankAccounts] = useState<BankAccountItem[]>([]);
  const [showBaModal, setShowBaModal] = useState(false);
  const [baSaving, setBaSaving] = useState(false);
  const [editingBa, setEditingBa] = useState<BankAccountItem | null>(null);
  const [baAccountNumber, setBaAccountNumber] = useState("");
  const [baBankName, setBaBankName] = useState("");
  const [baAccountType, setBaAccountType] = useState("Checking");
  const [baBankCode, setBaBankCode] = useState("");
  const [baBranchCode, setBaBranchCode] = useState("");
  const [baBranchLocation, setBaBranchLocation] = useState("");

  useEffect(() => {
    setPdFullName([pdFirstName, pdMiddleName, pdLastName].filter(Boolean).join(" "));
    const parts: string[] = [];
    if (pdFirstName) parts.push(pdFirstName.charAt(0).toUpperCase() + ".");
    if (pdMiddleName) parts.push(pdMiddleName.charAt(0).toUpperCase() + ".");
    if (pdLastName) parts.push(pdLastName);
    setPdNameWithInitials(parts.join(" "));
  }, [pdFirstName, pdMiddleName, pdLastName]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [e, deps, bus, locs, grs, jts, sts, empTypes, supCands, subCands, settings, atts] = await Promise.all([
        apiFetch<EmployeeDetail>(`/api/employees/${id}`),
        apiFetch<Lookup[]>("/api/organization/departments"),
        apiFetch<Lookup[]>("/api/organization/business-units"),
        apiFetch<Lookup[]>("/api/organization/locations"),
        apiFetch<Lookup[]>("/api/organization/grades"),
        apiFetch<Lookup[]>("/api/organization/job-titles"),
        apiFetch<StatusLookup[]>("/api/organization/employee-statuses").catch(() => [] as StatusLookup[]),
        apiFetch<EmploymentTypeCatalogItem[]>("/api/organization/employment-statuses").catch(() => [] as EmploymentTypeCatalogItem[]),
        apiFetch<{ items: { id: string; fullName: string }[] }>(`/api/employees/${id}/reporting/supervisor-candidates`)
          .then((r) => (r.items ?? []).map((m) => ({ id: m.id, name: m.fullName })))
          .catch(() => [] as Lookup[]),
        apiFetch<{ items: { id: string; fullName: string }[] }>("/api/employees?pageSize=200&excludeTerminated=true")
          .then((r) => r.items.filter((m) => m.id !== id).map((m) => ({ id: m.id, name: m.fullName }))),
        apiFetch<Record<string, string>>("/api/system-settings").catch((): Record<string, string> => ({})),
        apiFetch<Attachment[]>(`/api/employees/${id}/attachments`).catch(() => [] as Attachment[]),
      ]);
      setEmp(e);
      setPdFirstName(e.firstName);
      setPdMiddleName(e.middleName ?? "");
      setPdLastName(e.lastName);
      setDepartments(deps);
      setBusinessUnits(bus);
      setLocations(locs);
      setGrades(grs);
      setJobTitles(jts);
      setEmployeeStatuses(sts);
      setEmploymentTypes(empTypes);
      setSupervisorPickList(supCands);
      setSubordinatePickList(subCands);
      setAttachments(atts);
      apiFetch<ReportPerson[]>(`/api/employees/${id}/supervisors`).then(setSupervisors).catch(() => {});
      apiFetch<ReportPerson[]>(`/api/employees/${id}/subordinates`).then(setSubordinates).catch(() => {});
      apiFetch<EmergencyContactItem[]>(`/api/employees/${id}/emergency-contacts`).then(setEmergencyContacts).catch(() => {});
      apiFetch<DependentItem[]>(`/api/employees/${id}/dependents`).then(setDependents).catch(() => {});
      apiFetch<EducationItem[]>(`/api/employees/${id}/educations`).then(setEducations).catch(() => {});
      apiFetch<SkillItem[]>(`/api/employees/${id}/skills`).then(setSkills).catch(() => {});
      apiFetch<SkillMasterItem[]>("/api/employees/skills-catalog")
        .then((rows) => setSkillMasterList(rows.filter((r) => r.isActive !== false)))
        .catch(() => setSkillMasterList([]));
      apiFetch<AttachmentTypeItem[]>("/api/employees/profile-attachment-types")
        .then(setAttachmentTypeMasters)
        .catch(() => setAttachmentTypeMasters([]));
      apiFetch<TrainingAssignmentRow[]>(`/api/employees/${id}/training-assignments`).then(setTrainingRows).catch(() => { setTrainingRows([]); });
      apiFetch<EmployeeCertRow[]>(`/api/employees/${id}/certifications`).then(setCertRows).catch(() => { setCertRows([]); });
      apiFetch<{ id: string; skillName: string; proficiencyLevel: number; assessedAt: string | null; notes: string | null }[]>(`/api/learning/skill-matrix?employeeId=${id}`)
        .then((rows) => setMatrixRows(rows.map((r) => ({ id: r.id, skillName: r.skillName, proficiencyLevel: r.proficiencyLevel, assessedAt: r.assessedAt, notes: r.notes }))))
        .catch(() => { setMatrixRows([]); });
      apiFetch<LanguageItem[]>(`/api/employees/${id}/languages`).then(setLanguages).catch(() => {});
      apiFetch<ImmigrationItem[]>(`/api/employees/${id}/immigrations`).then(setImmigrations).catch(() => {});
      apiFetch<Attachment[]>(`/api/employees/${id}/immigration-documents`).then(setImmDocs).catch(() => {});
      apiFetch<WorkExperienceItem[]>(`/api/employees/${id}/work-experiences`).then(setWorkExperiences).catch(() => {});
      apiFetch<BankAccountItem[]>(`/api/employees/${id}/bank-accounts`).then(setBankAccounts).catch(() => {});
      apiFetch<{ id: string; name: string; description?: string; itemCount: number }[]>("/api/employee-tasks/templates?type=Offboarding").then(setOffboardingTemplates).catch(() => {});
      apiFetch<BenefitData>(`/api/employees/${id}/benefit`).then((b) => {
        setBenefitInsurer(b.insuranceProvider ?? "");
        setBenefitExtMed(b.coverageExtendedMedical);
        setBenefitDental(b.coverageDental);
        setBenefitVision(b.coverageVision);
        setBenefitSpousal(b.spousalCoverage);
        setBenefitDeps(b.dependentsCovered);
      }).catch(() => {});
      if (settings.EmployeeDashboardWidgets) {
        try {
          const saved = JSON.parse(settings.EmployeeDashboardWidgets) as string[];
          if (!saved.includes("about")) {
            saved.unshift("about");
            apiFetch("/api/system-settings/EmployeeDashboardWidgets", {
              method: "PUT", body: JSON.stringify({ value: JSON.stringify(saved) }),
            }).catch(() => {});
          }
          if (!saved.includes("lifecycle")) {
            const qi = saved.indexOf("quickAccess");
            saved.splice(qi >= 0 ? qi + 1 : 1, 0, "lifecycle");
            apiFetch("/api/system-settings/EmployeeDashboardWidgets", {
              method: "PUT", body: JSON.stringify({ value: JSON.stringify(saved) }),
            }).catch(() => {});
          }
          if (!saved.includes("birthdaysNotices")) {
            const qi = saved.indexOf("quickAccess");
            saved.splice(qi >= 0 ? qi + 1 : 1, 0, "birthdaysNotices");
            apiFetch("/api/system-settings/EmployeeDashboardWidgets", {
              method: "PUT", body: JSON.stringify({ value: JSON.stringify(saved) }),
            }).catch(() => {});
          }
          if (!saved.includes("pendingLifecycleTasks")) {
            const li = saved.indexOf("lifecycle");
            saved.splice(li >= 0 ? li + 1 : 2, 0, "pendingLifecycleTasks");
            apiFetch("/api/system-settings/EmployeeDashboardWidgets", {
              method: "PUT", body: JSON.stringify({ value: JSON.stringify(saved) }),
            }).catch(() => {});
          }
          setVisibleWidgets(normalizeVisibleWidgetIds(saved));
        } catch { /* defaults */ }
      }
    } catch { setMsg({ type: "err", text: "Employee not found." }); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (pageTab !== "profile" || !emp || typeof window === "undefined") return;
    if (!visibleWidgets.includes("birthdaysNotices")) return;
    function scrollToBirthdays() {
      if (window.location.hash !== "#birthdays-notices") return;
      window.setTimeout(() => {
        document.getElementById("birthdays-notices")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    }
    scrollToBirthdays();
    window.addEventListener("hashchange", scrollToBirthdays);
    return () => window.removeEventListener("hashchange", scrollToBirthdays);
  }, [emp, pageTab, visibleWidgets]);

  const loadPendingLifecycleTasks = useCallback(async () => {
    if (!id) return;
    setPendingLifecycleLoading(true);
    setPendingLifecycleErr(null);
    try {
      const res = await apiFetch<{ onboarding: PendingLifecycleTaskRow[]; offboarding: PendingLifecycleTaskRow[] }>(
        `/api/employee-tasks/employees/${id}/pending-lifecycle-tasks`,
      );
      setPendingOnboarding(Array.isArray(res.onboarding) ? res.onboarding : []);
      setPendingOffboarding(Array.isArray(res.offboarding) ? res.offboarding : []);
    } catch (e) {
      setPendingLifecycleErr(e instanceof Error ? e.message : "Could not load onboarding/offboarding tasks");
      setPendingOnboarding([]);
      setPendingOffboarding([]);
    } finally {
      setPendingLifecycleLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (pageTab !== "profile" || !visibleWidgets.includes("pendingLifecycleTasks") || !id) return;
    void loadPendingLifecycleTasks();
  }, [pageTab, visibleWidgets, id, loadPendingLifecycleTasks]);

  useEffect(() => {
    if (!emp) return;
    setDlType(emp.driversLicenseType ?? "");
    setDlIssue(emp.licenseIssueDate ? emp.licenseIssueDate.split("T")[0] : "");
    setDlExpiry(emp.licenseExpiryDate ? emp.licenseExpiryDate.split("T")[0] : "");
  }, [emp?.id, emp?.driversLicenseType, emp?.licenseIssueDate, emp?.licenseExpiryDate]);

  useEffect(() => {
    if (!emp) return;
    setJobFormJoinDate(emp.joinDate ? emp.joinDate.split("T")[0] : "");
    setJobFormProbationEnd(emp.probationEndDate ? emp.probationEndDate.split("T")[0] : "");
    setJobFormPermanency(emp.dateOfPermanency ? emp.dateOfPermanency.split("T")[0] : "");
  }, [emp?.id, emp?.joinDate, emp?.probationEndDate, emp?.dateOfPermanency]);

  useEffect(() => {
    if (!showMoreMenu) return;
    function handleClick(e: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) setShowMoreMenu(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showMoreMenu]);

  useEffect(() => {
    if (!showDocPopover) return;
    function handleClick(e: MouseEvent) {
      if (docPopoverRef.current && !docPopoverRef.current.contains(e.target as Node)) setShowDocPopover(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showDocPopover]);

  useEffect(() => {
    if (!topSearchOpen) return;
    function handleClick(e: MouseEvent) {
      if (topSearchRef.current && !topSearchRef.current.contains(e.target as Node)) setTopSearchOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [topSearchOpen]);

  function handleTopSearch(query: string) {
    setTopSearch(query);
    if (topSearchTimer.current) clearTimeout(topSearchTimer.current);
    if (!query.trim()) { setTopSearchResults([]); setTopSearchOpen(false); return; }
    topSearchTimer.current = setTimeout(async () => {
      try {
        const res = await apiFetch<{ items: { id: string; fullName: string; employeeCode: string }[] }>(`/api/employees?search=${encodeURIComponent(query.trim())}&pageSize=8`);
        setTopSearchResults(res.items);
        setTopSearchOpen(true);
      } catch { setTopSearchResults([]); }
    }, 300);
  }

  function openConfig() { setDraftWidgets(normalizeVisibleWidgetIds([...visibleWidgets])); setShowConfig(true); }
  function toggleDraftWidget(wid: string) { setDraftWidgets((p) => p.includes(wid) ? p.filter((x) => x !== wid) : [...p, wid]); }
  async function saveConfig() {
    setConfigSaving(true);
    try {
      const normalized = normalizeVisibleWidgetIds(draftWidgets);
      await apiFetch("/api/system-settings/EmployeeDashboardWidgets", { method: "PUT", body: JSON.stringify({ value: JSON.stringify(normalized) }) });
      setVisibleWidgets(normalized); setShowConfig(false);
    } catch { /* */ } finally { setConfigSaving(false); }
  }
  const wOn = (wid: string) => visibleWidgets.includes(wid);

  async function removeWidget(wid: string) {
    const updated = normalizeVisibleWidgetIds(visibleWidgets.filter((w) => w !== wid));
    setVisibleWidgets(updated);
    try {
      await apiFetch("/api/system-settings/EmployeeDashboardWidgets", {
        method: "PUT", body: JSON.stringify({ value: JSON.stringify(updated) }),
      });
    } catch { /* ignore */ }
  }

  async function uploadAttachment() {
    if (!attachFile || !attachTypeId) return;
    setAttachUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", attachFile, attachFile.name);
      fd.append("attachmentTypeId", attachTypeId);
      const typeRow = attachmentTypeMasters.find((t) => t.id === attachTypeId);
      if (typeRow?.code) fd.append("attachmentTypeCode", typeRow.code);
      if (attachDesc.trim()) fd.append("description", attachDesc.trim());
      if (attachExpiry.trim()) fd.append("expiryDate", attachExpiry.trim());
      const res = await fetch(`${API_BASE_URL}/api/employees/${id}/attachments`, {
        method: "POST",
        body: fd,
        headers: { Authorization: `Bearer ${localStorage.getItem("auth_token") || ""}` },
      });
      if (!res.ok) {
        const text = await res.text();
        let msg = "Upload failed";
        try {
          const body = JSON.parse(text) as {
            error?: string;
            message?: string;
            title?: string;
            detail?: string;
          };
          if (typeof body.error === "string") msg = body.error;
          else if (typeof body.message === "string") msg = body.message;
          else if (typeof body.detail === "string") msg = body.detail;
          else if (typeof body.title === "string") msg = body.title;
          else if (text.trim()) msg = text.trim().slice(0, 200);
        } catch {
          if (text.trim()) msg = text.trim().slice(0, 200);
        }
        throw new Error(msg);
      }
      const att: Attachment = await res.json();
      setAttachments((prev) => [att, ...prev]);
      setShowAttachModal(false);
      setAttachFile(null);
      setAttachDesc("");
      setAttachTypeId("");
      setAttachExpiry("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setAttachUploading(false);
    }
  }

  async function deleteAttachment(attId: string) {
    if (!confirm("Delete this attachment?")) return;
    try {
      await apiFetch(`/api/employees/${id}/attachments/${attId}`, { method: "DELETE" });
      setAttachments((prev) => prev.filter((a) => a.id !== attId));
    } catch { /* ignore */ }
  }

  async function updateAttachmentRow(attId: string) {
    if (!editAttachTypeId) {
      alert("Please select an attachment type.");
      return;
    }
    try {
      const res = await apiFetch<Attachment>(`/api/employees/${id}/attachments/${attId}`, {
        method: "PUT",
        body: JSON.stringify({
          description: editDesc,
          attachmentTypeId: editAttachTypeId,
          expiryDate: editAttachExpiry.trim() || null,
        }),
      });
      setAttachments((prev) => prev.map((a) => (a.id === attId ? res : a)));
      setEditingAttach(null);
    } catch { /* ignore */ }
  }

  async function addSupervisor() {
    if (!addReportPersonId || !addReportMethod) return;
    setAddReportSaving(true);
    try {
      const res = await apiFetch<ReportPerson>(`/api/employees/${id}/supervisors`, {
        method: "POST",
        body: JSON.stringify({ supervisorId: addReportPersonId, reportingMethod: addReportMethod }),
      });
      setSupervisors((prev) => [...prev, res]);
      setShowAddSupervisor(false);
      setAddReportPersonId("");
      setAddReportMethod("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add supervisor");
    } finally {
      setAddReportSaving(false);
    }
  }

  async function addSubordinate() {
    if (!addReportPersonId || !addReportMethod) return;
    setAddReportSaving(true);
    try {
      const res = await apiFetch<ReportPerson>(`/api/employees/${id}/subordinates`, {
        method: "POST",
        body: JSON.stringify({ employeeId: addReportPersonId, reportingMethod: addReportMethod }),
      });
      setSubordinates((prev) => [...prev, res]);
      setShowAddSubordinate(false);
      setAddReportPersonId("");
      setAddReportMethod("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add subordinate");
    } finally {
      setAddReportSaving(false);
    }
  }

  async function removeSupervisor(entryId: string) {
    if (!confirm("Remove this supervisor?")) return;
    try {
      await apiFetch(`/api/employees/${id}/supervisors/${entryId}`, { method: "DELETE" });
      setSupervisors((prev) => prev.filter((s) => s.id !== entryId));
    } catch { /* ignore */ }
  }

  async function removeSubordinate(entryId: string) {
    if (!confirm("Remove this subordinate?")) return;
    try {
      await apiFetch(`/api/employees/${id}/subordinates/${entryId}`, { method: "DELETE" });
      setSubordinates((prev) => prev.filter((s) => s.id !== entryId));
    } catch { /* ignore */ }
  }

  function openEcModal(ec?: EmergencyContactItem) {
    if (ec) {
      setEditingEc(ec);
      setEcName(ec.name);
      setEcRelationship(ec.relationship);
      setEcHome(ec.homeTelephone ?? "");
      setEcMobile(ec.mobileTelephone ?? "");
      setEcWork(ec.workTelephone ?? "");
    } else {
      setEditingEc(null);
      setEcName("");
      setEcRelationship("");
      setEcHome("");
      setEcMobile("");
      setEcWork("");
    }
    setShowEcModal(true);
  }

  function closeEcModal() {
    setShowEcModal(false);
    setEditingEc(null);
    setEcName("");
    setEcRelationship("");
    setEcHome("");
    setEcMobile("");
    setEcWork("");
  }

  async function saveEmergencyContact() {
    if (!ecName.trim() || !ecRelationship.trim()) return;
    setEcSaving(true);
    const body = {
      name: ecName.trim(),
      relationship: ecRelationship.trim(),
      homeTelephone: ecHome.trim() || null,
      mobileTelephone: ecMobile.trim() || null,
      workTelephone: ecWork.trim() || null,
    };
    try {
      if (editingEc) {
        const updated = await apiFetch<EmergencyContactItem>(`/api/employees/${id}/emergency-contacts/${editingEc.id}`, { method: "PUT", body: JSON.stringify(body) });
        setEmergencyContacts((prev) => prev.map((c) => (c.id === editingEc.id ? updated : c)));
      } else {
        const created = await apiFetch<EmergencyContactItem>(`/api/employees/${id}/emergency-contacts`, { method: "POST", body: JSON.stringify(body) });
        setEmergencyContacts((prev) => [created, ...prev]);
      }
      closeEcModal();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save emergency contact");
    } finally {
      setEcSaving(false);
    }
  }

  async function deleteEmergencyContact(contactId: string) {
    if (!confirm("Delete this emergency contact?")) return;
    try {
      await apiFetch(`/api/employees/${id}/emergency-contacts/${contactId}`, { method: "DELETE" });
      setEmergencyContacts((prev) => prev.filter((c) => c.id !== contactId));
    } catch { /* ignore */ }
  }

  function openDepModal(dep?: DependentItem) {
    if (dep) {
      setEditingDep(dep);
      setDepFirstName(dep.firstName);
      setDepLastName(dep.lastName);
      setDepRelationship(dep.relationship);
      setDepDob(dep.dateOfBirth ? new Date(dep.dateOfBirth).toISOString().split("T")[0] : "");
      setDepMaritalStatus(dep.maritalStatus ?? "");
      setDepOccupation(dep.occupation ?? "");
      setDepOrganization(dep.organization ?? "");
    } else {
      setEditingDep(null);
      setDepFirstName("");
      setDepLastName("");
      setDepRelationship("");
      setDepDob("");
      setDepMaritalStatus("");
      setDepOccupation("");
      setDepOrganization("");
    }
    setShowDepModal(true);
  }

  function closeDepModal() {
    setShowDepModal(false);
    setEditingDep(null);
    setDepFirstName("");
    setDepLastName("");
    setDepRelationship("");
    setDepDob("");
    setDepMaritalStatus("");
    setDepOccupation("");
    setDepOrganization("");
  }

  async function saveDependent() {
    if (!depFirstName.trim() || !depLastName.trim() || !depRelationship.trim()) return;
    setDepSaving(true);
    const body = {
      firstName: depFirstName.trim(),
      lastName: depLastName.trim(),
      relationship: depRelationship.trim(),
      dateOfBirth: depDob || null,
      maritalStatus: depMaritalStatus || null,
      occupation: depOccupation || null,
      organization: depOrganization || null,
    };
    try {
      if (editingDep) {
        const updated = await apiFetch<DependentItem>(`/api/employees/${id}/dependents/${editingDep.id}`, { method: "PUT", body: JSON.stringify(body) });
        setDependents((prev) => prev.map((d) => (d.id === editingDep.id ? updated : d)));
      } else {
        const created = await apiFetch<DependentItem>(`/api/employees/${id}/dependents`, { method: "POST", body: JSON.stringify(body) });
        setDependents((prev) => [created, ...prev]);
      }
      closeDepModal();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save dependent");
    } finally {
      setDepSaving(false);
    }
  }

  async function deleteDependent(depId: string) {
    if (!confirm("Delete this dependent?")) return;
    try {
      await apiFetch(`/api/employees/${id}/dependents/${depId}`, { method: "DELETE" });
      setDependents((prev) => prev.filter((d) => d.id !== depId));
    } catch { /* ignore */ }
  }

  function openEduModal(edu?: EducationItem) {
    if (edu) {
      setEditingEdu(edu);
      setEduLevel(edu.level);
      setEduQualName(edu.qualificationName ?? "");
      setEduInstitute(edu.institute ?? "");
      setEduMajor(edu.major ?? "");
      setEduYear(edu.year ?? "");
      setEduGpa(edu.gpaScore ?? "");
      setEduStartDate(edu.startDate ? new Date(edu.startDate).toISOString().split("T")[0] : "");
      setEduEndDate(edu.endDate ? new Date(edu.endDate).toISOString().split("T")[0] : "");
      setEduRemark(edu.remark ?? "");
    } else {
      setEditingEdu(null);
      setEduLevel("");
      setEduQualName("");
      setEduInstitute("");
      setEduMajor("");
      setEduYear("");
      setEduGpa("");
      setEduStartDate("");
      setEduEndDate("");
      setEduRemark("");
    }
    setShowEduModal(true);
  }

  function closeEduModal() {
    setShowEduModal(false);
    setEditingEdu(null);
  }

  async function saveEducation() {
    if (!eduLevel.trim()) return;
    if (eduStartDate && eduEndDate && eduEndDate < eduStartDate) {
      setMsg({ type: "err", text: "Education End Date must be on or after the Start Date." });
      return;
    }
    setEduSaving(true);
    try {
      const body = {
        level: eduLevel,
        qualificationName: eduQualName || null,
        institute: eduInstitute || null,
        major: eduMajor || null,
        year: eduYear || null,
        gpaScore: eduGpa || null,
        startDate: eduStartDate || null,
        endDate: eduEndDate || null,
        remark: eduRemark || null,
      };
      if (editingEdu) {
        const updated = await apiFetch<EducationItem>(`/api/employees/${id}/educations/${editingEdu.id}`, { method: "PUT", body: JSON.stringify(body) });
        setEducations((prev) => prev.map((e) => (e.id === editingEdu.id ? updated : e)));
      } else {
        const created = await apiFetch<EducationItem>(`/api/employees/${id}/educations`, { method: "POST", body: JSON.stringify(body) });
        setEducations((prev) => [created, ...prev]);
      }
      closeEduModal();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save education");
    } finally {
      setEduSaving(false);
    }
  }

  async function deleteEducation(eduId: string) {
    if (!confirm("Delete this education record?")) return;
    try {
      await apiFetch(`/api/employees/${id}/educations/${eduId}`, { method: "DELETE" });
      setEducations((prev) => prev.filter((e) => e.id !== eduId));
    } catch { /* ignore */ }
  }

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
    if (!skillName.trim()) return;
    setSkillSaving(true);
    try {
      const body = {
        skill: skillName,
        yearsOfExperience: skillYears || null,
        comments: skillComments || null,
      };
      if (editingSkill) {
        const updated = await apiFetch<SkillItem>(`/api/employees/${id}/skills/${editingSkill.id}`, { method: "PUT", body: JSON.stringify(body) });
        setSkills((prev) => prev.map((s) => (s.id === editingSkill.id ? updated : s)));
      } else {
        const created = await apiFetch<SkillItem>(`/api/employees/${id}/skills`, { method: "POST", body: JSON.stringify(body) });
        setSkills((prev) => [created, ...prev]);
      }
      closeSkillModal();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save skill");
    } finally {
      setSkillSaving(false);
    }
  }

  async function deleteSkill(skillId: string) {
    if (!confirm("Delete this skill?")) return;
    try {
      await apiFetch(`/api/employees/${id}/skills/${skillId}`, { method: "DELETE" });
      setSkills((prev) => prev.filter((s) => s.id !== skillId));
    } catch { /* ignore */ }
  }

  async function openTrainAssignModal() {
    try {
      const cs = await apiFetch<CourseOption[]>("/api/learning/courses");
      const active = cs.filter((c) => c.isActive);
      if (active.length === 0) {
        alert("No active courses in the catalog. Add a course from Learning first.");
        return;
      }
      setCoursesCatalog(active);
      setTrainCourseId(active[0]!.id);
      setTrainDue("");
      setShowTrainAssignModal(true);
    } catch {
      alert("Could not load courses. Ensure the Learning module is licensed and you have access.");
    }
  }

  function closeTrainAssignModal() {
    setShowTrainAssignModal(false);
  }

  async function saveTrainingAssign(e: FormEvent) {
    e.preventDefault();
    if (!trainCourseId) return;
    setTrainSaving(true);
    try {
      await apiFetch("/api/learning/training-assignments", {
        method: "POST",
        body: JSON.stringify({
          employeeId: id,
          courseId: trainCourseId,
          dueDate: trainDue ? new Date(trainDue).toISOString() : null,
          notes: null,
        }),
      });
      const rows = await apiFetch<TrainingAssignmentRow[]>(`/api/employees/${id}/training-assignments`);
      setTrainingRows(rows);
      closeTrainAssignModal();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to assign training");
    } finally {
      setTrainSaving(false);
    }
  }

  function openLangModal(lang?: LanguageItem) {
    if (lang) {
      setEditingLang(lang);
      setLangName(lang.language);
      const p = parseEmployeeLanguageSkill(lang.skill);
      setLangReading(p.reading);
      setLangWriting(p.writing);
      setLangSpeaking(p.speaking);
      setLangFluency(lang.fluencyLevel || "Intermediate");
      setLangComments(lang.comments ?? "");
    } else {
      setEditingLang(null);
      setLangName("");
      setLangReading(true);
      setLangWriting(true);
      setLangSpeaking(true);
      setLangFluency("Intermediate");
      setLangComments("");
    }
    setShowLangModal(true);
  }

  function closeLangModal() {
    setShowLangModal(false);
    setEditingLang(null);
  }

  async function saveLanguage() {
    if (!langName.trim() || !langFluency.trim()) return;
    if (!langReading && !langWriting && !langSpeaking) return;
    const skillStr = buildEmployeeLanguageSkill(langReading, langWriting, langSpeaking);
    setLangSaving(true);
    try {
      const body = {
        language: langName,
        skill: skillStr,
        fluencyLevel: langFluency,
        comments: langComments || null,
      };
      if (editingLang) {
        const updated = await apiFetch<LanguageItem>(`/api/employees/${id}/languages/${editingLang.id}`, { method: "PUT", body: JSON.stringify(body) });
        setLanguages((prev) => prev.map((l) => (l.id === editingLang.id ? updated : l)));
      } else {
        const created = await apiFetch<LanguageItem>(`/api/employees/${id}/languages`, { method: "POST", body: JSON.stringify(body) });
        setLanguages((prev) => [created, ...prev]);
      }
      closeLangModal();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save language");
    } finally {
      setLangSaving(false);
    }
  }

  async function deleteLanguage(langId: string) {
    if (!confirm("Delete this language?")) return;
    try {
      await apiFetch(`/api/employees/${id}/languages/${langId}`, { method: "DELETE" });
      setLanguages((prev) => prev.filter((l) => l.id !== langId));
    } catch { /* ignore */ }
  }

  async function saveBenefit() {
    setBenefitSaving(true);
    try {
      await apiFetch(`/api/employees/${id}/benefit`, {
        method: "PUT",
        body: JSON.stringify({
          insuranceProvider: benefitInsurer || null,
          coverageExtendedMedical: benefitExtMed,
          coverageDental: benefitDental,
          coverageVision: benefitVision,
          spousalCoverage: benefitSpousal,
          dependentsCovered: benefitDeps,
        }),
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save benefits");
    } finally {
      setBenefitSaving(false);
    }
  }

  function openImmModal(imm?: ImmigrationItem) {
    if (imm) {
      setEditingImm(imm);
      setImmDocType(imm.documentType);
      setImmNumber(imm.number);
      setImmIssuedBy(imm.issuedBy ?? "");
      setImmIssuedDate(imm.issuedDate ? new Date(imm.issuedDate).toISOString().split("T")[0] : "");
      setImmExpiryDate(imm.expiryDate ? new Date(imm.expiryDate).toISOString().split("T")[0] : "");
      setImmReviewDate(imm.eligibleReviewDate ? new Date(imm.eligibleReviewDate).toISOString().split("T")[0] : "");
      setImmStatus(imm.eligibleStatus ?? "");
      setImmComments(imm.comments ?? "");
    } else {
      setEditingImm(null);
      setImmDocType("Passport");
      setImmNumber("");
      setImmIssuedBy("");
      setImmIssuedDate("");
      setImmExpiryDate("");
      setImmReviewDate("");
      setImmStatus("");
      setImmComments("");
    }
    setShowImmModal(true);
  }

  function closeImmModal() {
    setShowImmModal(false);
    setEditingImm(null);
  }

  async function saveImmigration() {
    if (!immDocType.trim() || !immNumber.trim()) return;
    setImmSaving(true);
    try {
      const body = {
        documentType: immDocType,
        number: immNumber,
        issuedBy: immIssuedBy || null,
        issuedDate: immIssuedDate || null,
        expiryDate: immExpiryDate || null,
        eligibleReviewDate: immReviewDate || null,
        eligibleStatus: immStatus || null,
        comments: immComments || null,
      };
      if (editingImm) {
        const updated = await apiFetch<ImmigrationItem>(`/api/employees/${id}/immigrations/${editingImm.id}`, { method: "PUT", body: JSON.stringify(body) });
        setImmigrations((prev) => prev.map((i) => (i.id === editingImm.id ? updated : i)));
      } else {
        const created = await apiFetch<ImmigrationItem>(`/api/employees/${id}/immigrations`, { method: "POST", body: JSON.stringify(body) });
        setImmigrations((prev) => [created, ...prev]);
      }
      closeImmModal();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save immigration record");
    } finally {
      setImmSaving(false);
    }
  }

  async function deleteImmigration(immId: string) {
    if (!confirm("Delete this immigration record?")) return;
    try {
      await apiFetch(`/api/employees/${id}/immigrations/${immId}`, { method: "DELETE" });
      setImmigrations((prev) => prev.filter((i) => i.id !== immId));
    } catch { /* ignore */ }
  }

  function openImmDocModal() {
    setImmDocFile(null);
    setImmDocDesc("");
    setShowImmDocModal(true);
  }

  async function uploadImmDoc() {
    if (!immDocFile) return;
    setImmDocUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", immDocFile);
      if (immDocDesc.trim()) fd.append("description", immDocDesc.trim());
      const res = await fetch(`${API_BASE_URL}/api/employees/${id}/immigration-documents`, { method: "POST", body: fd, headers: { Authorization: `Bearer ${localStorage.getItem("auth_token") || ""}` } });
      if (!res.ok) throw new Error("Upload failed");
      const created = await res.json();
      setImmDocs((prev) => [created, ...prev]);
      setShowImmDocModal(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to upload document");
    } finally {
      setImmDocUploading(false);
    }
  }

  async function deleteImmDoc(docId: string) {
    if (!confirm("Delete this document?")) return;
    try {
      await apiFetch(`/api/employees/${id}/immigration-documents/${docId}`, { method: "DELETE" });
      setImmDocs((prev) => prev.filter((d) => d.id !== docId));
    } catch { /* ignore */ }
  }

  function openWeModal(item?: WorkExperienceItem) {
    if (item) {
      setEditingWe(item);
      setWeCompany(item.company);
      setWeJobTitle(item.jobTitle);
      setWeEmploymentType(item.employmentType && isKnownEmploymentTypeCode(employmentTypes, item.employmentType) ? item.employmentType : "");
      setWeFromDate(item.fromDate ? new Date(item.fromDate).toISOString().split("T")[0] : "");
      setWeToDate(item.toDate ? new Date(item.toDate).toISOString().split("T")[0] : "");
      setWeCreditable(item.creditable);
      setWeComment(item.comment ?? "");
    } else {
      setEditingWe(null);
      setWeCompany("");
      setWeJobTitle("");
      setWeEmploymentType("");
      setWeFromDate("");
      setWeToDate("");
      setWeCreditable(false);
      setWeComment("");
    }
    setShowWeModal(true);
  }

  function closeWeModal() {
    setShowWeModal(false);
    setEditingWe(null);
    setWeCompany("");
    setWeJobTitle("");
    setWeEmploymentType("");
    setWeFromDate("");
    setWeToDate("");
    setWeCreditable(false);
    setWeComment("");
  }

  async function saveWorkExperience() {
    if (!weCompany.trim() || !weJobTitle.trim() || !weEmploymentType.trim()) return;
    const today = dateInputMaxTodayLocal();
    if (weFromDate && weFromDate > today) {
      setMsg({ type: "err", text: "Work experience start date cannot be in the future." });
      return;
    }
    if (weToDate && weToDate > today) {
      setMsg({ type: "err", text: "Work experience end date cannot be in the future." });
      return;
    }
    if (weFromDate && weToDate && weToDate < weFromDate) {
      setMsg({ type: "err", text: "End date must be on or after the start date." });
      return;
    }
    setWeSaving(true);
    const body = {
      company: weCompany.trim(),
      jobTitle: weJobTitle.trim(),
      employmentType: weEmploymentType,
      fromDate: weFromDate || null,
      toDate: weToDate || null,
      creditable: weCreditable,
      comment: weComment.trim() || null,
    };
    try {
      if (editingWe) {
        const updated = await apiFetch<WorkExperienceItem>(`/api/employees/${id}/work-experiences/${editingWe.id}`, { method: "PUT", body: JSON.stringify(body) });
        setWorkExperiences((prev) => prev.map((w) => (w.id === editingWe.id ? updated : w)));
      } else {
        const created = await apiFetch<WorkExperienceItem>(`/api/employees/${id}/work-experiences`, { method: "POST", body: JSON.stringify(body) });
        setWorkExperiences((prev) => [created, ...prev]);
      }
      closeWeModal();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save work experience");
    } finally {
      setWeSaving(false);
    }
  }

  async function deleteWorkExperience(weId: string) {
    if (!confirm("Delete this work experience?")) return;
    try {
      await apiFetch(`/api/employees/${id}/work-experiences/${weId}`, { method: "DELETE" });
      setWorkExperiences((prev) => prev.filter((w) => w.id !== weId));
    } catch { /* ignore */ }
  }

  function openBaModal(item?: BankAccountItem) {
    if (item) {
      setEditingBa(item);
      setBaAccountNumber(item.accountNumber);
      setBaBankName(item.bankName ?? "");
      setBaAccountType(item.accountType);
      setBaBankCode(item.bankCode ?? "");
      setBaBranchCode(item.branchCode ?? "");
      setBaBranchLocation(item.branchLocation ?? "");
    } else {
      setEditingBa(null);
      setBaAccountNumber("");
      setBaBankName("");
      setBaAccountType("Checking");
      setBaBankCode("");
      setBaBranchCode("");
      setBaBranchLocation("");
    }
    setShowBaModal(true);
  }

  function closeBaModal() {
    setShowBaModal(false);
    setEditingBa(null);
    setBaAccountNumber("");
    setBaBankName("");
    setBaAccountType("Checking");
    setBaBankCode("");
    setBaBranchCode("");
    setBaBranchLocation("");
  }

  async function saveBankAccount() {
    if (!baAccountNumber.trim()) return;
    setBaSaving(true);
    const body = {
      accountNumber: baAccountNumber.trim(),
      bankName: baBankName || null,
      accountType: baAccountType,
      bankCode: baBankCode.trim() || null,
      branchCode: baBranchCode.trim() || null,
      branchLocation: baBranchLocation.trim() || null,
    };
    try {
      if (editingBa) {
        const updated = await apiFetch<BankAccountItem>(`/api/employees/${id}/bank-accounts/${editingBa.id}`, { method: "PUT", body: JSON.stringify(body) });
        setBankAccounts((prev) => prev.map((b) => (b.id === editingBa.id ? updated : b)));
      } else {
        const created = await apiFetch<BankAccountItem>(`/api/employees/${id}/bank-accounts`, { method: "POST", body: JSON.stringify(body) });
        setBankAccounts((prev) => [created, ...prev]);
      }
      closeBaModal();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save bank account");
    } finally {
      setBaSaving(false);
    }
  }

  async function deleteBankAccount(baId: string) {
    if (!confirm("Delete this bank account?")) return;
    try {
      await apiFetch(`/api/employees/${id}/bank-accounts/${baId}`, { method: "DELETE" });
      setBankAccounts((prev) => prev.filter((b) => b.id !== baId));
    } catch { /* ignore */ }
  }

  async function handleTerminate() {
    if (!emp || !termReason || !termDate) return;
    setTermSaving(true);
    try {
      await apiFetch(`/api/employees/${id}/terminate`, {
        method: "POST",
        body: JSON.stringify({
          terminationDate: termDate,
          terminationReason: termReason,
          terminationNote: termNote || null,
          withOffboarding,
          templateId: withOffboarding && selectedTemplateId ? selectedTemplateId : null,
        }),
      });
      setShowTerminateModal(false);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to terminate");
    } finally {
      setTermSaving(false);
    }
  }

  async function handleReactivate() {
    if (!emp) return;
    setReactSaving(true);
    try {
      const newEmploymentType = defaultEmploymentTypeCode(employmentTypes);
      const newJoinDate = reactUpdateJoinDate ? reactDate : emp.joinDate;
      const payload = {
        firstName: emp.firstName,
        middleName: emp.middleName,
        lastName: emp.lastName,
        email: emp.email,
        phone: emp.phone,
        addressStreet1: emp.addressStreet1,
        addressStreet2: emp.addressStreet2,
        city: emp.city,
        country: emp.country,
        stateProvince: emp.stateProvince,
        zipPostalCode: emp.zipPostalCode,
        district: emp.district,
        pollingDivision: emp.pollingDivision,
        distanceToOffice: emp.distanceToOffice,
        modeOfTransport: emp.modeOfTransport,
        homeTelephone: emp.homeTelephone,
        workTelephone: emp.workTelephone,
        otherEmail: emp.otherEmail,
        permanentStreet1: emp.permanentStreet1,
        permanentStreet2: emp.permanentStreet2,
        permanentCity: emp.permanentCity,
        permanentCountry: emp.permanentCountry,
        permanentStateProvince: emp.permanentStateProvince,
        permanentZipPostalCode: emp.permanentZipPostalCode,
        permanentDistrict: emp.permanentDistrict,
        permanentPollingDivision: emp.permanentPollingDivision,
        permanentDistanceToOffice: emp.permanentDistanceToOffice,
        dateOfBirth: emp.dateOfBirth,
        gender: emp.gender,
        maritalStatus: emp.maritalStatus,
        nationality: emp.nationality,
        religion: emp.religion,
        ethnicity: emp.ethnicity,
        otherId: emp.otherId,
        nationalId: emp.nationalId,
        tinNumber: emp.tinNumber,
        epfNumber: emp.epfNumber,
        etfNumber: emp.etfNumber,
        driversLicenseNumber: emp.driversLicenseNumber,
        driversLicenseType: emp.driversLicenseType,
        licenseIssueDate: emp.licenseIssueDate,
        licenseExpiryDate: emp.licenseExpiryDate,
        driversLicenseIssuingCountry: emp.driversLicenseIssuingCountry,
        joinDate: newJoinDate,
        probationEndDate: emp.probationEndDate,
        dateOfPermanency: emp.dateOfPermanency,
        status: "Active",
        employmentType: newEmploymentType,
        terminationDate: null,
        departmentId: emp.departmentId,
        businessUnitId: emp.businessUnitId,
        positionId: emp.positionId,
        locationId: emp.locationId,
        gradeId: emp.gradeId,
        jobTitleId: emp.jobTitleId,
        managerId: emp.managerId,
      };
      await apiFetch(`/api/employees/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setShowReactivateModal(false);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to reactivate");
    } finally {
      setReactSaving(false);
    }
  }

  async function downloadDocPdf(templateKey: string, docName: string) {
    try {
      const res = await apiFetch<{ html: string }>(`/api/documenttemplates/render/${templateKey}/${id}`);
      const filename = `${docName.replace(/\s+/g, "_")}_${emp?.employeeCode ?? "EMP"}.pdf`;
      const printWin = window.open("", "_blank");
      if (!printWin) { alert("Please allow pop-ups to download PDF"); return; }
      printWin.document.write(`
        <html><head><title>${filename}</title></head>
        <body>${res.html}</body></html>
      `);
      printWin.document.close();
      printWin.onload = () => { printWin.print(); };
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to generate document");
    }
  }

  async function downloadDocWord(templateKey: string, docName: string) {
    try {
      const res = await apiFetch<{ html: string }>(`/api/documenttemplates/render/${templateKey}/${id}`);
      const filename = `${docName.replace(/\s+/g, "_")}_${emp?.employeeCode ?? "EMP"}.docx`;
      const preHtml = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>${filename}</title></head><body>`;
      const postHtml = `</body></html>`;
      const fullHtml = preHtml + res.html + postHtml;
      const blob = new Blob([fullHtml], { type: "application/msword" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to generate document");
    }
  }

  function fmtFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}kB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
  }

  function openPhotoModal() {
    const currentUrl = emp?.profileImageUrl ? `${API_BASE_URL}${emp.profileImageUrl}` : null;
    setPhotoPreview(currentUrl);
    setPhotoFile(null);
    setShowPhotoModal(true);
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function savePhoto() {
    if (!photoFile || !emp) return;
    setPhotoSaving(true);
    try {
      const formData = new FormData();
      formData.append("file", photoFile);
      const res = await fetch(`${API_BASE_URL}/api/employees/${id}/photo`, {
        method: "POST",
        body: formData,
        headers: { Authorization: `Bearer ${localStorage.getItem("auth_token") || ""}` },
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(errText || `Upload failed (${res.status})`);
      }
      const data = await res.json() as { profileImageUrl: string };
      setEmp({ ...emp, profileImageUrl: data.profileImageUrl });
      window.dispatchEvent(new CustomEvent("opensky:profile-image-updated"));
      setShowPhotoModal(false);
      setPhotoFile(null);
      setPhotoPreview(null);
      setMsg({ type: "ok", text: "Profile photo updated." });
      setTimeout(() => setMsg(null), 3000);
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : "Unknown error";
      setMsg({ type: "err", text: `Failed to upload photo: ${detail}` });
    } finally { setPhotoSaving(false); }
  }

  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!emp) return;
    setSaving(true); setMsg(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      firstName: fd.get("firstName") || emp.firstName,
      middleName: fd.get("middleName") || null,
      lastName: fd.get("lastName") || emp.lastName,
      email: fd.get("email") || emp.email,
      phone: fd.get("phone") || null,
      addressStreet1: fd.get("addressStreet1") || null,
      addressStreet2: fd.get("addressStreet2") || null,
      city: fd.get("city") || null,
      country: fd.get("country") || null,
      stateProvince: fd.get("stateProvince") || null,
      zipPostalCode: fd.get("zipPostalCode") || null,
      district: fd.get("district") || null,
      pollingDivision: fd.get("pollingDivision") || null,
      distanceToOffice: fd.get("distanceToOffice") || null,
      modeOfTransport: fd.get("modeOfTransport") || null,
      homeTelephone: fd.get("homeTelephone") || null,
      workTelephone: fd.get("workTelephone") || null,
      otherEmail: fd.get("otherEmail") || null,
      permanentStreet1: fd.get("permanentStreet1") || null,
      permanentStreet2: fd.get("permanentStreet2") || null,
      permanentCity: fd.get("permanentCity") || null,
      permanentCountry: fd.get("permanentCountry") || null,
      permanentStateProvince: fd.get("permanentStateProvince") || null,
      permanentZipPostalCode: fd.get("permanentZipPostalCode") || null,
      permanentDistrict: fd.get("permanentDistrict") || null,
      permanentPollingDivision: fd.get("permanentPollingDivision") || null,
      permanentDistanceToOffice: fd.get("permanentDistanceToOffice") || null,
      dateOfBirth: fd.get("dateOfBirth") || emp.dateOfBirth,
      gender: fd.get("gender") || emp.gender,
      maritalStatus: fd.get("maritalStatus") || null,
      nationality: fd.get("nationality") || null,
      religion: fd.get("religion") || null,
      ethnicity: fd.get("ethnicity") || null,
      otherId: fd.get("otherId") || null,
      nationalId: fd.get("nationalId") || null,
      tinNumber: fd.get("tinNumber") || null,
      epfNumber: fd.get("epfNumber") || null,
      etfNumber: fd.get("etfNumber") || null,
      driversLicenseNumber: fd.get("driversLicenseNumber") || null,
      driversLicenseType: (fd.get("driversLicenseType") as string)?.trim() || null,
      licenseIssueDate: (fd.get("licenseIssueDate") as string)?.trim() || null,
      licenseExpiryDate: (fd.get("licenseExpiryDate") as string)?.trim() || null,
      driversLicenseIssuingCountry: fd.get("driversLicenseIssuingCountry") || null,
      joinDate: fd.get("joinDate") || emp.joinDate,
      probationEndDate: fd.get("probationEndDate") || null,
      dateOfPermanency: fd.get("dateOfPermanency") || null,
      status: fd.get("status") || emp.status,
      employmentType: fd.get("employmentType") || emp.employmentType,
      departmentId: fd.get("departmentId") || emp.departmentId,
      businessUnitId: fd.get("businessUnitId") || null,
      positionId: fd.get("positionId") || null,
      locationId: fd.get("locationId") || null,
      gradeId: fd.get("gradeId") || null,
      jobTitleId: fd.get("jobTitleId") || null,
      managerId: fd.get("managerId") || null,
      isTopOfHierarchy: fd.get("isTopOfHierarchy") === "true",
    };

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    const workEmail = (payload.email as string).trim();
    const personalEmail = ((payload.otherEmail as string) ?? "").trim();

    if (!emailRe.test(workEmail)) {
      setSaving(false);
      setMsg({ type: "err", text: "Work Email is not a valid email address (e.g. name@company.com)." });
      return;
    }
    if (personalEmail && !emailRe.test(personalEmail)) {
      setSaving(false);
      setMsg({ type: "err", text: "Personal Email is not a valid email address (e.g. name@example.com)." });
      return;
    }

    const jd = payload.joinDate ? (payload.joinDate as string).split("T")[0] : "";
    const pe = payload.probationEndDate ? (payload.probationEndDate as string).split("T")[0] : "";
    const dp = payload.dateOfPermanency ? (payload.dateOfPermanency as string).split("T")[0] : "";

    if (pe && jd && pe <= jd) {
      setSaving(false);
      setMsg({ type: "err", text: "Probation End Date must be after the Joined Date." });
      return;
    }
    if (dp && jd && dp <= jd) {
      setSaving(false);
      setMsg({ type: "err", text: "Date of Permanency must be after the Joined Date." });
      return;
    }
    if (dp && pe && dp < pe) {
      setSaving(false);
      setMsg({ type: "err", text: "Date of Permanency must be on or after the Probation End Date." });
      return;
    }

    const licIssue = (payload.licenseIssueDate as string)?.trim() ?? "";
    const licExpiry = (payload.licenseExpiryDate as string)?.trim() ?? "";
    const todayLocal = dateInputMaxTodayLocal();
    if (licIssue && licIssue > todayLocal) {
      setSaving(false);
      setMsg({ type: "err", text: "License issue date cannot be in the future." });
      return;
    }
    if (licIssue && licExpiry && licExpiry < licIssue) {
      setSaving(false);
      setMsg({ type: "err", text: "License expiry date must be on or after the issue date." });
      return;
    }

    try {
      const updated = await apiFetch<EmployeeDetail>(`/api/employees/${id}`, { method: "PUT", body: JSON.stringify(payload) });
      setEmp(updated);
      setMsg({ type: "ok", text: "Updated successfully." });
      setTimeout(() => setMsg(null), 3000);
    } catch (err: unknown) { setMsg({ type: "err", text: err instanceof Error ? err.message : "Failed to save." }); }
    finally { setSaving(false); }
  }

  const fmtDate = (d: string | null) => d ? d.split("T")[0] : "";
  const fmtBirthday = (d: string | null) => {
    if (!d) return "—";
    const [y, m, day] = d.split("T")[0].split("-");
    return new Date(+y, +m - 1, +day).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
  const fmtDateDisplay = formatDate;

  const careerPathRows = useMemo(() => (emp ? buildCareerProgressionRows(emp) : []), [emp]);

  const jobEmploymentTypeOptions = useMemo(
    () => employmentTypeOptionsFromCatalog(employmentTypes),
    [employmentTypes]
  );

  const jobEmploymentTypeSelectOptions = useMemo((): FormSelectOption[] => {
    const code = emp?.employmentType;
    const base = jobEmploymentTypeOptions;
    if (!code || base.some((o) => o.value === code)) return base;
    const fromCatalog = employmentTypes.find((t) => t.code === code);
    const label = fromCatalog ? `${fromCatalog.name} (inactive)` : `${employmentTypeDisplayName(employmentTypes, code)} (legacy)`;
    return [{ value: code, label }, ...base];
  }, [emp?.employmentType, employmentTypes, jobEmploymentTypeOptions]);

  const workEmpTypeSelectOptions: FormSelectOption[] = useMemo(
    () => [{ value: "", label: "-- Select --" }, ...jobEmploymentTypeOptions],
    [jobEmploymentTypeOptions]
  );

  const inputClass =
    "w-full rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition-all duration-200 " +
    "placeholder:text-slate-400 hover:border-slate-300 hover:shadow " +
    "focus:border-indigo-500 focus:shadow-md focus:shadow-indigo-500/5 focus:ring-[3px] focus:ring-indigo-500/20";
  const labelClass =
    "mb-1.5 block text-[13px] font-semibold leading-snug tracking-tight text-slate-700 antialiased " +
    "after:mt-1.5 after:block after:h-[2px] after:w-10 after:max-w-[40%] after:rounded-full after:bg-gradient-to-r after:from-sky-200 after:via-indigo-200 after:to-slate-200/90 after:content-['']";
  const inputReadonlyClass = inputClass + " cursor-default bg-slate-50/90 text-slate-600";

  if (loading) return (
    <div className="flex min-h-[400px] items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
        <p className="text-sm text-slate-500">Loading employee profile...</p>
      </div>
    </div>
  );

  if (!emp) return (
    <div className="flex min-h-[400px] items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-red-100">
          <svg className="h-8 w-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
        </div>
        <p className="mb-1 text-lg font-semibold text-slate-800">Employee Not Found</p>
        <p className="mb-4 text-sm text-slate-500">{msg?.text ?? "The employee you're looking for doesn't exist."}</p>
        <Button variant="secondary" onClick={() => router.push("/app/people")}>Back to People Hub</Button>
      </div>
    </div>
  );

  const initials = `${emp.firstName[0]}${emp.lastName[0]}`;
  const isProfileTab = pageTab === "profile";

  function renderEmployeeLifecycleHeader() {
    return (
      <div className={sectionCardHeaderRowSm}>
        <div className="flex items-center gap-2">
          <SectionIcon path="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" color="bg-sky-600" />
          <h2 className="text-[15px] font-bold text-slate-700">Employee Lifecycle</h2>
        </div>
        <WidgetGear onRemove={() => removeWidget("lifecycle")} />
      </div>
    );
  }

<<<<<<< HEAD
  function renderEmployeeLifecycleMain() {
    if (!emp) return null;
=======
  function renderEmployeeLifecycleMain(employee: EmployeeDetail) {
>>>>>>> master
    return (
      <>
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          <div className="flex w-full shrink-0 flex-col items-center border-b border-slate-100 pb-4 text-center md:w-[160px] md:border-b-0 md:border-r md:border-slate-100 md:pb-0 md:pr-4">
            <div className="grid h-[88px] w-[88px] place-items-center rounded-full border-4 border-sky-100 bg-gradient-to-br from-sky-400 to-blue-600 text-2xl font-extrabold text-white shadow-md shadow-sky-500/20">
              {initials}
            </div>
            <h3 className="mt-3 text-sm font-bold text-slate-800">{employee.fullName}</h3>
            <span className="mt-1 line-clamp-2 text-[11px] font-semibold leading-snug text-sky-900">
              {employee.jobTitleName ?? employee.positionTitle ?? "—"}
            </span>
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-700">
              <span className={`h-2 w-2 shrink-0 rounded-full ${lifecycleColors[employee.status] ?? "bg-gray-400"}`} />
              {lifecycleLabels[employee.status] ?? employee.status}
            </span>
            <p className="mt-2 text-[11px] text-slate-500">
              Tenure:{" "}
              <span className="font-semibold text-slate-700">
                {employee.terminationDate
                  ? formatTenureSpan(employee.joinDate, employee.terminationDate)
                  : formatTenureSpan(employee.joinDate)}
              </span>
            </p>
          </div>
          <div className="min-w-0 flex-1 md:pl-1">
            <div
              className="max-h-[min(65vh,560px)] overflow-y-auto overflow-x-hidden overscroll-contain pr-2 [scrollbar-gutter:stable] scroll-smooth [scrollbar-width:thin] [scrollbar-color:rgb(203_213_225)_rgb(241_245_249)] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-slate-100"
              title="Scroll to see lifecycle milestones and role responsibilities"
            >
              <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-600">
                <SectionIcon path="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" color="bg-sky-500" />
                Lifecycle milestones
              </h4>
              <ul className="space-y-0">
                {(() => {
                  const milestones = (
                    [
                      { label: "Joined organization", date: employee.joinDate },
                      employee.probationEndDate ? { label: "Probation ends", date: employee.probationEndDate } : null,
                      employee.dateOfPermanency ? { label: "Permanent / confirmed", date: employee.dateOfPermanency } : null,
                      employee.terminationDate
                        ? {
                            label: "Separation",
                            date: employee.terminationDate,
                            sub:
                              employee.terminationReason && employee.terminationReason.trim().length > 0
                                ? employee.terminationReason.trim().length > 72
                                  ? `${employee.terminationReason.trim().slice(0, 70)}…`
                                  : employee.terminationReason.trim()
                                : undefined,
                          }
                        : null,
                    ] as ({ label: string; date: string; sub?: string } | null)[]
                  )
                    .filter((m): m is { label: string; date: string; sub?: string } => m != null)
                    .sort(
                      (a, b) =>
                        new Date(a.date.split("T")[0]).getTime() - new Date(b.date.split("T")[0]).getTime(),
                    );
                  return milestones.map((m, idx) => (
                    <li key={`${m.label}-${m.date}`} className="flex gap-3">
                      <div className="flex w-4 shrink-0 flex-col items-center pt-1">
                        <span className="h-2.5 w-2.5 rounded-full border-2 border-white bg-sky-500 shadow ring-1 ring-sky-200" />
                        {idx < milestones.length - 1 && (
                          <span className="mt-1 min-h-[2.25rem] w-0 flex-1 border-l-2 border-slate-200" aria-hidden />
                        )}
                      </div>
                      <div className={`min-w-0 flex-1 ${idx < milestones.length - 1 ? "pb-5" : ""}`}>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          {m.label}
                        </div>
                        <div className="text-sm font-semibold text-slate-800">{fmtDateDisplay(m.date)}</div>
                        {m.sub && <p className="mt-0.5 text-xs leading-snug text-slate-500">{m.sub}</p>}
                      </div>
                    </li>
                  ));
                })()}
              </ul>
              <div className="mt-5 border-t border-slate-100 pt-4">
                <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-600">
                  <SectionIcon path="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" color="bg-violet-500" />
                  Career progression
                </h4>
                <ul className="space-y-0">
                  {careerPathRows.map((row, idx) => (
                    <li key={row.id} className="flex gap-3">
                      <div className="flex w-4 shrink-0 flex-col items-center pt-1">
                        <span
                          className={`h-2.5 w-2.5 rounded-full border-2 border-white shadow ring-1 ${
                            row.isCurrent
                              ? "bg-violet-600 ring-violet-200"
                              : "bg-violet-300 ring-violet-100"
                          }`}
                        />
                        {idx < careerPathRows.length - 1 && (
                          <span className="mt-1 min-h-[2.25rem] w-0 flex-1 border-l-2 border-slate-200" aria-hidden />
                        )}
                      </div>
                      <div className={`min-w-0 flex-1 ${idx < careerPathRows.length - 1 ? "pb-5" : ""}`}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                            {row.ladderLabel}
                          </span>
                          {row.isCurrent && (
                            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-800">
                              Current
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-[15px] font-semibold leading-snug text-slate-900">
                          {row.displayTitle}
                        </div>
                        <div className="mt-1 text-base font-bold tracking-tight text-slate-800">{row.yearRange}</div>
                        <div className="text-xs font-medium text-slate-600">{row.monthRange}</div>
                        <div className="mt-0.5 text-[11px] text-slate-500">
                          In seat: <span className="font-semibold text-slate-700">{row.actualTenure}</span>
                        </div>
                        <p className="mt-2 text-[11px] font-medium leading-snug text-slate-600">{row.durationBand}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-5 border-t border-slate-100 pt-4">
                <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-600">
                  <SectionIcon path="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" color="bg-indigo-500" />
                  Role &amp; responsibilities
                </h4>
                <div className="rounded-lg border border-slate-100 bg-slate-50/90 px-3 py-2.5">
                  <InfoRow label="Job title" value={employee.jobTitleName ?? employee.positionTitle ?? "—"} />
                  <InfoRow label="Department" value={employee.departmentName ?? "—"} />
                  <InfoRow label="Reports to" value={employee.managerName ?? "—"} />
                  <div className="mt-2 border-t border-slate-200/80 pt-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Responsibilities
                    </div>
                    {employee.jobTitleDescription && employee.jobTitleDescription.trim().length > 0 ? (
                      <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-slate-700">
                        {employee.jobTitleDescription.trim()}
                      </p>
                    ) : (
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                        No job title description yet. Add text under{" "}
                        <span className="font-medium text-slate-600">Organization → Job titles</span> for this
                        role.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setPageTab("job")}
          className="mt-4 w-full rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-600 transition hover:border-sky-300 hover:bg-sky-50/60 hover:text-sky-800"
        >
          Open Job &amp; organization tab
        </button>
      </>
    );
  }


  return (
    <>
      {/* Widget Config Modal */}
      <Modal open={showConfig} onClose={() => setShowConfig(false)} title="">
        <div>
          <div className="mb-3 flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-slate-700">
              <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>
            </div>
            <div><div className="text-[10px] font-medium text-slate-400">Employee Dashboard</div><div className="text-sm font-bold text-slate-800">Configuration</div></div>
          </div>
          <div className="mb-3 flex gap-0 rounded-lg border border-slate-200">
            <div className="flex-1 rounded-l-lg bg-white px-3 py-1.5 text-center text-xs font-semibold text-slate-700 shadow-sm">Admin Configurations</div>
            <div className="flex-1 rounded-r-lg px-3 py-1.5 text-center text-xs font-medium text-slate-400">My Widgets</div>
          </div>
          <div className="max-h-[320px] space-y-1.5 overflow-y-auto pr-1">
            {ALL_WIDGETS.map((wd) => (
              <div key={wd.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-white px-3 py-2.5 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${wd.color}`}><svg className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={wd.icon}/></svg></div>
                  <span className="text-xs font-semibold text-slate-700">{wd.label}</span>
                </div>
                <div className="flex items-center gap-1.5"><Toggle on={draftWidgets.includes(wd.id)} onToggle={() => toggleDraftWidget(wd.id)} /><svg className="h-3.5 w-3.5 text-slate-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg></div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-center gap-3">
            <button type="button" onClick={() => setShowConfig(false)} className="rounded-full border border-slate-300 px-6 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">Cancel</button>
            <button type="button" onClick={saveConfig} disabled={configSaving} className="rounded-full bg-green-500 px-6 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-green-600 disabled:opacity-50">{configSaving ? "Saving..." : "Save"}</button>
          </div>
        </div>
      </Modal>

      {/* ── Profile Photo Upload Modal ── */}
      <Modal open={showPhotoModal} onClose={() => setShowPhotoModal(false)} title="">
        <div className="px-1">
          <h3 className="mb-1 text-lg font-semibold text-slate-700">Update Profile Photo</h3>
          <div className="mb-5 border-b border-slate-100 pb-3">
            <p className="text-xs text-slate-400">Use the scroll to zoom in and out</p>
          </div>

          <div className="flex items-center justify-center rounded-xl bg-black/90 py-8">
            <div className="h-[220px] w-[220px] overflow-hidden rounded-full border-4 border-white/30">
              {photoPreview ? (
                <img src={photoPreview} alt="Preview" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center bg-gradient-to-br from-blue-100 to-indigo-100 text-5xl font-extrabold text-blue-800">
                  {emp ? `${emp.firstName[0]}${emp.lastName[0]}` : ""}
                </div>
              )}
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handlePhotoSelect}
          />

          <div className="mt-5 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-6 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              Change
            </button>
            <button
              type="button"
              onClick={savePhoto}
              disabled={!photoFile || photoSaving}
              className="rounded-full bg-green-500 px-8 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-green-600 disabled:opacity-50"
            >
              {photoSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ══════════════════════════════════════════════════
          TOP NAV BAR — Profile | Personal Details | Job | More
         ══════════════════════════════════════════════════ */}
      {/* z-40 + isolate: keep tab row and its dropdowns above main tab content (later siblings paint on top by default) */}
      <div className="relative z-40 isolate mb-5 flex flex-wrap items-center gap-3">
        {/* Back button */}
        <button type="button" onClick={() => router.push("/app/people")} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
        </button>

        {/* Tabs */}
        <div className="flex items-center gap-1.5">
          {PRIMARY_TABS.map((tab) => {
            const active = pageTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setPageTab(tab.key)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition duration-200 ${
                  active
                    ? "border border-[#2B7DE9]/25 bg-white/65 text-[#1565C9] shadow-[0_4px_20px_rgba(43,125,233,0.12)] backdrop-blur-xl ring-1 ring-inset ring-white/70"
                    : "border border-slate-200/40 bg-slate-100/50 text-slate-600 backdrop-blur-md hover:border-slate-300/50 hover:bg-white/65 hover:text-slate-800"
                }`}
              >
                {tab.label}
              </button>
            );
          })}

          {/* More dropdown */}
          <div ref={moreMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setShowMoreMenu((p) => !p)}
              className={`flex items-center gap-1 rounded-full px-4 py-1.5 text-sm font-semibold transition duration-200 ${
                OVERFLOW_TABS.some((t) => t.key === pageTab)
                  ? "border border-[#2B7DE9]/25 bg-white/65 text-[#1565C9] shadow-[0_4px_20px_rgba(43,125,233,0.12)] backdrop-blur-xl ring-1 ring-inset ring-white/70"
                  : "border border-slate-200/40 bg-slate-100/50 text-slate-600 backdrop-blur-md hover:border-slate-300/50 hover:bg-white/65 hover:text-slate-800"
              }`}
            >
              {OVERFLOW_TABS.find((t) => t.key === pageTab)?.label ?? "More"}
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
            </button>
            {showMoreMenu && (
              <div className="absolute left-0 top-full z-50 mt-1.5 min-w-[200px] rounded-xl border border-slate-200 bg-white py-1 shadow-xl ring-1 ring-slate-900/5">
                {OVERFLOW_TABS.map((tab) => {
                  const active = pageTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => { setPageTab(tab.key); setShowMoreMenu(false); }}
                      className={`flex w-full items-center px-4 py-2.5 text-left text-sm font-medium transition duration-150 ${
                        active
                          ? "border-l-2 border-[#2B7DE9] bg-sky-500/[0.07] text-[#0c4a6e] backdrop-blur-sm"
                          : "border-l-2 border-transparent text-slate-600 hover:bg-white/60 hover:text-slate-900"
                      }`}
                    >
                      {active && <span className="mr-2 h-1.5 w-1.5 rounded-full bg-[#2B7DE9] shadow-sm shadow-sky-400/50 ring-1 ring-white/80" />}
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {pageTab === "profile" && (
            <button type="button" onClick={openConfig} className="ml-2 grid h-7 w-7 place-items-center rounded-full bg-slate-100 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600" title="Configure Widgets">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            </button>
          )}
        </div>

        {/* Employee Search — keep above tab row when results overlap (stacking / wrap) */}
        <div ref={topSearchRef} className={`relative ml-auto min-w-0 ${topSearchOpen ? "z-50" : "z-20"}`}>
          <div className="flex items-center rounded-full border border-slate-200 bg-white px-3 py-1">
            <svg className="mr-2 h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <input
              type="text"
              value={topSearch}
              onChange={(e) => handleTopSearch(e.target.value)}
              onFocus={() => { if (topSearchResults.length > 0) setTopSearchOpen(true); }}
              placeholder="Search employee..."
              className="w-44 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
          </div>
          {topSearchOpen && topSearchResults.length > 0 && (
            <div className="absolute right-0 top-full z-[60] mt-1.5 w-72 rounded-xl border border-slate-200 bg-white py-1 shadow-xl ring-1 ring-slate-900/5">
              {topSearchResults.map((emp) => (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => { router.push(`/app/people/${emp.id}`); setTopSearch(""); setTopSearchOpen(false); setTopSearchResults([]); }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-slate-50"
                >
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 text-xs font-bold text-blue-700">
                    {emp.fullName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-700">{emp.fullName}</div>
                    <div className="text-xs text-slate-400">{emp.employeeCode}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Help button */}
        <button type="button" className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:bg-slate-50 hover:text-slate-600" title="Help">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </button>
      </div>

      {/* Toast */}
      {msg && (
        <div className={`mb-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${msg.type === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
          <span className={`h-2 w-2 rounded-full ${msg.type === "ok" ? "bg-emerald-500" : "bg-red-500"}`} />
          {msg.text}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          TAB: PROFILE — About card + Quick Access + widgets
         ══════════════════════════════════════════════════ */}
      {isProfileTab && (
        <div className="grid items-start gap-5 lg:grid-cols-2">
          {/* Left column stack: keeps Onboarding directly under About (avoids a tall empty grid cell beside Quick Access). */}
          {(wOn("about") || (wOn("lifecycle") && !wOn("about")) || wOn("pendingLifecycleTasks")) && (
            <div className="flex min-w-0 flex-col gap-3">
          {/* ABOUT CARD */}
          {wOn("about") && (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className={sectionCardHeaderRowSm}>
                <div className="flex items-center gap-2"><SectionIcon path="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" color="bg-slate-600" /><h2 className="text-[15px] font-bold text-slate-700">About</h2></div>
              </div>
              <div className="p-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-start">
                  {/* Avatar */}
                  <div className="flex w-[132px] shrink-0 flex-col items-center text-center sm:w-[148px]">
                    <button type="button" onClick={openPhotoModal} className="relative group cursor-pointer">
                      {emp.profileImageUrl ? (
                        <img src={`${API_BASE_URL}${emp.profileImageUrl}`} alt={emp.fullName} className="h-[104px] w-[104px] rounded-full border-4 border-slate-100 object-cover sm:h-[112px] sm:w-[112px]" />
                      ) : (
                        <div className="grid h-[104px] w-[104px] place-items-center rounded-full border-4 border-slate-100 bg-gradient-to-br from-blue-100 to-indigo-100 text-3xl font-extrabold text-blue-800 sm:h-[112px] sm:w-[112px] sm:text-4xl">{initials}</div>
                      )}
                      <div className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-slate-100 transition group-hover:bg-slate-200">
                        <svg className="h-3 w-3 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                      </div>
                    </button>
                    <h3 className="mt-3 text-sm font-bold text-slate-800">{emp.fullName}</h3>
                    <span className="mt-1 inline-block rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-semibold text-blue-700">
                      {emp.jobTitleName ?? emp.positionTitle ?? "No title"} - {emp.departmentName ?? "—"}
                    </span>
                    <div className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-500">
                      <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                      {emp.locationName ?? "—"}
                    </div>
                  </div>
                  {/* Info sections — vertical with scroll */}
                  <div className="min-w-0 flex-1 max-h-[min(200px,42vh)] overflow-y-auto overflow-x-hidden pl-3 pr-1 sm:pl-4">
                    <div className="space-y-4">
                      <div>
                        <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-600"><SectionIcon path="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" color="bg-blue-500" />Basic Info</h4>
                        <InfoRow label="Full Name" value={emp.fullName} />
                        <InfoRow label="Employee Id" value={emp.employeeCode} />
                        <InfoRow label="Birthday" value={fmtBirthday(emp.dateOfBirth)} />
                      </div>
                      <div className="border-t border-slate-100 pt-3">
                        <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-600"><SectionIcon path="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" color="bg-slate-600" />Job</h4>
                        <InfoRow label="Joined Date" value={fmtDate(emp.joinDate)} />
                        <InfoRow label="Sub Unit" value={emp.departmentName ?? "—"} />
                        <div className="flex py-0.5">
                          <span className="w-24 shrink-0 text-xs text-slate-400">Status:</span>
                          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                            <span className={`h-1.5 w-1.5 rounded-full ${lifecycleColors[emp.status] ?? "bg-gray-400"}`} />{lifecycleLabels[emp.status] ?? emp.status}
                            {emp.status === "Active" && emp.joinDate && (
                              <span className="text-[9px] font-normal text-slate-400 ml-0.5">({fmtDateDisplay(emp.joinDate)})</span>
                            )}
                            {emp.status !== "Active" && emp.terminationDate && (
                              <span className="text-[9px] font-normal text-slate-400 ml-0.5">({fmtDateDisplay(emp.terminationDate)})</span>
                            )}
                          </span>
                        </div>
                        <InfoRow label="Emp. Type" value={employmentTypeDisplayName(employmentTypes, emp.employmentType)} />
                      </div>
                      <div className="border-t border-slate-100 pt-3">
                        <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-600"><SectionIcon path="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" color="bg-green-500" />Contact</h4>
                        <InfoRow label="Mobile" value={emp.phone ?? "—"} />
                        <InfoRow label="Email" value={emp.email} />
                      </div>
                    </div>
                  </div>
                </div>

                {wOn("lifecycle") && (
                  <div className="mt-5 border-t border-slate-100 pt-4">
                    {renderEmployeeLifecycleHeader()}
                    <div className="pt-2">
                      {renderEmployeeLifecycleMain(emp)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}


          {wOn("lifecycle") && !wOn("about") && (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              {renderEmployeeLifecycleHeader()}
              <div className="p-4">
                {renderEmployeeLifecycleMain(emp)}
              </div>
            </div>
          )}

          {/* ONBOARDING & OFFBOARDING — pending tasks for this employee (assigned user shown) */}
          {wOn("pendingLifecycleTasks") && (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className={sectionCardHeaderRowSm}>
                <div className="flex items-center gap-2">
                  <SectionIcon
                    path="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                    color="bg-teal-600"
                  />
                  <h2 className="text-[15px] font-bold text-slate-700">Onboarding &amp; offboarding</h2>
                </div>
                <WidgetGear onRemove={() => removeWidget("pendingLifecycleTasks")} />
              </div>
              <div className="p-4">
                {pendingLifecycleLoading && (
                  <div className="flex justify-center py-8">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-200 border-t-teal-600" />
                  </div>
                )}
                {!pendingLifecycleLoading && pendingLifecycleErr && (
                  <p className="text-center text-xs text-amber-700">{pendingLifecycleErr}</p>
                )}
                {!pendingLifecycleLoading && !pendingLifecycleErr && (
                  <div className="max-h-[min(52vh,420px)] space-y-5 overflow-y-auto pr-1 [scrollbar-gutter:stable] [scrollbar-width:thin]">
                    {(() => {
                      const renderSection = (label: string, rows: PendingLifecycleTaskRow[]) => (
                        <div>
                          <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-1.5">
                            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                              {rows.length} pending
                            </span>
                          </div>
                          {rows.length === 0 ? (
                            <p className="text-xs text-slate-400">No pending tasks.</p>
                          ) : (
                            <ul className="space-y-2">
                              {rows.map((t) => (
                                <li
                                  key={`${t.kind}-${t.id}`}
                                  className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 text-xs shadow-sm"
                                >
                                  <div className="font-semibold text-slate-800">{t.title}</div>
                                  {t.category ? (
                                    <div className="mt-0.5 text-[11px] text-slate-500">{t.category}</div>
                                  ) : null}
                                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600">
                                    <span>
                                      <span className="text-slate-400">Assigned to:</span>{" "}
                                      <span className="font-medium text-slate-700">
                                        {t.assignedToUserName?.trim() || "—"}
                                      </span>
                                    </span>
                                    {t.dueDate ? (
                                      <span>
                                        <span className="text-slate-400">Due:</span>{" "}
                                        <span className="font-medium text-slate-700">{formatDate(t.dueDate)}</span>
                                      </span>
                                    ) : null}
                                    {t.assignmentType ? (
                                      <span className="text-slate-400">
                                        Type: <span className="text-slate-600">{t.assignmentType}</span>
                                      </span>
                                    ) : null}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                      return (
                        <>
                          {renderSection("Onboarding tasks", pendingOnboarding)}
                          {renderSection("Offboarding tasks", pendingOffboarding)}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          )}

            </div>
          )}

          {(wOn("quickAccess") || wOn("birthdaysNotices")) && (
            <div className="flex min-w-0 flex-col gap-5">
              {/* QUICK ACCESS */}
              {wOn("quickAccess") && (
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className={sectionCardHeaderRowSm}>
                    <div className="flex items-center gap-2"><SectionIcon path="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" color="bg-slate-600" /><h2 className="text-[15px] font-bold text-slate-700">Quick Access</h2></div>
                    <WidgetGear onRemove={() => removeWidget("quickAccess")} />
                  </div>
                  <div className="space-y-0.5 p-3">
                    {[
                      { label: "Career Development", sub: "Individual Development Plans", bg: "bg-amber-500", icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" },
                      { label: "Discipline", sub: "Disciplinary Cases", bg: "bg-red-500", icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" },
                    ].map((item) => (
                      <button key={item.sub} type="button" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50">
                        <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${item.bg}`}><svg className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={item.icon}/></svg></div>
                        <div><div className="text-[10px] font-medium text-slate-400">{item.label}</div><div className="text-xs font-semibold text-slate-700">{item.sub}</div></div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {wOn("birthdaysNotices") && (
                <div id="birthdays-notices" className="min-w-0 scroll-mt-28">
                  <BirthdaysCompanyNoticesWidget
                    scrollAnchorHref={`${ROUTES.people}/${id}#birthdays-notices`}
                  />
                </div>
              )}
            </div>
          )}

          {/* LEAVE BALANCE */}
          {wOn("leaveBalance") && (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
              <div className={sectionCardHeaderRowSm}><div className="flex items-center gap-2"><SectionIcon path="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" color="bg-indigo-500" /><h2 className="text-[15px] font-bold text-slate-700">Leave Balance</h2></div><WidgetGear onRemove={() => removeWidget("leaveBalance")} /></div>
              <div className="p-4"><div className="space-y-3">{[{type:"Annual Leave",used:5,total:14,color:"bg-blue-500"},{type:"Sick Leave",used:2,total:7,color:"bg-amber-500"},{type:"Casual Leave",used:1,total:3,color:"bg-emerald-500"}].map((lv)=>(<div key={lv.type}><div className="mb-1 flex items-center justify-between text-xs"><span className="font-medium text-slate-600">{lv.type}</span><span className="text-slate-400">{lv.used}/{lv.total} used</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${lv.color}`} style={{width:`${(lv.used/lv.total)*100}%`}}/></div></div>))}</div><p className="mt-4 text-center text-[11px] text-slate-400">Data synced from Leave module</p></div>
            </div>
          )}

          {/* LEAVE LIST */}
          {wOn("leaveList") && (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
              <div className={sectionCardHeaderRowSm}><div className="flex items-center gap-2"><SectionIcon path="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" color="bg-violet-500" /><h2 className="text-[15px] font-bold text-slate-700">Leave List</h2></div><WidgetGear onRemove={() => removeWidget("leaveList")} /></div>
              <div className="p-4"><p className="mb-3 text-xs text-slate-500">Leave Request(s) From {new Date().toLocaleDateString("en-US",{month:"long",year:"numeric"})}</p><div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5"><div><div className="text-xs font-semibold text-slate-700">No pending requests</div><div className="text-[11px] text-slate-400">All caught up</div></div><span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Clear</span></div><button type="button" className="mt-3 w-full rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-50">View Leave List</button></div>
            </div>
          )}

          {/* TIMESHEETS */}
          {wOn("timesheets") && (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
              <div className={sectionCardHeaderRowSm}><div className="flex items-center gap-2"><SectionIcon path="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" color="bg-teal-500" /><h2 className="text-[15px] font-bold text-slate-700">Timesheets</h2></div><WidgetGear onRemove={() => removeWidget("timesheets")} /></div>
              <div className="p-4"><div className="grid grid-cols-3 gap-2">{[{label:"Today",value:"8h 15m",sub:"On track"},{label:"This Week",value:"36h",sub:"4 days logged"},{label:"This Month",value:"142h",sub:"Target: 160h"}].map((ts)=>(<div key={ts.label} className="rounded-xl bg-slate-50 px-2 py-2.5 text-center"><div className="text-[9px] font-medium uppercase tracking-wider text-slate-400">{ts.label}</div><div className="mt-0.5 text-base font-extrabold text-slate-800">{ts.value}</div><div className="text-[9px] text-slate-400">{ts.sub}</div></div>))}</div><button type="button" className="mt-3 w-full rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-50">View Full Timesheets</button></div>
            </div>
          )}

        </div>
      )}

      {/* ══════════════════════════════════════════════════
          TAB: PERSONAL DETAILS
         ══════════════════════════════════════════════════ */}
      {pageTab === "personal" && (
        <>
        <form onSubmit={handleSave}>
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06),0_8px_24px_-4px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/60">
            <div className="relative flex items-center justify-between border-b border-slate-100/90 bg-gradient-to-r from-slate-50/90 via-white to-indigo-50/30 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-md shadow-indigo-500/25 ring-2 ring-white">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                </div>
                <div>
                  <h2 className="text-base font-bold tracking-tight text-slate-800">Personal Details</h2>
                  <p className="text-[11px] font-medium text-slate-500">Identity and demographic information</p>
                </div>
              </div>
            </div>
            <div className="p-6 sm:p-8">
              <div className="grid gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
                <div><label className={labelClass}>Employee Id</label><input className={inputReadonlyClass} value={emp.employeeCode} readOnly /></div>
                <div><label className={labelClass}>Other Id</label><input name="otherId" className={inputClass} defaultValue={emp.otherId ?? ""} /></div>
                <div><label className={labelClass}>SSN/AADHAAR/ID NO/QID</label><input name="nationalId" className={inputClass} defaultValue={emp.nationalId ?? ""} /></div>
                <div><label className={labelClass}>TIN Number</label><input name="tinNumber" className={inputClass} defaultValue={emp.tinNumber ?? ""} /></div>
                <div><label className={labelClass}>First Name *</label><input name="firstName" required className={inputClass} value={pdFirstName} onChange={(e) => setPdFirstName(e.target.value)} /></div>
                <div><label className={labelClass}>Middle Name</label><input name="middleName" className={inputClass} value={pdMiddleName} onChange={(e) => setPdMiddleName(e.target.value)} /></div>
                <div><label className={labelClass}>Last Name *</label><input name="lastName" required className={inputClass} value={pdLastName} onChange={(e) => setPdLastName(e.target.value)} /></div>
                <div><label className={labelClass}>Full Name</label><input className={inputClass} value={pdFullName} onChange={(e) => setPdFullName(e.target.value)} /></div>
                <div><label className={labelClass}>Name with Initials</label><input className={inputClass} value={pdNameWithInitials} onChange={(e) => setPdNameWithInitials(e.target.value)} /></div>
                <div>
                  <label className={labelClass} htmlFor="people-personal-dateOfBirth">
                    Date of Birth *
                  </label>
                  <DatePickerField
                    id="people-personal-dateOfBirth"
                    name="dateOfBirth"
                    required
                    className={inputClass}
                    defaultValue={fmtDate(emp.dateOfBirth)}
                  />
                </div>
                <div><label className={labelClass}>Marital Status</label><FormSelect name="maritalStatus" defaultValue={emp.maritalStatus ?? ""} options={MARITAL_OPTIONS} placeholder="--Select--" /></div>
                <div><label className={labelClass}>Gender *</label><FormSelect name="gender" required defaultValue={emp.gender} options={GENDER_SELECT_OPTIONS} /></div>
                <div><label className={labelClass}>Nationality</label><FormSelect name="nationality" defaultValue={emp.nationality ?? ""} options={NATIONALITY_OPTIONS} placeholder="--Select--" /></div>
                <div><label className={labelClass}>Religion</label><FormSelect name="religion" defaultValue={emp.religion ?? ""} options={RELIGION_OPTIONS} placeholder="--Select--" /></div>
                <div><label className={labelClass}>Ethnicity</label><FormSelect name="ethnicity" defaultValue={emp.ethnicity ?? ""} options={ETHNICITY_OPTIONS} placeholder="--Select--" /></div>
                <div>
                  <label className={labelClass}>Employee Status *</label>
                  <FormSelect
                    name="status"
                    required
                    defaultValue={emp.status}
                    options={
                      employeeStatuses.length > 0
                        ? employeeStatuses.map((s) => ({ value: s.code, label: s.name }))
                        : Object.keys(lifecycleLabels).map((code) => ({ value: code, label: lifecycleLabels[code] ?? code }))
                    }
                  />
                </div>
              </div>
              {/* Hidden fields for other sections */}
              <input type="hidden" name="driversLicenseNumber" value={emp.driversLicenseNumber ?? ""} />
              <input type="hidden" name="driversLicenseType" value={emp.driversLicenseType ?? ""} />
              <input type="hidden" name="licenseIssueDate" value={emp.licenseIssueDate ? fmtDate(emp.licenseIssueDate) : ""} />
              <input type="hidden" name="licenseExpiryDate" value={emp.licenseExpiryDate ? fmtDate(emp.licenseExpiryDate) : ""} />
              <input type="hidden" name="driversLicenseIssuingCountry" value={emp.driversLicenseIssuingCountry ?? ""} />
              <input type="hidden" name="email" value={emp.email} />
              <input type="hidden" name="phone" value={emp.phone ?? ""} />
              <input type="hidden" name="addressStreet1" value={emp.addressStreet1 ?? ""} />
              <input type="hidden" name="addressStreet2" value={emp.addressStreet2 ?? ""} />
              <input type="hidden" name="city" value={emp.city ?? ""} />
              <input type="hidden" name="country" value={emp.country ?? ""} />
              <input type="hidden" name="stateProvince" value={emp.stateProvince ?? ""} />
              <input type="hidden" name="zipPostalCode" value={emp.zipPostalCode ?? ""} />
              <input type="hidden" name="district" value={emp.district ?? ""} />
              <input type="hidden" name="pollingDivision" value={emp.pollingDivision ?? ""} />
              <input type="hidden" name="distanceToOffice" value={emp.distanceToOffice ?? ""} />
              <input type="hidden" name="modeOfTransport" value={emp.modeOfTransport ?? ""} />
              <input type="hidden" name="homeTelephone" value={emp.homeTelephone ?? ""} />
              <input type="hidden" name="workTelephone" value={emp.workTelephone ?? ""} />
              <input type="hidden" name="otherEmail" value={emp.otherEmail ?? ""} />
              <input type="hidden" name="permanentStreet1" value={emp.permanentStreet1 ?? ""} />
              <input type="hidden" name="permanentStreet2" value={emp.permanentStreet2 ?? ""} />
              <input type="hidden" name="permanentCity" value={emp.permanentCity ?? ""} />
              <input type="hidden" name="permanentCountry" value={emp.permanentCountry ?? ""} />
              <input type="hidden" name="permanentStateProvince" value={emp.permanentStateProvince ?? ""} />
              <input type="hidden" name="permanentZipPostalCode" value={emp.permanentZipPostalCode ?? ""} />
              <input type="hidden" name="permanentDistrict" value={emp.permanentDistrict ?? ""} />
              <input type="hidden" name="permanentPollingDivision" value={emp.permanentPollingDivision ?? ""} />
              <input type="hidden" name="permanentDistanceToOffice" value={emp.permanentDistanceToOffice ?? ""} />
              <input type="hidden" name="departmentId" value={emp.departmentId} />
              <input type="hidden" name="businessUnitId" value={emp.businessUnitId ?? ""} />
              <input type="hidden" name="locationId" value={emp.locationId ?? ""} />
              <input type="hidden" name="gradeId" value={emp.gradeId ?? ""} />
              <input type="hidden" name="jobTitleId" value={emp.jobTitleId ?? ""} />
              <input type="hidden" name="managerId" value={emp.managerId ?? ""} />
              <input type="hidden" name="isTopOfHierarchy" value={String(emp.isTopOfHierarchy)} />
              <div className="mt-8 flex items-center justify-end gap-3 border-t border-slate-100/90 pt-6">
                <button type="submit" disabled={saving} className="inline-flex min-w-[140px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition hover:from-indigo-500 hover:to-blue-500 hover:shadow-lg disabled:opacity-50">
                  {saving && <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* ── Add Attachment Modal ── */}
        <Modal open={showAttachModal} onClose={() => { setShowAttachModal(false); setAttachFile(null); setAttachDesc(""); setAttachTypeId(""); setAttachExpiry(""); }} title="">
          <div>
            <h3 className="text-lg font-semibold text-slate-700">Add Attachment</h3>
            <div className="mt-3 border-t border-slate-200 pt-4">
              <label className="mb-1 block text-sm font-semibold text-slate-600">
                File<span className="text-blue-500">*</span>
                <span className="ml-0.5 text-xs font-normal text-slate-400">(Up to 10 MB)</span>
              </label>
              <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <button
                  type="button"
                  onClick={() => attachFileRef.current?.click()}
                  className="rounded-lg bg-slate-200 px-4 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-300"
                >
                  Browse
                </button>
                <span className="truncate text-sm text-slate-500">
                  {attachFile ? attachFile.name : "No file chosen"}
                </span>
                <input
                  ref={attachFileRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      if (f.size > 10 * 1024 * 1024) {
                        alert("File size must be less than 10 MB.");
                        return;
                      }
                      setAttachFile(f);
                    }
                  }}
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="mb-1 block text-sm font-semibold text-slate-600">
                Attachment type<span className="text-blue-500">*</span>
              </label>
              <FormSelect
                value={attachTypeId}
                onValueChange={setAttachTypeId}
                placeholder="Select type…"
                options={[
                  { value: "", label: "Select type…" },
                  ...[...attachmentTypeMasters]
                    .filter((t) => t.isActive)
                    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name))
                    .map((t) => ({ value: t.id, label: t.name })),
                ]}
              />
            </div>
            <div className="mt-4">
              <label className="mb-1 block text-sm font-semibold text-slate-600">Expiry date</label>
              <DatePickerField
                value={attachExpiry}
                onChange={setAttachExpiry}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div className="mt-4">
              <label className="mb-1 block text-sm font-semibold text-slate-600">Description</label>
              <textarea
                value={attachDesc}
                onChange={(e) => setAttachDesc(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                rows={4}
                placeholder=""
              />
            </div>
            <div className="mt-3 border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-red-400">* Required</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => { setShowAttachModal(false); setAttachFile(null); setAttachDesc(""); setAttachTypeId(""); setAttachExpiry(""); }}
                    className="rounded-full border border-slate-300 px-6 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={uploadAttachment}
                    disabled={!attachFile || !attachTypeId || attachUploading}
                    className="rounded-full bg-green-500 px-8 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-600 disabled:opacity-50"
                  >
                    {attachUploading ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Modal>

        {/* ── EPF / ETF Section ── */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className={sectionCardHeaderRow}>
            <div className="flex items-center gap-2.5">
              <SectionIcon path="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" color="bg-cyan-500" />
              <h2 className="text-base font-bold text-slate-800">EPF / ETF Details</h2>
            </div>
          </div>
          <div className="p-6">
            <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
              <div><label className={labelClass}>EPF Number</label><input name="epfNumber" className={inputClass} defaultValue={emp.epfNumber ?? ""} /></div>
              <div><label className={labelClass}>ETF Number</label><input name="etfNumber" className={inputClass} defaultValue={emp.etfNumber ?? ""} /></div>
            </div>
          </div>
        </div>

        {/* ── Attachments Section ── */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className={sectionCardHeaderRow}>
            <div className="flex min-w-0 items-center gap-2.5">
              <SectionIcon path="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" color="bg-cyan-500" />
              <h2 className="text-base font-bold text-slate-800">Attachments</h2>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="hidden text-sm text-slate-500 sm:inline">{attachments.length} record(s)</span>
              <span className="text-sm text-slate-500 sm:hidden">{attachments.length}</span>
              <button
                type="button"
                onClick={() => {
                  setAttachFile(null);
                  setAttachDesc("");
                  setAttachTypeId("");
                  setAttachExpiry("");
                  setShowAttachModal(true);
                  apiFetch<AttachmentTypeItem[]>("/api/employees/profile-attachment-types")
                    .then(setAttachmentTypeMasters)
                    .catch(() => setAttachmentTypeMasters([]));
                }}
                className={sectionHeaderAddTextBtn}
              >
                Add
              </button>
            </div>
          </div>

          {attachments.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-slate-400">No attachments yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] table-fixed border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50/95 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="w-10 px-3 py-3" aria-label="Select" />
                    <th className="w-[22%] px-3 py-3">File</th>
                    <th className="w-[14%] px-3 py-3">Type</th>
                    <th className="w-[16%] px-3 py-3">Description</th>
                    <th className="w-[7%] px-3 py-3">Size</th>
                    <th className="w-[9%] px-3 py-3">Expiry</th>
                    <th className="w-[11%] px-3 py-3">Format</th>
                    <th className="w-[11%] px-3 py-3">Added</th>
                    <th className="w-[10%] px-3 py-3">By</th>
                    <th className="w-28 px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {attachments.map((att) => {
                    const mime = attachmentMimeLabel(att.contentType);
                    return (
                    <tr key={att.id} className="border-b border-slate-100/90 transition hover:bg-slate-50/80">
                      <td className="px-3 py-2.5 align-middle"><input type="checkbox" className="rounded border-slate-300" /></td>
                      <td className="max-w-0 px-3 py-2.5 align-middle">
                        <span className="block truncate font-medium text-slate-800" title={att.fileName}>
                          {att.fileName}
                        </span>
                      </td>
                      <td className="max-w-0 px-3 py-2.5 align-middle text-slate-600">
                        {editingAttach === att.id ? (
                          <FormSelect
                            value={editAttachTypeId}
                            onValueChange={setEditAttachTypeId}
                            className="!h-8 !min-h-0 !w-full !max-w-full !rounded-lg !px-2 !py-1 !text-xs"
                            placeholder="Select…"
                            options={[
                              { value: "", label: "Select…" },
                              ...[...attachmentTypeMasters]
                                .filter((t) => t.isActive || t.id === att.attachmentTypeId)
                                .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name))
                                .map((t) => ({ value: t.id, label: t.name })),
                            ]}
                          />
                        ) : (
                          <span className="block truncate" title={att.attachmentTypeName ?? undefined}>
                            {att.attachmentTypeName ?? "—"}
                          </span>
                        )}
                      </td>
                      <td className="max-w-0 px-3 py-2.5 align-middle text-slate-600">
                        {editingAttach === att.id ? (
                          <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs shadow-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/30" />
                        ) : (
                          <span className="block truncate text-slate-500" title={att.description ?? undefined}>
                            {att.description?.trim() ? att.description : "—"}
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 align-middle text-slate-600 tabular-nums">{fmtFileSize(att.size)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 align-middle text-slate-600">
                        {editingAttach === att.id ? (
                          <DatePickerField
                            value={editAttachExpiry}
                            onChange={setEditAttachExpiry}
                            className="min-w-0 rounded-lg border border-slate-200 px-2 py-1.5 text-xs shadow-sm"
                          />
                        ) : (
                          formatDate(att.expiryDate ?? null)
                        )}
                      </td>
                      <td className="max-w-0 px-3 py-2.5 align-middle">
                        <span className="block truncate text-slate-600" title={att.contentType?.trim() || undefined}>
                          {mime.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 align-middle text-slate-600">{formatDateTime(att.dateAdded)}</td>
                      <td className="max-w-0 px-3 py-2.5 align-middle text-slate-600">
                        <span className="block truncate" title={att.addedBy ?? undefined}>{att.addedBy ?? "—"}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right align-middle">
                        <div className="flex items-center justify-end gap-2">
                          {editingAttach === att.id ? (
                            <>
                              <button type="button" title="Save" onClick={() => updateAttachmentRow(att.id)} className="text-emerald-600 hover:text-emerald-700">
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                              </button>
                              <button type="button" title="Cancel" onClick={() => setEditingAttach(null)} className="text-slate-400 hover:text-slate-600">
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                            </>
                          ) : (
                            <>
                              <a href={`${API_BASE_URL}/api/employees/${id}/attachments/${att.id}/download`} target="_blank" rel="noreferrer" title="Download" className="text-slate-500 transition hover:text-blue-600">
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                              </a>
                              <button
                                type="button"
                                title="Edit attachment"
                                onClick={() => {
                                  setEditingAttach(att.id);
                                  setEditDesc(att.description ?? "");
                                  setEditAttachTypeId(att.attachmentTypeId ?? "");
                                  setEditAttachExpiry(att.expiryDate ? att.expiryDate.split("T")[0] : "");
                                }}
                                className="text-slate-500 transition hover:text-amber-600"
                              >
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                              </button>
                              <button type="button" title="Delete" onClick={() => deleteAttachment(att.id)} className="text-slate-400 transition hover:text-red-600">
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════
          TAB: JOB
         ══════════════════════════════════════════════════ */}
      {pageTab === "job" && (
        <div className="space-y-6">
        <form onSubmit={handleSave}>
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className={sectionCardHeaderRow}>
              <div className="flex items-center gap-2.5"><SectionIcon path="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" color="bg-indigo-500" /><h2 className="text-[15px] font-bold text-slate-700">Job Details</h2></div>
              <div ref={docPopoverRef} className="relative">
                <button type="button" onClick={() => setShowDocPopover((p) => !p)} title="Create Document" className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:border-slate-300">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                  Create Document
                </button>
                {showDocPopover && (
                  <div className="absolute right-0 top-full z-30 mt-2 w-72 rounded-xl border border-slate-200 bg-white shadow-lg">
                    <div className="border-b border-slate-100 px-4 py-2.5">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Generate Letter</span>
                    </div>
                    <div className="divide-y divide-slate-50 py-1">
                      {[
                        { key: "job_confirmation", name: "Job Confirmation Letter" },
                        { key: "probation_confirmation", name: "Probation Confirmation Letter" },
                        { key: "experience_letter", name: "Experience Letter" },
                        { key: "resignation_letter", name: "Resignation Letter" },
                        { key: "appointment_letter", name: "Appointment Letter" },
                        { key: "confirmation_letter", name: "Confirmation Letter" },
                        { key: "contract_letter", name: "Contract Letter" },
                      ].map((doc) => (
                        <div key={doc.key} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition">
                          <span className="text-sm text-slate-700">{doc.name}</span>
                          <div className="flex items-center gap-1">
                            <button type="button" title="Email" className="rounded-full p-1 text-green-500 transition hover:bg-green-50">
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
                            </button>
                            <button type="button" title="Download PDF" onClick={() => { downloadDocPdf(doc.key, doc.name); setShowDocPopover(false); }} className="rounded-full p-1 text-red-500 transition hover:bg-red-50">
                              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M7 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-6-6H7zm5 1.5L17.5 9H13a1 1 0 0 1-1-1V3.5zM9.5 13h1.2l.5 1.8.5-1.8h1.2l-1 3.2H10.6L9.5 13zm-2.3 0h1.1c.8 0 1.3.5 1.3 1.3v.6c0 .8-.5 1.3-1.3 1.3H7.2V13zm5.3 0h1.3c.7 0 1.2.5 1.2 1.2v1c0 .6-.5 1-1.2 1H12.5V13z"/></svg>
                            </button>
                            <button type="button" title="Download DOCX" onClick={() => { downloadDocWord(doc.key, doc.name); setShowDocPopover(false); }} className="rounded-full p-1 text-blue-500 transition hover:bg-blue-50">
                              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M7 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-6-6H7zm5 1.5L17.5 9H13a1 1 0 0 1-1-1V3.5zM8 13h1l1 3.5L11 13h1l-1.5 4.5h-1L8 13zm4.5 0H14c.6 0 1 .3 1 .9v2.7c0 .6-.4.9-1 .9h-1.5V13z"/></svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            {/* Summary banner */}
            <div className="border-b border-slate-100 bg-slate-50/70 px-6 py-3">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-indigo-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                  <span className="text-xs font-semibold text-slate-700">{emp.fullName}</span>
                  <span className="text-xs text-slate-400">({emp.employeeCode})</span>
                </div>
                <span className="hidden sm:inline text-slate-200">|</span>
                <div className="flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                  <span className="text-xs text-slate-600">{emp.jobTitleName ?? "No title"}</span>
                </div>
                <span className="hidden sm:inline text-slate-200">|</span>
                <div className="flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
                  <span className="text-xs text-slate-600">{emp.departmentName ?? "—"}</span>
                </div>
                <span className="hidden sm:inline text-slate-200">|</span>
                <div className="flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                  <span className="text-xs text-slate-500">Joined</span>
                  <span className="text-xs font-medium text-slate-600">{fmtDateDisplay(emp.joinDate)}</span>
                </div>
                <span className="hidden sm:inline text-slate-200">|</span>
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${lifecycleColors[emp.status] ?? "bg-gray-400"}`} />
                  <span className="text-xs font-semibold text-slate-600">{lifecycleLabels[emp.status] ?? emp.status}</span>
                  {emp.status !== "Active" && emp.terminationDate && (
                    <span className="text-[11px] text-slate-400">({fmtDateDisplay(emp.terminationDate)})</span>
                  )}
                </div>
                {emp.locationName && (
                  <>
                    <span className="hidden sm:inline text-slate-200">|</span>
                    <div className="flex items-center gap-1.5">
                      <svg className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                      <span className="text-xs text-slate-600">{emp.locationName}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="p-6">
              <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
                <div><label className={labelClass}>Joined Date *</label><DatePickerField name="joinDate" required className={inputClass} value={jobFormJoinDate} onChange={setJobFormJoinDate} /></div>
                <div><label className={labelClass}>Probation End Date</label><DatePickerField name="probationEndDate" className={inputClass} value={jobFormProbationEnd} onChange={setJobFormProbationEnd} /></div>
                <div><label className={labelClass}>Date of Permanency</label><DatePickerField name="dateOfPermanency" className={inputClass} value={jobFormPermanency} onChange={setJobFormPermanency} /></div>
                <div><label className={labelClass}>Job Title</label><FormSelect name="jobTitleId" defaultValue={emp.jobTitleId ?? ""} placeholder="— None —" options={[{ value: "", label: "— None —" }, ...jobTitles.map((j) => ({ value: j.id, label: j.name }))]} /></div>
                <div><label className={labelClass}>Department *</label><FormSelect name="departmentId" required defaultValue={emp.departmentId} options={departments.map((d) => ({ value: d.id, label: d.name }))} /></div>
                <div><label className={labelClass}>Employment Type *</label><FormSelect name="employmentType" required defaultValue={emp.employmentType} options={jobEmploymentTypeSelectOptions} /></div>
                <div><label className={labelClass}>Business Unit</label><FormSelect name="businessUnitId" defaultValue={emp.businessUnitId ?? ""} placeholder="— None —" options={[{ value: "", label: "— None —" }, ...businessUnits.map((b) => ({ value: b.id, label: b.name }))]} /></div>
                <div><label className={labelClass}>Grade</label><FormSelect name="gradeId" defaultValue={emp.gradeId ?? ""} placeholder="— None —" options={[{ value: "", label: "— None —" }, ...grades.map((g) => ({ value: g.id, label: g.name }))]} /></div>
                <div><label className={labelClass}>Location</label><FormSelect name="locationId" defaultValue={emp.locationId ?? ""} placeholder="— None —" options={[{ value: "", label: "— None —" }, ...locations.map((l) => ({ value: l.id, label: l.name }))]} /></div>
              </div>
              {/* Hidden fields */}
              <input type="hidden" name="firstName" value={emp.firstName} />
              <input type="hidden" name="middleName" value={emp.middleName ?? ""} />
              <input type="hidden" name="lastName" value={emp.lastName} />
              <input type="hidden" name="email" value={emp.email} />
              <input type="hidden" name="phone" value={emp.phone ?? ""} />
              <input type="hidden" name="addressStreet1" value={emp.addressStreet1 ?? ""} />
              <input type="hidden" name="addressStreet2" value={emp.addressStreet2 ?? ""} />
              <input type="hidden" name="city" value={emp.city ?? ""} />
              <input type="hidden" name="country" value={emp.country ?? ""} />
              <input type="hidden" name="stateProvince" value={emp.stateProvince ?? ""} />
              <input type="hidden" name="zipPostalCode" value={emp.zipPostalCode ?? ""} />
              <input type="hidden" name="district" value={emp.district ?? ""} />
              <input type="hidden" name="pollingDivision" value={emp.pollingDivision ?? ""} />
              <input type="hidden" name="distanceToOffice" value={emp.distanceToOffice ?? ""} />
              <input type="hidden" name="modeOfTransport" value={emp.modeOfTransport ?? ""} />
              <input type="hidden" name="homeTelephone" value={emp.homeTelephone ?? ""} />
              <input type="hidden" name="workTelephone" value={emp.workTelephone ?? ""} />
              <input type="hidden" name="otherEmail" value={emp.otherEmail ?? ""} />
              <input type="hidden" name="permanentStreet1" value={emp.permanentStreet1 ?? ""} />
              <input type="hidden" name="permanentStreet2" value={emp.permanentStreet2 ?? ""} />
              <input type="hidden" name="permanentCity" value={emp.permanentCity ?? ""} />
              <input type="hidden" name="permanentCountry" value={emp.permanentCountry ?? ""} />
              <input type="hidden" name="permanentStateProvince" value={emp.permanentStateProvince ?? ""} />
              <input type="hidden" name="permanentZipPostalCode" value={emp.permanentZipPostalCode ?? ""} />
              <input type="hidden" name="permanentDistrict" value={emp.permanentDistrict ?? ""} />
              <input type="hidden" name="permanentPollingDivision" value={emp.permanentPollingDivision ?? ""} />
              <input type="hidden" name="permanentDistanceToOffice" value={emp.permanentDistanceToOffice ?? ""} />
              <input type="hidden" name="dateOfBirth" value={fmtDate(emp.dateOfBirth)} />
              <input type="hidden" name="gender" value={emp.gender} />
              <input type="hidden" name="maritalStatus" value={emp.maritalStatus ?? ""} />
              <input type="hidden" name="nationality" value={emp.nationality ?? ""} />
              <input type="hidden" name="religion" value={emp.religion ?? ""} />
              <input type="hidden" name="ethnicity" value={emp.ethnicity ?? ""} />
              <input type="hidden" name="otherId" value={emp.otherId ?? ""} />
              <input type="hidden" name="nationalId" value={emp.nationalId ?? ""} />
              <input type="hidden" name="tinNumber" value={emp.tinNumber ?? ""} />
              <input type="hidden" name="epfNumber" value={emp.epfNumber ?? ""} />
              <input type="hidden" name="etfNumber" value={emp.etfNumber ?? ""} />
              <input type="hidden" name="driversLicenseNumber" value={emp.driversLicenseNumber ?? ""} />
              <input type="hidden" name="driversLicenseType" value={emp.driversLicenseType ?? ""} />
              <input type="hidden" name="licenseIssueDate" value={emp.licenseIssueDate ? fmtDate(emp.licenseIssueDate) : ""} />
              <input type="hidden" name="licenseExpiryDate" value={emp.licenseExpiryDate ? fmtDate(emp.licenseExpiryDate) : ""} />
              <input type="hidden" name="driversLicenseIssuingCountry" value={emp.driversLicenseIssuingCountry ?? ""} />
              <input type="hidden" name="isTopOfHierarchy" value={String(emp.isTopOfHierarchy)} />
              <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" onClick={() => setPageTab("profile")} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50">
                  {saving && <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </form>

        {emp.status === "Terminated" ? (
          <>
          {/* Activate Employment Link */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm px-6 py-4">
            <button
              type="button"
              onClick={() => { setReactActivateNow(false); setReactUpdateJoinDate(true); setReactDate(new Date().toISOString().split("T")[0]); setReactHour("00"); setReactMinute("00"); setReactWithOnboarding(false); setShowReactivateModal(true); }}
              className="flex items-center gap-2 text-green-600 transition hover:text-green-700"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" /></svg>
              <span className="text-sm font-medium">Activate Employment</span>
            </button>
          </div>

          {/* Reactivate Employment Modal */}
          <Modal open={showReactivateModal} onClose={() => setShowReactivateModal(false)} title="">
            <div>
              <h3 className="text-lg font-semibold text-slate-700">Reactivate Employment</h3>
              <div className="mt-3 border-t border-slate-200 pt-4 flex items-center gap-8">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={reactActivateNow} onChange={(e) => setReactActivateNow(e.target.checked)} className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                  <span className="text-sm font-medium text-slate-600">Activate Now</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={reactUpdateJoinDate} onChange={(e) => setReactUpdateJoinDate(e.target.checked)} className="h-5 w-5 rounded border-slate-300 text-orange-500 focus:ring-orange-500 accent-orange-500" />
                  <span className="text-sm font-medium text-slate-600">Update Joined Date</span>
                </label>
              </div>
              {!reactActivateNow && (
                <div className="mt-4">
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Date<span className="text-red-500">*</span></label>
                  <DatePickerField value={reactDate} onChange={setReactDate} className={inputClass} />
                </div>
              )}
              <div className="mt-5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={reactWithOnboarding} onChange={(e) => setReactWithOnboarding(e.target.checked)} className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                  <span className="text-sm text-slate-600">With Onboarding</span>
                </label>
              </div>
              <div className="mt-5 border-t border-slate-100 pt-4 flex items-center justify-between">
                <span className="text-xs text-red-400">* Required</span>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setShowReactivateModal(false)} className="rounded-full border border-slate-300 px-6 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">Cancel</button>
                  <button type="button" onClick={handleReactivate} disabled={(!reactActivateNow && !reactDate) || reactSaving} className="rounded-full bg-green-500 px-8 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-600 disabled:opacity-50">{reactSaving ? "Processing..." : "Confirm"}</button>
                </div>
              </div>
            </div>
          </Modal>
          </>
        ) : (
          <>
          {/* Terminate Employment Link */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm px-6 py-4">
            <button
              type="button"
              onClick={() => { setTermReason(""); setTermDate(new Date().toISOString().split("T")[0]); setTermNote(""); setWithOffboarding(true); setSelectedTemplateId(""); setShowTerminateModal(true); }}
              className="flex items-center gap-2 text-slate-500 transition hover:text-red-600"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M22 10.5h-6m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" /></svg>
              <span className="text-sm font-medium">Terminate Employment</span>
            </button>
          </div>

          {/* Terminate Employment Modal */}
          <Modal open={showTerminateModal} onClose={() => setShowTerminateModal(false)} title="">
            <div>
              <h3 className="text-lg font-semibold text-slate-700">Terminate Employment</h3>
              <div className="mt-3 border-t border-slate-200 pt-4">
                <label className="mb-1 block text-sm font-semibold text-slate-600">Reason<span className="text-red-500">*</span></label>
                <FormSelect
                  value={termReason}
                  onValueChange={setTermReason}
                  placeholder="-- Select --"
                  options={[
                    { value: "", label: "-- Select --" },
                    ...employeeStatuses.filter((s) => s.code !== "Active").map((s) => ({ value: s.name, label: s.name })),
                  ]}
                />
              </div>
              <div className="mt-4">
                <label className="mb-1 block text-sm font-semibold text-slate-600">Date<span className="text-red-500">*</span></label>
                <DatePickerField value={termDate} onChange={setTermDate} className={inputClass} />
              </div>
              <div className="mt-4">
                <label className="mb-1 block text-sm font-semibold text-slate-600">Note</label>
                <textarea value={termNote} onChange={(e) => setTermNote(e.target.value)} rows={3} className={inputClass + " resize-y"} />
              </div>

              {/* Offboarding Section */}
              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={withOffboarding}
                    onChange={(e) => { setWithOffboarding(e.target.checked); if (!e.target.checked) setSelectedTemplateId(""); }}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-semibold text-slate-700">Start Offboarding Process</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">Automatically create offboarding tasks for this employee</p>
                  </div>
                </label>
                {withOffboarding && (
                  <div className="mt-3">
                    <label className="mb-1 block text-xs font-semibold text-slate-500">Offboarding Template</label>
                    <FormSelect
                      value={selectedTemplateId}
                      onValueChange={setSelectedTemplateId}
                      placeholder="-- Select a template --"
                      options={[
                        { value: "", label: "-- Select a template --" },
                        ...offboardingTemplates.map((t) => ({
                          value: t.id,
                          label: `${t.name} (${t.itemCount} task${t.itemCount !== 1 ? "s" : ""})`,
                        })),
                      ]}
                    />
                    {offboardingTemplates.length === 0 && (
                      <p className="mt-1.5 text-[11px] text-amber-500">No offboarding templates found. Create one in Employee Tasks module first.</p>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-4 border-t border-slate-100 pt-4 flex items-center justify-between">
                <span className="text-xs text-red-400">* Required</span>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setShowTerminateModal(false)} className="rounded-full border border-slate-300 px-6 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">Cancel</button>
                  <button type="button" onClick={handleTerminate} disabled={!termReason || !termDate || termSaving} className="rounded-full bg-red-500 px-8 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-600 disabled:opacity-50">{termSaving ? "Processing..." : "Terminate"}</button>
                </div>
              </div>
            </div>
          </Modal>
          </>
        )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          TAB: CONTACT DETAILS
         ══════════════════════════════════════════════════ */}
      {pageTab === "contactDetails" && (
        <form onSubmit={handleSave} className="space-y-6">
          {/* Telephone & Email */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className={sectionCardHeaderRow}>
              <div className="flex items-center gap-2.5"><SectionIcon path="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" color="bg-green-500" /><h2 className="text-[15px] font-bold text-slate-700">Telephone & Email</h2></div>
            </div>
            <div className="p-6">
              <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
                <div><label className={labelClass}>Home Telephone</label><input name="homeTelephone" className={inputClass} defaultValue={emp.homeTelephone ?? ""} /></div>
                <div><label className={labelClass}>Mobile</label><input name="phone" className={inputClass} defaultValue={emp.phone ?? ""} /></div>
                <div><label className={labelClass}>Work Telephone</label><input name="workTelephone" className={inputClass} defaultValue={emp.workTelephone ?? ""} /></div>
                <div><label className={labelClass}>Work Email</label><input name="email" type="email" pattern="[^\s@]+@[^\s@]+\.[^\s@]{2,}" title="Enter a valid email (e.g. name@company.com)" className={inputClass} defaultValue={emp.email} /></div>
                <div><label className={labelClass}>Personal Email</label><input name="otherEmail" type="email" pattern="[^\s@]+@[^\s@]+\.[^\s@]{2,}" title="Enter a valid email (e.g. name@example.com)" className={inputClass} defaultValue={emp.otherEmail ?? ""} /></div>
              </div>
            </div>
          </div>

          {/* Current Address */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className={sectionCardHeaderRow}>
              <div className="flex items-center gap-2.5"><SectionIcon path="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" color="bg-blue-500" /><h2 className="text-[15px] font-bold text-slate-700">Current Address</h2></div>
            </div>
            <div className="p-6">
              <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
                <div><label className={labelClass}>Address Street 1</label><input name="addressStreet1" className={inputClass} defaultValue={emp.addressStreet1 ?? ""} /></div>
                <div><label className={labelClass}>Address Street 2</label><input name="addressStreet2" className={inputClass} defaultValue={emp.addressStreet2 ?? ""} /></div>
                <div><label className={labelClass}>City</label><input name="city" className={inputClass} defaultValue={emp.city ?? ""} /></div>
                <div><label className={labelClass}>Country</label><FormSelect name="country" defaultValue={emp.country ?? ""} options={COUNTRY_OPTIONS} placeholder="--Select--" /></div>
                <div><label className={labelClass}>State/Province</label><input name="stateProvince" className={inputClass} defaultValue={emp.stateProvince ?? ""} /></div>
                <div><label className={labelClass}>Zip/Postal Code</label><input name="zipPostalCode" className={inputClass} defaultValue={emp.zipPostalCode ?? ""} /></div>
                <div><label className={labelClass}>District</label><FormSelect name="district" defaultValue={emp.district ?? ""} options={SL_DISTRICT_OPTIONS} placeholder="-- Select --" /></div>
                <div><label className={labelClass}>Polling Division</label><input name="pollingDivision" className={inputClass} defaultValue={emp.pollingDivision ?? ""} /></div>
                <div><label className={labelClass}>Distance to Office</label><input name="distanceToOffice" className={inputClass} defaultValue={emp.distanceToOffice ?? ""} placeholder="e.g. 15 km" /></div>
                <div><label className={labelClass}>Mode of Transport</label><FormSelect name="modeOfTransport" defaultValue={emp.modeOfTransport ?? ""} options={MODE_TRANSPORT_OPTIONS} placeholder="-- Select --" /></div>
              </div>
            </div>
          </div>

          {/* Permanent Address */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className={sectionCardHeaderRow}>
              <div className="flex items-center gap-2.5"><SectionIcon path="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1m-2 0h2" color="bg-amber-500" /><h2 className="text-[15px] font-bold text-slate-700">Permanent Address</h2></div>
            </div>
            <div className="p-6">
              <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
                <div><label className={labelClass}>Address Street 1</label><input name="permanentStreet1" className={inputClass} defaultValue={emp.permanentStreet1 ?? ""} /></div>
                <div><label className={labelClass}>Address Street 2</label><input name="permanentStreet2" className={inputClass} defaultValue={emp.permanentStreet2 ?? ""} /></div>
                <div><label className={labelClass}>City</label><input name="permanentCity" className={inputClass} defaultValue={emp.permanentCity ?? ""} /></div>
                <div><label className={labelClass}>Country</label><FormSelect name="permanentCountry" defaultValue={emp.permanentCountry ?? ""} options={COUNTRY_OPTIONS} placeholder="--Select--" /></div>
                <div><label className={labelClass}>State/Province</label><input name="permanentStateProvince" className={inputClass} defaultValue={emp.permanentStateProvince ?? ""} /></div>
                <div><label className={labelClass}>Zip/Postal Code</label><input name="permanentZipPostalCode" className={inputClass} defaultValue={emp.permanentZipPostalCode ?? ""} /></div>
                <div><label className={labelClass}>District</label><FormSelect name="permanentDistrict" defaultValue={emp.permanentDistrict ?? ""} options={SL_DISTRICT_OPTIONS} placeholder="-- Select --" /></div>
                <div><label className={labelClass}>Polling Division</label><input name="permanentPollingDivision" className={inputClass} defaultValue={emp.permanentPollingDivision ?? ""} /></div>
                <div><label className={labelClass}>Distance to Office</label><input name="permanentDistanceToOffice" className={inputClass} defaultValue={emp.permanentDistanceToOffice ?? ""} placeholder="e.g. 15 km" /></div>
              </div>
            </div>
          </div>

          {/* Hidden fields for required fields from other tabs */}
          <input type="hidden" name="firstName" value={emp.firstName} />
          <input type="hidden" name="middleName" value={emp.middleName ?? ""} />
          <input type="hidden" name="lastName" value={emp.lastName} />
          <input type="hidden" name="dateOfBirth" value={fmtDate(emp.dateOfBirth)} />
          <input type="hidden" name="gender" value={emp.gender} />
          <input type="hidden" name="status" value={emp.status} />
          <input type="hidden" name="departmentId" value={emp.departmentId} />
          <input type="hidden" name="businessUnitId" value={emp.businessUnitId ?? ""} />
          <input type="hidden" name="locationId" value={emp.locationId ?? ""} />
          <input type="hidden" name="gradeId" value={emp.gradeId ?? ""} />
          <input type="hidden" name="jobTitleId" value={emp.jobTitleId ?? ""} />
          <input type="hidden" name="managerId" value={emp.managerId ?? ""} />
          <input type="hidden" name="isTopOfHierarchy" value={String(emp.isTopOfHierarchy)} />
          <div className="flex items-center justify-end gap-2">
            <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50">
              {saving && <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      )}

      {/* ══════════════════════════════════════════════════
          TAB: EMERGENCY CONTACTS
         ══════════════════════════════════════════════════ */}
      {pageTab === "emergencyContacts" && (
        <div className="space-y-6">
          {/* Add / Edit Emergency Contact Modal */}
          <Modal open={showEcModal} onClose={closeEcModal} title="">
            <div>
              <h3 className="text-lg font-semibold text-slate-700">{editingEc ? "Edit Emergency Contact" : "Add Emergency Contact"}</h3>
              <div className="mt-3 border-t border-slate-200 pt-4">
                <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-600">Name<span className="text-red-500">*</span></label>
                    <input value={ecName} onChange={(e) => setEcName(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-600">Relationship<span className="text-red-500">*</span></label>
                    <input value={ecRelationship} onChange={(e) => setEcRelationship(e.target.value)} className={inputClass} />
                  </div>
                </div>
              </div>
              <div className="mt-5">
                <label className="mb-2 block text-sm font-semibold text-slate-600">Telephone<span className="text-red-500">*</span></label>
                <div className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Home</label>
                    <input value={ecHome} onChange={(e) => setEcHome(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Mobile</label>
                    <input value={ecMobile} onChange={(e) => setEcMobile(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Work</label>
                    <input value={ecWork} onChange={(e) => setEcWork(e.target.value)} className={inputClass} />
                  </div>
                </div>
              </div>
              <div className="mt-4 border-t border-slate-100 pt-4 flex items-center justify-between">
                <span className="text-xs text-red-400">* Required</span>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={closeEcModal} className="rounded-full border border-slate-300 px-6 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">Cancel</button>
                  <button type="button" onClick={saveEmergencyContact} disabled={!ecName.trim() || !ecRelationship.trim() || ecSaving} className="rounded-full bg-green-500 px-8 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-600 disabled:opacity-50">{ecSaving ? "Saving..." : "Save"}</button>
                </div>
              </div>
            </div>
          </Modal>

          {/* Emergency Contacts List */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className={sectionCardHeaderRow}>
              <div className="flex items-center gap-2.5">
                <SectionIcon path="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" color="bg-red-500" />
                <h2 className="text-base font-bold text-slate-800">Assigned Emergency Contacts</h2>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500">{emergencyContacts.length} record(s)</span>
                <button type="button" onClick={() => openEcModal()} className={sectionHeaderAddBtn}>
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                </button>
              </div>
            </div>
            {emergencyContacts.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-slate-400">No emergency contacts assigned.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-semibold uppercase text-slate-400">
                      <th className="px-6 py-3">Name</th>
                      <th className="px-4 py-3">Relationship</th>
                      <th className="px-4 py-3">Home Telephone</th>
                      <th className="px-4 py-3">Mobile</th>
                      <th className="px-4 py-3">Work Telephone</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emergencyContacts.map((ec) => (
                      <tr key={ec.id} className="border-b border-slate-50 transition hover:bg-slate-50">
                        <td className="px-6 py-3 font-medium text-slate-700">{ec.name}</td>
                        <td className="px-4 py-3 text-slate-600">{ec.relationship}</td>
                        <td className="px-4 py-3 text-slate-600">{ec.homeTelephone ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{ec.mobileTelephone ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{ec.workTelephone ?? "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button type="button" onClick={() => openEcModal(ec)} className="text-slate-500 transition hover:text-amber-600" title="Edit">
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </button>
                            <button type="button" onClick={() => deleteEmergencyContact(ec.id)} className="text-slate-400 transition hover:text-red-600" title="Delete">
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          TAB: DEPENDENTS
         ══════════════════════════════════════════════════ */}
      {pageTab === "dependents" && (
        <div className="space-y-6">
          {/* Add / Edit Dependent Modal */}
          <Modal open={showDepModal} onClose={closeDepModal} title="">
            <div>
              <h3 className="text-lg font-semibold text-slate-700">{editingDep ? "Edit Dependent" : "Add Dependent"}</h3>
              <div className="mt-3 border-t border-slate-200 pt-4">
                <label className="mb-1 block text-sm font-semibold text-slate-600">Name<span className="text-red-500">*</span></label>
                <div className="grid gap-x-4 sm:grid-cols-2">
                  <input placeholder="First Name" value={depFirstName} onChange={(e) => setDepFirstName(e.target.value)} className={inputClass} />
                  <input placeholder="Last Name" value={depLastName} onChange={(e) => setDepLastName(e.target.value)} className={inputClass + " mt-2 sm:mt-0"} />
                </div>
              </div>
              <div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Date of Birth</label>
                  <DatePickerField value={depDob} onChange={setDepDob} className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Relationship<span className="text-red-500">*</span></label>
                  <FormSelect value={depRelationship} onValueChange={setDepRelationship} options={DEP_RELATIONSHIP_OPTIONS} placeholder="-- Select --" />
                </div>
              </div>
              <div className="mt-4">
                <label className="mb-1 block text-sm font-semibold text-slate-600">Marital Status</label>
                <FormSelect value={depMaritalStatus} onValueChange={setDepMaritalStatus} options={MARITAL_OPTIONS} placeholder="-- Select --" />
              </div>
              <div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Occupation</label>
                  <input value={depOccupation} onChange={(e) => setDepOccupation(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Organization</label>
                  <input value={depOrganization} onChange={(e) => setDepOrganization(e.target.value)} className={inputClass} />
                </div>
              </div>
              <div className="mt-4 border-t border-slate-100 pt-4 flex items-center justify-between">
                <span className="text-xs text-red-400">* Required</span>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={closeDepModal} className="rounded-full border border-slate-300 px-6 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">Cancel</button>
                  <button type="button" onClick={saveDependent} disabled={!depFirstName.trim() || !depLastName.trim() || !depRelationship.trim() || depSaving} className="rounded-full bg-green-500 px-8 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-600 disabled:opacity-50">{depSaving ? "Saving..." : "Save"}</button>
                </div>
              </div>
            </div>
          </Modal>

          {/* Dependents List */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className={sectionCardHeaderRow}>
              <div className="flex items-center gap-2.5">
                <SectionIcon path="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" color="bg-purple-500" />
                <h2 className="text-base font-bold text-slate-800">Assigned Dependents</h2>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500">{dependents.length} record(s)</span>
                <button type="button" onClick={() => openDepModal()} className={sectionHeaderAddBtn}>
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                </button>
              </div>
            </div>
            {dependents.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-slate-400">No dependents assigned.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-semibold uppercase text-slate-400">
                      <th className="px-6 py-3">Name</th>
                      <th className="px-4 py-3">Relationship</th>
                      <th className="px-4 py-3">Date of Birth</th>
                      <th className="px-4 py-3">Marital Status</th>
                      <th className="px-4 py-3">Occupation</th>
                      <th className="px-4 py-3">Organization</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dependents.map((dep) => (
                      <tr key={dep.id} className="border-b border-slate-50 transition hover:bg-slate-50">
                        <td className="px-6 py-3 font-medium text-slate-700">{dep.firstName} {dep.lastName}</td>
                        <td className="px-4 py-3 text-slate-600">{dep.relationship}</td>
                        <td className="px-4 py-3 text-slate-600">{formatDate(dep.dateOfBirth)}</td>
                        <td className="px-4 py-3 text-slate-600">{dep.maritalStatus || "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{dep.occupation || "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{dep.organization || "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button type="button" onClick={() => openDepModal(dep)} className="text-slate-500 transition hover:text-amber-600" title="Edit">
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </button>
                            <button type="button" onClick={() => deleteDependent(dep.id)} className="text-slate-400 transition hover:text-red-600" title="Delete">
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          TAB: QUALIFICATIONS
         ══════════════════════════════════════════════════ */}
      {pageTab === "qualifications" && (
        <div className="space-y-6">
          {/* Add / Edit Education Modal */}
          <Modal open={showEduModal} onClose={closeEduModal} title="">
            <div>
              <h3 className="text-lg font-semibold text-slate-700">{editingEdu ? "Edit Education" : "Add Education"}</h3>
              <div className="mt-3 border-t border-slate-200 pt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Level<span className="text-red-500">*</span></label>
                  <FormSelect value={eduLevel} onValueChange={setEduLevel} options={EDU_LEVEL_OPTIONS} placeholder="-- Select --" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Qualification Name</label>
                  <input value={eduQualName} onChange={(e) => setEduQualName(e.target.value)} className={inputClass} placeholder="e.g. BSc Computer Science" />
                </div>
              </div>
              <div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Institute</label>
                  <input value={eduInstitute} onChange={(e) => setEduInstitute(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Major/Specialization</label>
                  <input value={eduMajor} onChange={(e) => setEduMajor(e.target.value)} className={inputClass} />
                </div>
              </div>
              <div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Year</label>
                  <input value={eduYear} onChange={(e) => setEduYear(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">GPA/Score</label>
                  <input value={eduGpa} onChange={(e) => setEduGpa(e.target.value)} className={inputClass} />
                </div>
              </div>
              <div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Start Date</label>
                  <DatePickerField value={eduStartDate} onChange={setEduStartDate} max={eduEndDate || undefined} className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">End Date</label>
                  <DatePickerField value={eduEndDate} onChange={setEduEndDate} min={eduStartDate || undefined} className={inputClass} />
                </div>
              </div>
              <div className="mt-4">
                <label className="mb-1 block text-sm font-semibold text-slate-600">Remark</label>
                <textarea value={eduRemark} onChange={(e) => setEduRemark(e.target.value)} rows={3} className={inputClass + " resize-y"} placeholder="Additional remarks..." />
              </div>
              <div className="mt-4 border-t border-slate-100 pt-4 flex items-center justify-between">
                <span className="text-xs text-red-400">* Required</span>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={closeEduModal} className="rounded-full border border-slate-300 px-6 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">Cancel</button>
                  <button type="button" onClick={saveEducation} disabled={!eduLevel.trim() || eduSaving} className="rounded-full bg-green-500 px-8 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-600 disabled:opacity-50">{eduSaving ? "Saving..." : "Save"}</button>
                </div>
              </div>
            </div>
          </Modal>

          {/* Formal qualifications (same backing store as education; qualification name is the credential title) */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className={sectionCardHeaderRow}>
              <div className="flex items-center gap-2.5">
                <SectionIcon path="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" color="bg-emerald-600" />
                <h2 className="text-base font-bold text-slate-800">Qualifications</h2>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500">{educations.length} record(s)</span>
                <button type="button" onClick={() => openEduModal()} className={sectionHeaderAddBtn} title="Add">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                </button>
              </div>
            </div>
            {educations.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-slate-400">No records yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-semibold uppercase text-slate-400">
                      <th className="px-6 py-3">Qualification</th>
                      <th className="px-4 py-3">Level</th>
                      <th className="px-4 py-3">Institute</th>
                      <th className="px-4 py-3">Major</th>
                      <th className="px-4 py-3">Year</th>
                      <th className="px-4 py-3">Period</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {educations.map((edu) => (
                      <tr key={`qual-${edu.id}`} className="border-b border-slate-50 transition hover:bg-slate-50">
                        <td className="px-6 py-3 font-medium text-slate-800">{edu.qualificationName?.trim() || "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{edu.level}</td>
                        <td className="px-4 py-3 text-slate-600">{edu.institute ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{edu.major ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{edu.year ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {formatDate(edu.startDate) || "—"}
                          {" – "}
                          {edu.endDate ? formatDate(edu.endDate) : "Present"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button type="button" onClick={() => openEduModal(edu)} className="text-slate-500 transition hover:text-amber-600" title="Edit">
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </button>
                            <button type="button" onClick={() => deleteEducation(edu.id)} className="text-slate-400 transition hover:text-red-600" title="Delete">
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Education: academic structure and study metadata (same API as qualifications) */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className={sectionCardHeaderRow}>
              <div className="flex items-center gap-2.5">
                <SectionIcon path="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" color="bg-indigo-500" />
                <h2 className="text-base font-bold text-slate-800">Education</h2>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500">{educations.length} record(s)</span>
                <button type="button" onClick={() => openEduModal()} className={sectionHeaderAddBtn}>
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                </button>
              </div>
            </div>
            {educations.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-slate-400">No education records added.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-semibold uppercase text-slate-400">
                      <th className="px-6 py-3">Level</th>
                      <th className="px-4 py-3">Institute</th>
                      <th className="px-4 py-3">Major</th>
                      <th className="px-4 py-3">Year</th>
                      <th className="px-4 py-3">GPA/Score</th>
                      <th className="px-4 py-3">Period</th>
                      <th className="px-4 py-3">Remark</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {educations.map((edu) => (
                      <tr key={edu.id} className="border-b border-slate-50 transition hover:bg-slate-50">
                        <td className="px-6 py-3 font-medium text-slate-700">{edu.level}</td>
                        <td className="px-4 py-3 text-slate-600">{edu.institute ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{edu.major ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{edu.year ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{edu.gpaScore ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {formatDate(edu.startDate) || "—"}
                          {" – "}
                          {edu.endDate ? formatDate(edu.endDate) : "Present"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{edu.remark ?? "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button type="button" onClick={() => openEduModal(edu)} className="text-slate-500 transition hover:text-amber-600" title="Edit">
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </button>
                            <button type="button" onClick={() => deleteEducation(edu.id)} className="text-slate-400 transition hover:text-red-600" title="Delete">
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Skills Section (separate from formal qualifications) ── */}
          <Modal open={showSkillModal} onClose={closeSkillModal} title="">
            <div>
              <h3 className="text-lg font-semibold text-slate-700">{editingSkill ? "Edit Skill" : "Add Skill"}</h3>
              <div className="mt-3 border-t border-slate-200 pt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Skill<span className="text-red-500">*</span></label>
                  <input
                    id="employee-skill-name-input"
                    list="employee-skill-catalog"
                    value={skillName}
                    onChange={(e) => setSkillName(e.target.value)}
                    className={inputClass}
                    placeholder={skillMasterList.length ? "Choose from list or type a skill" : "Type a skill name"}
                    autoComplete="off"
                  />
                  <datalist id="employee-skill-catalog">
                    {skillMasterList.map((s) => (
                      <option key={s.id} value={s.name} />
                    ))}
                  </datalist>
                  {skillMasterList.length === 0 && (
                    <p className="mt-1.5 text-xs text-amber-700">
                      No catalog entries loaded (or none active). You can still type a skill above. To manage the shared catalog, use <strong>Settings</strong> → Master data → <strong>Skills</strong> (requires Org Structure on the API).
                    </p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Years of Experience</label>
                  <input value={skillYears} onChange={(e) => setSkillYears(e.target.value)} className={inputClass} />
                </div>
              </div>
              <div className="mt-4">
                <label className="mb-1 block text-sm font-semibold text-slate-600">Comments</label>
                <textarea value={skillComments} onChange={(e) => setSkillComments(e.target.value)} rows={4} className={inputClass + " resize-y"} />
              </div>
              <div className="mt-4 border-t border-slate-100 pt-4 flex items-center justify-between">
                <span className="text-xs text-red-400">* Required</span>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={closeSkillModal} className="rounded-full border border-slate-300 px-6 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">Cancel</button>
                  <button type="button" onClick={saveSkill} disabled={!skillName.trim() || skillSaving} className="rounded-full bg-green-500 px-8 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-600 disabled:opacity-50">{skillSaving ? "Saving..." : "Save"}</button>
                </div>
              </div>
            </div>
          </Modal>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className={sectionCardHeaderRow}>
              <div className="flex items-center gap-2.5">
                <SectionIcon path="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" color="bg-teal-500" />
                <h2 className="text-base font-bold text-slate-800">Skills</h2>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500">{skills.length} record(s)</span>
                <button type="button" onClick={() => openSkillModal()} className={sectionHeaderAddBtn}>
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                </button>
              </div>
            </div>
            {skills.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-slate-400">No skills added.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-semibold uppercase text-slate-400">
                      <th className="px-6 py-3">Skill</th>
                      <th className="px-4 py-3">Years of Experience</th>
                      <th className="px-4 py-3">Comments</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {skills.map((sk) => (
                      <tr key={sk.id} className="border-b border-slate-50 transition hover:bg-slate-50">
                        <td className="px-6 py-3 font-medium text-slate-700">{sk.skill}</td>
                        <td className="px-4 py-3 text-slate-600">{sk.yearsOfExperience ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{sk.comments ?? "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button type="button" onClick={() => openSkillModal(sk)} className="text-slate-500 transition hover:text-amber-600" title="Edit">
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </button>
                            <button type="button" onClick={() => deleteSkill(sk.id)} className="text-slate-400 transition hover:text-red-600" title="Delete">
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <Modal open={showTrainAssignModal} onClose={closeTrainAssignModal} title="">
            <form onSubmit={saveTrainingAssign}>
              <h3 className="text-lg font-semibold text-slate-700">Assign training</h3>
              <p className="mt-1 text-sm text-slate-500">Creates a course assignment for this employee.</p>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Course</label>
                  <FormSelect
                    value={trainCourseId}
                    onValueChange={setTrainCourseId}
                    required
                    options={coursesCatalog.map((c) => ({ value: c.id, label: `${c.title} (${c.code})` }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Due date (optional)</label>
                  <DatePickerField value={trainDue} onChange={setTrainDue} className={inputClass} />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button type="button" onClick={closeTrainAssignModal} className="rounded-full border border-slate-300 px-6 py-2 text-sm font-semibold text-slate-600">
                  Cancel
                </button>
                <button type="submit" disabled={trainSaving || !trainCourseId} className="rounded-full bg-indigo-600 px-8 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  {trainSaving ? "Saving…" : "Assign"}
                </button>
              </div>
            </form>
          </Modal>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className={sectionCardHeaderRow}>
              <div className="flex items-center gap-2.5">
                <SectionIcon path="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" color="bg-indigo-500" />
                <h2 className="text-base font-bold text-indigo-700">Training assignments</h2>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500">{trainingRows.length} record(s)</span>
                <button type="button" onClick={() => void openTrainAssignModal()} className="grid h-9 w-9 place-items-center rounded-full bg-indigo-600 text-white shadow-sm transition hover:bg-indigo-700" title="Assign training">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                </button>
              </div>
            </div>
            {trainingRows.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-slate-400">No training assignments (requires Learning module access).</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-semibold uppercase text-slate-400">
                      <th className="px-6 py-3">Course</th>
                      <th className="px-4 py-3">Code</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Due</th>
                      <th className="px-4 py-3">Assigned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trainingRows.map((t) => (
                      <tr key={t.id} className="border-b border-slate-50 transition hover:bg-slate-50">
                        <td className="px-6 py-3 font-medium text-slate-700">{t.courseTitle}</td>
                        <td className="px-4 py-3 text-slate-600">{t.courseCode}</td>
                        <td className="px-4 py-3 text-slate-600">{t.status}</td>
                        <td className="px-4 py-3 text-slate-600">{formatDate(t.dueDate)}</td>
                        <td className="px-4 py-3 text-slate-600">{formatDateTime(t.assignedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className={sectionCardHeaderRow}>
              <div className="flex items-center gap-2.5">
                <SectionIcon path="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" color="bg-violet-500" />
                <h2 className="text-base font-bold text-violet-800">Skill matrix (reference skills)</h2>
              </div>
              <span className="text-sm text-slate-500">{matrixRows.length} record(s)</span>
            </div>
            {matrixRows.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-slate-400">No structured skill matrix rows for this employee.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-semibold uppercase text-slate-400">
                      <th className="px-6 py-3">Skill</th>
                      <th className="px-4 py-3">Proficiency</th>
                      <th className="px-4 py-3">Assessed</th>
                      <th className="px-4 py-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrixRows.map((m) => (
                      <tr key={m.id} className="border-b border-slate-50 transition hover:bg-slate-50">
                        <td className="px-6 py-3 font-medium text-slate-700">{m.skillName}</td>
                        <td className="px-4 py-3 text-slate-600">{m.proficiencyLevel}</td>
                        <td className="px-4 py-3 text-slate-600">{formatDateTime(m.assessedAt)}</td>
                        <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{m.notes ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className={sectionCardHeaderRow}>
              <div className="flex items-center gap-2.5">
                <SectionIcon path="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" color="bg-amber-500" />
                <h2 className="text-base font-bold text-amber-800">Certifications</h2>
              </div>
              <span className="text-sm text-slate-500">{certRows.length} record(s)</span>
            </div>
            {certRows.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-slate-400">No certifications recorded.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-semibold uppercase text-slate-400">
                      <th className="px-6 py-3">Certification</th>
                      <th className="px-4 py-3">Obtained</th>
                      <th className="px-4 py-3">Expires</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {certRows.map((c) => (
                      <tr key={c.id} className="border-b border-slate-50 transition hover:bg-slate-50">
                        <td className="px-6 py-3 font-medium text-slate-700">{c.certificationName}</td>
                        <td className="px-4 py-3 text-slate-600">{formatDate(c.obtainedDate)}</td>
                        <td className="px-4 py-3 text-slate-600">{formatDate(c.expiryDate)}</td>
                        <td className="px-4 py-3 text-slate-600">{c.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Languages Section ── */}
          <Modal open={showLangModal} onClose={closeLangModal} title="">
            <div>
              <h3 className="text-lg font-semibold text-slate-700">{editingLang ? "Edit Language" : "Add Language"}</h3>
              <p className="mt-1 text-xs text-slate-500">Pick the language, tick reading / writing / speaking (any combination), and fluency. Defaults cover a full proficiency so you can save quickly.</p>
              <div className="mt-3 border-t border-slate-200 pt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Language<span className="text-red-500">*</span></label>
                  <FormSelect value={langName} onValueChange={setLangName} options={LANGUAGE_NAME_OPTIONS} placeholder="-- Select --" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Fluency<span className="text-red-500">*</span></label>
                  <FormSelect value={langFluency} onValueChange={setLangFluency} options={LANGUAGE_FLUENCY_OPTIONS} />
                </div>
              </div>
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                <span className="mb-2 block text-sm font-semibold text-slate-600">Applies to<span className="text-red-500">*</span> <span className="font-normal text-slate-400">(select one or more)</span></span>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={langReading} onChange={(e) => setLangReading(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-green-600 focus:ring-green-500" />
                    Reading
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={langWriting} onChange={(e) => setLangWriting(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-green-600 focus:ring-green-500" />
                    Writing
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={langSpeaking} onChange={(e) => setLangSpeaking(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-green-600 focus:ring-green-500" />
                    Speaking
                  </label>
                  <button
                    type="button"
                    onClick={() => { setLangReading(true); setLangWriting(true); setLangSpeaking(true); }}
                    className="text-xs font-semibold text-green-700 underline decoration-green-300 underline-offset-2 hover:text-green-800"
                  >
                    Select all three
                  </button>
                </div>
              </div>
              <div className="mt-4">
                <label className="mb-1 block text-sm font-semibold text-slate-600">Comments <span className="font-normal text-slate-400">(optional)</span></label>
                <textarea value={langComments} onChange={(e) => setLangComments(e.target.value)} rows={2} className={inputClass + " resize-y"} placeholder="Optional notes" />
              </div>
              <div className="mt-4 border-t border-slate-100 pt-4 flex items-center justify-between">
                <span className="text-xs text-slate-400">Language, at least one mode, and fluency required</span>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={closeLangModal} className="rounded-full border border-slate-300 px-6 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">Cancel</button>
                  <button
                    type="button"
                    onClick={saveLanguage}
                    disabled={!langName.trim() || !langFluency.trim() || (!langReading && !langWriting && !langSpeaking) || langSaving}
                    className="rounded-full bg-green-500 px-8 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-600 disabled:opacity-50"
                  >
                    {langSaving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            </div>
          </Modal>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className={sectionCardHeaderRow}>
              <div className="flex items-center gap-2.5">
                <SectionIcon path="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" color="bg-orange-500" />
                <h2 className="text-base font-bold text-slate-800">Languages</h2>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500">{languages.length} record(s)</span>
                <button type="button" onClick={() => openLangModal()} className={sectionHeaderAddBtn}>
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                </button>
              </div>
            </div>
            {languages.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-slate-400">No languages added.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-semibold uppercase text-slate-400">
                      <th className="px-6 py-3">Language</th>
                      <th className="px-4 py-3">Skill</th>
                      <th className="px-4 py-3">Fluency Level</th>
                      <th className="px-4 py-3">Comments</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {languages.map((lang) => (
                      <tr key={lang.id} className="border-b border-slate-50 transition hover:bg-slate-50">
                        <td className="px-6 py-3 font-medium text-slate-700">{lang.language}</td>
                        <td className="px-4 py-3 text-slate-600">{lang.skill}</td>
                        <td className="px-4 py-3 text-slate-600">{lang.fluencyLevel}</td>
                        <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{lang.comments ?? "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button type="button" onClick={() => openLangModal(lang)} className="text-slate-500 transition hover:text-amber-600" title="Edit">
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </button>
                            <button type="button" onClick={() => deleteLanguage(lang.id)} className="text-slate-400 transition hover:text-red-600" title="Delete">
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          TAB: WORK EXPERIENCE
         ══════════════════════════════════════════════════ */}
      {pageTab === "workExperience" && (
        <div className="space-y-6">
          {/* Add / Edit Work Experience Modal */}
          <Modal open={showWeModal} onClose={closeWeModal} title="">
            <div>
              <h3 className="text-lg font-semibold text-slate-700">{editingWe ? "Edit Work Experience" : "Add Work Experience"}</h3>
              <div className="mt-3 border-t border-slate-200 pt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Company<span className="text-red-500">*</span></label>
                  <input value={weCompany} onChange={(e) => setWeCompany(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Job Title<span className="text-red-500">*</span></label>
                  <input value={weJobTitle} onChange={(e) => setWeJobTitle(e.target.value)} className={inputClass} />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Employment type<span className="text-red-500">*</span></label>
                  <FormSelect value={weEmploymentType} onValueChange={setWeEmploymentType} options={workEmpTypeSelectOptions} placeholder="-- Select --" />
                  <p className="mt-1 text-[11px] text-slate-400">Same options as Employment Type on the Job tab.</p>
                </div>
              </div>
              <div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">From</label>
                  <DatePickerField
                    value={weFromDate}
                    onChange={setWeFromDate}
                    max={dateInputMaxTodayLocal()}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">To</label>
                  <DatePickerField
                    value={weToDate}
                    onChange={setWeToDate}
                    max={dateInputMaxTodayLocal()}
                    min={weFromDate || undefined}
                    className={inputClass}
                  />
                </div>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">Dates must be today or in the past. End date cannot be before start date.</p>
              <div className="mt-4">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={weCreditable} onChange={(e) => setWeCreditable(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-green-500 focus:ring-green-500" />
                  Creditable
                </label>
              </div>
              <div className="mt-4">
                <label className="mb-1 block text-sm font-semibold text-slate-600">Comment</label>
                <textarea value={weComment} onChange={(e) => setWeComment(e.target.value)} rows={3} className={inputClass + " resize-y"} />
              </div>
              <div className="mt-4 border-t border-slate-100 pt-4 flex items-center justify-between">
                <span className="text-xs text-red-400">* Required</span>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={closeWeModal} className="rounded-full border border-slate-300 px-6 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">Cancel</button>
                  <button type="button" onClick={saveWorkExperience} disabled={!weCompany.trim() || !weJobTitle.trim() || !weEmploymentType.trim() || weSaving} className="rounded-full bg-green-500 px-8 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-600 disabled:opacity-50">{weSaving ? "Saving..." : "Save"}</button>
                </div>
              </div>
            </div>
          </Modal>

          {/* Work Experience List */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className={sectionCardHeaderRow}>
              <div className="flex items-center gap-2.5">
                <SectionIcon path="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" color="bg-indigo-500" />
                <h2 className="text-base font-bold text-slate-800">Work Experience</h2>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500">{workExperiences.length} record(s)</span>
                <button type="button" onClick={() => openWeModal()} className={sectionHeaderAddBtn}>
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                </button>
              </div>
            </div>
            {workExperiences.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-slate-400">No work experience records.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-semibold uppercase text-slate-400">
                      <th className="px-6 py-3">Company</th>
                      <th className="px-4 py-3">Job Title</th>
                      <th className="px-4 py-3">Employment type</th>
                      <th className="px-4 py-3">From</th>
                      <th className="px-4 py-3">To</th>
                      <th className="px-4 py-3">Creditable</th>
                      <th className="px-4 py-3">Comment</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workExperiences.map((we) => (
                      <tr key={we.id} className="border-b border-slate-50 transition hover:bg-slate-50">
                        <td className="px-6 py-3 font-medium text-slate-700">{we.company}</td>
                        <td className="px-4 py-3 text-slate-600">{we.jobTitle}</td>
                        <td className="px-4 py-3 text-slate-600">{we.employmentType ? employmentTypeDisplayName(employmentTypes, we.employmentType) : "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{formatDate(we.fromDate)}</td>
                        <td className="px-4 py-3 text-slate-600">{formatDate(we.toDate)}</td>
                        <td className="px-4 py-3 text-slate-600">{we.creditable ? "Yes" : "No"}</td>
                        <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate">{we.comment || "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button type="button" onClick={() => openWeModal(we)} className="text-slate-500 transition hover:text-amber-600" title="Edit">
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </button>
                            <button type="button" onClick={() => deleteWorkExperience(we.id)} className="text-slate-400 transition hover:text-red-600" title="Delete">
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          TAB: DRIVER'S LICENSE
         ══════════════════════════════════════════════════ */}
      {pageTab === "driversLicense" && (
        <form onSubmit={handleSave} className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className={sectionCardHeaderRow}>
              <div className="flex items-center gap-2.5">
                <SectionIcon path="M9 12h6m-3-3v6m-7 4h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" color="bg-teal-500" />
                <h2 className="text-[15px] font-bold text-slate-700">Driver&apos;s License Details</h2>
              </div>
            </div>
            <div className="p-6">
              <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
                <div><label className={labelClass}>Driver&apos;s License Number</label><input name="driversLicenseNumber" className={inputClass} defaultValue={emp.driversLicenseNumber ?? ""} /></div>
                <div>
                  <label className={labelClass}>License type</label>
                  <FormSelect
                    name="driversLicenseType"
                    value={dlType}
                    onValueChange={setDlType}
                    options={[
                      ...(emp.driversLicenseType && !DRIVERS_LICENSE_TYPE_OPTIONS.some((o) => o.value === emp.driversLicenseType)
                        ? [{ value: emp.driversLicenseType, label: emp.driversLicenseType }]
                        : []),
                      ...DRIVERS_LICENSE_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
                    ]}
                  />
                </div>
                <div>
                  <label className={labelClass}>Issue date</label>
                  <DatePickerField name="licenseIssueDate" className={inputClass} max={dateInputMaxTodayLocal()} value={dlIssue} onChange={setDlIssue} />
                </div>
                <div>
                  <label className={labelClass}>Expiry date</label>
                  <DatePickerField name="licenseExpiryDate" className={inputClass} min={dlIssue || undefined} value={dlExpiry} onChange={setDlExpiry} />
                </div>
                <div><label className={labelClass}>Issuing Country</label><FormSelect name="driversLicenseIssuingCountry" defaultValue={emp.driversLicenseIssuingCountry ?? ""} options={COUNTRY_OPTIONS_ISSUING} placeholder="-- Select --" /></div>
              </div>
            </div>
          </div>

          {/* Hidden fields */}
          <input type="hidden" name="firstName" value={emp.firstName} />
          <input type="hidden" name="middleName" value={emp.middleName ?? ""} />
          <input type="hidden" name="lastName" value={emp.lastName} />
          <input type="hidden" name="dateOfBirth" value={fmtDate(emp.dateOfBirth)} />
          <input type="hidden" name="gender" value={emp.gender} />
          <input type="hidden" name="status" value={emp.status} />
          <input type="hidden" name="departmentId" value={emp.departmentId} />
          <input type="hidden" name="businessUnitId" value={emp.businessUnitId ?? ""} />
          <input type="hidden" name="locationId" value={emp.locationId ?? ""} />
          <input type="hidden" name="gradeId" value={emp.gradeId ?? ""} />
          <input type="hidden" name="jobTitleId" value={emp.jobTitleId ?? ""} />
          <input type="hidden" name="managerId" value={emp.managerId ?? ""} />
          <input type="hidden" name="isTopOfHierarchy" value={String(emp.isTopOfHierarchy)} />
          <input type="hidden" name="email" value={emp.email} />
          <input type="hidden" name="phone" value={emp.phone ?? ""} />
          <input type="hidden" name="otherId" value={emp.otherId ?? ""} />
          <input type="hidden" name="nationalId" value={emp.nationalId ?? ""} />
          <input type="hidden" name="tinNumber" value={emp.tinNumber ?? ""} />
          <input type="hidden" name="epfNumber" value={emp.epfNumber ?? ""} />
          <input type="hidden" name="etfNumber" value={emp.etfNumber ?? ""} />
          <input type="hidden" name="maritalStatus" value={emp.maritalStatus ?? ""} />
          <input type="hidden" name="nationality" value={emp.nationality ?? ""} />
          <input type="hidden" name="religion" value={emp.religion ?? ""} />
          <input type="hidden" name="ethnicity" value={emp.ethnicity ?? ""} />
          <input type="hidden" name="addressStreet1" value={emp.addressStreet1 ?? ""} />
          <input type="hidden" name="addressStreet2" value={emp.addressStreet2 ?? ""} />
          <input type="hidden" name="city" value={emp.city ?? ""} />
          <input type="hidden" name="country" value={emp.country ?? ""} />
          <input type="hidden" name="stateProvince" value={emp.stateProvince ?? ""} />
          <input type="hidden" name="zipPostalCode" value={emp.zipPostalCode ?? ""} />
          <input type="hidden" name="district" value={emp.district ?? ""} />
          <input type="hidden" name="pollingDivision" value={emp.pollingDivision ?? ""} />
          <input type="hidden" name="distanceToOffice" value={emp.distanceToOffice ?? ""} />
          <input type="hidden" name="modeOfTransport" value={emp.modeOfTransport ?? ""} />
          <input type="hidden" name="homeTelephone" value={emp.homeTelephone ?? ""} />
          <input type="hidden" name="workTelephone" value={emp.workTelephone ?? ""} />
          <input type="hidden" name="otherEmail" value={emp.otherEmail ?? ""} />
          <div className="flex items-center justify-end gap-2">
            <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50">
              {saving && <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      )}

      {/* ══════════════════════════════════════════════════
          TAB: BANK ACCOUNT
         ══════════════════════════════════════════════════ */}
      {pageTab === "bankAccount" && (
        <div className="space-y-6">
          {/* Add / Edit Bank Account Modal */}
          <Modal open={showBaModal} onClose={closeBaModal} title="">
            <div>
              <h3 className="text-lg font-semibold text-slate-700">{editingBa ? "Edit Direct Deposit" : "Add Direct Deposit"}</h3>
              <div className="mt-3 border-t border-slate-200 pt-4">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Account Number<span className="text-red-500">*</span></label>
                  <input value={baAccountNumber} onChange={(e) => setBaAccountNumber(e.target.value)} className={inputClass} />
                </div>
              </div>
              <div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Bank Name</label>
                  <FormSelect value={baBankName} onValueChange={setBaBankName} options={BA_BANK_OPTIONS} placeholder="-- Select --" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Account Type</label>
                  <FormSelect value={baAccountType} onValueChange={setBaAccountType} options={BA_ACCOUNT_TYPE_OPTIONS} />
                </div>
              </div>
              <div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Bank Code</label>
                  <input value={baBankCode} onChange={(e) => setBaBankCode(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Branch Code</label>
                  <input value={baBranchCode} onChange={(e) => setBaBranchCode(e.target.value)} className={inputClass} />
                </div>
              </div>
              <div className="mt-4">
                <label className="mb-1 block text-sm font-semibold text-slate-600">Branch Location</label>
                <input value={baBranchLocation} onChange={(e) => setBaBranchLocation(e.target.value)} className={inputClass} />
              </div>
              <div className="mt-4 border-t border-slate-100 pt-4 flex items-center justify-between">
                <span className="text-xs text-red-400">* Required</span>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={closeBaModal} className="rounded-full border border-slate-300 px-6 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">Cancel</button>
                  <button type="button" onClick={saveBankAccount} disabled={!baAccountNumber.trim() || baSaving} className="rounded-full bg-green-500 px-8 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-600 disabled:opacity-50">{baSaving ? "Saving..." : "Save"}</button>
                </div>
              </div>
            </div>
          </Modal>

          {/* Bank Account List */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className={sectionCardHeaderRow}>
              <div className="flex items-center gap-2.5">
                <SectionIcon path="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" color="bg-emerald-500" />
                <h2 className="text-base font-bold text-slate-800">Bank Accounts</h2>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500">{bankAccounts.length} record(s)</span>
                <button type="button" onClick={() => openBaModal()} className={sectionHeaderAddBtn}>
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                </button>
              </div>
            </div>
            {bankAccounts.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-slate-400">No bank accounts added.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-semibold uppercase text-slate-400">
                      <th className="px-6 py-3">Account Number</th>
                      <th className="px-4 py-3">Bank Name</th>
                      <th className="px-4 py-3">Account Type</th>
                      <th className="px-4 py-3">Bank Code</th>
                      <th className="px-4 py-3">Branch Code</th>
                      <th className="px-4 py-3">Branch</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bankAccounts.map((ba) => (
                      <tr key={ba.id} className="border-b border-slate-50 transition hover:bg-slate-50">
                        <td className="px-6 py-3 font-medium text-slate-700">{ba.accountNumber}</td>
                        <td className="px-4 py-3 text-slate-600">{ba.bankName || "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{ba.accountType}</td>
                        <td className="px-4 py-3 text-slate-600">{ba.bankCode || "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{ba.branchCode || "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{ba.branchLocation || "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button type="button" onClick={() => openBaModal(ba)} className="text-slate-500 transition hover:text-amber-600" title="Edit">
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </button>
                            <button type="button" onClick={() => deleteBankAccount(ba.id)} className="text-slate-400 transition hover:text-red-600" title="Delete">
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          TAB: REPORT TO
         ══════════════════════════════════════════════════ */}
      {pageTab === "reportTo" && (
        <div className="space-y-6">
          {/* Top of Hierarchy Toggle */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100">
                  <svg className="h-5 w-5 text-amber-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /></svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-700">Top of Hierarchy</h3>
                  <p className="text-xs text-slate-500">Enable for CEO/Directors who do not need a supervisor assigned</p>
                </div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const newVal = !emp.isTopOfHierarchy;
                  try {
                    const updated = await apiFetch<EmployeeDetail>(`/api/employees/${id}`, {
                      method: "PUT",
                      body: JSON.stringify({
                        firstName: emp.firstName, middleName: emp.middleName, lastName: emp.lastName,
                        email: emp.email, phone: emp.phone,
                        addressStreet1: emp.addressStreet1, addressStreet2: emp.addressStreet2,
                        city: emp.city, country: emp.country, stateProvince: emp.stateProvince,
                        zipPostalCode: emp.zipPostalCode, district: emp.district, pollingDivision: emp.pollingDivision,
                        distanceToOffice: emp.distanceToOffice, modeOfTransport: emp.modeOfTransport,
                        homeTelephone: emp.homeTelephone, workTelephone: emp.workTelephone, otherEmail: emp.otherEmail,
                        permanentStreet1: emp.permanentStreet1, permanentStreet2: emp.permanentStreet2,
                        permanentCity: emp.permanentCity, permanentCountry: emp.permanentCountry,
                        permanentStateProvince: emp.permanentStateProvince, permanentZipPostalCode: emp.permanentZipPostalCode,
                        permanentDistrict: emp.permanentDistrict, permanentPollingDivision: emp.permanentPollingDivision, permanentDistanceToOffice: emp.permanentDistanceToOffice,
                        dateOfBirth: emp.dateOfBirth, gender: emp.gender, maritalStatus: emp.maritalStatus,
                        nationality: emp.nationality, religion: emp.religion, ethnicity: emp.ethnicity,
                        otherId: emp.otherId, nationalId: emp.nationalId, tinNumber: emp.tinNumber,
                        epfNumber: emp.epfNumber, etfNumber: emp.etfNumber,
                        driversLicenseNumber: emp.driversLicenseNumber,
                        driversLicenseType: emp.driversLicenseType,
                        licenseIssueDate: emp.licenseIssueDate,
                        licenseExpiryDate: emp.licenseExpiryDate,
                        driversLicenseIssuingCountry: emp.driversLicenseIssuingCountry,
                        joinDate: emp.joinDate, probationEndDate: emp.probationEndDate, dateOfPermanency: emp.dateOfPermanency,
                        status: emp.status, employmentType: emp.employmentType, terminationDate: emp.terminationDate,
                        departmentId: emp.departmentId, businessUnitId: emp.businessUnitId,
                        positionId: emp.positionId, locationId: emp.locationId,
                        gradeId: emp.gradeId, jobTitleId: emp.jobTitleId, managerId: emp.managerId,
                        isTopOfHierarchy: newVal,
                      }),
                    });
                    setEmp(updated);
                  } catch { /* ignore */ }
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${emp.isTopOfHierarchy ? "bg-amber-500" : "bg-slate-200"}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${emp.isTopOfHierarchy ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>
          </div>

          {/* Warning if no supervisor and not top of hierarchy */}
          {!emp.isTopOfHierarchy && !emp.hasDirectSupervisor && (
            <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3">
              <svg className="h-5 w-5 shrink-0 text-amber-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
              <p className="text-sm text-amber-800">No direct supervisor assigned. This employee will not be able to apply for leave until a supervisor is added or &quot;Top of Hierarchy&quot; is enabled.</p>
            </div>
          )}

          {/* Add Supervisor Modal */}
          <Modal open={showAddSupervisor} onClose={() => { setShowAddSupervisor(false); setAddReportPersonId(""); setAddReportMethod(""); }} title="">
            <div>
              <h3 className="text-lg font-semibold text-slate-700">Add Supervisor</h3>
              <div className="mt-3 border-t border-slate-200 pt-4">
                <label className="mb-1 block text-sm font-semibold text-slate-600">Name<span className="text-red-500">*</span></label>
                <FormSelect
                  value={addReportPersonId}
                  onValueChange={setAddReportPersonId}
                  placeholder="Select Supervisor"
                  options={[
                    { value: "", label: "Select Supervisor" },
                    ...supervisorPickList
                      .filter((m) => m.id !== id && !supervisors.some((s) => s.supervisorId === m.id))
                      .map((m) => ({ value: m.id, label: m.name })),
                  ]}
                />
              </div>
              <div className="mt-4">
                <label className="mb-1 block text-sm font-semibold text-slate-600">Reporting Method<span className="text-red-500">*</span></label>
                <FormSelect value={addReportMethod} onValueChange={setAddReportMethod} options={REPORTING_METHOD_OPTIONS} placeholder="-- Select --" />
              </div>
              <div className="mt-4 border-t border-slate-100 pt-4 flex items-center justify-between">
                <span className="text-xs text-red-400">* Required</span>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => { setShowAddSupervisor(false); setAddReportPersonId(""); setAddReportMethod(""); }} className="rounded-full border border-slate-300 px-6 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">Cancel</button>
                  <button type="button" onClick={addSupervisor} disabled={!addReportPersonId || !addReportMethod || addReportSaving} className="rounded-full bg-green-500 px-8 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-600 disabled:opacity-50">{addReportSaving ? "Saving..." : "Save"}</button>
                </div>
              </div>
            </div>
          </Modal>

          {/* Add Subordinate Modal */}
          <Modal open={showAddSubordinate} onClose={() => { setShowAddSubordinate(false); setAddReportPersonId(""); setAddReportMethod(""); }} title="">
            <div>
              <h3 className="text-lg font-semibold text-slate-700">Add Subordinate</h3>
              <div className="mt-3 border-t border-slate-200 pt-4">
                <label className="mb-1 block text-sm font-semibold text-slate-600">Name<span className="text-red-500">*</span></label>
                <FormSelect
                  value={addReportPersonId}
                  onValueChange={setAddReportPersonId}
                  placeholder="Select Employee"
                  options={[
                    { value: "", label: "Select Employee" },
                    ...subordinatePickList
                      .filter((m) => m.id !== id && !subordinates.some((s) => s.employeeId === m.id) && !supervisors.some((s) => s.supervisorId === m.id))
                      .map((m) => ({ value: m.id, label: m.name })),
                  ]}
                />
              </div>
              <div className="mt-4">
                <label className="mb-1 block text-sm font-semibold text-slate-600">Reporting Method<span className="text-red-500">*</span></label>
                <FormSelect value={addReportMethod} onValueChange={setAddReportMethod} options={REPORTING_METHOD_OPTIONS} placeholder="-- Select --" />
              </div>
              <div className="mt-4 border-t border-slate-100 pt-4 flex items-center justify-between">
                <span className="text-xs text-red-400">* Required</span>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => { setShowAddSubordinate(false); setAddReportPersonId(""); setAddReportMethod(""); }} className="rounded-full border border-slate-300 px-6 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">Cancel</button>
                  <button type="button" onClick={addSubordinate} disabled={!addReportPersonId || !addReportMethod || addReportSaving} className="rounded-full bg-green-500 px-8 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-600 disabled:opacity-50">{addReportSaving ? "Saving..." : "Save"}</button>
                </div>
              </div>
            </div>
          </Modal>

          {/* Assigned Supervisors */}
          <div className="relative rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className={sectionCardHeaderRow}>
              <h2 className="text-base font-bold text-slate-800">Assigned Supervisors</h2>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500">{supervisors.length} record(s)</span>
                <button type="button" onClick={() => { setAddReportPersonId(""); setAddReportMethod(""); setShowAddSupervisor(true); }} className={sectionHeaderAddBtn}>
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                </button>
              </div>
            </div>
            {supervisors.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-slate-400">No supervisors assigned.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-semibold uppercase text-slate-400">
                      <th className="px-6 py-3 w-8"></th>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Reporting Method</th>
                      <th className="px-4 py-3 text-right"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {supervisors.map((s) => (
                      <tr key={s.id} className="border-b border-slate-50 transition hover:bg-slate-50">
                        <td className="px-6 py-3"><input type="checkbox" className="rounded border-slate-300" /></td>
                        <td className="px-4 py-3 font-medium text-slate-700">{s.fullName}</td>
                        <td className="px-4 py-3 text-slate-600">{s.reportingMethod}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button type="button" onClick={() => removeSupervisor(s.id)} className="text-slate-400 transition hover:text-red-600" title="Remove">
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Assigned Subordinates */}
          <div className="relative rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className={sectionCardHeaderRow}>
              <h2 className="text-base font-bold text-slate-800">Assigned Subordinates</h2>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500">{subordinates.length} record(s)</span>
                <button type="button" onClick={() => { setAddReportPersonId(""); setAddReportMethod(""); setShowAddSubordinate(true); }} className={sectionHeaderAddBtn}>
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                </button>
              </div>
            </div>
            {subordinates.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-slate-400">No subordinates assigned.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-semibold uppercase text-slate-400">
                      <th className="px-6 py-3 w-8"></th>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Reporting Method</th>
                      <th className="px-4 py-3 text-right"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {subordinates.map((s) => (
                      <tr key={s.id} className="border-b border-slate-50 transition hover:bg-slate-50">
                        <td className="px-6 py-3"><input type="checkbox" className="rounded border-slate-300" /></td>
                        <td className="px-4 py-3 font-medium text-slate-700">{s.fullName}</td>
                        <td className="px-4 py-3 text-slate-600">{s.reportingMethod}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button type="button" onClick={() => removeSubordinate(s.id)} className="text-slate-400 transition hover:text-red-600" title="Remove">
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          TAB: BENEFITS
         ══════════════════════════════════════════════════ */}
      {pageTab === "benefits" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className={sectionCardHeaderRowGap}>
              <SectionIcon path="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" color="bg-emerald-500" />
              <h2 className="text-lg font-bold text-slate-700">Benefits Info</h2>
            </div>
            <div className="px-6 py-5">
              <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-orange-500">Insurance Provider</label>
                  <FormSelect value={benefitInsurer} onValueChange={setBenefitInsurer} options={BENEFIT_INSURER_OPTIONS} placeholder="-- Select --" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-orange-500">Coverage</label>
                  <div className="mt-1 space-y-2.5">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input type="checkbox" checked={benefitExtMed} onChange={(e) => setBenefitExtMed(e.target.checked)} className="h-4.5 w-4.5 rounded border-slate-300 text-orange-500 focus:ring-orange-400" />
                      <span className="text-sm text-slate-700">Extended Medical</span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input type="checkbox" checked={benefitDental} onChange={(e) => setBenefitDental(e.target.checked)} className="h-4.5 w-4.5 rounded border-slate-300 text-orange-500 focus:ring-orange-400" />
                      <span className="text-sm text-slate-700">Dental</span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input type="checkbox" checked={benefitVision} onChange={(e) => setBenefitVision(e.target.checked)} className="h-4.5 w-4.5 rounded border-slate-300 text-orange-500 focus:ring-orange-400" />
                      <span className="text-sm text-slate-700">Vision</span>
                    </label>
                  </div>
                </div>
              </div>
              <div className="mt-5">
                <label className="mb-1 block text-sm font-semibold text-orange-500">Spousal Coverage</label>
                <FormSelect
                  value={benefitSpousal ? "Yes" : "No"}
                  onValueChange={(v) => setBenefitSpousal(v === "Yes")}
                  options={YES_NO_OPTIONS}
                  className="sm:w-1/2"
                />
              </div>
              <div className="mt-5">
                <label className="mb-1 block text-sm font-semibold text-orange-500">Dependents</label>
                <FormSelect
                  value={benefitDeps ? "Yes" : "No"}
                  onValueChange={(v) => setBenefitDeps(v === "Yes")}
                  options={YES_NO_OPTIONS}
                  className="sm:w-1/2"
                />
              </div>
              <div className="mt-5 border-t border-slate-100 pt-4 flex items-center justify-between">
                <span className="text-xs text-slate-400">* Required field</span>
                <button type="button" onClick={saveBenefit} disabled={benefitSaving} className="rounded-lg bg-emerald-500 px-8 py-2.5 text-sm font-bold uppercase tracking-wide text-white shadow-sm transition hover:bg-emerald-600 disabled:opacity-50">{benefitSaving ? "Saving..." : "Save"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          TAB: IMMIGRATION DOCS
         ══════════════════════════════════════════════════ */}
      {pageTab === "immigration" && (
        <div className="space-y-6">
          <Modal open={showImmModal} onClose={closeImmModal} title="">
            <div>
              <h3 className="text-lg font-semibold text-slate-700">{editingImm ? "Edit Immigration" : "Add Immigration"}</h3>
              <div className="mt-3 border-t border-slate-200 pt-4">
                <label className="mb-1 block text-sm font-semibold text-slate-600">Document<span className="text-red-500">*</span></label>
                <div className="flex items-center gap-6 mt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="immDocType" value="Passport" checked={immDocType === "Passport"} onChange={() => setImmDocType("Passport")} className="h-4 w-4 text-orange-500 focus:ring-orange-400 border-slate-300" />
                    <span className="text-sm text-slate-700">Passport</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="immDocType" value="Visa" checked={immDocType === "Visa"} onChange={() => setImmDocType("Visa")} className="h-4 w-4 text-orange-500 focus:ring-orange-400 border-slate-300" />
                    <span className="text-sm text-slate-700">Visa</span>
                  </label>
                </div>
              </div>
              <div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Number<span className="text-red-500">*</span></label>
                  <input value={immNumber} onChange={(e) => setImmNumber(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Issued By</label>
                  <FormSelect value={immIssuedBy} onValueChange={setImmIssuedBy} options={IMM_ISSUER_OPTIONS} placeholder="-- Select --" />
                </div>
              </div>
              <div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Issued Date</label>
                  <DatePickerField value={immIssuedDate} onChange={setImmIssuedDate} className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Expiry Date</label>
                  <DatePickerField value={immExpiryDate} onChange={setImmExpiryDate} className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Eligible Review Date</label>
                  <DatePickerField value={immReviewDate} onChange={setImmReviewDate} className={inputClass} />
                </div>
              </div>
              <div className="mt-4">
                <label className="mb-1 block text-sm font-semibold text-slate-600">Eligible Status</label>
                <input value={immStatus} onChange={(e) => setImmStatus(e.target.value)} className={inputClass + " sm:w-1/2"} />
              </div>
              <div className="mt-4">
                <label className="mb-1 block text-sm font-semibold text-slate-600">Comments</label>
                <textarea value={immComments} onChange={(e) => setImmComments(e.target.value)} rows={4} className={inputClass + " resize-y"} />
              </div>
              <div className="mt-4 border-t border-slate-100 pt-4 flex items-center justify-between">
                <span className="text-xs text-red-400">* Required</span>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={closeImmModal} className="rounded-full border border-slate-300 px-6 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">Cancel</button>
                  <button type="button" onClick={saveImmigration} disabled={!immDocType.trim() || !immNumber.trim() || immSaving} className="rounded-full bg-green-500 px-8 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-600 disabled:opacity-50">{immSaving ? "Saving..." : "Save"}</button>
                </div>
              </div>
            </div>
          </Modal>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className={sectionCardHeaderRow}>
              <div className="flex items-center gap-2.5">
                <SectionIcon path="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" color="bg-rose-500" />
                <h2 className="text-base font-bold text-slate-800">Immigration Documents</h2>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500">{immigrations.length} record(s)</span>
                <button type="button" onClick={() => openImmModal()} className={sectionHeaderAddBtn}>
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                </button>
              </div>
            </div>
            {immigrations.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-slate-400">No immigration documents added.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-semibold uppercase text-slate-400">
                      <th className="px-6 py-3">Document</th>
                      <th className="px-4 py-3">Number</th>
                      <th className="px-4 py-3">Issued By</th>
                      <th className="px-4 py-3">Issued Date</th>
                      <th className="px-4 py-3">Expiry Date</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {immigrations.map((imm) => (
                      <tr key={imm.id} className="border-b border-slate-50 transition hover:bg-slate-50">
                        <td className="px-6 py-3 font-medium text-slate-700">{imm.documentType}</td>
                        <td className="px-4 py-3 text-slate-600">{imm.number}</td>
                        <td className="px-4 py-3 text-slate-600">{imm.issuedBy ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{formatDate(imm.issuedDate)}</td>
                        <td className="px-4 py-3 text-slate-600">{formatDate(imm.expiryDate)}</td>
                        <td className="px-4 py-3 text-slate-600">{imm.eligibleStatus ?? "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button type="button" onClick={() => openImmModal(imm)} className="text-slate-500 transition hover:text-amber-600" title="Edit">
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </button>
                            <button type="button" onClick={() => deleteImmigration(imm.id)} className="text-slate-400 transition hover:text-red-600" title="Delete">
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Attached Documents ── */}
          <Modal open={showImmDocModal} onClose={() => setShowImmDocModal(false)} title="">
            <div>
              <h3 className="text-lg font-semibold text-slate-700">Add Attachment</h3>
              <div className="mt-3 border-t border-slate-200 pt-4">
                <label className="mb-1 block text-sm font-semibold text-slate-600">File<span className="text-red-500">*</span><span className="text-xs font-normal text-slate-400">(Accepts up to 5MB)</span></label>
                <div className="flex items-center gap-3 mt-1">
                  <button type="button" onClick={() => immDocFileRef.current?.click()} className="rounded-full bg-slate-200 px-5 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-300">Browse</button>
                  <span className="text-sm text-slate-500 truncate">{immDocFile ? immDocFile.name : "No file chosen"}</span>
                  <input ref={immDocFileRef} type="file" className="hidden" onChange={(e) => setImmDocFile(e.target.files?.[0] ?? null)} />
                </div>
              </div>
              <div className="mt-4">
                <label className="mb-1 block text-sm font-semibold text-slate-600">Description</label>
                <textarea value={immDocDesc} onChange={(e) => setImmDocDesc(e.target.value)} rows={4} className={inputClass + " resize-y"} />
              </div>
              <div className="mt-4 border-t border-slate-100 pt-4 flex items-center justify-between">
                <span className="text-xs text-red-400">* Required</span>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setShowImmDocModal(false)} className="rounded-full border border-slate-300 px-6 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">Cancel</button>
                  <button type="button" onClick={uploadImmDoc} disabled={!immDocFile || immDocUploading} className="rounded-full bg-green-500 px-8 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-600 disabled:opacity-50">{immDocUploading ? "Saving..." : "Save"}</button>
                </div>
              </div>
            </div>
          </Modal>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className={sectionCardHeaderRow}>
              <div className="flex items-center gap-2.5">
                <SectionIcon path="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" color="bg-cyan-500" />
                <h2 className="text-base font-bold text-slate-800">Attached Documents</h2>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500">{immDocs.length} record(s)</span>
                <button type="button" onClick={openImmDocModal} className={sectionHeaderAddBtn}>
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                </button>
              </div>
            </div>
            {immDocs.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-slate-400">No documents uploaded.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-semibold uppercase text-slate-400">
                      <th className="px-6 py-3">File Name</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3">Size</th>
                      <th className="px-4 py-3">Date Added</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {immDocs.map((doc) => (
                      <tr key={doc.id} className="border-b border-slate-50 transition hover:bg-slate-50">
                        <td className="px-6 py-3 font-medium text-slate-700">{doc.fileName}</td>
                        <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{doc.description ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{fmtFileSize(doc.size)}</td>
                        <td className="px-4 py-3 text-slate-600">{formatDateTime(doc.dateAdded)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <a href={`${API_BASE_URL}/api/employees/${id}/immigration-documents/${doc.id}/download`} target="_blank" rel="noreferrer" title="Download" className="text-slate-500 transition hover:text-blue-600">
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            </a>
                            <button type="button" onClick={() => deleteImmDoc(doc.id)} className="text-slate-400 transition hover:text-red-600" title="Delete">
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
