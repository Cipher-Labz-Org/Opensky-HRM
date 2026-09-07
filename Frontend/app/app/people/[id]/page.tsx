"use client";

import { appAlert, appConfirm } from "@/components/ui/appDialogs";
import { useState, useEffect, useCallback, useRef, useMemo, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { DatePickerField, FormSelect, PersonNameInput, PhoneInput, NicInput, DrivingLicenseInput, PassportNumberInput, TinInput, EpfInput, EtfInput, EmailInput, CountryAutocompleteInput, NationalityAutocompleteInput, OptionsAutocompleteInput, ListAutocompleteInput, AddressTextInput, SectionRecordHeaderActions, AddressRegionFields, TablePagination, FlashMessageBanner, FormErrorAlert, type FormSelectOption } from "@/components/ui";
import { EmployeeAddressSections } from "@/components/workforce/EmployeeAddressSections";
import { useClientPagination } from "@/lib/use-client-pagination";
import { isValidPhone, isValidNic, isValidDrivingLicense, isValidPassportNumber, isValidTin, isValidEpfNumber, isValidEtfNumber, isValidEmailInput, isValidEmailFormat, isValidAddressText, sanitizeTinInput, sanitizeEpfInput, sanitizeEtfInput, sanitizePassportNumberInput, sanitizePhoneInput, validateEmployeeAddressFieldsIfChanged, PHONE_VALIDATION_MESSAGE, NIC_VALIDATION_MESSAGE, DRIVING_LICENSE_VALIDATION_MESSAGE, PASSPORT_NUMBER_VALIDATION_MESSAGE, TIN_VALIDATION_MESSAGE, EPF_VALIDATION_MESSAGE, ETF_VALIDATION_MESSAGE, EMAIL_INPUT_VALIDATION_MESSAGE, EMAIL_FORMAT_VALIDATION_MESSAGE } from "@/lib/input-validation";
import { sanitizeEmployeeAddressFields } from "@/lib/employee-address";
import { displayWorkEmail } from "@/lib/employee-email";
import { inferStateFromDistrict } from "@/lib/geo-regions";
import { apiFetch, apiFetchBlob } from "@/lib/api";
import { resolveHttpErrorMessage } from "@/lib/api-errors";
import { EmployeeSearchCombobox } from "@/components/workforce/EmployeeSearchCombobox";
import { getSystemSetting } from "@/lib/system-settings";
import { formatDate, formatDateTime } from "@/lib/date-utils";
import {
  calculateImmigrationEligibleDate,
  countdownTone,
  formatDateCountdown,
  formatDateCountdownToExpire,
  formatAvailableDateDayCount,
} from "@/lib/immigration-dates";
import { getApiBaseUrl, resolveAssetUrl } from "@/config/constants";
import { ROUTES } from "@/config/routes";
import { useAuth } from "@/contexts/auth-context";
import { usePeopleScopedLookups } from "@/lib/people-scope-filters";
import { BirthdaysCompanyNoticesWidget } from "@/components/employee-profile/BirthdaysCompanyNoticesWidget";
import { EmployeePayrollTab } from "@/components/people/EmployeePayrollTab";
import { EmployeeTimesheetsWidget } from "@/components/employee-profile/EmployeeTimesheetsWidget";
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
  terminationNote?: string | null;
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
  shiftPatternId?: string | null;
  shiftPatternName?: string | null;
  shiftPatternCode?: string | null;
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

interface LeaveBalanceWidgetRow {
  id: string;
  leaveTypeId?: string;
  leaveTypeName: string;
  year: number;
  entitled: number;
  used: number;
  carriedForward?: number;
  remaining: number;
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
  skillId: string;
  skillName: string;
  proficiencyLevel: number;
  assessedAt: string | null;
  notes: string | null;
}

interface CertCatalogOption {
  id: string;
  name: string;
  issuingBody: string | null;
  isActive: boolean;
}

interface LearningSkillOption {
  id: string;
  name: string;
  category: string | null;
  isActive?: boolean;
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

interface DriverLicenseItem {
  id: string;
  employeeId: string;
  number: string | null;
  licenseType: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  issuingCountry: string | null;
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
  id: string;
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

const LEAVE_BALANCE_BAR_COLORS: Record<string, string> = {
  "Annual Leave": "bg-blue-500",
  "Sick Leave": "bg-amber-500",
  "Casual Leave": "bg-emerald-500",
  "Maternity Leave": "bg-pink-500",
  "No-Pay Leave": "bg-slate-400",
};
const LEAVE_BALANCE_BAR_FALLBACK = ["bg-blue-500", "bg-amber-500", "bg-emerald-500", "bg-violet-500", "bg-rose-500"];

function leaveBalanceBarColor(name: string, index: number): string {
  return LEAVE_BALANCE_BAR_COLORS[name] ?? LEAVE_BALANCE_BAR_FALLBACK[index % LEAVE_BALANCE_BAR_FALLBACK.length];
}

function leaveBalanceTotalDays(row: LeaveBalanceWidgetRow): number {
  const entitled = Number(row.entitled) || 0;
  const carried = Number(row.carriedForward) || 0;
  const used = Number(row.used) || 0;
  const remaining = Number(row.remaining) || 0;
  if (entitled + carried > 0) return entitled + carried;
  if (used + remaining > 0) return used + remaining;
  return 1;
}

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

interface EmployeeLifecycleEventRow {
  id: string;
  eventType: string;
  eventTypeLabel: string;
  eventDate: string;
  title: string;
  summary: string | null;
  isCurrentRole: boolean;
}

interface EmployeeLifecycleTimeline {
  milestones: EmployeeLifecycleEventRow[];
  roleHistory: EmployeeLifecycleEventRow[];
}

function buildEmployeePutPayload(
  emp: EmployeeDetail,
  overrides: Partial<{ epfNumber: string | null; etfNumber: string | null }> = {},
) {
  return sanitizeEmployeeAddressFields({
    firstName: emp.firstName,
    middleName: emp.middleName,
    lastName: emp.lastName,
    email: displayWorkEmail(emp.email),
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
    fingerprintId: emp.fingerprintId,
    nationalId: emp.nationalId,
    tinNumber: emp.tinNumber,
    epfNumber: overrides.epfNumber !== undefined ? overrides.epfNumber : emp.epfNumber,
    etfNumber: overrides.etfNumber !== undefined ? overrides.etfNumber : emp.etfNumber,
    driversLicenseNumber: emp.driversLicenseNumber,
    driversLicenseType: emp.driversLicenseType,
    licenseIssueDate: emp.licenseIssueDate,
    licenseExpiryDate: emp.licenseExpiryDate,
    driversLicenseIssuingCountry: emp.driversLicenseIssuingCountry,
    joinDate: emp.joinDate,
    probationEndDate: emp.probationEndDate,
    dateOfPermanency: emp.dateOfPermanency,
    status: emp.status,
    employmentType: emp.employmentType,
    departmentId: emp.departmentId,
    businessUnitId: emp.businessUnitId,
    positionId: emp.positionId,
    locationId: emp.locationId,
    gradeId: emp.gradeId,
    jobTitleId: emp.jobTitleId,
    managerId: emp.managerId,
    isTopOfHierarchy: emp.isTopOfHierarchy,
    terminationDate: emp.terminationDate,
    terminationReason: emp.terminationReason,
    terminationNote: emp.terminationNote ?? null,
  });
}

/** Merge form fields onto a full employee PUT payload so tab saves never wipe unrelated data. */
function buildEmployeePutPayloadFromForm(emp: EmployeeDetail, fd: FormData) {
  const payload = buildEmployeePutPayload(emp);

  const setIfPresent = (key: keyof typeof payload, formName?: string) => {
    const name = formName ?? String(key);
    if (!fd.has(name)) return;
    const raw = fd.get(name);
    (payload as Record<string, unknown>)[key] = typeof raw === "string" ? raw.trim() || null : raw;
  };

  const setRequiredIfPresent = (key: keyof typeof payload, formName?: string) => {
    const name = formName ?? String(key);
    if (!fd.has(name)) return;
    const raw = fd.get(name);
    if (typeof raw === "string" && raw.trim()) {
      (payload as Record<string, unknown>)[key] = raw.trim();
    }
  };

  setRequiredIfPresent("firstName");
  setRequiredIfPresent("lastName");
  setRequiredIfPresent("dateOfBirth");
  setRequiredIfPresent("gender");
  setRequiredIfPresent("status");
  setRequiredIfPresent("departmentId");
  setRequiredIfPresent("employmentType");
  setRequiredIfPresent("joinDate");

  const optionalTextKeys: (keyof typeof payload)[] = [
    "middleName", "phone", "addressStreet1", "addressStreet2", "city", "country", "stateProvince",
    "zipPostalCode", "district", "pollingDivision", "distanceToOffice", "modeOfTransport",
    "homeTelephone", "workTelephone", "otherEmail", "permanentStreet1", "permanentStreet2",
    "permanentCity", "permanentCountry", "permanentStateProvince", "permanentZipPostalCode",
    "permanentDistrict", "permanentPollingDivision", "permanentDistanceToOffice",
    "maritalStatus", "nationality", "religion", "ethnicity", "otherId", "fingerprintId", "nationalId", "tinNumber",
    "driversLicenseNumber", "driversLicenseType", "licenseIssueDate", "licenseExpiryDate",
    "driversLicenseIssuingCountry", "probationEndDate", "dateOfPermanency",
    "terminationDate", "terminationReason", "terminationNote",
  ];
  for (const key of optionalTextKeys) setIfPresent(key);

  if (fd.has("epfNumber")) {
    payload.epfNumber = ((fd.get("epfNumber") as string) ?? "").trim() || null;
  }
  if (fd.has("etfNumber")) {
    payload.etfNumber = ((fd.get("etfNumber") as string) ?? "").trim() || null;
  }

  for (const key of ["businessUnitId", "positionId", "locationId", "gradeId", "jobTitleId", "managerId"] as const) {
    if (!fd.has(key)) continue;
    const v = ((fd.get(key) as string) ?? "").trim();
    payload[key] = v || null;
  }

  if (fd.has("isTopOfHierarchy")) {
    payload.isTopOfHierarchy = fd.get("isTopOfHierarchy") === "true";
  }

  if (fd.has("email")) {
    payload.email = displayWorkEmail((fd.get("email") as string) ?? "");
  }

  return payload;
}

const genderOptions = ["Male", "Female", "Other"];

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
const RELIGION_OPTIONS = selectOptsOptional("--Select--", RELIGION_VALUES);
const ETHNICITY_OPTIONS = selectOptsOptional("--Select--", ETHNICITY_VALUES);
const MODE_TRANSPORT_OPTIONS = selectOptsOptional("-- Select --", ["Own Vehicle", "Company Vehicle", "Public Transport", "Bicycle", "Walking", "Ride Sharing", "Other"]);
const GENDER_SELECT_OPTIONS = selectOpts(genderOptions);
const DEP_RELATIONSHIP_OPTIONS = selectOptsOptional("-- Select --", ["Child", "Spouse", "Parent", "Sibling", "Other"]);
const EC_RELATIONSHIP_OPTIONS = selectOptsOptional("-- Select --", ["Spouse", "Parent", "Child", "Sibling", "Friend", "Relative", "Guardian", "Other"]);
const EDU_LEVEL_OPTIONS = selectOptsOptional("-- Select --", ["High School", "Diploma", "Associate", "Bachelor", "Master", "Doctorate", "Certificate", "Other"]);
function buildYearSelectOptions(fromYear = 1950, toYear = new Date().getFullYear() + 5): FormSelectOption[] {
  const years: string[] = [];
  for (let y = toYear; y >= fromYear; y--) years.push(String(y));
  return selectOptsOptional("-- Select --", years);
}
const EDU_YEAR_OPTIONS = buildYearSelectOptions();
const CERT_STATUS_OPTIONS = selectOpts(["Active", "Expired", "Revoked"]);
const MATRIX_PROFICIENCY_OPTIONS: FormSelectOption[] = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }));
const LANGUAGE_NAME_OPTIONS = selectOptsOptional("-- Select --", [
  "Arabic", "Bengali", "Chinese", "Dutch", "English", "French", "German", "Hindi", "Italian", "Japanese", "Korean", "Malay", "Portuguese", "Russian", "Sinhala", "Spanish", "Tamil", "Turkish", "Urdu", "Other",
]);
const LANGUAGE_CATALOG_NAMES = LANGUAGE_NAME_OPTIONS.map((o) => o.label).filter((n) => n && n !== "-- Select --");
const LANGUAGE_FLUENCY_OPTIONS = selectOpts(["Beginner", "Elementary", "Intermediate", "Upper Intermediate", "Advanced", "Native"]);
const REPORTING_METHOD_OPTIONS = selectOptsOptional("-- Select --", ["Direct", "Indirect", "Both"]);
const REPORTING_METHOD_ROW_OPTIONS = selectOpts(["Direct", "Indirect", "Both"]);

function normalizeReportingMethodValue(value: string): string {
  const trimmed = value.trim();
  return trimmed.toLowerCase() === "other" ? "Both" : trimmed;
}

function normalizeEmployeeId(value: string | undefined | null): string {
  return (value ?? "").trim().toLowerCase();
}

function buildReportingExcludeIds(
  employeeId: string,
  supervisors: ReportPerson[],
  subordinates: ReportPerson[],
): string[] {
  const excluded = new Set<string>();
  const selfId = normalizeEmployeeId(employeeId);
  if (selfId) excluded.add(selfId);
  for (const row of supervisors) {
    const supervisorId = normalizeEmployeeId(row.supervisorId);
    if (supervisorId) excluded.add(supervisorId);
  }
  for (const row of subordinates) {
    const subordinateId = normalizeEmployeeId(row.employeeId);
    if (subordinateId) excluded.add(subordinateId);
  }
  return Array.from(excluded);
}

function dedupeReportPeople(
  rows: ReportPerson[],
  personKey: "supervisorId" | "employeeId",
): ReportPerson[] {
  const seen = new Map<string, ReportPerson>();
  for (const row of rows) {
    const personId = row[personKey];
    if (!personId || seen.has(personId)) continue;
    seen.set(personId, row);
  }
  return Array.from(seen.values());
}

function reportLinesMatchSaved(
  saved: ReportPerson[],
  draft: ReportPerson[],
  personKey: "supervisorId" | "employeeId",
) {
  if (saved.length !== draft.length) return false;
  const savedByPerson = new Map(
    saved.map((row) => [row[personKey] ?? "", row]),
  );
  return draft.every((row) => {
    const personId = row[personKey] ?? "";
    const prev = savedByPerson.get(personId);
    if (!prev) return false;
    return prev.reportingMethod === row.reportingMethod;
  });
}

function validateReportingDraft(
  supervisors: ReportPerson[],
  subordinates: ReportPerson[],
): string | null {
  for (const row of supervisors) {
    if (!row.supervisorId || !row.reportingMethod.trim()) {
      return "Each supervisor must have a reporting method.";
    }
  }
  for (const row of subordinates) {
    if (!row.employeeId || !row.reportingMethod.trim()) {
      return "Each subordinate must have a reporting method.";
    }
  }
  const supervisorIds = supervisors.map((s) => s.supervisorId).filter(Boolean) as string[];
  if (new Set(supervisorIds).size !== supervisorIds.length) {
    return "Duplicate supervisors are not allowed.";
  }
  const subordinateIds = subordinates.map((s) => s.employeeId).filter(Boolean) as string[];
  if (new Set(subordinateIds).size !== subordinateIds.length) {
    return "Duplicate subordinates are not allowed.";
  }
  if (subordinateIds.some((subId) => supervisorIds.includes(subId))) {
    return "An employee cannot be both a supervisor and a subordinate.";
  }
  return null;
}
const BA_BANK_NAMES = [
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
] as const;
const BA_ACCOUNT_TYPE_OPTIONS = selectOpts(["Checking", "Savings", "Current", "Fixed Deposit", "Other"]);
const BENEFIT_INSURER_NAMES = [
  "Aetna",
  "Blue Cross Blue Shield",
  "Cigna",
  "Humana",
  "Kaiser Permanente",
  "Liberty Mutual",
  "MetLife",
  "State Farm",
  "UnitedHealthcare",
] as const;
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

type PageTab = "profile" | "personal" | "job" | "contactDetails" | "emergencyContacts" | "dependents" | "qualifications" | "workExperience" | "driversLicense" | "bankAccount" | "reportTo" | "benefits" | "immigration" | "payroll";
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
  { key: "reportTo", label: "Supervisor" },
  { key: "benefits", label: "Benefits" },
  { key: "immigration", label: "Immigration Docs" },
  { key: "payroll", label: "Payroll" },
];
const VISIBLE_TAB_COUNT = 3;
const PRIMARY_TABS = PAGE_TABS.slice(0, VISIBLE_TAB_COUNT);
const OVERFLOW_TABS = PAGE_TABS.slice(VISIBLE_TAB_COUNT);

const qualificationsPanelShellClass =
  "w-full space-y-3 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-sm sm:space-y-3.5 sm:p-3";
const qualificationsSectionClass =
  "overflow-hidden rounded-md border border-slate-200/90 bg-white";
const qualificationsSectionHeaderRow =
  "flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/80 px-2.5 py-1.5 sm:px-3";
const qualificationsSectionTitleClass = "text-xs font-semibold text-slate-800 sm:text-sm";
const qualificationsEmptyClass =
  "mx-2 mb-2 mt-1.5 rounded border border-dashed border-slate-200 bg-slate-50/60 px-2 py-2.5 text-center text-[11px] text-slate-400 sm:mx-2.5";
const qualificationsTableScrollClass =
  "mx-2 mb-2 mt-1.5 h-28 overflow-x-auto overflow-y-scroll rounded border border-slate-200 bg-white [scrollbar-gutter:stable] [scrollbar-width:auto] [scrollbar-color:rgb(71_85_105)_rgb(226_232_240)] sm:mx-2.5 sm:h-32 [&::-webkit-scrollbar]:h-2.5 [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-slate-500 [&::-webkit-scrollbar-thumb]:hover:bg-slate-600 [&::-webkit-scrollbar-track]:rounded [&::-webkit-scrollbar-track]:bg-slate-200/80";
const qualificationsTableClass = "w-full min-w-[32rem] border-collapse text-left text-xs sm:text-sm";
const qualificationsTheadClass = "sticky top-0 z-10 bg-slate-100";
const qualificationsHeadRowClass =
  "border-b border-slate-200 text-[10px] font-bold uppercase tracking-wide text-slate-600 sm:text-[11px]";
const qualificationsBodyRowClass =
  "border-b border-slate-200/80 bg-white transition hover:bg-sky-50/60 even:bg-slate-50/70";
const qualificationsThClass = "whitespace-nowrap px-2.5 py-2 first:pl-3 last:pr-3 sm:px-3 sm:first:pl-4";
const qualificationsTdClass = "px-2.5 py-2 text-slate-700 first:pl-3 last:pr-3 sm:px-3 sm:first:pl-4";
const qualificationsTdPrimaryClass =
  "px-2.5 py-2 font-semibold text-slate-800 first:pl-3 sm:px-3 sm:first:pl-4";
const qualificationsPagerClass = "mx-2 mb-1.5 border-t-0 px-1 pt-0 sm:mx-2.5";

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

function immigrationCountdownClass(dateIso: string): string {
  const tone = countdownTone(dateIso);
  if (tone === "danger") return "text-red-600";
  if (tone === "warning") return "text-amber-600";
  return "text-slate-500";
}

function ImmigrationDateCountdown({
  dateIso,
  variant = "default",
}: {
  dateIso: string;
  variant?: "default" | "expire";
}) {
  if (!dateIso) return null;
  const message =
    variant === "expire" ? formatDateCountdownToExpire(dateIso) : formatDateCountdown(dateIso);
  return (
    <p className={`mt-1 text-xs font-medium ${immigrationCountdownClass(dateIso)}`}>
      {message}
    </p>
  );
}

function isImmigrationFormValid(
  documentType: string,
  number: string,
  issuedDate: string,
  expiryDate: string,
  eligibleDate: string,
): boolean {
  const trimmedNumber = sanitizePassportNumberInput(number.trim());
  if (!documentType.trim() || !isValidPassportNumber(trimmedNumber, true)) return false;
  if (!issuedDate || !expiryDate || !eligibleDate) return false;
  return true;
}

/** Frosted header row inside section cards (OpenSky / glass) */
const sectionCardHeaderRow =
  "flex items-center justify-between border-b border-slate-200/55 bg-gradient-to-b from-white/90 via-slate-50/40 to-slate-100/20 px-6 py-4 backdrop-blur-xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.92)]";
const sectionCardHeaderRowSm =
  "flex items-center justify-between border-b border-slate-200/55 bg-gradient-to-b from-white/90 via-slate-50/40 to-slate-100/20 px-5 py-3 backdrop-blur-xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.92)]";
const sectionCardHeaderRowGap =
  "flex items-center gap-2.5 border-b border-slate-200/55 bg-gradient-to-b from-white/90 via-slate-50/40 to-slate-100/20 px-6 py-4 backdrop-blur-xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.92)]";
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

