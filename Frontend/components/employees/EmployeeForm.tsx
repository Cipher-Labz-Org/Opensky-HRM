"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { DatePickerField, PasswordVisibilityToggle, FormErrorAlert } from "@/components/ui";
import { FormSelect } from "@/components/ui/FormSelect";
import { PersonNameInput, PhoneInput, UsernameInput, EmailInput } from "@/components/ui";
import { CreatePageShell, type BreadcrumbItem } from "@/components/form-layout/CreatePageShell";
import { FormSection } from "@/components/form-layout/FormSection";
import { FormField } from "@/components/form-layout/FormField";
import { PreviewPanel, type PreviewChip } from "@/components/form-layout/PreviewPanel";
import {
  isValidPhone,
  isValidUsername,
  isValidEmailInput,
  isValidEmailFormat,
  sanitizeUsernameInput,
  sanitizePhoneInput,
  PHONE_VALIDATION_MESSAGE,
  USERNAME_VALIDATION_MESSAGE,
  EMAIL_INPUT_VALIDATION_MESSAGE,
  EMAIL_FORMAT_VALIDATION_MESSAGE,
} from "@/lib/input-validation";
import { formatLocalDateToIso } from "@/lib/datePickerIso";
import { apiFetch } from "@/lib/api";
import { getSystemSetting } from "@/lib/system-settings";
import { displayWorkEmail } from "@/lib/employee-email";
import { sanitizeEmployeeAddressFields } from "@/lib/employee-address";
import {
  buildCompanyProfileFilterOptions,
  isMultiCompanyFeatureActive,
  PRIMARY_COMPANY_PROFILE_KEY,
} from "@/lib/additional-company-profiles";

interface Lookup {
  id: string;
  name: string;
  code: string;
}

interface RoleLookup {
  id: string;
  name: string;
  code: string;
  description: string | null;
}

interface TemplateLookup {
  id: string;
  name: string;
  type: string;
  itemCount: number;
}

export type EmployeeFormInitialValues = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  joinDate?: string;
  departmentId?: string;
  jobTitleId?: string;
  locationId?: string;
  positionId?: string;
};

/** Full employee record as returned by GET /api/employees/{id}; used to build a non-destructive PUT. */
type EmployeeRecord = Record<string, unknown> & {
  id: string;
  employeeCode: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  joinDate: string | null;
  fingerprintId: string | null;
  departmentId: string | null;
  businessUnitId: string | null;
  locationId: string | null;
  gradeId: string | null;
  jobTitleId: string | null;
  terminationNote?: string | null;
  isCashPayment?: boolean;
};

const UPDATE_KEYS = [
  "firstName", "middleName", "lastName", "email", "phone",
  "addressStreet1", "addressStreet2", "city", "country", "stateProvince", "zipPostalCode", "district",
  "pollingDivision", "distanceToOffice", "modeOfTransport", "homeTelephone", "workTelephone", "otherEmail",
  "permanentStreet1", "permanentStreet2", "permanentCity", "permanentCountry", "permanentStateProvince",
  "permanentZipPostalCode", "permanentDistrict", "permanentPollingDivision", "permanentDistanceToOffice",
  "dateOfBirth", "gender", "maritalStatus", "nationality", "religion", "ethnicity", "otherId", "fingerprintId",
  "nationalId", "tinNumber", "epfNumber", "etfNumber", "driversLicenseNumber", "driversLicenseType",
  "licenseIssueDate", "licenseExpiryDate", "driversLicenseIssuingCountry", "joinDate", "probationEndDate",
  "dateOfPermanency", "status", "employmentType", "departmentId", "businessUnitId", "positionId", "locationId",
  "gradeId", "jobTitleId", "managerId", "isTopOfHierarchy", "isCashPayment", "terminationDate",
  "terminationReason", "terminationNote",
] as const;

type EmployeeFormProps = {
  mode: "create" | "edit";
  /** `page` renders the full lead-style layout with preview; `modal` renders a compact body for dialogs. */
  layout?: "page" | "modal";
  employeeId?: string;
  /** When set, submits to recruitment hire endpoint after validating the employee form. */
  candidateId?: string;
  initialValues?: EmployeeFormInitialValues;
  title?: string;
  subtitle?: string;
  breadcrumb?: BreadcrumbItem[];
  submitLabel?: string;
  onSaved?: (result: { employeeId: string; onboardingStarted?: boolean }) => void;
  onCancel: () => void;
};

const FORM_ID = "employee-form";

const toIsoDate = (value: unknown) => (typeof value === "string" && value ? value.split("T")[0] : "");

function Switch({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) {
  return (
    <div className="form-create-switch-row">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
          checked ? "bg-[var(--primary)]" : "bg-gray-200"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200 ease-in-out ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
      <span className="form-create-label">{label}</span>
    </div>
  );
}

export function EmployeeForm({
  mode,
  layout = "page",
  employeeId,
  candidateId,
  initialValues,
  title,
  subtitle,
  breadcrumb,
  submitLabel,
  onSaved,
  onCancel,
}: EmployeeFormProps) {
  const isEdit = mode === "edit";

  const [departments, setDepartments] = useState<Lookup[]>([]);
  const [businessUnits, setBusinessUnits] = useState<Lookup[]>([]);
  const [locations, setLocations] = useState<Lookup[]>([]);
  const [grades, setGrades] = useState<Lookup[]>([]);
  const [jobTitles, setJobTitles] = useState<Lookup[]>([]);
  const [roles, setRoles] = useState<RoleLookup[]>([]);
  const [multiCompanyActive, setMultiCompanyActive] = useState(false);
  const [companyProfileOptions, setCompanyProfileOptions] = useState<{ value: string; label: string }[]>([]);
  const [companyProfileKey, setCompanyProfileKey] = useState(PRIMARY_COMPANY_PROFILE_KEY);
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [nextCode, setNextCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [error, setError] = useState("");
  const [existing, setExisting] = useState<EmployeeRecord | null>(null);

  const [employeeCode, setEmployeeCode] = useState("");
  const [fingerprintId, setFingerprintId] = useState("");
  const [firstName, setFirstName] = useState(initialValues?.firstName ?? "");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState(initialValues?.lastName ?? "");
  const [email, setEmail] = useState(initialValues?.email ?? "");
  const [phone, setPhone] = useState(initialValues?.phone ?? "");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [joinDate, setJoinDate] = useState(initialValues?.joinDate ?? "");
  const [departmentId, setDepartmentId] = useState(initialValues?.departmentId ?? "");
  const [businessUnitId, setBusinessUnitId] = useState("");
  const [locationId, setLocationId] = useState(initialValues?.locationId ?? "");
  const [gradeId, setGradeId] = useState("");
  const [jobTitleId, setJobTitleId] = useState(initialValues?.jobTitleId ?? "");

  const [createLogin, setCreateLogin] = useState(false);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginStatus, setLoginStatus] = useState<"enabled" | "disabled">("enabled");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginConfirmPassword, setLoginConfirmPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showLoginConfirmPassword, setShowLoginConfirmPassword] = useState(false);
  const [loginUsernameError, setLoginUsernameError] = useState("");
  const [loginPasswordError, setLoginPasswordError] = useState("");
  const [loginConfirmPasswordError, setLoginConfirmPasswordError] = useState("");
  const [essRoleId, setEssRoleId] = useState("");
  const [supervisorRoleId, setSupervisorRoleId] = useState("");
  const [adminRoleId, setAdminRoleId] = useState("");

  const [withOnboarding, setWithOnboarding] = useState(false);
  const [onboardingTemplateId, setOnboardingTemplateId] = useState("");
  const [onboardingTemplates, setOnboardingTemplates] = useState<TemplateLookup[]>([]);
  const [formVersion, setFormVersion] = useState(0);

  function loadNextCode() {
    apiFetch<{ code: string }>("/api/system-settings/next-employee-code")
      .then((r) => {
        setNextCode(r.code);
        setEmployeeCode(r.code);
      })
      .catch(() => {
        setNextCode("");
        setEmployeeCode("");
      });
  }

  useEffect(() => {
    if (!isEdit) {
      apiFetch<TemplateLookup[]>("/api/employee-tasks/lookup?type=Onboarding")
        .then((t) => setOnboardingTemplates(t))
        .catch(() => setOnboardingTemplates([]));
    }

    Promise.all([
      apiFetch<Lookup[]>("/api/organization/departments").catch(() => []),
      apiFetch<Lookup[]>("/api/organization/business-units").catch(() => []),
      apiFetch<Lookup[]>("/api/organization/locations").catch(() => []),
      apiFetch<Lookup[]>("/api/organization/grades").catch(() => []),
      apiFetch<Lookup[]>("/api/organization/job-titles").catch(() => []),
      apiFetch<Record<string, string>>("/api/system-settings").catch(() => ({})),
      isEdit ? Promise.resolve([] as RoleLookup[]) : apiFetch<RoleLookup[]>("/api/auth/roles").catch(() => []),
    ]).then(([depts, bus, locs, grs, jts, settings, fetchedRoles]) => {
      setDepartments(depts as Lookup[]);
      setBusinessUnits(bus as Lookup[]);
      setLocations(locs as Lookup[]);
      setGrades(grs as Lookup[]);
      setJobTitles(jts as Lookup[]);
      setRoles(fetchedRoles as RoleLookup[]);

      const ess = (fetchedRoles as RoleLookup[]).find((r) => r.code === "EMPLOYEE");
      if (ess) setEssRoleId(ess.id);

      if (isEdit) return;

      const settingsMap = settings as Record<string, string>;
      const multi = isMultiCompanyFeatureActive(getSystemSetting(settingsMap, "MultiCompanyFeatureActive"));
      setMultiCompanyActive(multi);
      const companyOpts = multi ? buildCompanyProfileFilterOptions(settingsMap).filter((o) => o.value !== "") : [];
      setCompanyProfileOptions(companyOpts);
      setCompanyProfileKey(PRIMARY_COMPANY_PROFILE_KEY);

      const isAuto = getSystemSetting(settingsMap, "EmployeeCodeAutoGenerate") !== "false";
      setAutoGenerate(isAuto);
      if (isAuto) loadNextCode();
    });
  }, [isEdit]);

  useEffect(() => {
    if (!isEdit || !employeeId) return;
    setLoading(true);
    apiFetch<EmployeeRecord>(`/api/employees/${employeeId}`)
      .then((emp) => {
        setExisting(emp);
        setEmployeeCode(emp.employeeCode ?? "");
        setFingerprintId(emp.fingerprintId ?? "");
        setFirstName(emp.firstName ?? "");
        setMiddleName(emp.middleName ?? "");
        setLastName(emp.lastName ?? "");
        setEmail(displayWorkEmail(emp.email));
        setPhone(emp.phone ?? "");
        setDateOfBirth(toIsoDate(emp.dateOfBirth));
        setGender(emp.gender ?? "");
        setJoinDate(toIsoDate(emp.joinDate));
        setDepartmentId(emp.departmentId ?? "");
        setBusinessUnitId(emp.businessUnitId ?? "");
        setLocationId(emp.locationId ?? "");
        setGradeId(emp.gradeId ?? "");
        setJobTitleId(emp.jobTitleId ?? "");
        setFormVersion((v) => v + 1);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load employee."))
      .finally(() => setLoading(false));
  }, [isEdit, employeeId]);

  async function submit() {
    setError("");
    setLoginUsernameError("");
    setLoginPasswordError("");
    setLoginConfirmPasswordError("");

    if (!isEdit && createLogin) {
      let hasFieldError = false;
      const username = sanitizeUsernameInput(loginUsername.trim());
      if (!username) {
        setLoginUsernameError("Username is required.");
        hasFieldError = true;
      } else if (!isValidUsername(username)) {
        setLoginUsernameError(USERNAME_VALIDATION_MESSAGE);
        hasFieldError = true;
      }
      if (!loginPassword) {
        setLoginPasswordError("Password is required.");
        hasFieldError = true;
      } else if (loginPassword.length < 6) {
        setLoginPasswordError("Password must be at least 6 characters.");
        hasFieldError = true;
      }
      if (!loginConfirmPassword) {
        setLoginConfirmPasswordError("Confirm password is required.");
        hasFieldError = true;
      } else if (loginPassword !== loginConfirmPassword) {
        setLoginConfirmPasswordError("Passwords do not match.");
        hasFieldError = true;
      }
      if (hasFieldError) return;
    }

    const todayIso = formatLocalDateToIso(new Date());
    if (!firstName.trim() || !lastName.trim()) return setError("First name and last name are required.");
    if (!isEdit && !autoGenerate && !employeeCode.trim()) return setError("Employee code is required.");
    if (!dateOfBirth) return setError("Date of birth is required.");
    if (dateOfBirth > todayIso) return setError("Date of birth cannot be in the future.");
    if (!gender) return setError("Gender is required.");
    if (!joinDate) return setError("Join date is required.");
    if (joinDate > todayIso) return setError("Join date cannot be in the future.");
    if (joinDate < dateOfBirth) return setError("Join date cannot be before date of birth.");
    if (!departmentId) return setError("Department is required.");

    const phoneRaw = sanitizePhoneInput(phone.trim());
    if (phoneRaw && !isValidPhone(phoneRaw)) return setError(PHONE_VALIDATION_MESSAGE);

    const emailRaw = email.trim();
    if (emailRaw && !isValidEmailInput(emailRaw)) return setError(EMAIL_INPUT_VALIDATION_MESSAGE);
    if (emailRaw && !isValidEmailFormat(emailRaw)) return setError(EMAIL_FORMAT_VALIDATION_MESSAGE);
    if (candidateId && !emailRaw) return setError("Email is required for employee conversion.");
    if (candidateId && withOnboarding && !onboardingTemplateId) {
      return setError("Select an onboarding template or turn off With Onboarding.");
    }

    setSubmitting(true);
    try {
      if (isEdit) {
        if (!existing || !employeeId) throw new Error("Employee is not loaded yet.");
        const base: Record<string, unknown> = {};
        for (const key of UPDATE_KEYS) base[key] = existing[key] ?? null;
        base.isTopOfHierarchy = Boolean(existing.isTopOfHierarchy);
        base.isCashPayment = Boolean(existing.isCashPayment);
        const payload = sanitizeEmployeeAddressFields({
          ...base,
          firstName: firstName.trim(),
          middleName: middleName.trim() || null,
          lastName: lastName.trim(),
          // "" (not null): null fails ASP.NET binding on UpdateEmployeeDto.Email.
          email: emailRaw,
          phone: phoneRaw || null,
          fingerprintId: fingerprintId.trim() || null,
          dateOfBirth,
          gender,
          joinDate,
          departmentId,
          businessUnitId: businessUnitId || null,
          locationId: locationId || null,
          gradeId: gradeId || null,
          jobTitleId: jobTitleId || null,
        } as Parameters<typeof sanitizeEmployeeAddressFields>[0]);
        await apiFetch(`/api/employees/${employeeId}`, { method: "PUT", body: JSON.stringify(payload) });
        onSaved?.({ employeeId });
        return;
      }

      const roleIds: string[] = [];
      if (essRoleId) roleIds.push(essRoleId);
      if (supervisorRoleId) roleIds.push(supervisorRoleId);
      if (adminRoleId) roleIds.push(adminRoleId);

      const payload: Record<string, unknown> = {
        employeeCode: employeeCode.trim(),
        fingerprintId: fingerprintId.trim() || null,
        firstName: firstName.trim(),
        middleName: middleName.trim() || null,
        lastName: lastName.trim(),
        email: emailRaw,
        phone: phoneRaw || null,
        dateOfBirth,
        gender,
        joinDate,
        departmentId,
        businessUnitId: businessUnitId || null,
        locationId: locationId || null,
        gradeId: gradeId || null,
        jobTitleId: jobTitleId || null,
        positionId: initialValues?.positionId || null,
        companyProfileKey: multiCompanyActive ? companyProfileKey : PRIMARY_COMPANY_PROFILE_KEY,
      };

      if (createLogin) {
        payload.createLogin = {
          username: sanitizeUsernameInput(loginUsername.trim()),
          password: loginPassword,
          isActive: loginStatus === "enabled",
          roleIds,
        };
      }

      if (withOnboarding && onboardingTemplateId) {
        payload.withOnboarding = true;
        payload.onboardingTemplateId = onboardingTemplateId;
      }

      if (candidateId) {
        const result = await apiFetch<{ employeeId: string; onboardingStarted?: boolean }>(
          `/api/recruitment/candidates/${candidateId}/hire`,
          { method: "POST", body: JSON.stringify({ employee: payload }) },
        );
        onSaved?.({ employeeId: result.employeeId, onboardingStarted: result.onboardingStarted });
      } else {
        const created = await apiFetch<{ id: string }>("/api/employees", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        onSaved?.({ employeeId: created?.id ?? "" });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : isEdit ? "Failed to update employee" : "Failed to create employee";
      if (!isEdit && createLogin && /password/i.test(msg)) {
        setLoginPasswordError(msg);
      } else if (!isEdit && createLogin && /username/i.test(msg)) {
        setLoginUsernameError(msg);
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void submit();
  }

  const ctl = "form-create-ctl";
  const errCtl = (hasError: boolean) => `${ctl}${hasError ? " input-error" : ""}`;

  const essRoles = roles.filter((r) => r.code === "EMPLOYEE");
  const supRoles = roles.filter((r) => r.code === "SUPERVISOR");
  const adminRoles = roles.filter((r) => r.code === "ADMIN" || r.code === "HR_MANAGER");

  const nameOf = (list: Lookup[], id: string) => list.find((x) => x.id === id)?.name;
  const departmentName = nameOf(departments, departmentId);
  const jobTitleName = nameOf(jobTitles, jobTitleId);
  const locationName = nameOf(locations, locationId);
  const gradeName = nameOf(grades, gradeId);
  const companyLabel = multiCompanyActive
    ? companyProfileOptions.find((o) => o.value === companyProfileKey)?.label
    : undefined;

  const fullName = [firstName, middleName, lastName].map((s) => s.trim()).filter(Boolean).join(" ");
  const previewChips = useMemo(() => {
    const chips: PreviewChip[] = [];
    if (gender) chips.push({ label: gender, dot: "#7C5CD6", bg: "#EEE8FD", fg: "#5B21B6" });
    if (companyLabel) chips.push({ label: companyLabel });
    if (!isEdit && createLogin) chips.push({ label: "Login enabled", dot: "#2E9A5E", bg: "#E2F4EA", fg: "#0F6537" });
    if (!isEdit && withOnboarding) chips.push({ label: "Onboarding", dot: "#3B6FE0", bg: "#E6EEFF", fg: "#1D4ED8" });
    return chips;
  }, [gender, companyLabel, isEdit, createLogin, withOnboarding]);

  const sections = (
    <>
      <FormSection index={1} title="Identity" hint="Employee code and legal name">
        <FormField
          label="Employee code"
          required={!isEdit && !autoGenerate}
          help={
            isEdit
              ? "Employee code cannot be changed here."
              : multiCompanyActive
                ? "Multiple company setup is active. Employee ID must be unique."
                : autoGenerate
                  ? "Auto-generated, editable."
                  : undefined
          }
        >
          <input
            name="employeeCode"
            value={employeeCode}
            onChange={(e) => setEmployeeCode(e.target.value)}
            readOnly={isEdit}
            className={ctl}
            placeholder={autoGenerate ? nextCode || "Auto code will be suggested" : "Enter employee code"}
          />
        </FormField>
        <FormField label="Fingerprint ID">
          <input
            name="fingerprintId"
            value={fingerprintId}
            onChange={(e) => setFingerprintId(e.target.value)}
            className={ctl}
            placeholder="Device PIN when different from employee code"
            maxLength={50}
          />
        </FormField>
        <FormField label="First name" required>
          <PersonNameInput value={firstName} onChange={(e) => setFirstName(e.target.value)} required className={ctl} placeholder="John" />
        </FormField>
        <FormField label="Middle name">
          <PersonNameInput value={middleName} onChange={(e) => setMiddleName(e.target.value)} autoComplete="additional-name" className={ctl} placeholder="William" />
        </FormField>
        <FormField label="Last name" required>
          <PersonNameInput value={lastName} onChange={(e) => setLastName(e.target.value)} required autoComplete="family-name" className={ctl} placeholder="Doe" />
        </FormField>
        {multiCompanyActive && companyProfileOptions.length > 0 ? (
          <FormField label="Company" required>
            <FormSelect
              value={companyProfileKey}
              onValueChange={setCompanyProfileKey}
              options={companyProfileOptions}
              placeholder="Select company…"
              required
              clearable={false}
            />
          </FormField>
        ) : null}
      </FormSection>

      <FormSection index={2} title="Personal">
        <FormField label="Date of birth" required htmlFor="employee-form-dateOfBirth">
          <DatePickerField
            key={`dob-${formVersion}`}
            id="employee-form-dateOfBirth"
            value={dateOfBirth}
            onChange={setDateOfBirth}
            required
            className={ctl}
            max={formatLocalDateToIso(new Date())}
          />
        </FormField>
        <FormField label="Gender" required>
          <FormSelect
            value={gender}
            onValueChange={setGender}
            required
            placeholder="Select..."
            options={[
              { value: "", label: "Select..." },
              { value: "Male", label: "Male" },
              { value: "Female", label: "Female" },
              { value: "Other", label: "Other" },
            ]}
          />
        </FormField>
      </FormSection>

      <FormSection index={3} title="Contact">
        <FormField label="Email" required={Boolean(candidateId)}>
          <EmailInput
            value={email}
            required={Boolean(candidateId)}
            title={candidateId ? "Email is required for employee conversion." : "Optional. When set, must be a valid email (e.g. name@company.com)"}
            className={ctl}
            placeholder={candidateId ? "name@company.com" : "Optional — name@company.com"}
            onChange={(e) => {
              setEmail(e.target.value);
              if (createLogin && !loginUsername) {
                setLoginUsername(sanitizeUsernameInput(e.target.value.split("@")[0] ?? ""));
              }
            }}
          />
        </FormField>
        <FormField label="Phone">
          <PhoneInput value={phone} onChange={(e) => setPhone(e.target.value)} className={ctl} placeholder="0762535363" />
        </FormField>
      </FormSection>

      <FormSection index={4} title="Employment" hint="Placement in the organization">
        <FormField label="Join date" required>
          <DatePickerField
            key={`join-${formVersion}`}
            value={joinDate}
            onChange={setJoinDate}
            required
            className={ctl}
            max={formatLocalDateToIso(new Date())}
          />
        </FormField>
        <FormField label="Department" required>
          <FormSelect
            value={departmentId}
            onValueChange={setDepartmentId}
            required
            placeholder="Select..."
            options={[{ value: "", label: "Select..." }, ...departments.map((d) => ({ value: d.id, label: d.name }))]}
          />
        </FormField>
        <FormField label="Business unit">
          <FormSelect
            value={businessUnitId}
            onValueChange={setBusinessUnitId}
            placeholder="Select..."
            options={[{ value: "", label: "Select..." }, ...businessUnits.map((b) => ({ value: b.id, label: b.name }))]}
          />
        </FormField>
        <FormField label="Location">
          <FormSelect
            value={locationId}
            onValueChange={setLocationId}
            placeholder="Select..."
            options={[{ value: "", label: "Select..." }, ...locations.map((l) => ({ value: l.id, label: l.name }))]}
          />
        </FormField>
        <FormField label="Grade">
          <FormSelect
            value={gradeId}
            onValueChange={setGradeId}
            placeholder="Select..."
            options={[{ value: "", label: "Select..." }, ...grades.map((g) => ({ value: g.id, label: g.name }))]}
          />
        </FormField>
        <FormField label="Job title">
          <FormSelect
            value={jobTitleId}
            onValueChange={setJobTitleId}
            placeholder="Select..."
            options={[{ value: "", label: "Select..." }, ...jobTitles.map((j) => ({ value: j.id, label: j.name }))]}
          />
        </FormField>
      </FormSection>

      {!isEdit ? (
        <FormSection
          index={5}
          title="Login access"
          hint="Optional ESS account"
          actions={<Switch checked={createLogin} onToggle={() => setCreateLogin(!createLogin)} label="Create login" />}
        >
          {createLogin ? (
            <>
              <FormField label="User name" required error={loginUsernameError}>
                <UsernameInput
                  value={loginUsername}
                  onChange={(e) => {
                    setLoginUsername(e.target.value);
                    if (loginUsernameError) setLoginUsernameError("");
                  }}
                  className={errCtl(Boolean(loginUsernameError))}
                  placeholder="john.doe"
                />
              </FormField>
              <FormField label="Status">
                <div className="flex h-9 items-center gap-4">
                  {(["enabled", "disabled"] as const).map((s) => (
                    <label key={s} className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name="loginStatus"
                        checked={loginStatus === s}
                        onChange={() => setLoginStatus(s)}
                        className="h-4 w-4 accent-[var(--primary)]"
                      />
                      <span className="text-[13px] capitalize">{s}</span>
                    </label>
                  ))}
                </div>
              </FormField>
              <FormField label="Password" required error={loginPasswordError}>
                <div className="relative">
                  <input
                    type={showLoginPassword ? "text" : "password"}
                    value={loginPassword}
                    onChange={(e) => {
                      setLoginPassword(e.target.value);
                      if (loginPasswordError) setLoginPasswordError("");
                      if (loginConfirmPasswordError && loginConfirmPassword && e.target.value === loginConfirmPassword) {
                        setLoginConfirmPasswordError("");
                      }
                    }}
                    className={`${errCtl(Boolean(loginPasswordError))} pr-11`}
                    placeholder="Enter password"
                    autoComplete="new-password"
                  />
                  <PasswordVisibilityToggle visible={showLoginPassword} onToggle={() => setShowLoginPassword((v) => !v)} />
                </div>
              </FormField>
              <FormField
                label="Confirm password"
                required
                error={
                  loginConfirmPasswordError ||
                  (loginConfirmPassword && loginPassword !== loginConfirmPassword ? "Passwords do not match." : "")
                }
              >
                <div className="relative">
                  <input
                    type={showLoginConfirmPassword ? "text" : "password"}
                    value={loginConfirmPassword}
                    onChange={(e) => {
                      setLoginConfirmPassword(e.target.value);
                      if (loginConfirmPasswordError) setLoginConfirmPasswordError("");
                    }}
                    className={`${errCtl(Boolean(loginConfirmPasswordError || (loginConfirmPassword && loginPassword !== loginConfirmPassword)))} pr-11`}
                    placeholder="Re-enter password"
                    autoComplete="new-password"
                  />
                  <PasswordVisibilityToggle
                    visible={showLoginConfirmPassword}
                    onToggle={() => setShowLoginConfirmPassword((v) => !v)}
                    label={showLoginConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                  />
                </div>
              </FormField>
              <p className="form-create-help form-create-field-full">
                Use a hard to guess combination of upper and lower case letters, symbols and numbers. The employee will be
                prompted to set a new password on their first sign-in.
              </p>
              <FormField label="ESS role" required>
                <FormSelect
                  value={essRoleId}
                  onValueChange={setEssRoleId}
                  options={
                    essRoles.length > 0
                      ? essRoles.map((r) => ({ value: r.id, label: r.name }))
                      : [{ value: "", label: "No ESS role found" }]
                  }
                />
              </FormField>
              <FormField label="Supervisor role">
                <FormSelect
                  value={supervisorRoleId}
                  onValueChange={setSupervisorRoleId}
                  placeholder="-- Select --"
                  options={[{ value: "", label: "-- Select --" }, ...supRoles.map((r) => ({ value: r.id, label: r.name }))]}
                />
              </FormField>
              <FormField label="Admin role">
                <FormSelect
                  value={adminRoleId}
                  onValueChange={setAdminRoleId}
                  placeholder="-- Select --"
                  options={[{ value: "", label: "-- Select --" }, ...adminRoles.map((r) => ({ value: r.id, label: r.name }))]}
                />
              </FormField>
            </>
          ) : null}
        </FormSection>
      ) : null}

      {!isEdit ? (
        <FormSection
          index={6}
          title="Onboarding"
          hint="Start an onboarding checklist"
          actions={<Switch checked={withOnboarding} onToggle={() => setWithOnboarding(!withOnboarding)} label="With onboarding" />}
        >
          {withOnboarding ? (
            <FormField
              label="Onboarding template"
              required
              full
              help={onboardingTemplates.length === 0 ? "No onboarding templates found. Create one in Employee Tasks first." : undefined}
            >
              <FormSelect
                value={onboardingTemplateId}
                onValueChange={setOnboardingTemplateId}
                required={withOnboarding}
                placeholder="Select template..."
                options={[
                  { value: "", label: "Select template..." },
                  ...onboardingTemplates.map((t) => ({ value: t.id, label: `${t.name} (${t.itemCount} tasks)` })),
                ]}
              />
            </FormField>
          ) : null}
        </FormSection>
      ) : null}
    </>
  );

  const defaultSubmitLabel = isEdit ? "Save changes" : candidateId ? "Convert to employee" : "Save employee";
  const saveLabel = submitLabel ?? defaultSubmitLabel;

  if (layout === "modal") {
    return (
      <form id={FORM_ID} onSubmit={handleSubmit} className="form-create !min-h-0 !bg-transparent">
        <div className="form-create-form">
          <FormErrorAlert message={error} onDismiss={() => setError("")} />
          {sections}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={onCancel} type="button">
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (candidateId ? "Converting..." : "Saving...") : saveLabel}
            </Button>
          </div>
        </div>
      </form>
    );
  }

  const preview = (
    <PreviewPanel
      label={isEdit ? `Preview · ${employeeCode || "Employee"}` : `Preview · ${employeeCode || "New employee"}`}
      name={fullName || "Unnamed employee"}
      subtitle={[jobTitleName, departmentName].filter(Boolean).join(" · ") || "No department yet"}
      chips={previewChips}
      kv={[
        { label: "Code", value: employeeCode, mono: true },
        { label: "Email", value: email.trim() },
        { label: "Phone", value: phone.trim(), mono: true },
        { label: "Join date", value: joinDate, mono: true },
        { label: "Location", value: locationName },
        { label: "Grade", value: gradeName },
      ]}
      checks={[
        { label: "Full name", done: Boolean(firstName.trim() && lastName.trim()) },
        { label: "Date of birth and gender", done: Boolean(dateOfBirth && gender) },
        { label: "Email or phone", done: Boolean(email.trim() || phone.trim()) },
        { label: "Department", done: Boolean(departmentId) },
        { label: "Job title", done: Boolean(jobTitleId) },
        { label: "Join date", done: Boolean(joinDate) },
        { label: "Location", done: Boolean(locationId) },
      ]}
      tip={
        isEdit ? (
          <>Addresses, dependents, bank accounts and other details are edited from the employee profile tabs.</>
        ) : (
          <>Turn on <b>Create login</b> to give the employee self-service access right away.</>
        )
      }
    />
  );

  return (
    <CreatePageShell
      breadcrumb={breadcrumb}
      title={title ?? (isEdit ? "Edit employee" : "Create new employee")}
      subtitle={subtitle ?? (isEdit ? "Update core employee details" : "Add a new employee to your organization")}
      formId={FORM_ID}
      saving={submitting || loading}
      saveLabel={saveLabel}
      onDiscard={onCancel}
      preview={preview}
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="form-create-form form-create-form-column" noValidate>
        <FormErrorAlert message={error} onDismiss={() => setError("")} />
        {loading ? <p className="form-create-help">Loading employee…</p> : null}
        {sections}
      </form>
    </CreatePageShell>
  );
}