function SectionIcon({ path, color, compact = false }: { path: string; color: string; compact?: boolean }) {
  const g = SECTION_ICON_GLASS[color] ?? SECTION_ICON_GLASS["bg-indigo-500"];
  return (
    <div
      className={`grid shrink-0 place-items-center rounded-lg border shadow-sm backdrop-blur-md ring-1 ring-inset ring-white/70 ${compact ? "h-6 w-6 rounded-md" : "h-8 w-8 rounded-xl"} ${g.shell}`}
    >
      <svg className={`${compact ? "h-3.5 w-3.5" : "h-[18px] w-[18px]"} ${g.ink}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
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

const DELETABLE_EMPLOYEE_STATUSES = new Set(["Terminated", "Retired"]);

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { hasPermission, isAdmin } = useAuth();
  const { filterLocations, filterBusinessUnits, filterGrades, filterJobTitles } = usePeopleScopedLookups();

  const [emp, setEmp] = useState<EmployeeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageTab, setPageTab] = useState<PageTab>("profile");
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [showIdValidationErrors, setShowIdValidationErrors] = useState(false);
  const [showAddressValidationErrors, setShowAddressValidationErrors] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const flashSuccessMsg = useCallback((text: string) => {
    setMsg({ type: "ok", text });
  }, []);

  useEffect(() => {
    if (!showIdValidationErrors) return;
    const timer = window.setTimeout(() => setShowIdValidationErrors(false), 5000);
    return () => window.clearTimeout(timer);
  }, [showIdValidationErrors, msg?.text]);

  useEffect(() => {
    if (!showAddressValidationErrors) return;
    const timer = window.setTimeout(() => setShowAddressValidationErrors(false), 5000);
    return () => window.clearTimeout(timer);
  }, [showAddressValidationErrors, msg?.text]);

  const [pdFirstName, setPdFirstName] = useState("");
  const [pdMiddleName, setPdMiddleName] = useState("");
  const [pdLastName, setPdLastName] = useState("");
  const [pdNationality, setPdNationality] = useState("");
  const [epfNumber, setEpfNumber] = useState("");
  const [etfNumber, setEtfNumber] = useState("");
  const [epfSaving, setEpfSaving] = useState(false);

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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteSaving, setDeleteSaving] = useState(false);

  const [departments, setDepartments] = useState<Lookup[]>([]);
  const [businessUnits, setBusinessUnits] = useState<Lookup[]>([]);
  const [locations, setLocations] = useState<Lookup[]>([]);
  const [grades, setGrades] = useState<Lookup[]>([]);
  const [jobTitles, setJobTitles] = useState<Lookup[]>([]);
  const visibleJobTitles = useMemo(() => filterJobTitles(jobTitles), [filterJobTitles, jobTitles]);
  const visibleBusinessUnits = useMemo(() => filterBusinessUnits(businessUnits), [filterBusinessUnits, businessUnits]);
  const visibleGrades = useMemo(() => filterGrades(grades), [filterGrades, grades]);
  const visibleLocations = useMemo(() => filterLocations(locations), [filterLocations, locations]);

  /** Keep the employee's current org values selectable even if out of the user's assignment scope. */
  const ensureCurrentLookup = useCallback(
    (items: Lookup[], id: string | null | undefined, name: string | null | undefined): Lookup[] => {
      if (!id) return items;
      if (items.some((i) => i.id === id)) return items;
      return [{ id, name: name?.trim() || "Current value" }, ...items];
    },
    [],
  );
  const jobTitleOptions = useMemo(
    () => ensureCurrentLookup(visibleJobTitles, emp?.jobTitleId, emp?.jobTitleName),
    [ensureCurrentLookup, visibleJobTitles, emp?.jobTitleId, emp?.jobTitleName],
  );
  const businessUnitOptions = useMemo(
    () => ensureCurrentLookup(visibleBusinessUnits, emp?.businessUnitId, emp?.businessUnitName),
    [ensureCurrentLookup, visibleBusinessUnits, emp?.businessUnitId, emp?.businessUnitName],
  );
  const gradeOptions = useMemo(
    () => ensureCurrentLookup(visibleGrades, emp?.gradeId, emp?.gradeName),
    [ensureCurrentLookup, visibleGrades, emp?.gradeId, emp?.gradeName],
  );
  const locationOptions = useMemo(
    () => ensureCurrentLookup(visibleLocations, emp?.locationId, emp?.locationName),
    [ensureCurrentLookup, visibleLocations, emp?.locationId, emp?.locationName],
  );
  const departmentOptions = useMemo(
    () => ensureCurrentLookup(departments, emp?.departmentId, emp?.departmentName),
    [ensureCurrentLookup, departments, emp?.departmentId, emp?.departmentName],
  );
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
  const [lifecycleTimeline, setLifecycleTimeline] = useState<EmployeeLifecycleTimeline | null>(null);
  const [lifecycleLoading, setLifecycleLoading] = useState(false);

  const leaveBalanceYear = new Date().getFullYear();
  const [leaveBalanceRows, setLeaveBalanceRows] = useState<LeaveBalanceWidgetRow[]>([]);
  const [leaveBalanceLoading, setLeaveBalanceLoading] = useState(false);

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
  const [attachOpeningId, setAttachOpeningId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editAttachTypeId, setEditAttachTypeId] = useState("");
  const [editAttachExpiry, setEditAttachExpiry] = useState("");
  const [supervisors, setSupervisors] = useState<ReportPerson[]>([]);
  const [subordinates, setSubordinates] = useState<ReportPerson[]>([]);
  const [draftSupervisors, setDraftSupervisors] = useState<ReportPerson[]>([]);
  const [draftSubordinates, setDraftSubordinates] = useState<ReportPerson[]>([]);
  const [savedReportingSupervisors, setSavedReportingSupervisors] = useState<ReportPerson[]>([]);
  const [savedReportingSubordinates, setSavedReportingSubordinates] = useState<ReportPerson[]>([]);
  const [reportingSaving, setReportingSaving] = useState(false);
  const [showAddSupervisor, setShowAddSupervisor] = useState(false);
  const [showAddSubordinate, setShowAddSubordinate] = useState(false);
  const [showEditReportMethod, setShowEditReportMethod] = useState(false);
  const [editReportMethodTarget, setEditReportMethodTarget] = useState<{
    kind: "supervisor" | "subordinate";
    id: string;
    fullName: string;
  } | null>(null);
  const [editReportMethodValue, setEditReportMethodValue] = useState("");
  const [addReportMethod, setAddReportMethod] = useState("");
  const [addReportPersonId, setAddReportPersonId] = useState("");
  const [addReportPersonName, setAddReportPersonName] = useState("");

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
  const [eduModalContext, setEduModalContext] = useState<"qualification" | "education">("education");
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

  const [showCertModal, setShowCertModal] = useState(false);
  const [certSaving, setCertSaving] = useState(false);
  const [editingCert, setEditingCert] = useState<EmployeeCertRow | null>(null);
  const [certCatalog, setCertCatalog] = useState<CertCatalogOption[]>([]);
  const [certCatalogId, setCertCatalogId] = useState("");
  const [certObtained, setCertObtained] = useState("");
  const [certExpiry, setCertExpiry] = useState("");
  const [certNumber, setCertNumber] = useState("");
  const [certStatus, setCertStatus] = useState("Active");

  const [showMatrixModal, setShowMatrixModal] = useState(false);
  const [matrixSaving, setMatrixSaving] = useState(false);
  const [editingMatrix, setEditingMatrix] = useState<SkillMatrixRow | null>(null);
  const [learningSkillsCatalog, setLearningSkillsCatalog] = useState<LearningSkillOption[]>([]);
  const [matrixSkillId, setMatrixSkillId] = useState("");
  const [matrixProficiency, setMatrixProficiency] = useState("3");
  const [matrixAssessedAt, setMatrixAssessedAt] = useState("");
  const [matrixNotes, setMatrixNotes] = useState("");

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

  const [benefits, setBenefits] = useState<BenefitData[]>([]);
  const [showBenefitModal, setShowBenefitModal] = useState(false);
  const [benefitSaving, setBenefitSaving] = useState(false);
  const [editingBenefit, setEditingBenefit] = useState<BenefitData | null>(null);
  const [benefitInsurer, setBenefitInsurer] = useState("");
  const [benefitExtMed, setBenefitExtMed] = useState(false);
  const [benefitDental, setBenefitDental] = useState(false);
  const [benefitVision, setBenefitVision] = useState(false);
  const [benefitSpousal, setBenefitSpousal] = useState(false);
  const [benefitDeps, setBenefitDeps] = useState(false);
  const [showBenefitValidationErrors, setShowBenefitValidationErrors] = useState(false);

  const [immigrations, setImmigrations] = useState<ImmigrationItem[]>([]);
  const [showImmModal, setShowImmModal] = useState(false);
  const [showImmViewModal, setShowImmViewModal] = useState(false);
  const [viewingImm, setViewingImm] = useState<ImmigrationItem | null>(null);
  const [immSaving, setImmSaving] = useState(false);
  const [editingImm, setEditingImm] = useState<ImmigrationItem | null>(null);
  const [immDocType, setImmDocType] = useState("Passport");
  const [immNumber, setImmNumber] = useState("");
  const [immIssuedBy, setImmIssuedBy] = useState("");
  const [immIssuedDate, setImmIssuedDate] = useState("");
  const [immExpiryDate, setImmExpiryDate] = useState("");
  const [immReviewDate, setImmReviewDate] = useState("");
  const [immComments, setImmComments] = useState("");

  const [immDocs, setImmDocs] = useState<Attachment[]>([]);
  const [immDocFile, setImmDocFile] = useState<File | null>(null);
  const [immDocDesc, setImmDocDesc] = useState("");
  const [immDocOpeningId, setImmDocOpeningId] = useState<string | null>(null);
  const immDocFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!showImmModal) return;
    const eligible = calculateImmigrationEligibleDate(immDocType, immIssuedDate, immExpiryDate);
    setImmReviewDate(eligible ?? "");
  }, [showImmModal, immDocType, immIssuedDate, immExpiryDate]);

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
  const [showWeValidationErrors, setShowWeValidationErrors] = useState(false);
  const [weFormError, setWeFormError] = useState<string | null>(null);

  const [dlType, setDlType] = useState("");
  const [dlIssue, setDlIssue] = useState("");
  const [dlExpiry, setDlExpiry] = useState("");
  const [dlIssuingCountry, setDlIssuingCountry] = useState("");
  const [driverLicenses, setDriverLicenses] = useState<DriverLicenseItem[]>([]);
  const [showDlModal, setShowDlModal] = useState(false);
  const [dlSaving, setDlSaving] = useState(false);
  const [showDlValidationErrors, setShowDlValidationErrors] = useState(false);
  const [editingDl, setEditingDl] = useState<DriverLicenseItem | null>(null);
  const [dlNumber, setDlNumber] = useState("");

  const [addrCountry, setAddrCountry] = useState("");
  const [addrState, setAddrState] = useState("");
  const [addrDistrict, setAddrDistrict] = useState("");
  const [permCountry, setPermCountry] = useState("");
  const [permState, setPermState] = useState("");
  const [permDistrict, setPermDistrict] = useState("");

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

  const addAttachmentTypeOptions = useMemo(
    () =>
      [...attachmentTypeMasters]
        .filter((t) => t.isActive)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name))
        .map((t) => ({ value: t.id, label: t.name })),
    [attachmentTypeMasters],
  );

  const editAttachmentTypeOptions = useMemo(
    () =>
      [...attachmentTypeMasters]
        .filter((t) => t.isActive || t.id === editAttachTypeId)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name))
        .map((t) => ({ value: t.id, label: t.name })),
    [attachmentTypeMasters, editAttachTypeId],
  );

  const skillCatalogNames = useMemo(() => {
    const names = new Set(skillMasterList.map((s) => s.name.trim()).filter(Boolean));
    skills.forEach((s) => {
      const n = s.skill.trim();
      if (n) names.add(n);
    });
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [skillMasterList, skills]);

  const qualificationRecords = useMemo(
    () => educations.filter((e) => e.qualificationName?.trim()),
    [educations],
  );

  const educationRecords = useMemo(
    () => educations.filter((e) => !e.qualificationName?.trim()),
    [educations],
  );

  const ecRelationshipSelectOptions = useMemo((): FormSelectOption[] => {
    if (!ecRelationship.trim() || EC_RELATIONSHIP_OPTIONS.some((o) => o.value === ecRelationship)) {
      return EC_RELATIONSHIP_OPTIONS;
    }
    return [...EC_RELATIONSHIP_OPTIONS, { value: ecRelationship, label: ecRelationship }];
  }, [ecRelationship]);

  const attachmentsPager = useClientPagination(attachments);
  const emergencyContactsPager = useClientPagination(emergencyContacts);
  const dependentsPager = useClientPagination(dependents);
  const qualificationRecordsPager = useClientPagination(qualificationRecords);
  const educationRecordsPager = useClientPagination(educationRecords);
  const skillsPager = useClientPagination(skills);
  const languagesPager = useClientPagination(languages);
  const workExperiencesPager = useClientPagination(workExperiences);
  const driverLicensesPager = useClientPagination(driverLicenses);
  const benefitsPager = useClientPagination(benefits);
  const bankAccountsPager = useClientPagination(bankAccounts);
  const baBankNameOptions = useMemo(() => {
    const names = new Set<string>(BA_BANK_NAMES);
    bankAccounts.forEach((b) => {
      const n = b.bankName?.trim();
      if (n) names.add(n);
    });
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [bankAccounts]);
  const benefitInsurerOptions = useMemo(() => {
    const names = new Set<string>(BENEFIT_INSURER_NAMES);
    benefits.forEach((b) => {
      const n = b.insuranceProvider?.trim();
      if (n) names.add(n);
    });
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [benefits]);
  const supervisorsPager = useClientPagination(draftSupervisors);
  const subordinatesPager = useClientPagination(draftSubordinates);

  const reportingDirty = useMemo(
    () =>
      !reportLinesMatchSaved(savedReportingSupervisors, draftSupervisors, "supervisorId") ||
      !reportLinesMatchSaved(savedReportingSubordinates, draftSubordinates, "employeeId"),
    [savedReportingSupervisors, draftSupervisors, savedReportingSubordinates, draftSubordinates],
  );

  const draftHasDirectSupervisor = useMemo(
    () => draftSupervisors.some((s) => s.reportingMethod === "Direct"),
    [draftSupervisors],
  );

  const reportsToByMethod = useMemo(() => {
    const source = reportingDirty ? draftSupervisors : supervisors;
    const grouped = {
      direct: [] as string[],
      indirect: [] as string[],
      both: [] as string[],
    };

    for (const s of source) {
      const name = s.fullName.trim();
      if (!name) continue;
      const method = s.reportingMethod.trim().toLowerCase();
      if (method === "direct") grouped.direct.push(name);
      else if (method === "indirect") grouped.indirect.push(name);
      else if (method === "both" || method === "other") grouped.both.push(name);
    }

    if (source.length === 0 && emp?.managerName?.trim()) {
      grouped.direct = emp.managerName.split(",").map((n) => n.trim()).filter(Boolean);
    }

    return grouped;
  }, [reportingDirty, draftSupervisors, supervisors, emp?.managerName]);

  const hasAnyReportsTo =
    reportsToByMethod.direct.length > 0
    || reportsToByMethod.indirect.length > 0
    || reportsToByMethod.both.length > 0;

  const reportingExcludeIds = useMemo(
    () => buildReportingExcludeIds(id, draftSupervisors, draftSubordinates),
    [id, draftSupervisors, draftSubordinates],
  );

  function resetAddReportPersonFields() {
    setAddReportPersonId("");
    setAddReportPersonName("");
    setAddReportMethod("");
  }

  function pickAddReportPerson(emp: { id: string; firstName: string; lastName: string } | null) {
    const personId = emp?.id ?? "";
    const personName = emp ? `${emp.firstName} ${emp.lastName}`.trim() : "";
    setAddReportPersonId(personId);
    setAddReportPersonName(personName);
    if (!emp) return;
    if (showAddSupervisor && addReportMethod) {
      stageAddSupervisor(personId, personName, addReportMethod);
    } else if (showAddSubordinate && addReportMethod) {
      stageAddSubordinate(personId, personName, addReportMethod);
    }
  }

  function onAddSupervisorMethodChange(method: string) {
    setAddReportMethod(method);
    if (method && addReportPersonId) {
      stageAddSupervisor(addReportPersonId, addReportPersonName, method);
    }
  }

  function onAddSubordinateMethodChange(method: string) {
    setAddReportMethod(method);
    if (method && addReportPersonId) {
      stageAddSubordinate(addReportPersonId, addReportPersonName, method);
    }
  }

  const syncReportingDraft = useCallback((sup: ReportPerson[], sub: ReportPerson[]) => {
    const uniqueSupervisors = dedupeReportPeople(sup, "supervisorId");
    const uniqueSubordinates = dedupeReportPeople(sub, "employeeId");
    setSupervisors(uniqueSupervisors);
    setSubordinates(uniqueSubordinates);
    setDraftSupervisors(uniqueSupervisors);
    setDraftSubordinates(uniqueSubordinates);
    setSavedReportingSupervisors(uniqueSupervisors);
    setSavedReportingSubordinates(uniqueSubordinates);
  }, []);
  const immigrationsPager = useClientPagination(immigrations);
  const trainingRowsPager = useClientPagination(trainingRows);
  const matrixRowsPager = useClientPagination(matrixRows);
  const certRowsPager = useClientPagination(certRows);

  function syncEmpDriverLicenseFromList(rows: DriverLicenseItem[]) {
    const primary = rows[0];
    setEmp((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        driversLicenseNumber: primary?.number ?? null,
        driversLicenseType: primary?.licenseType ?? null,
        licenseIssueDate: primary?.issueDate ?? null,
        licenseExpiryDate: primary?.expiryDate ?? null,
        driversLicenseIssuingCountry: primary?.issuingCountry ?? null,
      };
    });
    setDlType(primary?.licenseType ?? "");
    setDlIssue(primary?.issueDate ? primary.issueDate.split("T")[0] : "");
    setDlExpiry(primary?.expiryDate ? primary.expiryDate.split("T")[0] : "");
    setDlIssuingCountry(primary?.issuingCountry ?? "");
  }

  function formatBenefitCoverage(b: BenefitData) {
    const parts: string[] = [];
    if (b.coverageExtendedMedical) parts.push("Extended Medical");
    if (b.coverageDental) parts.push("Dental");
    if (b.coverageVision) parts.push("Vision");
    return parts.length ? parts.join(", ") : "—";
  }

  const load = useCallback(async () => {
    setLoading(true);
    let e: EmployeeDetail;
    try {
      e = await apiFetch<EmployeeDetail>(`/api/employees/${id}`);
    } catch {
      setMsg({ type: "err", text: "Employee not found." });
      setLoading(false);
      return;
    }

    setEmp(e);
    setPdFirstName(e.firstName);
    setPdMiddleName(e.middleName ?? "");
    setPdLastName(e.lastName);
    setPdNationality(e.nationality ?? "");
    setEpfNumber(e.epfNumber ?? "");
    setEtfNumber(e.etfNumber ?? "");
    setLoading(false);

    try {
      const [deps, bus, locs, grs, jts, sts, empTypes, supCands, subCands, settings, atts] = await Promise.all([
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
          .then((r) => (r.items ?? []).filter((m) => m.id !== id).map((m) => ({ id: m.id, name: m.fullName })))
          .catch(() => [] as Lookup[]),
        apiFetch<Record<string, string>>("/api/system-settings").catch((): Record<string, string> => ({})),
        apiFetch<Attachment[]>(`/api/employees/${id}/attachments`).catch(() => [] as Attachment[]),
      ]);
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
      Promise.all([
        apiFetch<ReportPerson[]>(`/api/employees/${id}/supervisors`).catch(() => [] as ReportPerson[]),
        apiFetch<ReportPerson[]>(`/api/employees/${id}/subordinates`).catch(() => [] as ReportPerson[]),
      ]).then(([sup, sub]) => syncReportingDraft(sup, sub));
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
      apiFetch<{ id: string; skillId: string; skillName: string; proficiencyLevel: number; assessedAt: string | null; notes: string | null }[]>(`/api/learning/skill-matrix?employeeId=${id}`)
        .then((rows) => setMatrixRows(rows.map((r) => ({ id: r.id, skillId: r.skillId, skillName: r.skillName, proficiencyLevel: r.proficiencyLevel, assessedAt: r.assessedAt, notes: r.notes }))))
        .catch(() => { setMatrixRows([]); });
      apiFetch<LanguageItem[]>(`/api/employees/${id}/languages`).then(setLanguages).catch(() => {});
      apiFetch<ImmigrationItem[]>(`/api/employees/${id}/immigrations`).then(setImmigrations).catch(() => {});
      apiFetch<Attachment[]>(`/api/employees/${id}/immigration-documents`).then(setImmDocs).catch(() => {});
      apiFetch<WorkExperienceItem[]>(`/api/employees/${id}/work-experiences`).then(setWorkExperiences).catch(() => {});
      apiFetch<DriverLicenseItem[]>(`/api/employees/${id}/driver-licenses`).then((rows) => {
        setDriverLicenses(rows);
        syncEmpDriverLicenseFromList(rows);
      }).catch(() => {});
      apiFetch<BenefitData[]>(`/api/employees/${id}/benefits`).then(setBenefits).catch(() => {});
      apiFetch<BankAccountItem[]>(`/api/employees/${id}/bank-accounts`).then(setBankAccounts).catch(() => {});
      apiFetch<{ id: string; name: string; description?: string; itemCount: number }[]>("/api/employee-tasks/templates?type=Offboarding").then(setOffboardingTemplates).catch(() => {});
      const dashboardWidgetsJson = getSystemSetting(settings, "EmployeeDashboardWidgets");
      if (dashboardWidgetsJson) {
        try {
          const saved = JSON.parse(dashboardWidgetsJson) as string[];
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
    } catch { /* supplementary lookups failed — profile shell already visible */ }
  }, [id, syncReportingDraft]);

  const loadLifecycleTimeline = useCallback(async () => {
    if (!id) return;
    setLifecycleLoading(true);
    try {
      const timeline = await apiFetch<EmployeeLifecycleTimeline>(`/api/employees/${id}/lifecycle-timeline`);
      setLifecycleTimeline(timeline);
    } catch {
      setLifecycleTimeline({ milestones: [], roleHistory: [] });
    } finally {
      setLifecycleLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!id || !visibleWidgets.includes("lifecycle")) return;
    void loadLifecycleTimeline();
  }, [id, visibleWidgets, loadLifecycleTimeline]);

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

  const loadLeaveBalances = useCallback(async () => {
    if (!id) return;
    setLeaveBalanceLoading(true);
    try {
      const rows = await apiFetch<LeaveBalanceWidgetRow[]>(`/api/leave/balances/${id}?year=${leaveBalanceYear}`);
      setLeaveBalanceRows(Array.isArray(rows) ? rows : []);
    } catch {
      setLeaveBalanceRows([]);
    } finally {
      setLeaveBalanceLoading(false);
    }
  }, [id, leaveBalanceYear]);

  useEffect(() => {
    if (pageTab !== "profile" || !visibleWidgets.includes("leaveBalance") || !id) return;
    void loadLeaveBalances();
  }, [pageTab, visibleWidgets, id, loadLeaveBalances]);

  useEffect(() => {
    if (!emp) return;
    setAddrCountry(emp.country ?? "");
    setAddrState(emp.stateProvince ?? inferStateFromDistrict(emp.country ?? "", emp.district ?? "") ?? "");
    setAddrDistrict(emp.district ?? "");
    setPermCountry(emp.permanentCountry ?? "");
    setPermState(emp.permanentStateProvince ?? inferStateFromDistrict(emp.permanentCountry ?? "", emp.permanentDistrict ?? "") ?? "");
    setPermDistrict(emp.permanentDistrict ?? "");
    setDlType(emp.driversLicenseType ?? "");
    setDlIssue(emp.licenseIssueDate ? emp.licenseIssueDate.split("T")[0] : "");
    setDlExpiry(emp.licenseExpiryDate ? emp.licenseExpiryDate.split("T")[0] : "");
    setDlIssuingCountry(emp.driversLicenseIssuingCountry ?? "");
  }, [emp]);

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
    if (!attachFile) {
      await appAlert("Please choose a file to upload.");
      return;
    }
    if (!attachTypeId) {
      await appAlert("Please select an attachment type.");
      return;
    }
    const type = attachmentTypeMasters.find((t) => t.id === attachTypeId);
    if (!type?.isActive) {
      await appAlert("Please select a valid attachment type.");
      return;
    }
    setAttachUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", attachFile, attachFile.name);
      fd.append("attachmentTypeId", type.id);
      if (type.code) fd.append("attachmentTypeCode", type.code);
      fd.append("attachmentTypeName", type.name);
      if (attachDesc.trim()) fd.append("description", attachDesc.trim());
      if (attachExpiry.trim()) fd.append("expiryDate", attachExpiry.trim());
      const res = await fetch(`${getApiBaseUrl()}/api/employees/${id}/attachments`, {
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
      await appAlert(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setAttachUploading(false);
    }
  }

  async function deleteAttachment(attId: string) {
    if (!(await appConfirm("Delete this attachment?"))) return;
    try {
      await apiFetch(`/api/employees/${id}/attachments/${attId}`, { method: "DELETE" });
      setAttachments((prev) => prev.filter((a) => a.id !== attId));
    } catch { /* ignore */ }
  }

  async function openAttachmentFile(attId: string) {
    setAttachOpeningId(attId);
    try {
      const blob = await apiFetchBlob(`/api/employees/${id}/attachments/${attId}/download`);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Could not open the attachment.");
    } finally {
      setAttachOpeningId(null);
    }
  }

  async function updateAttachmentRow(attId: string) {
    if (!editAttachTypeId) {
      await appAlert("Please select an attachment type.");
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

  function stageAddSupervisor(
    personId = addReportPersonId,
    personName = addReportPersonName,
    method = addReportMethod,
  ) {
    if (!personId || !method) return;
    const normalizedPersonId = normalizeEmployeeId(personId);
    if (draftSupervisors.some((row) => normalizeEmployeeId(row.supervisorId) === normalizedPersonId)) return;
    if (draftSubordinates.some((row) => normalizeEmployeeId(row.employeeId) === normalizedPersonId)) return;
    setDraftSupervisors((prev) => [
      ...prev,
      {
        id: `pending-supervisor-${personId}`,
        supervisorId: personId,
        employeeCode: "",
        fullName: personName,
        jobTitleName: null,
        reportingMethod: method,
      },
    ]);
    setShowAddSupervisor(false);
    resetAddReportPersonFields();
  }

  function stageAddSubordinate(
    personId = addReportPersonId,
    personName = addReportPersonName,
    method = addReportMethod,
  ) {
    if (!personId || !method) return;
    const normalizedPersonId = normalizeEmployeeId(personId);
    if (draftSubordinates.some((row) => normalizeEmployeeId(row.employeeId) === normalizedPersonId)) return;
    if (draftSupervisors.some((row) => normalizeEmployeeId(row.supervisorId) === normalizedPersonId)) return;
    setDraftSubordinates((prev) => [
      ...prev,
      {
        id: `pending-subordinate-${personId}`,
        employeeId: personId,
        employeeCode: "",
        fullName: personName,
        jobTitleName: null,
        reportingMethod: method,
      },
    ]);
    setShowAddSubordinate(false);
    resetAddReportPersonFields();
  }

  function updateDraftSupervisorMethod(entryId: string, reportingMethod: string) {
    setDraftSupervisors((prev) => prev.map((s) => (s.id === entryId ? { ...s, reportingMethod } : s)));
  }

  function updateDraftSubordinateMethod(entryId: string, reportingMethod: string) {
    setDraftSubordinates((prev) => prev.map((s) => (s.id === entryId ? { ...s, reportingMethod } : s)));
  }

  function openEditReportMethod(row: ReportPerson, kind: "supervisor" | "subordinate") {
    setEditReportMethodTarget({ kind, id: row.id, fullName: row.fullName });
    setEditReportMethodValue(normalizeReportingMethodValue(row.reportingMethod));
    setShowEditReportMethod(true);
  }

  function closeEditReportMethod() {
    setShowEditReportMethod(false);
    setEditReportMethodTarget(null);
    setEditReportMethodValue("");
  }

  function saveEditReportMethod(method: string) {
    if (!editReportMethodTarget || !method.trim()) return;
    if (editReportMethodTarget.kind === "supervisor") {
      updateDraftSupervisorMethod(editReportMethodTarget.id, method);
    } else {
      updateDraftSubordinateMethod(editReportMethodTarget.id, method);
    }
    closeEditReportMethod();
  }

  async function removeSupervisorDraft(entryId: string) {
    if (!(await appConfirm("Remove this supervisor?"))) return;
    setDraftSupervisors((prev) => prev.filter((s) => s.id !== entryId));
  }

  async function removeSubordinateDraft(entryId: string) {
    if (!(await appConfirm("Remove this subordinate?"))) return;
    setDraftSubordinates((prev) => prev.filter((s) => s.id !== entryId));
  }

  async function reloadReportingLinesFromServer() {
    const [sup, sub, updatedEmp] = await Promise.all([
      apiFetch<ReportPerson[]>(`/api/employees/${id}/supervisors`),
      apiFetch<ReportPerson[]>(`/api/employees/${id}/subordinates`),
      apiFetch<EmployeeDetail>(`/api/employees/${id}`),
    ]);
    syncReportingDraft(sup, sub);
    setEmp(updatedEmp);
  }

  async function saveReportingLinesIncremental() {
    const draftSupervisorIds = new Set(
      draftSupervisors.map((row) => row.supervisorId).filter(Boolean) as string[],
    );
    for (const saved of savedReportingSupervisors) {
      if (saved.supervisorId && !draftSupervisorIds.has(saved.supervisorId)) {
        await apiFetch(`/api/employees/${id}/supervisors/${saved.id}`, { method: "DELETE" });
      }
    }
    const savedSupervisorByPersonId = new Map(
      savedReportingSupervisors
        .filter((row) => row.supervisorId)
        .map((row) => [row.supervisorId as string, row]),
    );
    for (const draft of draftSupervisors) {
      if (!draft.supervisorId) continue;
      const saved = savedSupervisorByPersonId.get(draft.supervisorId);
      if (!saved) {
        await apiFetch(`/api/employees/${id}/supervisors`, {
          method: "POST",
          body: JSON.stringify({ supervisorId: draft.supervisorId, reportingMethod: draft.reportingMethod }),
        });
      } else if (saved.reportingMethod !== draft.reportingMethod) {
        for (const row of savedReportingSupervisors.filter((s) => s.supervisorId === draft.supervisorId)) {
          await apiFetch(`/api/employees/${id}/supervisors/${row.id}`, { method: "DELETE" });
        }
        await apiFetch(`/api/employees/${id}/supervisors`, {
          method: "POST",
          body: JSON.stringify({ supervisorId: draft.supervisorId, reportingMethod: draft.reportingMethod }),
        });
      }
    }

    const draftSubordinateIds = new Set(
      draftSubordinates.map((row) => row.employeeId).filter(Boolean) as string[],
    );
    for (const saved of savedReportingSubordinates) {
      if (saved.employeeId && !draftSubordinateIds.has(saved.employeeId)) {
        await apiFetch(`/api/employees/${id}/subordinates/${saved.id}`, { method: "DELETE" });
      }
    }
    const savedSubordinateByPersonId = new Map(
      savedReportingSubordinates
        .filter((row) => row.employeeId)
        .map((row) => [row.employeeId as string, row]),
    );
    for (const draft of draftSubordinates) {
      if (!draft.employeeId) continue;
      const saved = savedSubordinateByPersonId.get(draft.employeeId);
      if (!saved) {
        await apiFetch(`/api/employees/${id}/subordinates`, {
          method: "POST",
          body: JSON.stringify({ employeeId: draft.employeeId, reportingMethod: draft.reportingMethod }),
        });
      } else if (saved.reportingMethod !== draft.reportingMethod) {
        for (const row of savedReportingSubordinates.filter((s) => s.employeeId === draft.employeeId)) {
          await apiFetch(`/api/employees/${id}/subordinates/${row.id}`, { method: "DELETE" });
        }
        await apiFetch(`/api/employees/${id}/subordinates`, {
          method: "POST",
          body: JSON.stringify({ employeeId: draft.employeeId, reportingMethod: draft.reportingMethod }),
        });
      }
    }

    await reloadReportingLinesFromServer();
  }

  async function saveReportingLines() {
    if (reportingSaving || !reportingDirty) return;
    const validationError = validateReportingDraft(draftSupervisors, draftSubordinates);
    if (validationError) {
      await appAlert(validationError);
      return;
    }
    setReportingSaving(true);
    try {
      const payload = {
        supervisors: draftSupervisors.map((row) => ({
          supervisorId: row.supervisorId,
          reportingMethod: row.reportingMethod,
        })),
        subordinates: draftSubordinates.map((row) => ({
          employeeId: row.employeeId,
          reportingMethod: row.reportingMethod,
        })),
      };
      try {
        const res = await apiFetch<{ supervisors: ReportPerson[]; subordinates: ReportPerson[] }>(
          `/api/employees/${id}/reporting-lines`,
          { method: "POST", body: JSON.stringify(payload) },
        );
        const updatedEmp = await apiFetch<EmployeeDetail>(`/api/employees/${id}`);
        syncReportingDraft(res.supervisors, res.subordinates);
        setEmp(updatedEmp);
        flashSuccessMsg("Reporting lines saved successfully.");
      } catch (batchErr) {
        const batchMsg = batchErr instanceof Error ? batchErr.message : "";
        if (batchMsg.includes("API 404") && batchMsg.includes("reporting-lines")) {
          await saveReportingLinesIncremental();
          flashSuccessMsg("Reporting lines saved successfully.");
          return;
        }
        throw batchErr;
      }
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Failed to save reporting lines");
    } finally {
      setReportingSaving(false);
    }
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
    const phones = [
      { label: "Home telephone", value: ecHome.trim() },
      { label: "Mobile telephone", value: ecMobile.trim() },
      { label: "Work telephone", value: ecWork.trim() },
    ];
    const filled = phones.filter((p) => p.value);
    if (filled.length === 0) {
      await appAlert("Enter at least one telephone number.");
      return;
    }
    for (const p of filled) {
      if (!isValidPhone(p.value, true)) {
        await appAlert(`${p.label}: ${PHONE_VALIDATION_MESSAGE}`);
        return;
      }
    }
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
      await appAlert(err instanceof Error ? err.message : "Failed to save emergency contact");
    } finally {
      setEcSaving(false);
    }
  }

  async function deleteEmergencyContact(contactId: string) {
    if (!(await appConfirm("Delete this emergency contact?"))) return;
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
    if (
      !depFirstName.trim() ||
      !depLastName.trim() ||
      !depRelationship.trim() ||
      !depOccupation.trim() ||
      !depOrganization.trim()
    ) {
      return;
    }
    setDepSaving(true);
    const body = {
      firstName: depFirstName.trim(),
      lastName: depLastName.trim(),
      relationship: depRelationship.trim(),
      dateOfBirth: depDob || null,
      maritalStatus: depMaritalStatus || null,
      occupation: depOccupation.trim(),
      organization: depOrganization.trim(),
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
      await appAlert(err instanceof Error ? err.message : "Failed to save dependent");
    } finally {
      setDepSaving(false);
    }
  }

  async function deleteDependent(depId: string) {
    if (!(await appConfirm("Delete this dependent?"))) return;
    try {
      await apiFetch(`/api/employees/${id}/dependents/${depId}`, { method: "DELETE" });
      setDependents((prev) => prev.filter((d) => d.id !== depId));
    } catch { /* ignore */ }
  }

  function openEduModal(edu?: EducationItem, context: "qualification" | "education" = "education") {
    if (edu) {
      setEditingEdu(edu);
      setEduModalContext(edu.qualificationName?.trim() ? "qualification" : "education");
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
      setEduModalContext(context);
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
    const isQualification = eduModalContext === "qualification";
    if (isQualification) {
      if (!eduQualName.trim()) return;
    } else if (!eduLevel.trim()) {
      return;
    }
    if (eduStartDate && eduEndDate && eduEndDate < eduStartDate) {
      setMsg({ type: "err", text: "Education End Date must be on or after the Start Date." });
      return;
    }
    setEduSaving(true);
    try {
      const body = {
        level: eduLevel.trim() || "Other",
        qualificationName: isQualification ? eduQualName.trim() : null,
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
      await appAlert(err instanceof Error ? err.message : "Failed to save education");
    } finally {
      setEduSaving(false);
    }
  }

  async function deleteEducation(eduId: string) {
    if (!(await appConfirm("Delete this education record?"))) return;
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
    if (!skillName.trim() || !skillYears.trim()) return;
    setSkillSaving(true);
    try {
      const body = {
        skill: skillName.trim(),
        yearsOfExperience: skillYears.trim(),
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
      await appAlert(err instanceof Error ? err.message : "Failed to save skill");
    } finally {
      setSkillSaving(false);
    }
  }

  async function deleteSkill(skillId: string) {
    if (!(await appConfirm("Delete this skill?"))) return;
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
        await appAlert("No active courses in the catalog. Add a course from Learning first.");
        return;
      }
      setCoursesCatalog(active);
      setTrainCourseId(active[0]!.id);
      setTrainDue("");
      setShowTrainAssignModal(true);
    } catch {
      await appAlert("Could not load courses. Ensure the Learning module is licensed and you have access.");
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
      await appAlert(err instanceof Error ? err.message : "Failed to assign training");
    } finally {
      setTrainSaving(false);
    }
  }

  async function refreshCertRows() {
    const rows = await apiFetch<EmployeeCertRow[]>(`/api/employees/${id}/certifications`);
    setCertRows(rows);
  }

  async function refreshMatrixRows() {
    const rows = await apiFetch<{ id: string; skillId: string; skillName: string; proficiencyLevel: number; assessedAt: string | null; notes: string | null }[]>(
      `/api/learning/skill-matrix?employeeId=${id}`,
    );
    setMatrixRows(rows.map((r) => ({ id: r.id, skillId: r.skillId, skillName: r.skillName, proficiencyLevel: r.proficiencyLevel, assessedAt: r.assessedAt, notes: r.notes })));
  }

  async function openCertModal(cert?: EmployeeCertRow) {
    try {
      const catalog = await apiFetch<CertCatalogOption[]>("/api/learning/certifications");
      const active = catalog.filter((c) => c.isActive);
      if (!cert && active.length === 0) {
        await appAlert("No certification types in the catalog. Restart the API to load defaults, or add types from Learning.");
        return;
      }
      setCertCatalog(active);
      if (cert) {
        setEditingCert(cert);
        setCertCatalogId(cert.certificationId);
        setCertObtained(cert.obtainedDate?.slice(0, 10) ?? "");
        setCertExpiry(cert.expiryDate?.slice(0, 10) ?? "");
        setCertNumber(cert.certificateNumber ?? "");
        setCertStatus(cert.status || "Active");
      } else {
        setEditingCert(null);
        setCertCatalogId(active[0]!.id);
        setCertObtained("");
        setCertExpiry("");
        setCertNumber("");
        setCertStatus("Active");
      }
      setShowCertModal(true);
    } catch {
      await appAlert("Could not load certification catalog. Ensure the Learning module is licensed and you have access.");
    }
  }

  function closeCertModal() {
    setShowCertModal(false);
    setEditingCert(null);
  }

  async function saveCertification() {
    if (!certCatalogId || !certObtained.trim()) return;
    setCertSaving(true);
    try {
      const body = {
        certificationId: certCatalogId,
        obtainedDate: new Date(certObtained).toISOString(),
        expiryDate: certExpiry ? new Date(certExpiry).toISOString() : null,
        certificateNumber: certNumber.trim() || null,
        status: certStatus || "Active",
      };
      if (editingCert) {
        await apiFetch(`/api/employees/${id}/certifications/${editingCert.id}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await apiFetch(`/api/employees/${id}/certifications`, { method: "POST", body: JSON.stringify(body) });
      }
      await refreshCertRows();
      closeCertModal();
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Failed to save certification");
    } finally {
      setCertSaving(false);
    }
  }

  async function deleteCertification(certId: string) {
    if (!(await appConfirm("Remove this certification record?"))) return;
    try {
      await apiFetch(`/api/employees/${id}/certifications/${certId}`, { method: "DELETE" });
      setCertRows((prev) => prev.filter((c) => c.id !== certId));
    } catch {
      await appAlert("Failed to delete certification");
    }
  }

  async function openMatrixModal(row?: SkillMatrixRow) {
    try {
      const skills = await apiFetch<LearningSkillOption[]>("/api/learning/skills");
      const active = skills.filter((s) => s.isActive !== false);
      if (!row) {
        const usedIds = new Set(matrixRows.map((m) => m.skillId));
        const available = active.filter((s) => !usedIds.has(s.id));
        if (available.length === 0) {
          await appAlert(active.length === 0
            ? "No skills in the learning catalog. Restart the API to load defaults, or add skills from Learning."
            : "This employee already has matrix entries for all catalog skills.");
          return;
        }
        setLearningSkillsCatalog(available);
        setEditingMatrix(null);
        setMatrixSkillId(available[0]!.id);
        setMatrixProficiency("3");
        setMatrixAssessedAt("");
        setMatrixNotes("");
      } else {
        setLearningSkillsCatalog(active);
        setEditingMatrix(row);
        setMatrixSkillId(row.skillId);
        setMatrixProficiency(String(row.proficiencyLevel));
        setMatrixAssessedAt(row.assessedAt?.slice(0, 10) ?? "");
        setMatrixNotes(row.notes ?? "");
      }
      setShowMatrixModal(true);
    } catch {
      await appAlert("Could not load skills catalog. Ensure the Learning module is licensed and you have access.");
    }
  }

  function closeMatrixModal() {
    setShowMatrixModal(false);
    setEditingMatrix(null);
  }

  async function saveMatrixEntry() {
    if (!editingMatrix && !matrixSkillId) return;
    if (!matrixProficiency.trim()) return;
    setMatrixSaving(true);
    try {
      const assessedPayload = matrixAssessedAt ? new Date(matrixAssessedAt).toISOString() : null;
      const notesPayload = matrixNotes.trim() || null;
      if (editingMatrix) {
        await apiFetch(`/api/learning/skill-matrix/${editingMatrix.id}`, {
          method: "PUT",
          body: JSON.stringify({
            proficiencyLevel: Number(matrixProficiency),
            assessedAt: assessedPayload,
            notes: notesPayload,
          }),
        });
      } else {
        await apiFetch("/api/learning/skill-matrix", {
          method: "POST",
          body: JSON.stringify({
            employeeId: id,
            skillId: matrixSkillId,
            proficiencyLevel: Number(matrixProficiency),
            assessedAt: assessedPayload,
            notes: notesPayload,
          }),
        });
      }
      await refreshMatrixRows();
      closeMatrixModal();
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Failed to save skill matrix entry");
    } finally {
      setMatrixSaving(false);
    }
  }

  async function deleteMatrixEntry(matrixId: string) {
    if (!(await appConfirm("Remove this skill matrix entry?"))) return;
    try {
      await apiFetch(`/api/learning/skill-matrix/${matrixId}`, { method: "DELETE" });
      setMatrixRows((prev) => prev.filter((m) => m.id !== matrixId));
    } catch {
      await appAlert("Failed to delete skill matrix entry");
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
      await appAlert(err instanceof Error ? err.message : "Failed to save language");
    } finally {
      setLangSaving(false);
    }
  }

  async function deleteLanguage(langId: string) {
    if (!(await appConfirm("Delete this language?"))) return;
    try {
      await apiFetch(`/api/employees/${id}/languages/${langId}`, { method: "DELETE" });
      setLanguages((prev) => prev.filter((l) => l.id !== langId));
    } catch { /* ignore */ }
  }

  async function saveBenefitRecord() {
    if (!isBenefitFormValid()) {
      setShowBenefitValidationErrors(true);
      return;
    }
    setBenefitSaving(true);
    try {
      const body = {
        insuranceProvider: benefitInsurer.trim(),
        coverageExtendedMedical: benefitExtMed,
        coverageDental: benefitDental,
        coverageVision: benefitVision,
        spousalCoverage: benefitSpousal,
        dependentsCovered: benefitDeps,
      };
      if (editingBenefit) {
        const updated = await apiFetch<BenefitData>(`/api/employees/${id}/benefits/${editingBenefit.id}`, { method: "PUT", body: JSON.stringify(body) });
        setBenefits((prev) => prev.map((b) => (b.id === editingBenefit.id ? updated : b)));
        flashSuccessMsg("Benefits record updated successfully.");
      } else {
        const created = await apiFetch<BenefitData>(`/api/employees/${id}/benefits`, { method: "POST", body: JSON.stringify(body) });
        setBenefits((prev) => [created, ...prev]);
        flashSuccessMsg("Benefits record added successfully.");
      }
      closeBenefitModal();
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Failed to save benefits");
    } finally {
      setBenefitSaving(false);
    }
  }

  function openBenefitModal(item?: BenefitData) {
    setShowBenefitValidationErrors(false);
    if (item) {
      setEditingBenefit(item);
      setBenefitInsurer(item.insuranceProvider ?? "");
      setBenefitExtMed(item.coverageExtendedMedical);
      setBenefitDental(item.coverageDental);
      setBenefitVision(item.coverageVision);
      setBenefitSpousal(item.spousalCoverage);
      setBenefitDeps(item.dependentsCovered);
    } else {
      setEditingBenefit(null);
      setBenefitInsurer("");
      setBenefitExtMed(false);
      setBenefitDental(false);
      setBenefitVision(false);
      setBenefitSpousal(false);
      setBenefitDeps(false);
    }
    setShowBenefitModal(true);
  }

  function closeBenefitModal() {
    setShowBenefitModal(false);
    setEditingBenefit(null);
    setShowBenefitValidationErrors(false);
  }

  function isBenefitFormValid() {
    if (!benefitInsurer.trim()) return false;
    if (!benefitExtMed && !benefitDental && !benefitVision) return false;
    return true;
  }

  function getBenefitFormError(): string | null {
    if (!benefitInsurer.trim()) return "Insurance provider is required.";
    if (!benefitExtMed && !benefitDental && !benefitVision) return "Select at least one coverage option.";
    return null;
  }

  async function deleteBenefitRecord(benefitId: string) {
    if (!(await appConfirm("Delete this benefits record?"))) return;
    try {
      await apiFetch(`/api/employees/${id}/benefits/${benefitId}`, { method: "DELETE" });
      setBenefits((prev) => prev.filter((b) => b.id !== benefitId));
    } catch { /* ignore */ }
  }

  function isDriverLicenseFormValid() {
    const trimmedNumber = dlNumber.trim();
    if (!trimmedNumber || !isValidDrivingLicense(trimmedNumber)) return false;
    if (!dlType.trim()) return false;
    if (!dlIssue || !dlExpiry) return false;
    if (!dlIssuingCountry.trim()) return false;
    const today = dateInputMaxTodayLocal();
    if (dlIssue > today) return false;
    if (dlExpiry < dlIssue) return false;
    return true;
  }

  function openDlModal(item?: DriverLicenseItem) {
    if (item) {
      setEditingDl(item);
      setDlNumber(item.number ?? "");
      setDlType(item.licenseType ?? "");
      setDlIssue(item.issueDate ? item.issueDate.split("T")[0] : "");
      setDlExpiry(item.expiryDate ? item.expiryDate.split("T")[0] : "");
      setDlIssuingCountry(item.issuingCountry ?? "");
    } else {
      setEditingDl(null);
      setDlNumber("");
      setDlType("");
      setDlIssue("");
      setDlExpiry("");
      setDlIssuingCountry("");
    }
    setShowDlModal(true);
    setShowDlValidationErrors(false);
  }

  function closeDlModal() {
    setShowDlModal(false);
    setEditingDl(null);
    setShowDlValidationErrors(false);
  }

  async function saveDriverLicense() {
    if (!isDriverLicenseFormValid()) {
      setShowDlValidationErrors(true);
      const trimmedNumber = dlNumber.trim();
      if (!trimmedNumber) {
        await appAlert("Driver's license number is required.");
        return;
      }
      if (!isValidDrivingLicense(trimmedNumber)) {
        await appAlert(DRIVING_LICENSE_VALIDATION_MESSAGE);
        return;
      }
      if (!dlType.trim()) {
        await appAlert("License type is required.");
        return;
      }
      if (!dlIssue) {
        await appAlert("Issue date is required.");
        return;
      }
      if (!dlExpiry) {
        await appAlert("Expiry date is required.");
        return;
      }
      if (!dlIssuingCountry.trim()) {
        await appAlert("Issuing country is required.");
        return;
      }
      const today = dateInputMaxTodayLocal();
      if (dlIssue > today) {
        await appAlert("Issue date cannot be in the future.");
        return;
      }
      if (dlExpiry < dlIssue) {
        await appAlert("Expiry date cannot be before issue date.");
        return;
      }
      return;
    }
    setDlSaving(true);
    try {
      const body = {
        number: dlNumber.trim(),
        licenseType: dlType.trim(),
        issueDate: dlIssue,
        expiryDate: dlExpiry,
        issuingCountry: dlIssuingCountry.trim(),
      };
      if (editingDl) {
        await apiFetch<DriverLicenseItem>(`/api/employees/${id}/driver-licenses/${editingDl.id}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await apiFetch<DriverLicenseItem>(`/api/employees/${id}/driver-licenses`, { method: "POST", body: JSON.stringify(body) });
      }
      const refreshed = await apiFetch<DriverLicenseItem[]>(`/api/employees/${id}/driver-licenses`);
      setDriverLicenses(refreshed);
      syncEmpDriverLicenseFromList(refreshed);
      closeDlModal();
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Failed to save driver's license");
    } finally {
      setDlSaving(false);
    }
  }

  async function deleteDriverLicense(licenseId: string) {
    if (!(await appConfirm("Delete this driver's license record?"))) return;
    try {
      await apiFetch(`/api/employees/${id}/driver-licenses/${licenseId}`, { method: "DELETE" });
      const refreshed = await apiFetch<DriverLicenseItem[]>(`/api/employees/${id}/driver-licenses`);
      setDriverLicenses(refreshed);
      syncEmpDriverLicenseFromList(refreshed);
    } catch { /* ignore */ }
  }

  function resetImmAttachmentDraft() {
    setImmDocFile(null);
    setImmDocDesc("");
    if (immDocFileRef.current) immDocFileRef.current.value = "";
  }

  function openImmModal(imm?: ImmigrationItem) {
    resetImmAttachmentDraft();
    if (imm) {
      setEditingImm(imm);
      setImmDocType(imm.documentType);
      setImmNumber(sanitizePassportNumberInput(imm.number));
      setImmIssuedBy(imm.issuedBy ?? "");
      setImmIssuedDate(imm.issuedDate ? new Date(imm.issuedDate).toISOString().split("T")[0] : "");
      setImmExpiryDate(imm.expiryDate ? new Date(imm.expiryDate).toISOString().split("T")[0] : "");
      setImmComments(imm.comments ?? "");
    } else {
      setEditingImm(null);
      setImmDocType("Passport");
      setImmNumber("");
      setImmIssuedBy("");
      setImmIssuedDate("");
      setImmExpiryDate("");
      setImmReviewDate("");
      setImmComments("");
    }
    setShowImmModal(true);
  }

  function closeImmModal() {
    setShowImmModal(false);
    setEditingImm(null);
    resetImmAttachmentDraft();
  }

  function openImmViewModal(imm: ImmigrationItem) {
    setViewingImm(imm);
    setShowImmViewModal(true);
  }

  function closeImmViewModal() {
    setShowImmViewModal(false);
    setViewingImm(null);
  }

  async function uploadImmigrationAttachment() {
    if (!immDocFile) return;
    const fd = new FormData();
    fd.append("file", immDocFile);
    if (immDocDesc.trim()) fd.append("description", immDocDesc.trim());
    const res = await fetch(`${getApiBaseUrl()}/api/employees/${id}/immigration-documents`, {
      method: "POST",
      body: fd,
      headers: { Authorization: `Bearer ${localStorage.getItem("auth_token") || ""}` },
    });
    if (!res.ok) throw new Error("Upload failed");
    const created = await res.json();
    setImmDocs((prev) => [created, ...prev]);
    resetImmAttachmentDraft();
  }

  async function saveImmigration() {
    const trimmedNumber = sanitizePassportNumberInput(immNumber.trim());
    const eligibleDate = calculateImmigrationEligibleDate(immDocType, immIssuedDate, immExpiryDate) ?? "";
    if (!isImmigrationFormValid(immDocType, immNumber, immIssuedDate, immExpiryDate, eligibleDate)) {
      if (!immIssuedDate || !immExpiryDate || !eligibleDate) {
        await appAlert("Issued Date, Expiry Date, and Available Date are required.");
        return;
      }
      await appAlert(PASSPORT_NUMBER_VALIDATION_MESSAGE);
      return;
    }
    setImmSaving(true);
    try {
      const body = {
        documentType: immDocType,
        number: trimmedNumber,
        issuedBy: immIssuedBy || null,
        issuedDate: immIssuedDate,
        expiryDate: immExpiryDate,
        eligibleReviewDate: eligibleDate,
        eligibleStatus: editingImm?.eligibleStatus ?? null,
        comments: immComments || null,
      };
      if (editingImm) {
        const updated = await apiFetch<ImmigrationItem>(`/api/employees/${id}/immigrations/${editingImm.id}`, { method: "PUT", body: JSON.stringify(body) });
        setImmigrations((prev) => prev.map((i) => (i.id === editingImm.id ? updated : i)));
      } else {
        const created = await apiFetch<ImmigrationItem>(`/api/employees/${id}/immigrations`, { method: "POST", body: JSON.stringify(body) });
        setImmigrations((prev) => [created, ...prev]);
      }
      if (immDocFile) await uploadImmigrationAttachment();
      closeImmModal();
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Failed to save immigration record");
    } finally {
      setImmSaving(false);
    }
  }

  async function deleteImmigration(immId: string) {
    if (!(await appConfirm("Delete this immigration record?"))) return;
    try {
      await apiFetch(`/api/employees/${id}/immigrations/${immId}`, { method: "DELETE" });
      setImmigrations((prev) => prev.filter((i) => i.id !== immId));
    } catch { /* ignore */ }
  }

  async function deleteImmDoc(docId: string) {
    if (!(await appConfirm("Delete this document?"))) return;
    try {
      await apiFetch(`/api/employees/${id}/immigration-documents/${docId}`, { method: "DELETE" });
      setImmDocs((prev) => prev.filter((d) => d.id !== docId));
    } catch { /* ignore */ }
  }

  async function openImmigrationDocumentFile(docId: string) {
    setImmDocOpeningId(docId);
    try {
      const blob = await apiFetchBlob(`/api/employees/${id}/immigration-documents/${docId}/download`);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Could not open the document.");
    } finally {
      setImmDocOpeningId(null);
    }
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
    setShowWeValidationErrors(false);
    setWeFormError(null);
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
    setShowWeValidationErrors(false);
    setWeFormError(null);
  }

  async function saveWorkExperience() {
    setWeFormError(null);
    if (!isValidAddressText(weCompany, true) || !isValidAddressText(weJobTitle, true) || !weEmploymentType.trim()) {
      setShowWeValidationErrors(true);
      setWeFormError("Company, job title, and employment type are required.");
      return;
    }
    const today = dateInputMaxTodayLocal();
    if (weFromDate && weFromDate > today) {
      setWeFormError("Work experience start date cannot be in the future.");
      return;
    }
    if (weToDate && weToDate > today) {
      setWeFormError("Work experience end date cannot be in the future.");
      return;
    }
    if (weFromDate && weToDate && weToDate < weFromDate) {
      setWeFormError("End date must be on or after the start date.");
      return;
    }
    setShowWeValidationErrors(false);
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
      await appAlert(err instanceof Error ? err.message : "Failed to save work experience");
    } finally {
      setWeSaving(false);
    }
  }

  async function deleteWorkExperience(weId: string) {
    if (!(await appConfirm("Delete this work experience?"))) return;
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
    const accountNumber = baAccountNumber.trim();
    if (!accountNumber || !/^\d+$/.test(accountNumber)) return;
    setBaSaving(true);
    const body = {
      accountNumber,
      bankName: baBankName.trim() || null,
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
      await appAlert(err instanceof Error ? err.message : "Failed to save bank account");
    } finally {
      setBaSaving(false);
    }
  }

  async function deleteBankAccount(baId: string) {
    if (!(await appConfirm("Delete this bank account?"))) return;
    try {
      await apiFetch(`/api/employees/${id}/bank-accounts/${baId}`, { method: "DELETE" });
      setBankAccounts((prev) => prev.filter((b) => b.id !== baId));
    } catch { /* ignore */ }
  }

  async function handleTerminate() {
    if (!emp || !termReason.trim() || !termDate) return;
    setTermSaving(true);
    try {
      await apiFetch(`/api/employees/${id}/terminate`, {
        method: "POST",
        body: JSON.stringify({
          terminationDate: termDate,
          terminationReason: termReason.trim(),
          terminationNote: termNote || null,
          withOffboarding,
          templateId: withOffboarding && selectedTemplateId ? selectedTemplateId : null,
        }),
      });
      setShowTerminateModal(false);
      load();
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Failed to terminate");
    } finally {
      setTermSaving(false);
    }
  }

  async function handleDeleteEmployee() {
    if (!emp) return;
    setDeleteSaving(true);
    try {
      await apiFetch(`/api/employees/${id}`, { method: "DELETE" });
      setShowDeleteModal(false);
      router.push(ROUTES.people);
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Failed to delete employee");
    } finally {
      setDeleteSaving(false);
    }
  }

  async function handleReactivate() {
    if (!emp) return;
    setReactSaving(true);
    try {
      const newEmploymentType = defaultEmploymentTypeCode(employmentTypes);
      const newJoinDate = reactUpdateJoinDate ? reactDate : emp.joinDate;
      const payload = {
        ...buildEmployeePutPayload(emp),
        joinDate: newJoinDate,
        status: "Active",
        employmentType: newEmploymentType,
        terminationDate: null,
      };
      await apiFetch(`/api/employees/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setShowReactivateModal(false);
      load();
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Failed to reactivate");
    } finally {
      setReactSaving(false);
    }
  }

  async function downloadDocPdf(templateKey: string, docName: string) {
    try {
      const res = await apiFetch<{ html: string }>(`/api/documenttemplates/render/${templateKey}/${id}`);
      const filename = `${docName.replace(/\s+/g, "_")}_${emp?.employeeCode ?? "EMP"}.pdf`;
      const printWin = window.open("", "_blank");
      if (!printWin) { await appAlert("Please allow pop-ups to download PDF"); return; }
      printWin.document.write(`
        <html><head><title>${filename}</title></head>
        <body>${res.html}</body></html>
      `);
      printWin.document.close();
      printWin.onload = () => { printWin.print(); };
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Failed to generate document");
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
      await appAlert(err instanceof Error ? err.message : "Failed to generate document");
    }
  }

  function fmtFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}kB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
  }

  function openPhotoModal() {
    const currentUrl = resolveAssetUrl(emp?.profileImageUrl);
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
      const endpoint = `/api/employees/${emp.id}/photo`;
      const res = await fetch(`${getApiBaseUrl()}${endpoint}`, {
        method: "POST",
        body: formData,
        headers: { Authorization: `Bearer ${localStorage.getItem("auth_token") || ""}` },
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(resolveHttpErrorMessage(errText, {
          status: res.status,
          endpoint,
          backendUrl: getApiBaseUrl(),
        }));
      }
      const data = await res.json() as { profileImageUrl: string };
      setEmp({ ...emp, profileImageUrl: data.profileImageUrl });
      window.dispatchEvent(new CustomEvent("opensky:profile-image-updated"));
      setShowPhotoModal(false);
      setPhotoFile(null);
      setPhotoPreview(null);
      setMsg({ type: "ok", text: "Profile photo updated." });
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : "Unknown error";
      setMsg({ type: "err", text: `Failed to upload photo: ${detail}` });
    } finally { setPhotoSaving(false); }
  }

  async function saveEpfEtf(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!emp) return;
    const epf = sanitizeEpfInput(epfNumber.trim());
    const etf = sanitizeEtfInput(etfNumber.trim());
    if ((epf && !isValidEpfNumber(epf)) || (etf && !isValidEtfNumber(etf))) {
      setShowIdValidationErrors(true);
      setMsg({
        type: "err",
        text: epf && !isValidEpfNumber(epf) ? EPF_VALIDATION_MESSAGE : ETF_VALIDATION_MESSAGE,
      });
      return;
    }
    setShowIdValidationErrors(false);
    setEpfSaving(true);
    setMsg(null);
    try {
      const payload = buildEmployeePutPayload(emp, {
        epfNumber: epf || null,
        etfNumber: etf || null,
      });
      const updated = await apiFetch<EmployeeDetail>(`/api/employees/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setEmp(updated);
      setEpfNumber(updated.epfNumber ?? "");
      setEtfNumber(updated.etfNumber ?? "");
      setMsg({ type: "ok", text: "EPF / ETF details saved." });
    } catch (err) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Failed to save EPF / ETF details." });
    } finally {
      setEpfSaving(false);
    }
  }

  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!emp) return;
    setSaving(true); setMsg(null);
    const fd = new FormData(e.currentTarget);
    const payload = buildEmployeePutPayloadFromForm(emp, fd);

    const workEmail = displayWorkEmail((payload.email as string) ?? "");
    const personalEmail = ((payload.otherEmail as string) ?? "").trim();
    const savingTab = pageTab;

    const fieldChanged = (next: string | null | undefined, current: string | null | undefined) =>
      (next ?? "").trim().toLowerCase() !== (current ?? "").trim().toLowerCase();

    if (savingTab === "contactDetails") {
      const phoneFields = [
        { label: "Home telephone", value: sanitizePhoneInput(((payload.homeTelephone as string) ?? "").trim()), current: emp.homeTelephone },
        { label: "Mobile phone", value: sanitizePhoneInput(((payload.phone as string) ?? "").trim()), current: emp.phone },
        { label: "Work telephone", value: sanitizePhoneInput(((payload.workTelephone as string) ?? "").trim()), current: emp.workTelephone },
      ];
      for (const phone of phoneFields) {
        if (!fieldChanged(phone.value, phone.current)) continue;
        if (phone.value && !isValidPhone(phone.value)) {
          setSaving(false);
          setMsg({ type: "err", text: `${phone.label}: ${PHONE_VALIDATION_MESSAGE}` });
          return;
        }
      }

      if (fieldChanged(workEmail, displayWorkEmail(emp.email)) && workEmail && !isValidEmailInput(workEmail)) {
        setSaving(false);
        setMsg({ type: "err", text: `Work Email: ${EMAIL_INPUT_VALIDATION_MESSAGE}` });
        return;
      }
      if (fieldChanged(personalEmail, emp.otherEmail) && personalEmail && !isValidEmailInput(personalEmail)) {
        setSaving(false);
        setMsg({ type: "err", text: `Personal Email: ${EMAIL_INPUT_VALIDATION_MESSAGE}` });
        return;
      }
      if (fieldChanged(workEmail, displayWorkEmail(emp.email)) && workEmail && !isValidEmailFormat(workEmail)) {
        setSaving(false);
        setMsg({ type: "err", text: `Work Email: ${EMAIL_FORMAT_VALIDATION_MESSAGE}` });
        return;
      }
      if (fieldChanged(personalEmail, emp.otherEmail) && personalEmail && !isValidEmailFormat(personalEmail)) {
        setSaving(false);
        setMsg({ type: "err", text: `Personal Email: ${EMAIL_FORMAT_VALIDATION_MESSAGE}` });
        return;
      }

      const addressError = validateEmployeeAddressFieldsIfChanged({
        addressStreet1: (payload.addressStreet1 as string) ?? null,
        addressStreet2: (payload.addressStreet2 as string) ?? null,
        city: (payload.city as string) ?? null,
        zipPostalCode: (payload.zipPostalCode as string) ?? null,
        pollingDivision: (payload.pollingDivision as string) ?? null,
        distanceToOffice: (payload.distanceToOffice as string) ?? null,
        permanentStreet1: (payload.permanentStreet1 as string) ?? null,
        permanentStreet2: (payload.permanentStreet2 as string) ?? null,
        permanentCity: (payload.permanentCity as string) ?? null,
        permanentZipPostalCode: (payload.permanentZipPostalCode as string) ?? null,
        permanentPollingDivision: (payload.permanentPollingDivision as string) ?? null,
        permanentDistanceToOffice: (payload.permanentDistanceToOffice as string) ?? null,
      }, {
        addressStreet1: emp.addressStreet1,
        addressStreet2: emp.addressStreet2,
        city: emp.city,
        zipPostalCode: emp.zipPostalCode,
        pollingDivision: emp.pollingDivision,
        distanceToOffice: emp.distanceToOffice,
        permanentStreet1: emp.permanentStreet1,
        permanentStreet2: emp.permanentStreet2,
        permanentCity: emp.permanentCity,
        permanentZipPostalCode: emp.permanentZipPostalCode,
        permanentPollingDivision: emp.permanentPollingDivision,
        permanentDistanceToOffice: emp.permanentDistanceToOffice,
      });
      if (addressError) {
        setSaving(false);
        setShowAddressValidationErrors(true);
        setMsg({ type: "err", text: addressError });
        return;
      }
      setShowAddressValidationErrors(false);
      Object.assign(payload, sanitizeEmployeeAddressFields({
        addressStreet1: payload.addressStreet1 as string | null,
        addressStreet2: payload.addressStreet2 as string | null,
        city: payload.city as string | null,
        zipPostalCode: payload.zipPostalCode as string | null,
        pollingDivision: payload.pollingDivision as string | null,
        distanceToOffice: payload.distanceToOffice as string | null,
        permanentStreet1: payload.permanentStreet1 as string | null,
        permanentStreet2: payload.permanentStreet2 as string | null,
        permanentCity: payload.permanentCity as string | null,
        permanentZipPostalCode: payload.permanentZipPostalCode as string | null,
        permanentPollingDivision: payload.permanentPollingDivision as string | null,
        permanentDistanceToOffice: payload.permanentDistanceToOffice as string | null,
      }));
    }

    if (savingTab === "personal") {
      const nic = ((payload.nationalId as string) ?? "").trim();
      const tin = sanitizeTinInput(((payload.tinNumber as string) ?? "").trim());
      if (fieldChanged(nic, emp.nationalId) && nic && !isValidNic(nic)) {
        setSaving(false);
        setShowIdValidationErrors(true);
        setMsg({ type: "err", text: NIC_VALIDATION_MESSAGE });
        return;
      }
      if (fieldChanged(tin, emp.tinNumber) && tin && !isValidTin(tin)) {
        setSaving(false);
        setShowIdValidationErrors(true);
        setMsg({ type: "err", text: TIN_VALIDATION_MESSAGE });
        return;
      }
      setShowIdValidationErrors(false);
      payload.tinNumber = tin || null;
    }

    if (savingTab === "job") {
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
    }

    // Send "" (not null) when no work email — null fails ASP.NET binding on UpdateEmployeeDto.Email.
    payload.email = workEmail;
    if (savingTab !== "personal") {
      payload.tinNumber = sanitizeTinInput(((payload.tinNumber as string) ?? "").trim()) || null;
    }

    try {
      const updated = await apiFetch<EmployeeDetail>(`/api/employees/${id}`, { method: "PUT", body: JSON.stringify(payload) });
      setEmp(updated);
      void loadLifecycleTimeline();
      const successByTab: Partial<Record<PageTab, string>> = {
        job: "Job details updated successfully.",
        contactDetails: "Contact details updated successfully.",
        personal: "Personal details updated successfully.",
      };
      setMsg({ type: "ok", text: successByTab[savingTab] ?? "Updated successfully." });
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

  const lifecycleMilestones = lifecycleTimeline?.milestones ?? [];
  const lifecycleRoleHistory = lifecycleTimeline?.roleHistory ?? [];

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
  const inputDisabledClass =
    "w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2.5 text-sm text-slate-500 shadow-none outline-none";

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

  function renderEmployeeLifecycleMain(employee: EmployeeDetail) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
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
              {lifecycleLoading && (
                <p className="text-xs text-slate-500">Loading lifecycle history…</p>
              )}
              <ul className="space-y-0">
                {lifecycleMilestones.map((m, idx) => (
                  <li key={m.id} className="flex gap-3">
                    <div className="flex w-4 shrink-0 flex-col items-center pt-1">
                      <span className="h-2.5 w-2.5 rounded-full border-2 border-white bg-sky-500 shadow ring-1 ring-sky-200" />
                      {idx < lifecycleMilestones.length - 1 && (
                        <span className="mt-1 min-h-[2.25rem] w-0 flex-1 border-l-2 border-slate-200" aria-hidden />
                      )}
                    </div>
                    <div className={`min-w-0 flex-1 ${idx < lifecycleMilestones.length - 1 ? "pb-5" : ""}`}>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        {m.eventTypeLabel}
                      </div>
                      <div className="text-sm font-semibold text-slate-800">{fmtDateDisplay(m.eventDate)}</div>
                      {m.summary && <p className="mt-0.5 text-xs leading-snug text-slate-500">{m.summary}</p>}
                    </div>
                  </li>
                ))}
                {!lifecycleLoading && lifecycleMilestones.length === 0 && (
                  <li className="text-xs text-slate-500">No milestones yet.</li>
                )}
              </ul>
              <div className="mt-5 border-t border-slate-100 pt-4">
                <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-600">
                  <SectionIcon path="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" color="bg-violet-500" />
                  Role &amp; org history
                </h4>
                <ul className="space-y-0">
                  {lifecycleRoleHistory.map((row, idx) => (
                    <li key={row.id} className="flex gap-3">
                      <div className="flex w-4 shrink-0 flex-col items-center pt-1">
                        <span
                          className={`h-2.5 w-2.5 rounded-full border-2 border-white shadow ring-1 ${
                            row.isCurrentRole
                              ? "bg-violet-600 ring-violet-200"
                              : "bg-violet-300 ring-violet-100"
                          }`}
                        />
                        {idx < lifecycleRoleHistory.length - 1 && (
                          <span className="mt-1 min-h-[2.25rem] w-0 flex-1 border-l-2 border-slate-200" aria-hidden />
                        )}
                      </div>
                      <div className={`min-w-0 flex-1 ${idx < lifecycleRoleHistory.length - 1 ? "pb-5" : ""}`}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                            {row.eventTypeLabel}
                          </span>
                          {row.isCurrentRole && (
                            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-800">
                              Latest
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-[15px] font-semibold leading-snug text-slate-900">{row.title}</div>
                        <div className="mt-1 text-xs font-medium text-slate-600">{fmtDateDisplay(row.eventDate)}</div>
                        {row.summary && (
                          <p className="mt-1.5 text-[11px] leading-snug text-slate-600">{row.summary}</p>
                        )}
                      </div>
                    </li>
                  ))}
                  {!lifecycleLoading && lifecycleRoleHistory.length === 0 && (
                    <li className="text-xs text-slate-500">No role or org changes yet.</li>
                  )}
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
                  {!hasAnyReportsTo ? (
                    <InfoRow label="Reports to" value="—" />
                  ) : (
                    <>
                      {reportsToByMethod.direct.length > 0 && (
                        <div className="flex py-0.5">
                          <span className="w-24 shrink-0 text-xs text-slate-400">Direct:</span>
                          <div className="text-xs font-medium text-slate-700">
                            {reportsToByMethod.direct.map((name, index) => (
                              <div key={`direct-${name}-${index}`}>{name}</div>
                            ))}
                          </div>
                        </div>
                      )}
                      {reportsToByMethod.indirect.length > 0 && (
                        <div className="flex py-0.5">
                          <span className="w-24 shrink-0 text-xs text-slate-400">Indirect:</span>
                          <div className="text-xs font-medium text-slate-700">
                            {reportsToByMethod.indirect.map((name, index) => (
                              <div key={`indirect-${name}-${index}`}>{name}</div>
                            ))}
                          </div>
                        </div>
                      )}
                      {reportsToByMethod.both.length > 0 && (
                        <div className="flex py-0.5">
                          <span className="w-24 shrink-0 text-xs text-slate-400">Both:</span>
                          <div className="text-xs font-medium text-slate-700">
                            {reportsToByMethod.both.map((name, index) => (
                              <div key={`both-${name}-${index}`}>{name}</div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  <div className="mt-2 border-t border-slate-200/80 pt-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Responsibilities
                    </div>
                    {employee.jobTitleDescription && employee.jobTitleDescription.trim().length > 0 ? (
                      <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-slate-700">
                        {employee.jobTitleDescription.trim()}
                      </p>
                    ) : (
                      <p className="mt-1.5 text-xs text-slate-500">
                        No description. Set under{" "}
                        <span className="font-medium text-slate-600">Organization → Job titles</span>.
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
          className="mt-auto w-full rounded-lg border border-slate-200 py-2 pt-4 text-xs font-semibold text-slate-600 transition hover:border-sky-300 hover:bg-sky-50/60 hover:text-sky-800"
        >
          Open Job &amp; organization tab
        </button>
      </div>
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
      </div>

      <FlashMessageBanner msg={msg} onClear={() => setMsg(null)} />

      {/* ══════════════════════════════════════════════════
          TAB: PROFILE — About card + Quick Access + widgets
         ══════════════════════════════════════════════════ */}
      {isProfileTab && (
        <div className="grid items-stretch gap-5 lg:grid-cols-2">
          {/* Left column stack */}
          {(wOn("about") || (wOn("lifecycle") && !wOn("about"))) && (
            <div className="flex h-full min-w-0 flex-col gap-3">
          {/* ABOUT CARD */}
          {wOn("about") && (
            <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className={sectionCardHeaderRowSm}>
                <div className="flex items-center gap-2"><SectionIcon path="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" color="bg-slate-600" /><h2 className="text-[15px] font-bold text-slate-700">About</h2></div>
              </div>
              <div className="flex min-h-0 flex-1 flex-col p-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-start">
                  {/* Avatar */}
                  <div className="flex w-[132px] shrink-0 flex-col items-center text-center sm:w-[148px]">
                    <button type="button" onClick={openPhotoModal} className="relative group cursor-pointer">
                      {emp.profileImageUrl ? (
                        <img src={resolveAssetUrl(emp.profileImageUrl) ?? ""} alt={emp.fullName} className="h-[104px] w-[104px] rounded-full border-4 border-slate-100 object-cover sm:h-[112px] sm:w-[112px]" />
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
                        <InfoRow label="Fingerprint ID" value={emp.fingerprintId ?? "—"} />
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
                        <InfoRow label="Email" value={displayWorkEmail(emp.email) || "—"} />
                      </div>
                    </div>
                  </div>
                </div>

                {wOn("lifecycle") && (
                  <div className="mt-5 flex min-h-0 flex-1 flex-col border-t border-slate-100 pt-4">
                    {renderEmployeeLifecycleHeader()}
                    <div className="flex min-h-0 flex-1 flex-col pt-2">
                      {renderEmployeeLifecycleMain(emp)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}


          {wOn("lifecycle") && !wOn("about") && (
            <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
              {renderEmployeeLifecycleHeader()}
              <div className="flex min-h-0 flex-1 flex-col p-4">
                {renderEmployeeLifecycleMain(emp)}
              </div>
            </div>
          )}

            </div>
          )}

          {(wOn("quickAccess") || wOn("birthdaysNotices") || wOn("pendingLifecycleTasks")) && (
            <div className="flex h-full min-w-0 flex-col gap-5">
              {/* QUICK ACCESS */}
              {wOn("quickAccess") && (
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className={sectionCardHeaderRowSm}>
                    <div className="flex items-center gap-2"><SectionIcon path="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" color="bg-slate-600" /><h2 className="text-[15px] font-bold text-slate-700">Quick Access</h2></div>
                    <WidgetGear onRemove={() => removeWidget("quickAccess")} />
                  </div>
                  <div className="space-y-0.5 p-3">
                    {[
                      {
                        label: "Career Development",
                        sub: "Individual Development Plans",
                        bg: "bg-amber-500",
                        icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
                        href: `${ROUTES.learning}?tab=assignments&employeeId=${id}`,
                      },
                      {
                        label: "Discipline",
                        sub: "Disciplinary Cases",
                        bg: "bg-red-500",
                        icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
                        href: `${ROUTES.employeeActions}?type=Warning&employeeId=${id}`,
                      },
                    ].map((item) => (
                      <button
                        key={item.sub}
                        type="button"
                        onClick={() => router.push(item.href)}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50"
                      >
                        <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${item.bg}`}><svg className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={item.icon}/></svg></div>
                        <div><div className="text-[10px] font-medium text-slate-400">{item.label}</div><div className="text-xs font-semibold text-slate-700">{item.sub}</div></div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {wOn("birthdaysNotices") && (
                <div id="birthdays-notices" className="min-w-0 scroll-mt-28">
                  <BirthdaysCompanyNoticesWidget />
                </div>
              )}

              {wOn("pendingLifecycleTasks") && (
                <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
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
                              <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-1.5">
                                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                                  {rows.length} pending
                                </span>
                                {rows.length === 0 ? (
                                  <span className="text-xs text-slate-400">No pending tasks.</span>
                                ) : null}
                              </div>
                              {rows.length > 0 ? (
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
                              ) : null}
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

          {/* LEAVE BALANCE */}
          {wOn("leaveBalance") && (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
              <div className={sectionCardHeaderRowSm}>
                <div className="flex items-center gap-2">
                  <SectionIcon path="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" color="bg-indigo-500" />
                  <h2 className="text-[15px] font-bold text-slate-700">Leave Balance</h2>
                </div>
                <WidgetGear onRemove={() => removeWidget("leaveBalance")} />
              </div>
              <div className="p-4">
                {leaveBalanceLoading ? (
                  <p className="py-4 text-center text-xs text-slate-400">Loading leave balances…</p>
                ) : leaveBalanceRows.length === 0 ? (
                  <p className="py-4 text-center text-xs text-slate-400">
                    No leave balances assigned for {leaveBalanceYear}.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {leaveBalanceRows.map((row, index) => {
                      const used = Number(row.used) || 0;
                      const total = leaveBalanceTotalDays(row);
                      const pct = Math.min(100, (used / total) * 100);
                      return (
                        <div key={row.id}>
                          <div className="mb-1 flex items-center justify-between text-xs">
                            <span className="font-medium text-slate-600">{row.leaveTypeName}</span>
                            <span className="text-slate-400">
                              {used}/{total} used · {Number(row.remaining) || 0} left
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full ${leaveBalanceBarColor(row.leaveTypeName, index)}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <p className="mt-4 text-center text-[11px] text-slate-400">
                  Data from Leave module · {leaveBalanceYear}
                </p>
              </div>
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
              <EmployeeTimesheetsWidget
                employeeId={id}
                shiftPatternName={emp?.shiftPatternName}
                shiftPatternCode={emp?.shiftPatternCode}
              />
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
                <div><label className={labelClass}>Employee Id</label><input className={inputDisabledClass} value={emp.employeeCode} disabled aria-readonly="true" tabIndex={-1} /></div>
                <div><label className={labelClass}>Fingerprint ID</label><input name="fingerprintId" className={inputClass} defaultValue={emp.fingerprintId ?? ""} placeholder="Device PIN when different from employee id" maxLength={50} /></div>
                <div><label className={labelClass}>Other Id</label><input name="otherId" className={inputClass} defaultValue={emp.otherId ?? ""} /></div>
                <div><label className={labelClass}>NIC Number</label><NicInput name="nationalId" className={inputClass} defaultValue={emp.nationalId ?? ""} forceShowError={showIdValidationErrors} /></div>
                <div><label className={labelClass}>TIN Number</label><TinInput name="tinNumber" className={inputClass} defaultValue={emp.tinNumber ?? ""} forceShowError={showIdValidationErrors} /></div>
                <div><label className={labelClass}>First Name *</label><PersonNameInput name="firstName" required className={inputClass} value={pdFirstName} onChange={(e) => setPdFirstName(e.target.value)} /></div>
                <div><label className={labelClass}>Middle Name</label><PersonNameInput name="middleName" autoComplete="additional-name" className={inputClass} value={pdMiddleName} onChange={(e) => setPdMiddleName(e.target.value)} /></div>
                <div><label className={labelClass}>Last Name *</label><PersonNameInput name="lastName" required autoComplete="family-name" className={inputClass} value={pdLastName} onChange={(e) => setPdLastName(e.target.value)} /></div>
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
                <div>
                  <label className={labelClass}>Nationality</label>
                  <NationalityAutocompleteInput
                    name="nationality"
                    value={pdNationality}
                    onChange={setPdNationality}
                    className={inputClass}
                    placeholder="Type to search nationality…"
                  />
                </div>
                <div><label className={labelClass}>Religion</label><FormSelect name="religion" defaultValue={emp.religion ?? ""} options={RELIGION_OPTIONS} placeholder="--Select--" /></div>
                <div><label className={labelClass}>Ethnicity</label><FormSelect name="ethnicity" defaultValue={emp.ethnicity ?? ""} options={ETHNICITY_OPTIONS} placeholder="--Select--" /></div>
                <div>
                  <label className={labelClass}>Employee Status *</label>
                  <FormSelect
                    name="status"
                    required
                    disabled
                    clearable={false}
                    defaultValue={emp.status}
                    className="!cursor-not-allowed !border-slate-200 !bg-slate-100 !text-slate-500 !opacity-100 !shadow-none hover:!border-slate-200 hover:!shadow-none focus:!ring-0"
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
              <input type="hidden" name="epfNumber" value={emp.epfNumber ?? ""} />
              <input type="hidden" name="etfNumber" value={emp.etfNumber ?? ""} />
              <input type="hidden" name="email" value={displayWorkEmail(emp.email)} />
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
              <input type="hidden" name="positionId" value={emp.positionId ?? ""} />
              <input type="hidden" name="joinDate" value={fmtDate(emp.joinDate)} />
              <input type="hidden" name="employmentType" value={emp.employmentType} />
              <input type="hidden" name="probationEndDate" value={emp.probationEndDate ? fmtDate(emp.probationEndDate) : ""} />
              <input type="hidden" name="dateOfPermanency" value={emp.dateOfPermanency ? fmtDate(emp.dateOfPermanency) : ""} />
              <input type="hidden" name="terminationDate" value={emp.terminationDate ? fmtDate(emp.terminationDate) : ""} />
              <input type="hidden" name="terminationReason" value={emp.terminationReason ?? ""} />
              <input type="hidden" name="terminationNote" value={emp.terminationNote ?? ""} />
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
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      if (f.size > 10 * 1024 * 1024) {
                        await appAlert("File size must be less than 10 MB.", "File Too Large");
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
                options={addAttachmentTypeOptions}
                placeholder="-- Select attachment type --"
                clearable={false}
                required
              />
              {addAttachmentTypeOptions.length === 0 && (
                <p className="mt-1.5 text-xs text-amber-700">
                  No attachment types configured. Add them in Settings → Profile attachment types.
                </p>
              )}
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
        <form onSubmit={saveEpfEtf} className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className={sectionCardHeaderRow}>
            <div className="flex items-center gap-2.5">
              <SectionIcon path="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" color="bg-cyan-500" />
              <h2 className="text-base font-bold text-slate-800">EPF / ETF Details</h2>
            </div>
          </div>
          <div className="p-6">
            <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className={labelClass}>EPF Number</label>
                <EpfInput
                  name="epfNumber"
                  className={inputClass}
                  value={epfNumber}
                  forceShowError={showIdValidationErrors}
                  onChange={(ev) => setEpfNumber(ev.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>ETF Number</label>
                <EtfInput
                  name="etfNumber"
                  className={inputClass}
                  value={etfNumber}
                  forceShowError={showIdValidationErrors}
                  onChange={(ev) => setEtfNumber(ev.target.value)}
                />
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100/90 pt-6">
              <button type="submit" disabled={epfSaving} className="inline-flex min-w-[140px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition hover:from-indigo-500 hover:to-blue-500 hover:shadow-lg disabled:opacity-50">
                {epfSaving && <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
                {epfSaving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </form>

        {/* ── Attachments Section ── */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className={sectionCardHeaderRow}>
            <div className="flex min-w-0 items-center gap-2.5">
              <SectionIcon path="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" color="bg-cyan-500" />
              <h2 className="text-base font-bold text-slate-800">Attachments</h2>
            </div>
            <SectionRecordHeaderActions
              count={attachments.length}
              compactCountOnMobile
              addTitle="Add attachment"
              onAdd={() => {
                setAttachFile(null);
                setAttachDesc("");
                setAttachTypeId("");
                setAttachExpiry("");
                setShowAttachModal(true);
                apiFetch<AttachmentTypeItem[]>("/api/employees/profile-attachment-types")
                  .then(setAttachmentTypeMasters)
                  .catch(() => setAttachmentTypeMasters([]));
              }}
            />
          </div>

          {attachments.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-slate-400">No attachments yet.</div>
          ) : (
            <>
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
                  {attachmentsPager.pageItems.map((att) => {
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
                            options={editAttachmentTypeOptions}
                            placeholder="-- Select --"
                            clearable={false}
                            className="!h-8 min-w-0 text-xs"
                            tone="slate"
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
                              <button
                                type="button"
                                onClick={() => openAttachmentFile(att.id)}
                                disabled={attachOpeningId === att.id}
                                title="View"
                                className="text-slate-500 transition hover:text-blue-600 disabled:opacity-50"
                              >
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                              </button>
                              <a href={`${getApiBaseUrl()}/api/employees/${id}/attachments/${att.id}/download`} target="_blank" rel="noreferrer" title="Download" className="text-slate-500 transition hover:text-blue-600">
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
            <TablePagination page={attachmentsPager.page} totalPages={attachmentsPager.totalPages} totalCount={attachmentsPager.totalCount} pageSize={attachmentsPager.pageSize} onPageChange={attachmentsPager.setPage} />
            </>
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
          <div className="overflow-visible rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className={`${sectionCardHeaderRow} relative ${showDocPopover ? "z-50" : "z-10"}`}>
              <div className="flex items-center gap-2.5"><SectionIcon path="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" color="bg-indigo-500" /><h2 className="text-[15px] font-bold text-slate-700">Job Details</h2></div>
              <div ref={docPopoverRef} className="relative">
                <button type="button" onClick={() => setShowDocPopover((p) => !p)} title="Create Document" className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:border-slate-300">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                  Create Document
                </button>
                {showDocPopover && (
                  <div className="absolute right-0 top-full z-[60] mt-2 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                    <div className="border-b border-slate-100 px-4 py-2.5">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Generate Letter</span>
                    </div>
                    <div className="max-h-[min(60vh,320px)] divide-y divide-slate-50 overflow-y-auto py-1">
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
                <div><label className={labelClass}>Job Title</label><FormSelect name="jobTitleId" defaultValue={emp.jobTitleId ?? ""} placeholder="— None —" options={[{ value: "", label: "— None —" }, ...jobTitleOptions.map((j) => ({ value: j.id, label: j.name }))]} /></div>
                <div><label className={labelClass}>Department *</label><FormSelect name="departmentId" required clearable={false} defaultValue={emp.departmentId} options={departmentOptions.map((d) => ({ value: d.id, label: d.name }))} /></div>
                <div><label className={labelClass}>Employment Type *</label><FormSelect name="employmentType" required clearable={false} defaultValue={emp.employmentType} options={jobEmploymentTypeSelectOptions} /></div>
                <div><label className={labelClass}>Business Unit</label><FormSelect name="businessUnitId" defaultValue={emp.businessUnitId ?? ""} placeholder="— None —" options={[{ value: "", label: "— None —" }, ...businessUnitOptions.map((b) => ({ value: b.id, label: b.name }))]} /></div>
                <div><label className={labelClass}>Grade</label><FormSelect name="gradeId" defaultValue={emp.gradeId ?? ""} placeholder="— None —" options={[{ value: "", label: "— None —" }, ...gradeOptions.map((g) => ({ value: g.id, label: g.name }))]} /></div>
                <div><label className={labelClass}>Location</label><FormSelect name="locationId" defaultValue={emp.locationId ?? ""} placeholder="— None —" options={[{ value: "", label: "— None —" }, ...locationOptions.map((l) => ({ value: l.id, label: l.name }))]} /></div>
              </div>
              {/* Hidden fields */}
              <input type="hidden" name="firstName" value={emp.firstName} />
              <input type="hidden" name="middleName" value={emp.middleName ?? ""} />
              <input type="hidden" name="lastName" value={emp.lastName} />
              <input type="hidden" name="email" value={displayWorkEmail(emp.email)} />
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
              <input type="hidden" name="fingerprintId" value={emp.fingerprintId ?? ""} />
              <input type="hidden" name="nationalId" value={emp.nationalId ?? ""} />
              <input type="hidden" name="tinNumber" value={emp.tinNumber ?? ""} />
              <input type="hidden" name="epfNumber" value={emp.epfNumber ?? ""} />
              <input type="hidden" name="etfNumber" value={emp.etfNumber ?? ""} />
              <input type="hidden" name="driversLicenseNumber" value={emp.driversLicenseNumber ?? ""} />
              <input type="hidden" name="driversLicenseType" value={emp.driversLicenseType ?? ""} />
              <input type="hidden" name="licenseIssueDate" value={emp.licenseIssueDate ? fmtDate(emp.licenseIssueDate) : ""} />
              <input type="hidden" name="licenseExpiryDate" value={emp.licenseExpiryDate ? fmtDate(emp.licenseExpiryDate) : ""} />
              <input type="hidden" name="driversLicenseIssuingCountry" value={emp.driversLicenseIssuingCountry ?? ""} />
              <input type="hidden" name="status" value={emp.status} />
              <input type="hidden" name="managerId" value={emp.managerId ?? ""} />
              <input type="hidden" name="positionId" value={emp.positionId ?? ""} />
              <input type="hidden" name="terminationDate" value={emp.terminationDate ? fmtDate(emp.terminationDate) : ""} />
              <input type="hidden" name="terminationReason" value={emp.terminationReason ?? ""} />
              <input type="hidden" name="terminationNote" value={emp.terminationNote ?? ""} />
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

        {(() => {
          const isTerminated = emp.status === "Terminated";
          const isRetired = emp.status === "Retired";
          const canTerminate = !isTerminated && !isRetired;
          const canReactivate = isTerminated;
          const canDelete = DELETABLE_EMPLOYEE_STATUSES.has(emp.status) && (isAdmin || hasPermission("People", "Delete"));
          if (!canTerminate && !canReactivate && !canDelete) return null;

          return (
          <div className="flex flex-wrap items-center gap-3">
          {canReactivate ? (
          <div className="w-fit rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <button
              type="button"
              onClick={() => { setReactActivateNow(false); setReactUpdateJoinDate(true); setReactDate(new Date().toISOString().split("T")[0]); setReactHour("00"); setReactMinute("00"); setReactWithOnboarding(false); setShowReactivateModal(true); }}
              className="inline-flex items-center gap-2 rounded-full bg-green-500 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-600"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" /></svg>
              <span>Activate Employment</span>
            </button>
          </div>
          ) : null}

          {canTerminate ? (
          <div className="w-fit rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <button
              type="button"
              onClick={() => { setTermReason(""); setTermDate(new Date().toISOString().split("T")[0]); setTermNote(""); setWithOffboarding(true); setSelectedTemplateId(""); setShowTerminateModal(true); }}
              className="inline-flex items-center gap-2 rounded-full bg-red-500 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-600"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M22 10.5h-6m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" /></svg>
              <span>Terminate Employment</span>
            </button>
          </div>
          ) : null}

          {canDelete ? (
          <div className="w-fit rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="inline-flex items-center gap-2 rounded-full border border-red-300 bg-red-50 px-5 py-2 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-100"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
              <span>Delete Employee</span>
            </button>
          </div>
          ) : null}

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

          <Modal open={showTerminateModal} onClose={() => setShowTerminateModal(false)} title="">
            <div>
              <h3 className="text-lg font-semibold text-slate-700">Terminate Employment</h3>
              <div className="mt-3 border-t border-slate-200 pt-4">
                <label className="mb-1 block text-sm font-semibold text-slate-600">Reason<span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={termReason}
                  onChange={(e) => setTermReason(e.target.value)}
                  placeholder="Enter termination reason"
                  maxLength={100}
                  className={inputClass}
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
                  <button type="button" onClick={handleTerminate} disabled={!termReason.trim() || !termDate || termSaving} className="rounded-full bg-red-500 px-8 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-600 disabled:opacity-50">{termSaving ? "Processing..." : "Terminate"}</button>
                </div>
              </div>
            </div>
          </Modal>

          <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="">
            <div>
              <h3 className="text-lg font-semibold text-slate-700">Delete Employee</h3>
              <p className="mt-3 text-sm text-slate-600">
                Permanently remove <span className="font-semibold text-slate-800">{emp.fullName}</span> from the employee directory?
                This action cannot be undone.
              </p>
              <div className="mt-5 border-t border-slate-100 pt-4 flex items-center justify-end gap-3">
                <button type="button" onClick={() => setShowDeleteModal(false)} className="rounded-full border border-slate-300 px-6 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">Cancel</button>
                <button type="button" onClick={handleDeleteEmployee} disabled={deleteSaving} className="rounded-full bg-red-600 px-8 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50">{deleteSaving ? "Deleting..." : "Delete Employee"}</button>
              </div>
            </div>
          </Modal>
          </div>
          );
        })()}
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
                <div><label className={labelClass}>Home Telephone</label><PhoneInput name="homeTelephone" className={inputClass} defaultValue={emp.homeTelephone ?? ""} autoComplete="tel-national" /></div>
                <div><label className={labelClass}>Mobile</label><PhoneInput name="phone" className={inputClass} defaultValue={emp.phone ?? ""} autoComplete="tel" /></div>
                <div><label className={labelClass}>Work Telephone</label><PhoneInput name="workTelephone" className={inputClass} defaultValue={emp.workTelephone ?? ""} autoComplete="tel" /></div>
                <div><label className={labelClass}>Work Email</label><EmailInput key={`work-email-${emp.id}`} name="email" stripPlaceholderWorkEmail title="Optional. Enter a valid company email (e.g. name@company.com)" className={inputClass} defaultValue={emp.email ?? ""} placeholder="name@company.com" /></div>
                <div><label className={labelClass}>Personal Email</label><EmailInput name="otherEmail" title="Enter a valid email (e.g. name@example.com)" className={inputClass} defaultValue={emp.otherEmail ?? ""} /></div>
              </div>
            </div>
          </div>

          <EmployeeAddressSections
            values={emp}
            addrCountry={addrCountry}
            addrState={addrState}
            addrDistrict={addrDistrict}
            permCountry={permCountry}
            permState={permState}
            permDistrict={permDistrict}
            onAddrCountryChange={setAddrCountry}
            onAddrStateChange={setAddrState}
            onAddrDistrictChange={setAddrDistrict}
            onPermCountryChange={setPermCountry}
            onPermStateChange={setPermState}
            onPermDistrictChange={setPermDistrict}
            inputClass={inputClass}
            labelClass={labelClass}
            sectionCardHeaderRow={sectionCardHeaderRow}
            forceShowError={showAddressValidationErrors}
            modeOfTransportOptions={MODE_TRANSPORT_OPTIONS}
          />

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
          <input type="hidden" name="positionId" value={emp.positionId ?? ""} />
          <input type="hidden" name="joinDate" value={fmtDate(emp.joinDate)} />
          <input type="hidden" name="employmentType" value={emp.employmentType} />
          <input type="hidden" name="probationEndDate" value={emp.probationEndDate ? fmtDate(emp.probationEndDate) : ""} />
          <input type="hidden" name="dateOfPermanency" value={emp.dateOfPermanency ? fmtDate(emp.dateOfPermanency) : ""} />
          <input type="hidden" name="terminationDate" value={emp.terminationDate ? fmtDate(emp.terminationDate) : ""} />
          <input type="hidden" name="terminationReason" value={emp.terminationReason ?? ""} />
          <input type="hidden" name="terminationNote" value={emp.terminationNote ?? ""} />
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
                    <PersonNameInput value={ecName} onChange={(e) => setEcName(e.target.value)} autoComplete="name" className={inputClass} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-600">Relationship<span className="text-red-500">*</span></label>
                    <FormSelect value={ecRelationship} onValueChange={setEcRelationship} options={ecRelationshipSelectOptions} placeholder="-- Select --" />
                  </div>
                </div>
              </div>
              <div className="mt-5">
                <label className="mb-2 block text-sm font-semibold text-slate-600">Telephone<span className="text-red-500">*</span></label>
                <div className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Home</label>
                    <PhoneInput value={ecHome} onChange={(e) => setEcHome(e.target.value)} autoComplete="tel-national" className={inputClass} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Mobile</label>
                    <PhoneInput value={ecMobile} onChange={(e) => setEcMobile(e.target.value)} autoComplete="tel" className={inputClass} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Work</label>
                    <PhoneInput value={ecWork} onChange={(e) => setEcWork(e.target.value)} autoComplete="tel" className={inputClass} />
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
              <SectionRecordHeaderActions count={emergencyContacts.length} onAdd={() => openEcModal()} addTitle="Add emergency contact" />
            </div>
            {emergencyContacts.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-slate-400">No emergency contacts assigned.</div>
            ) : (
              <>
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
                    {emergencyContactsPager.pageItems.map((ec) => (
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
              <TablePagination page={emergencyContactsPager.page} totalPages={emergencyContactsPager.totalPages} totalCount={emergencyContactsPager.totalCount} pageSize={emergencyContactsPager.pageSize} onPageChange={emergencyContactsPager.setPage} />
            </>
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
                  <PersonNameInput placeholder="First Name" value={depFirstName} onChange={(e) => setDepFirstName(e.target.value)} className={inputClass} />
                  <PersonNameInput placeholder="Last Name" value={depLastName} onChange={(e) => setDepLastName(e.target.value)} autoComplete="family-name" className={inputClass + " mt-2 sm:mt-0"} />
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
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Occupation<span className="text-red-500">*</span></label>
                  <input value={depOccupation} onChange={(e) => setDepOccupation(e.target.value)} className={inputClass} required />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Organization<span className="text-red-500">*</span></label>
                  <input value={depOrganization} onChange={(e) => setDepOrganization(e.target.value)} className={inputClass} required />
                </div>
              </div>
              <div className="mt-4 border-t border-slate-100 pt-4 flex items-center justify-between">
                <span className="text-xs text-red-400">* Required</span>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={closeDepModal} className="rounded-full border border-slate-300 px-6 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">Cancel</button>
                  <button type="button" onClick={saveDependent} disabled={!depFirstName.trim() || !depLastName.trim() || !depRelationship.trim() || !depOccupation.trim() || !depOrganization.trim() || depSaving} className="rounded-full bg-green-500 px-8 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-600 disabled:opacity-50">{depSaving ? "Saving..." : "Save"}</button>
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
              <SectionRecordHeaderActions count={dependents.length} onAdd={() => openDepModal()} addTitle="Add dependent" />
            </div>
            {dependents.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-slate-400">No dependents assigned.</div>
            ) : (
              <>
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
                    {dependentsPager.pageItems.map((dep) => (
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
              <TablePagination page={dependentsPager.page} totalPages={dependentsPager.totalPages} totalCount={dependentsPager.totalCount} pageSize={dependentsPager.pageSize} onPageChange={dependentsPager.setPage} />
            </>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          TAB: QUALIFICATIONS
         ══════════════════════════════════════════════════ */}
      {pageTab === "qualifications" && (
        <div className="space-y-6 pb-4">
        <>
          {/* Add / Edit Education Modal */}
          <Modal open={showEduModal} onClose={closeEduModal} title="">
            <div>
              <h3 className="text-lg font-semibold text-slate-700">
                {editingEdu
                  ? (eduModalContext === "qualification" ? "Edit Qualification" : "Edit Education")
                  : (eduModalContext === "qualification" ? "Add Qualification" : "Add Education")}
              </h3>
              <div className="mt-3 border-t border-slate-200 pt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                {eduModalContext === "qualification" ? (
                  <>
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-sm font-semibold text-slate-600">Qualification Name<span className="text-red-500">*</span></label>
                      <input value={eduQualName} onChange={(e) => setEduQualName(e.target.value)} className={inputClass} placeholder="e.g. CIMA, BSc Computer Science" />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-600">Level</label>
                      <FormSelect value={eduLevel} onValueChange={setEduLevel} options={EDU_LEVEL_OPTIONS} placeholder="-- Select --" />
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-600">Level<span className="text-red-500">*</span></label>
                    <FormSelect value={eduLevel} onValueChange={setEduLevel} options={EDU_LEVEL_OPTIONS} placeholder="-- Select --" />
                  </div>
                )}
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
                  <FormSelect value={eduYear} onValueChange={setEduYear} options={EDU_YEAR_OPTIONS} placeholder="-- Select --" />
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
                  <button
                    type="button"
                    onClick={saveEducation}
                    disabled={(eduModalContext === "qualification" ? !eduQualName.trim() : !eduLevel.trim()) || eduSaving}
                    className="rounded-full bg-green-500 px-8 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-600 disabled:opacity-50"
                  >
                    {eduSaving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            </div>
          </Modal>

          {/* ── Qualification modals ── */}
          <Modal open={showSkillModal} onClose={closeSkillModal} title="">
            <div>
              <h3 className="text-lg font-semibold text-slate-700">{editingSkill ? "Edit Skill" : "Add Skill"}</h3>
              <div className="mt-3 border-t border-slate-200 pt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Skill<span className="text-red-500">*</span></label>
                  <ListAutocompleteInput
                    name="skillName"
                    value={skillName}
                    onChange={setSkillName}
                    options={skillCatalogNames}
                    className={inputClass}
                    placeholder={skillCatalogNames.length ? "Choose from list or type a skill" : "Type a skill name"}
                    showAllOnFocus
                    maxSuggestions={200}
                  />
                  {skillMasterList.length === 0 && (
                    <p className="mt-1.5 text-xs text-amber-700">
                      No catalog entries loaded (or none active). You can still type a skill above. To manage the shared catalog, use <strong>Settings</strong> → Master data → <strong>Skills</strong> (requires Org Structure on the API).
                    </p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Years of Experience<span className="text-red-500">*</span></label>
                  <input
                    value={skillYears}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "" || /^\d+$/.test(v)) setSkillYears(v);
                    }}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className={inputClass}
                    required
                  />
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
                  <button type="button" onClick={saveSkill} disabled={!skillName.trim() || !skillYears.trim() || skillSaving} className="rounded-full bg-green-500 px-8 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-600 disabled:opacity-50">{skillSaving ? "Saving..." : "Save"}</button>
                </div>
              </div>
            </div>
          </Modal>


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

          <Modal open={showMatrixModal} onClose={closeMatrixModal} title="">
            <div>
              <h3 className="text-lg font-semibold text-slate-700">{editingMatrix ? "Edit skill matrix entry" : "Add skill matrix entry"}</h3>
              <p className="mt-1 text-sm text-slate-500">Structured proficiency against the Learning skills catalog (shown on Learning → Skills &amp; matrix).</p>
              <div className="mt-3 border-t border-slate-200 pt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Skill{editingMatrix ? "" : <span className="text-red-500">*</span>}</label>
                  {editingMatrix ? (
                    <input value={editingMatrix.skillName} readOnly className={inputClass + " bg-slate-50 text-slate-600"} />
                  ) : (
                    <FormSelect
                      value={matrixSkillId}
                      onValueChange={setMatrixSkillId}
                      options={learningSkillsCatalog.map((s) => ({ value: s.id, label: s.category ? `${s.name} (${s.category})` : s.name }))}
                      placeholder="-- Select --"
                    />
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Proficiency (1–5)<span className="text-red-500">*</span></label>
                  <FormSelect value={matrixProficiency} onValueChange={setMatrixProficiency} options={MATRIX_PROFICIENCY_OPTIONS} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Assessed date</label>
                  <DatePickerField value={matrixAssessedAt} onChange={setMatrixAssessedAt} className={inputClass} />
                </div>
              </div>
              <div className="mt-4">
                <label className="mb-1 block text-sm font-semibold text-slate-600">Notes</label>
                <textarea value={matrixNotes} onChange={(e) => setMatrixNotes(e.target.value)} rows={3} className={inputClass + " resize-y"} placeholder="Optional assessment notes..." />
              </div>
              <div className="mt-4 border-t border-slate-100 pt-4 flex items-center justify-between">
                <span className="text-xs text-red-400">* Required</span>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={closeMatrixModal} className="rounded-full border border-slate-300 px-6 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">Cancel</button>
                  <button type="button" onClick={() => void saveMatrixEntry()} disabled={(!editingMatrix && !matrixSkillId) || !matrixProficiency || matrixSaving} className="rounded-full bg-green-500 px-8 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-600 disabled:opacity-50">{matrixSaving ? "Saving..." : "Save"}</button>
                </div>
              </div>
            </div>
          </Modal>

          <Modal open={showCertModal} onClose={closeCertModal} title="">
            <div>
              <h3 className="text-lg font-semibold text-slate-700">{editingCert ? "Edit certification" : "Add certification"}</h3>
              <p className="mt-1 text-sm text-slate-500">Assign a certification type from the Learning catalog to this employee.</p>
              <div className="mt-3 border-t border-slate-200 pt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Certification type{editingCert ? "" : <span className="text-red-500">*</span>}</label>
                  {editingCert ? (
                    <input value={editingCert.certificationName} readOnly className={inputClass + " bg-slate-50 text-slate-600"} />
                  ) : (
                    <FormSelect
                      value={certCatalogId}
                      onValueChange={setCertCatalogId}
                      options={certCatalog.map((c) => ({ value: c.id, label: c.issuingBody ? `${c.name} (${c.issuingBody})` : c.name }))}
                      placeholder="-- Select --"
                    />
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Obtained date<span className="text-red-500">*</span></label>
                  <DatePickerField value={certObtained} onChange={setCertObtained} max={certExpiry || undefined} className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Expiry date</label>
                  <DatePickerField value={certExpiry} onChange={setCertExpiry} min={certObtained || undefined} className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Certificate number</label>
                  <input value={certNumber} onChange={(e) => setCertNumber(e.target.value)} className={inputClass} placeholder="Optional reference" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Status</label>
                  <FormSelect value={certStatus} onValueChange={setCertStatus} options={CERT_STATUS_OPTIONS} />
                </div>
              </div>
              <div className="mt-4 border-t border-slate-100 pt-4 flex items-center justify-between">
                <span className="text-xs text-red-400">* Required</span>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={closeCertModal} className="rounded-full border border-slate-300 px-6 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">Cancel</button>
                  <button type="button" onClick={() => void saveCertification()} disabled={!certObtained.trim() || (!editingCert && !certCatalogId) || certSaving} className="rounded-full bg-green-500 px-8 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-600 disabled:opacity-50">{certSaving ? "Saving..." : "Save"}</button>
                </div>
              </div>
            </div>
          </Modal>

          <Modal open={showLangModal} onClose={closeLangModal} title="">
            <div>
              <h3 className="text-lg font-semibold text-slate-700">{editingLang ? "Edit Language" : "Add Language"}</h3>
              <p className="mt-1 text-xs text-slate-500">Type a language or pick from suggestions, then tick reading / writing / speaking and set fluency.</p>
              <div className="mt-3 border-t border-slate-200 pt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Language<span className="text-red-500">*</span></label>
                  <ListAutocompleteInput
                    name="langName"
                    value={langName}
                    onChange={setLangName}
                    options={LANGUAGE_CATALOG_NAMES}
                    className={inputClass}
                    placeholder="Type or choose a language"
                  />
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

          <div className={qualificationsPanelShellClass}>
          <div className={qualificationsSectionClass}>
            <div className={qualificationsSectionHeaderRow}>
              <div className="flex min-w-0 items-center gap-2">
                <SectionIcon path="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" color="bg-emerald-600" compact />
                <h2 className={qualificationsSectionTitleClass}>Qualifications</h2>
              </div>
              <SectionRecordHeaderActions count={qualificationRecords.length} onAdd={() => openEduModal(undefined, "qualification")} addTitle="Add qualification" compact />
            </div>
            {qualificationRecords.length === 0 ? (
              <div className={qualificationsEmptyClass}>No records yet</div>
            ) : (
              <>
              <div className={qualificationsTableScrollClass}>
                <table className={qualificationsTableClass}>
                  <thead className={qualificationsTheadClass}>
                    <tr className={qualificationsHeadRowClass}>
                      <th className={qualificationsThClass}>Qualification</th>
                      <th className={qualificationsThClass}>Level</th>
                      <th className={qualificationsThClass}>Institute</th>
                      <th className={qualificationsThClass}>Major</th>
                      <th className={qualificationsThClass}>Year</th>
                      <th className={qualificationsThClass}>Period</th>
                      <th className={`${qualificationsThClass} text-right`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {qualificationRecordsPager.pageItems.map((edu) => (
                      <tr key={`qual-${edu.id}`} className={qualificationsBodyRowClass}>
                        <td className={qualificationsTdPrimaryClass}>{edu.qualificationName?.trim() || "—"}</td>
                        <td className={qualificationsTdClass}>{edu.level === "Other" ? "—" : edu.level}</td>
                        <td className={qualificationsTdClass}>{edu.institute ?? "—"}</td>
                        <td className={qualificationsTdClass}>{edu.major ?? "—"}</td>
                        <td className={qualificationsTdClass}>{edu.year ?? "—"}</td>
                        <td className={qualificationsTdClass}>
                          {formatDate(edu.startDate) || "—"}
                          {" – "}
                          {edu.endDate ? formatDate(edu.endDate) : "Present"}
                        </td>
                        <td className={`${qualificationsTdClass} text-right`}>
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
              <TablePagination page={qualificationRecordsPager.page} totalPages={qualificationRecordsPager.totalPages} totalCount={qualificationRecordsPager.totalCount} pageSize={qualificationRecordsPager.pageSize} onPageChange={qualificationRecordsPager.setPage} className={qualificationsPagerClass} />
            </>
            )}
          </div>

          <div className={qualificationsSectionClass}>
            <div className={qualificationsSectionHeaderRow}>
              <div className="flex min-w-0 items-center gap-2">
                <SectionIcon path="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" color="bg-indigo-500" compact />
                <h2 className={qualificationsSectionTitleClass}>Education</h2>
              </div>
              <SectionRecordHeaderActions count={educationRecords.length} onAdd={() => openEduModal(undefined, "education")} addTitle="Add education" compact />
            </div>
            {educationRecords.length === 0 ? (
              <div className={qualificationsEmptyClass}>No records yet</div>
            ) : (
              <>
              <div className={qualificationsTableScrollClass}>
                <table className={qualificationsTableClass}>
                  <thead className={qualificationsTheadClass}>
                    <tr className={qualificationsHeadRowClass}>
                      <th className={qualificationsThClass}>Level</th>
                      <th className={qualificationsThClass}>Institute</th>
                      <th className={qualificationsThClass}>Major</th>
                      <th className={qualificationsThClass}>Year</th>
                      <th className={qualificationsThClass}>GPA/Score</th>
                      <th className={qualificationsThClass}>Period</th>
                      <th className={qualificationsThClass}>Remark</th>
                      <th className={`${qualificationsThClass} text-right`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {educationRecordsPager.pageItems.map((edu) => (
                      <tr key={edu.id} className={qualificationsBodyRowClass}>
                        <td className={qualificationsTdPrimaryClass}>{edu.level}</td>
                        <td className={qualificationsTdClass}>{edu.institute ?? "—"}</td>
                        <td className={qualificationsTdClass}>{edu.major ?? "—"}</td>
                        <td className={qualificationsTdClass}>{edu.year ?? "—"}</td>
                        <td className={qualificationsTdClass}>{edu.gpaScore ?? "—"}</td>
                        <td className={qualificationsTdClass}>
                          {formatDate(edu.startDate) || "—"}
                          {" – "}
                          {edu.endDate ? formatDate(edu.endDate) : "Present"}
                        </td>
                        <td className={qualificationsTdClass}>{edu.remark ?? "—"}</td>
                        <td className={`${qualificationsTdClass} text-right`}>
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
              <TablePagination page={educationRecordsPager.page} totalPages={educationRecordsPager.totalPages} totalCount={educationRecordsPager.totalCount} pageSize={educationRecordsPager.pageSize} onPageChange={educationRecordsPager.setPage} className={qualificationsPagerClass} />
            </>
            )}
          </div>

          <div className={qualificationsSectionClass}>
            <div className={qualificationsSectionHeaderRow}>
              <div className="flex min-w-0 items-center gap-2">
                <SectionIcon path="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" color="bg-orange-500" compact />
                <h2 className={qualificationsSectionTitleClass}>Languages</h2>
              </div>
              <SectionRecordHeaderActions count={languages.length} onAdd={() => openLangModal()} addTitle="Add language" compact />
            </div>
            {languages.length === 0 ? (
              <div className={qualificationsEmptyClass}>No records yet</div>
            ) : (
              <>
              <div className={qualificationsTableScrollClass}>
                <table className={qualificationsTableClass}>
                  <thead className={qualificationsTheadClass}>
                    <tr className={qualificationsHeadRowClass}>
                      <th className={qualificationsThClass}>Language</th>
                      <th className={qualificationsThClass}>Skill</th>
                      <th className={qualificationsThClass}>Fluency Level</th>
                      <th className={qualificationsThClass}>Comments</th>
                      <th className={`${qualificationsThClass} text-right`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {languagesPager.pageItems.map((lang) => (
                      <tr key={lang.id} className={qualificationsBodyRowClass}>
                        <td className={qualificationsTdPrimaryClass}>{lang.language}</td>
                        <td className={qualificationsTdClass}>{lang.skill}</td>
                        <td className={qualificationsTdClass}>{lang.fluencyLevel}</td>
                        <td className={`${qualificationsTdClass} max-w-xs truncate`}>{lang.comments ?? "—"}</td>
                        <td className={`${qualificationsTdClass} text-right`}>
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
              <TablePagination page={languagesPager.page} totalPages={languagesPager.totalPages} totalCount={languagesPager.totalCount} pageSize={languagesPager.pageSize} onPageChange={languagesPager.setPage} className={qualificationsPagerClass} />
            </>
            )}
          </div>

          <div className={qualificationsSectionClass}>
            <div className={qualificationsSectionHeaderRow}>
              <div className="flex min-w-0 items-center gap-2">
                <SectionIcon path="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" color="bg-amber-500" compact />
                <h2 className="text-xs font-semibold text-amber-800 sm:text-sm">Certifications</h2>
              </div>
              <SectionRecordHeaderActions count={certRows.length} onAdd={() => void openCertModal()} addTitle="Add certification" compact />
            </div>
            {certRows.length === 0 ? (
              <div className={qualificationsEmptyClass}>No records yet</div>
            ) : (
              <>
              <div className={qualificationsTableScrollClass}>
                <table className={qualificationsTableClass}>
                  <thead className={qualificationsTheadClass}>
                    <tr className={qualificationsHeadRowClass}>
                      <th className={qualificationsThClass}>Certification</th>
                      <th className={qualificationsThClass}>Obtained</th>
                      <th className={qualificationsThClass}>Expires</th>
                      <th className={qualificationsThClass}>Status</th>
                      <th className={`${qualificationsThClass} text-right`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {certRowsPager.pageItems.map((c) => (
                      <tr key={c.id} className={qualificationsBodyRowClass}>
                        <td className={qualificationsTdPrimaryClass}>{c.certificationName}</td>
                        <td className={qualificationsTdClass}>{formatDate(c.obtainedDate)}</td>
                        <td className={qualificationsTdClass}>{formatDate(c.expiryDate)}</td>
                        <td className={qualificationsTdClass}>{c.status}</td>
                        <td className={`${qualificationsTdClass} text-right`}>
                          <div className="flex items-center justify-end gap-2">
                            <button type="button" onClick={() => void openCertModal(c)} className="text-slate-500 transition hover:text-amber-600" title="Edit">
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </button>
                            <button type="button" onClick={() => void deleteCertification(c.id)} className="text-slate-400 transition hover:text-red-600" title="Delete">
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePagination page={certRowsPager.page} totalPages={certRowsPager.totalPages} totalCount={certRowsPager.totalCount} pageSize={certRowsPager.pageSize} onPageChange={certRowsPager.setPage} className={qualificationsPagerClass} />
            </>
            )}
          </div>

          <div className={qualificationsSectionClass}>
            <div className={qualificationsSectionHeaderRow}>
              <div className="flex min-w-0 items-center gap-2">
                <SectionIcon path="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" color="bg-violet-500" compact />
                <h2 className="text-xs font-semibold text-violet-800 sm:text-sm">Skill matrix (reference skills)</h2>
              </div>
              <SectionRecordHeaderActions count={matrixRows.length} onAdd={() => void openMatrixModal()} addTitle="Add skill matrix entry" compact />
            </div>
            {matrixRows.length === 0 ? (
              <div className={qualificationsEmptyClass}>No records yet</div>
            ) : (
              <>
              <div className={qualificationsTableScrollClass}>
                <table className={qualificationsTableClass}>
                  <thead className={qualificationsTheadClass}>
                    <tr className={qualificationsHeadRowClass}>
                      <th className={qualificationsThClass}>Skill</th>
                      <th className={qualificationsThClass}>Proficiency</th>
                      <th className={qualificationsThClass}>Assessed</th>
                      <th className={qualificationsThClass}>Notes</th>
                      <th className={`${qualificationsThClass} text-right`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrixRowsPager.pageItems.map((m) => (
                      <tr key={m.id} className={qualificationsBodyRowClass}>
                        <td className={qualificationsTdPrimaryClass}>{m.skillName}</td>
                        <td className={qualificationsTdClass}>{m.proficiencyLevel}</td>
                        <td className={qualificationsTdClass}>{formatDateTime(m.assessedAt)}</td>
                        <td className={`${qualificationsTdClass} max-w-xs truncate`}>{m.notes ?? "—"}</td>
                        <td className={`${qualificationsTdClass} text-right`}>
                          <div className="flex items-center justify-end gap-2">
                            <button type="button" onClick={() => void openMatrixModal(m)} className="text-slate-500 transition hover:text-amber-600" title="Edit">
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </button>
                            <button type="button" onClick={() => void deleteMatrixEntry(m.id)} className="text-slate-400 transition hover:text-red-600" title="Delete">
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePagination page={matrixRowsPager.page} totalPages={matrixRowsPager.totalPages} totalCount={matrixRowsPager.totalCount} pageSize={matrixRowsPager.pageSize} onPageChange={matrixRowsPager.setPage} className={qualificationsPagerClass} />
            </>
            )}
          </div>

          <div className={qualificationsSectionClass}>
            <div className={qualificationsSectionHeaderRow}>
              <div className="flex min-w-0 items-center gap-2">
                <SectionIcon path="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" color="bg-indigo-500" compact />
                <h2 className="text-xs font-semibold text-indigo-700 sm:text-sm">Training assignments</h2>
              </div>
              <SectionRecordHeaderActions count={trainingRows.length} onAdd={() => void openTrainAssignModal()} addTitle="Assign training" compact />
            </div>
            {trainingRows.length === 0 ? (
              <div className={qualificationsEmptyClass}>No records yet</div>
            ) : (
              <>
              <div className={qualificationsTableScrollClass}>
                <table className={qualificationsTableClass}>
                  <thead className={qualificationsTheadClass}>
                    <tr className={qualificationsHeadRowClass}>
                      <th className={qualificationsThClass}>Course</th>
                      <th className={qualificationsThClass}>Code</th>
                      <th className={qualificationsThClass}>Status</th>
                      <th className={qualificationsThClass}>Due</th>
                      <th className={qualificationsThClass}>Assigned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trainingRowsPager.pageItems.map((t) => (
                      <tr key={t.id} className={qualificationsBodyRowClass}>
                        <td className={qualificationsTdPrimaryClass}>{t.courseTitle}</td>
                        <td className={qualificationsTdClass}>{t.courseCode}</td>
                        <td className={qualificationsTdClass}>{t.status}</td>
                        <td className={qualificationsTdClass}>{formatDate(t.dueDate)}</td>
                        <td className={qualificationsTdClass}>{formatDateTime(t.assignedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePagination page={trainingRowsPager.page} totalPages={trainingRowsPager.totalPages} totalCount={trainingRowsPager.totalCount} pageSize={trainingRowsPager.pageSize} onPageChange={trainingRowsPager.setPage} className={qualificationsPagerClass} />
            </>
            )}
          </div>

          <div className={qualificationsSectionClass}>
            <div className={qualificationsSectionHeaderRow}>
              <div className="flex min-w-0 items-center gap-2">
                <SectionIcon path="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" color="bg-teal-500" compact />
                <h2 className={qualificationsSectionTitleClass}>Skills</h2>
              </div>
              <SectionRecordHeaderActions count={skills.length} onAdd={() => openSkillModal()} addTitle="Add skill" compact />
            </div>
            {skills.length === 0 ? (
              <div className={qualificationsEmptyClass}>No records yet</div>
            ) : (
              <>
              <div className={qualificationsTableScrollClass}>
                <table className={qualificationsTableClass}>
                  <thead className={qualificationsTheadClass}>
                    <tr className={qualificationsHeadRowClass}>
                      <th className={qualificationsThClass}>Skill</th>
                      <th className={qualificationsThClass}>Years of Experience</th>
                      <th className={qualificationsThClass}>Comments</th>
                      <th className={`${qualificationsThClass} text-right`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {skillsPager.pageItems.map((sk) => (
                      <tr key={sk.id} className={qualificationsBodyRowClass}>
                        <td className={qualificationsTdPrimaryClass}>{sk.skill}</td>
                        <td className={qualificationsTdClass}>{sk.yearsOfExperience ?? "—"}</td>
                        <td className={`${qualificationsTdClass} max-w-xs truncate`}>{sk.comments ?? "—"}</td>
                        <td className={`${qualificationsTdClass} text-right`}>
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
              <TablePagination page={skillsPager.page} totalPages={skillsPager.totalPages} totalCount={skillsPager.totalCount} pageSize={skillsPager.pageSize} onPageChange={skillsPager.setPage} className={qualificationsPagerClass} />
            </>
            )}
          </div>
        </div>
        </>
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
              <FormErrorAlert message={weFormError} onDismiss={() => setWeFormError(null)} className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600" />
              <div className="mt-3 border-t border-slate-200 pt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Company<span className="text-red-500">*</span></label>
                  <AddressTextInput
                    value={weCompany}
                    onChange={(e) => setWeCompany(e.target.value)}
                    className={inputClass}
                    placeholder="e.g. ABC Holdings (Pvt) Ltd"
                    forceShowError={showWeValidationErrors}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Job Title<span className="text-red-500">*</span></label>
                  <AddressTextInput
                    value={weJobTitle}
                    onChange={(e) => setWeJobTitle(e.target.value)}
                    className={inputClass}
                    placeholder="e.g. Senior Accountant"
                    forceShowError={showWeValidationErrors}
                    required
                  />
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
                  <button
                    type="button"
                    onClick={saveWorkExperience}
                    disabled={
                      !isValidAddressText(weCompany, true) ||
                      !isValidAddressText(weJobTitle, true) ||
                      !weEmploymentType.trim() ||
                      weSaving
                    }
                    className="rounded-full bg-green-500 px-8 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-600 disabled:opacity-50"
                  >
                    {weSaving ? "Saving..." : "Save"}
                  </button>
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
              <SectionRecordHeaderActions count={workExperiences.length} onAdd={() => openWeModal()} addTitle="Add work experience" />
            </div>
            {workExperiences.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-slate-400">No work experience records.</div>
            ) : (
              <>
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
                    {workExperiencesPager.pageItems.map((we) => (
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
              <TablePagination page={workExperiencesPager.page} totalPages={workExperiencesPager.totalPages} totalCount={workExperiencesPager.totalCount} pageSize={workExperiencesPager.pageSize} onPageChange={workExperiencesPager.setPage} />
            </>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          TAB: DRIVER'S LICENSE
         ══════════════════════════════════════════════════ */}
      {pageTab === "driversLicense" && (
        <div className="space-y-6">
          <Modal open={showDlModal} onClose={closeDlModal} title="">
            <div>
              <h3 className="text-lg font-semibold text-slate-700">{editingDl ? "Edit Driver's License" : "Add Driver's License"}</h3>
              <div className="mt-3 border-t border-slate-200 pt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Driver&apos;s License Number<span className="text-red-500">*</span></label>
                  <DrivingLicenseInput value={dlNumber} onChange={(e) => setDlNumber(e.target.value)} className={inputClass} forceShowError={showDlValidationErrors || showIdValidationErrors} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">License type<span className="text-red-500">*</span></label>
                  <FormSelect
                    value={dlType}
                    onValueChange={setDlType}
                    options={[
                      ...(dlType && !DRIVERS_LICENSE_TYPE_OPTIONS.some((o) => o.value === dlType)
                        ? [{ value: dlType, label: dlType }]
                        : []),
                      ...DRIVERS_LICENSE_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
                    ]}
                    placeholder="-- Select --"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Issue date<span className="text-red-500">*</span></label>
                  <DatePickerField className={inputClass} max={dateInputMaxTodayLocal()} value={dlIssue} onChange={setDlIssue} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Expiry date<span className="text-red-500">*</span></label>
                  <DatePickerField className={inputClass} min={dlIssue || undefined} value={dlExpiry} onChange={setDlExpiry} />
                </div>
                <div className="sm:col-span-2 lg:col-span-1">
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Issuing Country<span className="text-red-500">*</span></label>
                  <CountryAutocompleteInput
                    name="dlIssuingCountry"
                    value={dlIssuingCountry}
                    onChange={setDlIssuingCountry}
                    className={inputClass}
                    placeholder="Type to search country…"
                  />
                </div>
              </div>
              <div className="mt-4 border-t border-slate-100 pt-4 flex items-center justify-between">
                <span className="text-xs text-red-400">* Required</span>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={closeDlModal} className="rounded-full border border-slate-300 px-6 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">Cancel</button>
                  <button type="button" onClick={saveDriverLicense} disabled={!isDriverLicenseFormValid() || dlSaving} className="rounded-full bg-green-500 px-8 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-600 disabled:opacity-50">{dlSaving ? "Saving..." : "Save"}</button>
                </div>
              </div>
            </div>
          </Modal>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className={sectionCardHeaderRow}>
              <div className="flex items-center gap-2.5">
                <SectionIcon path="M9 12h6m-3-3v6m-7 4h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" color="bg-teal-500" />
                <h2 className="text-base font-bold text-slate-800">Driver&apos;s License Details</h2>
              </div>
              <SectionRecordHeaderActions count={driverLicenses.length} onAdd={() => openDlModal()} addTitle="Add driver's license" />
            </div>
            {driverLicenses.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-slate-400">No driver&apos;s license records added.</div>
            ) : (
              <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-semibold uppercase text-slate-400">
                      <th className="px-6 py-3">Number</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Issue date</th>
                      <th className="px-4 py-3">Expiry date</th>
                      <th className="px-4 py-3">Issuing country</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {driverLicensesPager.pageItems.map((dl) => (
                      <tr key={dl.id} className="border-b border-slate-50 transition hover:bg-slate-50">
                        <td className="px-6 py-3 font-medium text-slate-700">{dl.number || "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{dl.licenseType || "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{formatDate(dl.issueDate)}</td>
                        <td className="px-4 py-3 text-slate-600">{formatDate(dl.expiryDate)}</td>
                        <td className="px-4 py-3 text-slate-600">{dl.issuingCountry || "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button type="button" onClick={() => openDlModal(dl)} className="text-slate-500 transition hover:text-amber-600" title="Edit">
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </button>
                            <button type="button" onClick={() => deleteDriverLicense(dl.id)} className="text-slate-400 transition hover:text-red-600" title="Delete">
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePagination page={driverLicensesPager.page} totalPages={driverLicensesPager.totalPages} totalCount={driverLicensesPager.totalCount} pageSize={driverLicensesPager.pageSize} onPageChange={driverLicensesPager.setPage} />
              </>
            )}
          </div>
        </div>
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
                  <input
                    value={baAccountNumber}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "" || /^\d+$/.test(v)) setBaAccountNumber(v);
                    }}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className={inputClass}
                    required
                  />
                </div>
              </div>
              <div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Bank Name</label>
                  <ListAutocompleteInput
                    name="bankName"
                    value={baBankName}
                    onChange={setBaBankName}
                    options={baBankNameOptions}
                    className={inputClass}
                    placeholder={baBankNameOptions.length ? "Choose from list or type a bank name" : "Type a bank name"}
                    showAllOnFocus
                    maxSuggestions={200}
                  />
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
                  <button type="button" onClick={saveBankAccount} disabled={!baAccountNumber.trim() || !/^\d+$/.test(baAccountNumber.trim()) || baSaving} className="rounded-full bg-green-500 px-8 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-600 disabled:opacity-50">{baSaving ? "Saving..." : "Save"}</button>
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
              <SectionRecordHeaderActions count={bankAccounts.length} onAdd={() => openBaModal()} addTitle="Add bank account" />
            </div>
            {bankAccounts.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-slate-400">No bank accounts added.</div>
            ) : (
              <>
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
                    {bankAccountsPager.pageItems.map((ba) => (
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
              <TablePagination page={bankAccountsPager.page} totalPages={bankAccountsPager.totalPages} totalCount={bankAccountsPager.totalCount} pageSize={bankAccountsPager.pageSize} onPageChange={bankAccountsPager.setPage} />
            </>
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
                        ...buildEmployeePutPayload(emp),
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
          {!emp.isTopOfHierarchy && !(reportingDirty ? draftHasDirectSupervisor : emp.hasDirectSupervisor) && (
            <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3">
              <svg className="h-5 w-5 shrink-0 text-amber-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
              <p className="text-sm text-amber-800">No direct supervisor assigned. This employee will not be able to apply for leave until a supervisor is added or &quot;Top of Hierarchy&quot; is enabled.</p>
            </div>
          )}

          {/* Add Supervisor Modal */}
          <Modal open={showAddSupervisor} onClose={() => { setShowAddSupervisor(false); resetAddReportPersonFields(); }} title="">
            <div>
              <h3 className="text-lg font-semibold text-slate-700">Add Supervisor</h3>
              <div className="mt-3 border-t border-slate-200 pt-4">
                <label className="mb-1 block text-sm font-semibold text-slate-600">Name<span className="text-red-500">*</span></label>
                <EmployeeSearchCombobox
                  key={`reporting-supervisor-${reportingExcludeIds.join("|")}`}
                  value={addReportPersonId}
                  onPick={pickAddReportPerson}
                  placeholder="Type name or employee code…"
                  excludeEmployeeIds={reportingExcludeIds}
                />
              </div>
              <div className="mt-4">
                <label className="mb-1 block text-sm font-semibold text-slate-600">Reporting Method<span className="text-red-500">*</span></label>
                <FormSelect value={addReportMethod} onValueChange={onAddSupervisorMethodChange} options={REPORTING_METHOD_OPTIONS} placeholder="-- Select --" />
              </div>
              <p className="mt-4 text-xs text-red-400">* Required — use Save below to apply changes</p>
            </div>
          </Modal>

          {/* Add Subordinate Modal */}
          <Modal open={showAddSubordinate} onClose={() => { setShowAddSubordinate(false); resetAddReportPersonFields(); }} title="">
            <div>
              <h3 className="text-lg font-semibold text-slate-700">Add Subordinate</h3>
              <div className="mt-3 border-t border-slate-200 pt-4">
                <label className="mb-1 block text-sm font-semibold text-slate-600">Name<span className="text-red-500">*</span></label>
                <EmployeeSearchCombobox
                  key={`reporting-subordinate-${reportingExcludeIds.join("|")}`}
                  value={addReportPersonId}
                  onPick={pickAddReportPerson}
                  placeholder="Type name or employee code…"
                  excludeEmployeeIds={reportingExcludeIds}
                />
              </div>
              <div className="mt-4">
                <label className="mb-1 block text-sm font-semibold text-slate-600">Reporting Method<span className="text-red-500">*</span></label>
                <FormSelect value={addReportMethod} onValueChange={onAddSubordinateMethodChange} options={REPORTING_METHOD_OPTIONS} placeholder="-- Select --" />
              </div>
              <p className="mt-4 text-xs text-red-400">* Required — use Save below to apply changes</p>
            </div>
          </Modal>

          {/* Edit Reporting Method Modal */}
          <Modal open={showEditReportMethod} onClose={closeEditReportMethod} title="">
            <div>
              <h3 className="text-lg font-semibold text-slate-700">Edit Reporting Method</h3>
              {editReportMethodTarget && (
                <p className="mt-1 text-sm text-slate-500">{editReportMethodTarget.fullName}</p>
              )}
              <div className="mt-3 border-t border-slate-200 pt-4">
                <label className="mb-1 block text-sm font-semibold text-slate-600">
                  Reporting Method<span className="text-red-500">*</span>
                </label>
                <FormSelect
                  value={editReportMethodValue}
                  onValueChange={(value) => {
                    setEditReportMethodValue(value);
                    saveEditReportMethod(value);
                  }}
                  options={REPORTING_METHOD_ROW_OPTIONS}
                />
              </div>
              <p className="mt-4 text-xs text-red-400">* Required — use Save below to apply changes</p>
            </div>
          </Modal>

          {/* Assigned Supervisors */}
          <div className="relative rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className={sectionCardHeaderRow}>
              <h2 className="text-base font-bold text-slate-800">Assigned Supervisors</h2>
              <SectionRecordHeaderActions
                count={draftSupervisors.length}
                addTitle="Add supervisor"
                onAdd={() => { resetAddReportPersonFields(); setShowAddSupervisor(true); }}
              />
            </div>
            {draftSupervisors.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-slate-400">No supervisors assigned.</div>
            ) : (
              <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-semibold uppercase text-slate-400">
                      <th className="px-4 py-3 pl-6">Name</th>
                      <th className="px-4 py-3">Reporting Method</th>
                      <th className="px-4 py-3 text-right"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {supervisorsPager.pageItems.map((s) => (
                      <tr key={s.id} className="border-b border-slate-50 transition hover:bg-slate-50">
                        <td className="px-4 py-3 pl-6 font-medium text-slate-700">{s.fullName}</td>
                        <td className="px-4 py-3 text-slate-600">{normalizeReportingMethodValue(s.reportingMethod) || "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEditReportMethod(s, "supervisor")}
                              className="text-slate-500 transition hover:text-amber-600"
                              title="Edit reporting method"
                            >
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </button>
                            <button type="button" onClick={() => void removeSupervisorDraft(s.id)} className="text-slate-400 transition hover:text-red-600" title="Remove">
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePagination page={supervisorsPager.page} totalPages={supervisorsPager.totalPages} totalCount={supervisorsPager.totalCount} pageSize={supervisorsPager.pageSize} onPageChange={supervisorsPager.setPage} />
            </>
            )}
          </div>

          {/* Assigned Subordinates */}
          <div className="relative rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className={sectionCardHeaderRow}>
              <h2 className="text-base font-bold text-slate-800">Assigned Subordinates</h2>
              <SectionRecordHeaderActions
                count={draftSubordinates.length}
                addTitle="Add subordinate"
                onAdd={() => { resetAddReportPersonFields(); setShowAddSubordinate(true); }}
              />
            </div>
            {draftSubordinates.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-slate-400">No subordinates assigned.</div>
            ) : (
              <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-semibold uppercase text-slate-400">
                      <th className="px-4 py-3 pl-6">Name</th>
                      <th className="px-4 py-3">Reporting Method</th>
                      <th className="px-4 py-3 text-right"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {subordinatesPager.pageItems.map((s) => (
                      <tr key={s.id} className="border-b border-slate-50 transition hover:bg-slate-50">
                        <td className="px-4 py-3 pl-6 font-medium text-slate-700">{s.fullName}</td>
                        <td className="px-4 py-3 text-slate-600">{normalizeReportingMethodValue(s.reportingMethod) || "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEditReportMethod(s, "subordinate")}
                              className="text-slate-500 transition hover:text-amber-600"
                              title="Edit reporting method"
                            >
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </button>
                            <button type="button" onClick={() => void removeSubordinateDraft(s.id)} className="text-slate-400 transition hover:text-red-600" title="Remove">
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePagination page={subordinatesPager.page} totalPages={subordinatesPager.totalPages} totalCount={subordinatesPager.totalCount} pageSize={subordinatesPager.pageSize} onPageChange={subordinatesPager.setPage} />
            </>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void saveReportingLines()}
              disabled={!reportingDirty || reportingSaving}
              className="rounded-full bg-green-500 px-8 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-green-600 disabled:opacity-50"
            >
              {reportingSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          TAB: BENEFITS
         ══════════════════════════════════════════════════ */}
      {pageTab === "benefits" && (
        <div className="space-y-6">
          <Modal open={showBenefitModal} onClose={closeBenefitModal} title="">
            <div>
              <h3 className="text-lg font-semibold text-slate-700">{editingBenefit ? "Edit Benefits" : "Add Benefits"}</h3>
              <div className="mt-3 border-t border-slate-200 pt-4 grid gap-x-8 gap-y-5 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-orange-500">
                    Insurance Provider<span className="text-red-500">*</span>
                  </label>
                  <ListAutocompleteInput
                    name="insuranceProvider"
                    value={benefitInsurer}
                    onChange={(value) => {
                      setBenefitInsurer(value);
                      if (showBenefitValidationErrors && value.trim()) {
                        setShowBenefitValidationErrors(false);
                      }
                    }}
                    options={benefitInsurerOptions}
                    className={`${inputClass}${showBenefitValidationErrors && !benefitInsurer.trim() ? " border-red-400 focus:border-red-500 focus:ring-red-200" : ""}`}
                    placeholder={benefitInsurerOptions.length ? "Choose from list or type a provider" : "Type an insurance provider"}
                    showAllOnFocus
                    maxSuggestions={200}
                  />
                  {showBenefitValidationErrors && !benefitInsurer.trim() && (
                    <p className="mt-1 text-xs text-red-500">Insurance provider is required.</p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-orange-500">
                    Coverage<span className="text-red-500">*</span>
                  </label>
                  <div className={`mt-1 space-y-2.5 rounded-lg border px-3 py-2.5 ${showBenefitValidationErrors && !benefitExtMed && !benefitDental && !benefitVision ? "border-red-300 bg-red-50/40" : "border-transparent"}`}>
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input type="checkbox" checked={benefitExtMed} onChange={(e) => {
                        setBenefitExtMed(e.target.checked);
                        if (showBenefitValidationErrors) setShowBenefitValidationErrors(false);
                      }} className="h-4.5 w-4.5 rounded border-slate-300 text-orange-500 focus:ring-orange-400" />
                      <span className="text-sm text-slate-700">Extended Medical</span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input type="checkbox" checked={benefitDental} onChange={(e) => {
                        setBenefitDental(e.target.checked);
                        if (showBenefitValidationErrors) setShowBenefitValidationErrors(false);
                      }} className="h-4.5 w-4.5 rounded border-slate-300 text-orange-500 focus:ring-orange-400" />
                      <span className="text-sm text-slate-700">Dental</span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input type="checkbox" checked={benefitVision} onChange={(e) => {
                        setBenefitVision(e.target.checked);
                        if (showBenefitValidationErrors) setShowBenefitValidationErrors(false);
                      }} className="h-4.5 w-4.5 rounded border-slate-300 text-orange-500 focus:ring-orange-400" />
                      <span className="text-sm text-slate-700">Vision</span>
                    </label>
                  </div>
                  {showBenefitValidationErrors && !benefitExtMed && !benefitDental && !benefitVision && (
                    <p className="mt-1 text-xs text-red-500">Select at least one coverage option.</p>
                  )}
                </div>
              </div>
              <div className="mt-5 grid gap-y-5 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-orange-500">Spousal Coverage</label>
                  <FormSelect
                    value={benefitSpousal ? "Yes" : "No"}
                    onValueChange={(v) => setBenefitSpousal(v === "Yes")}
                    options={YES_NO_OPTIONS}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-orange-500">Dependents</label>
                  <FormSelect
                    value={benefitDeps ? "Yes" : "No"}
                    onValueChange={(v) => setBenefitDeps(v === "Yes")}
                    options={YES_NO_OPTIONS}
                  />
                </div>
              </div>
              {showBenefitValidationErrors && getBenefitFormError() && (
                <FormErrorAlert message={getBenefitFormError()!} onDismiss={() => setShowBenefitValidationErrors(false)} className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600" />
              )}
              <div className="mt-4 border-t border-slate-100 pt-4 flex items-center justify-between">
                <span className="text-xs text-slate-400">* Required field</span>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={closeBenefitModal} className="rounded-full border border-slate-300 px-6 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">Cancel</button>
                  <button type="button" onClick={saveBenefitRecord} disabled={!isBenefitFormValid() || benefitSaving} className="rounded-lg bg-emerald-500 px-8 py-2.5 text-sm font-bold uppercase tracking-wide text-white shadow-sm transition hover:bg-emerald-600 disabled:opacity-50">{benefitSaving ? "Saving..." : "Save"}</button>
                </div>
              </div>
            </div>
          </Modal>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className={sectionCardHeaderRow}>
              <div className="flex items-center gap-2.5">
                <SectionIcon path="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" color="bg-emerald-500" />
                <h2 className="text-base font-bold text-slate-800">Benefits Info</h2>
              </div>
              <SectionRecordHeaderActions count={benefits.length} onAdd={() => openBenefitModal()} addTitle="Add benefits record" />
            </div>
            {benefits.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-slate-400">No benefits records added.</div>
            ) : (
              <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-semibold uppercase text-slate-400">
                      <th className="px-6 py-3">Insurance provider</th>
                      <th className="px-4 py-3">Coverage</th>
                      <th className="px-4 py-3">Spousal</th>
                      <th className="px-4 py-3">Dependents</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {benefitsPager.pageItems.map((b) => (
                      <tr key={b.id} className="border-b border-slate-50 transition hover:bg-slate-50">
                        <td className="px-6 py-3 font-medium text-slate-700">{b.insuranceProvider || "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{formatBenefitCoverage(b)}</td>
                        <td className="px-4 py-3 text-slate-600">{b.spousalCoverage ? "Yes" : "No"}</td>
                        <td className="px-4 py-3 text-slate-600">{b.dependentsCovered ? "Yes" : "No"}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button type="button" onClick={() => openBenefitModal(b)} className="text-slate-500 transition hover:text-amber-600" title="Edit">
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </button>
                            <button type="button" onClick={() => deleteBenefitRecord(b.id)} className="text-slate-400 transition hover:text-red-600" title="Delete">
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePagination page={benefitsPager.page} totalPages={benefitsPager.totalPages} totalCount={benefitsPager.totalCount} pageSize={benefitsPager.pageSize} onPageChange={benefitsPager.setPage} />
              </>
            )}
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
                  <PassportNumberInput value={immNumber} onChange={(e) => setImmNumber(sanitizePassportNumberInput(e.target.value))} className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Issued By</label>
                  <CountryAutocompleteInput
                    name="immIssuedBy"
                    value={immIssuedBy}
                    onChange={setImmIssuedBy}
                    className={inputClass}
                    placeholder="Type to search country…"
                  />
                </div>
              </div>
              <div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Issued Date<span className="text-red-500">*</span></label>
                  <DatePickerField value={immIssuedDate} onChange={setImmIssuedDate} className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Expiry Date<span className="text-red-500">*</span></label>
                  <DatePickerField value={immExpiryDate} onChange={setImmExpiryDate} className={inputClass} />
                  <ImmigrationDateCountdown dateIso={immExpiryDate} variant="expire" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Available Date<span className="text-red-500">*</span></label>
                  <div
                    className={`${inputClass} bg-slate-50 font-semibold text-slate-700${
                      immReviewDate ? ` ${immigrationCountdownClass(immReviewDate)}` : ""
                    }`}
                  >
                    {immDocType === "Passport" && !immIssuedDate
                      ? "—"
                      : immDocType === "Visa" && !immExpiryDate
                        ? "—"
                        : immReviewDate
                          ? formatAvailableDateDayCount(immReviewDate)
                          : "—"}
                  </div>
                  {immDocType === "Passport" && !immIssuedDate ? (
                    <p className="mt-1 text-xs text-slate-400">Set Issued Date to calculate availability.</p>
                  ) : immDocType === "Visa" && !immExpiryDate ? (
                    <p className="mt-1 text-xs text-slate-400">Set Expiry Date to calculate availability.</p>
                  ) : null}
                </div>
              </div>
              <div className="mt-4">
                <label className="mb-1 block text-sm font-semibold text-slate-600">Comments</label>
                <textarea value={immComments} onChange={(e) => setImmComments(e.target.value)} rows={4} className={inputClass + " resize-y"} />
              </div>

              <div className="mt-6 border-t border-slate-200 pt-4">
                <div className="mb-4 flex items-center gap-2.5">
                  <SectionIcon path="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" color="bg-cyan-500" />
                  <h4 className="text-sm font-bold text-slate-800">Attached Documents</h4>
                </div>
                <label className="mb-1 block text-sm font-semibold text-slate-600">
                  File
                  <span className="text-xs font-normal text-slate-400"> (Accepts up to 5MB)</span>
                </label>
                <div className="mt-1 flex items-center gap-3">
                  <button type="button" onClick={() => immDocFileRef.current?.click()} className="rounded-full bg-slate-200 px-5 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-300">Browse</button>
                  <span className="truncate text-sm text-slate-500">{immDocFile ? immDocFile.name : "No file chosen"}</span>
                  <input
                    ref={immDocFileRef}
                    type="file"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f && f.size > 5 * 1024 * 1024) {
                        await appAlert("File size must be less than 5 MB.", "File Too Large");
                        resetImmAttachmentDraft();
                        return;
                      }
                      setImmDocFile(f ?? null);
                    }}
                  />
                </div>
                <div className="mt-4">
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Description</label>
                  <textarea value={immDocDesc} onChange={(e) => setImmDocDesc(e.target.value)} rows={3} className={inputClass + " resize-y"} />
                </div>
                {immDocs.length === 0 ? (
                  <p className="mt-4 text-center text-sm text-slate-400">No documents uploaded.</p>
                ) : (
                  <div className="mt-4 overflow-x-auto rounded-lg border border-slate-100">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase text-slate-400">
                          <th className="px-4 py-2.5">File Name</th>
                          <th className="px-4 py-2.5">Description</th>
                          <th className="px-4 py-2.5">Size</th>
                          <th className="px-4 py-2.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {immDocs.map((doc) => (
                          <tr key={doc.id} className="border-b border-slate-50 last:border-0">
                            <td className="px-4 py-2.5 font-medium text-slate-700">{doc.fileName}</td>
                            <td className="max-w-xs truncate px-4 py-2.5 text-slate-600">{doc.description ?? "—"}</td>
                            <td className="px-4 py-2.5 text-slate-600">{fmtFileSize(doc.size)}</td>
                            <td className="px-4 py-2.5 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => openImmigrationDocumentFile(doc.id)}
                                  disabled={immDocOpeningId === doc.id}
                                  title="View"
                                  className="text-slate-500 transition hover:text-blue-600 disabled:opacity-50"
                                >
                                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                </button>
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

              <div className="mt-4 border-t border-slate-100 pt-4 flex items-center justify-between">
                <span className="text-xs text-red-400">* Required</span>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={closeImmModal} className="rounded-full border border-slate-300 px-6 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">Cancel</button>
                  <button type="button" onClick={saveImmigration} disabled={!isImmigrationFormValid(immDocType, immNumber, immIssuedDate, immExpiryDate, immReviewDate) || immSaving} className="rounded-full bg-green-500 px-8 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-600 disabled:opacity-50">{immSaving ? "Saving..." : "Save"}</button>
                </div>
              </div>
            </div>
          </Modal>

          <Modal open={showImmViewModal} onClose={closeImmViewModal} title="">
            {viewingImm ? (
              <div>
                <h3 className="text-lg font-semibold text-slate-700">View Immigration Document</h3>
                <div className="mt-3 border-t border-slate-200 pt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-600">Document</label>
                    <div className={`${inputClass} bg-slate-50 text-slate-700`}>{viewingImm.documentType}</div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-600">Number</label>
                    <div className={`${inputClass} bg-slate-50 text-slate-700 uppercase`}>{viewingImm.number}</div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-600">Issued By</label>
                    <div className={`${inputClass} bg-slate-50 text-slate-700`}>{viewingImm.issuedBy ?? "—"}</div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-600">Issued Date</label>
                    <div className={`${inputClass} bg-slate-50 text-slate-700`}>{formatDate(viewingImm.issuedDate)}</div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-600">Expiry Date</label>
                    <div className={`${inputClass} bg-slate-50 text-slate-700`}>{formatDate(viewingImm.expiryDate)}</div>
                    {viewingImm.expiryDate ? (
                      <ImmigrationDateCountdown dateIso={viewingImm.expiryDate.split("T")[0]} variant="expire" />
                    ) : null}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-600">Available Date</label>
                    <div
                      className={`${inputClass} bg-slate-50 font-semibold text-slate-700${
                        viewingImm.eligibleReviewDate
                          ? ` ${immigrationCountdownClass(viewingImm.eligibleReviewDate.split("T")[0])}`
                          : ""
                      }`}
                    >
                      {viewingImm.eligibleReviewDate
                        ? formatAvailableDateDayCount(viewingImm.eligibleReviewDate.split("T")[0])
                        : "—"}
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <label className="mb-1 block text-sm font-semibold text-slate-600">Comments</label>
                  <div className={`${inputClass} min-h-[6rem] bg-slate-50 text-slate-700 whitespace-pre-wrap`}>
                    {viewingImm.comments?.trim() ? viewingImm.comments : "—"}
                  </div>
                </div>

                <div className="mt-6 border-t border-slate-200 pt-4">
                  <div className="mb-4 flex items-center gap-2.5">
                    <SectionIcon path="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" color="bg-cyan-500" />
                    <h4 className="text-sm font-bold text-slate-800">Attached Documents</h4>
                  </div>
                  {immDocs.length === 0 ? (
                    <p className="text-center text-sm text-slate-400">No documents uploaded.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-slate-100">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase text-slate-400">
                            <th className="px-4 py-2.5">File Name</th>
                            <th className="px-4 py-2.5">Description</th>
                            <th className="px-4 py-2.5">Size</th>
                            <th className="px-4 py-2.5 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {immDocs.map((doc) => (
                            <tr key={doc.id} className="border-b border-slate-50 last:border-0">
                              <td className="px-4 py-2.5 font-medium text-slate-700">{doc.fileName}</td>
                              <td className="max-w-xs truncate px-4 py-2.5 text-slate-600">{doc.description ?? "—"}</td>
                              <td className="px-4 py-2.5 text-slate-600">{fmtFileSize(doc.size)}</td>
                              <td className="px-4 py-2.5 text-right">
                                <button
                                  type="button"
                                  onClick={() => openImmigrationDocumentFile(doc.id)}
                                  disabled={immDocOpeningId === doc.id}
                                  title="View"
                                  className="inline-flex text-slate-500 transition hover:text-blue-600 disabled:opacity-50"
                                >
                                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="mt-4 border-t border-slate-100 pt-4 flex items-center justify-end gap-3">
                  <button type="button" onClick={closeImmViewModal} className="rounded-full border border-slate-300 px-6 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">Close</button>
                  <button
                    type="button"
                    onClick={() => {
                      closeImmViewModal();
                      openImmModal(viewingImm);
                    }}
                    className="rounded-full bg-[#2B7DE9] px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2569c7]"
                  >
                    Edit
                  </button>
                </div>
              </div>
            ) : null}
          </Modal>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className={sectionCardHeaderRow}>
              <div className="flex items-center gap-2.5">
                <SectionIcon path="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" color="bg-rose-500" />
                <h2 className="text-base font-bold text-slate-800">Immigration Documents</h2>
              </div>
              <SectionRecordHeaderActions count={immigrations.length} onAdd={() => openImmModal()} addTitle="Add immigration record" />
            </div>
            {immigrations.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-slate-400">No immigration documents added.</div>
            ) : (
              <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-semibold uppercase text-slate-400">
                      <th className="px-6 py-3">Document</th>
                      <th className="px-4 py-3">Number</th>
                      <th className="px-4 py-3">Issued By</th>
                      <th className="px-4 py-3">Issued Date</th>
                      <th className="px-4 py-3">Expiry Date</th>
                      <th className="px-4 py-3">Available Date</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {immigrationsPager.pageItems.map((imm) => (
                      <tr key={imm.id} className="border-b border-slate-50 transition hover:bg-slate-50">
                        <td className="px-6 py-3 font-medium text-slate-700">{imm.documentType}</td>
                        <td className="px-4 py-3 text-slate-600">{imm.number}</td>
                        <td className="px-4 py-3 text-slate-600">{imm.issuedBy ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{formatDate(imm.issuedDate)}</td>
                        <td className="px-4 py-3 text-slate-600">
                          <div>{formatDate(imm.expiryDate)}</div>
                          {imm.expiryDate ? (
                            <div className={`text-xs font-medium ${immigrationCountdownClass(imm.expiryDate.split("T")[0])}`}>
                              {formatDateCountdownToExpire(imm.expiryDate.split("T")[0])}
                            </div>
                          ) : null}
                        </td>
                        <td className={`px-4 py-3 font-semibold ${imm.eligibleReviewDate ? immigrationCountdownClass(imm.eligibleReviewDate.split("T")[0]) : "text-slate-600"}`}>
                          {imm.eligibleReviewDate
                            ? formatAvailableDateDayCount(imm.eligibleReviewDate.split("T")[0])
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button type="button" onClick={() => openImmViewModal(imm)} className="text-slate-500 transition hover:text-blue-600" title="View">
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            </button>
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
              <TablePagination page={immigrationsPager.page} totalPages={immigrationsPager.totalPages} totalCount={immigrationsPager.totalCount} pageSize={immigrationsPager.pageSize} onPageChange={immigrationsPager.setPage} />
            </>
            )}
          </div>
        </div>
      )}

      {pageTab === "payroll" && id && <EmployeePayrollTab employeeId={id} />}
    </>
  );
}
