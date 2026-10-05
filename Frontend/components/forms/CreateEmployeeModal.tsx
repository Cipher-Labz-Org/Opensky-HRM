"use client";

import { useState, useEffect, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { DatePickerField, PasswordVisibilityToggle, FormErrorAlert } from "@/components/ui";
import { FormSelect } from "@/components/ui/FormSelect";
import { PersonNameInput, PhoneInput, UsernameInput, EmailInput } from "@/components/ui";
import { isValidPhone, isValidUsername, isValidEmailInput, isValidEmailFormat, sanitizeUsernameInput, sanitizePhoneInput, PHONE_VALIDATION_MESSAGE, USERNAME_VALIDATION_MESSAGE, EMAIL_INPUT_VALIDATION_MESSAGE, EMAIL_FORMAT_VALIDATION_MESSAGE } from "@/lib/input-validation";
import { formatLocalDateToIso } from "@/lib/datePickerIso";
import { apiFetch } from "@/lib/api";
import { getSystemSetting } from "@/lib/system-settings";
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

interface CreateEmployeeModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
  /** When set, submits to recruitment hire endpoint after validating the employee form. */
  candidateId?: string;
  initialValues?: EmployeeFormInitialValues;
  title?: string;
  submitLabel?: string;
  onConverted?: (result: { employeeId: string; onboardingStarted?: boolean }) => void;
}

export function CreateEmployeeModal({
  open,
  onClose,
  onCreated,
  candidateId,
  initialValues,
  title = "Create New Employee",
  submitLabel = "Create Employee",
  onConverted,
}: CreateEmployeeModalProps) {
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
  const [employeeCode, setEmployeeCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

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

  useEffect(() => {
    if (!open) return;
    setCreateLogin(false);
    setLoginUsername("");
    setLoginStatus("enabled");
    setLoginPassword("");
    setLoginConfirmPassword("");
    setShowLoginPassword(false);
    setShowLoginConfirmPassword(false);
    setLoginUsernameError("");
    setLoginPasswordError("");
    setLoginConfirmPasswordError("");
    setEssRoleId("");
    setSupervisorRoleId("");
    setAdminRoleId("");
    setNextCode("");
    setEmployeeCode("");
    setWithOnboarding(false);
    setOnboardingTemplateId("");

    apiFetch<TemplateLookup[]>("/api/employee-tasks/lookup?type=Onboarding")
      .then((t) => setOnboardingTemplates(t))
      .catch(() => setOnboardingTemplates([]));

    Promise.all([
      apiFetch<Lookup[]>("/api/organization/departments").catch(() => []),
      apiFetch<Lookup[]>("/api/organization/business-units").catch(() => []),
      apiFetch<Lookup[]>("/api/organization/locations").catch(() => []),
      apiFetch<Lookup[]>("/api/organization/grades").catch(() => []),
      apiFetch<Lookup[]>("/api/organization/job-titles").catch(() => []),
      apiFetch<Record<string, string>>("/api/system-settings").catch(() => ({})),
      apiFetch<RoleLookup[]>("/api/auth/roles").catch(() => []),
    ]).then(([depts, bus, locs, grs, jts, settings, fetchedRoles]) => {
      setDepartments(depts as Lookup[]);
      setBusinessUnits(bus as Lookup[]);
      setLocations(locs as Lookup[]);
      setGrades(grs as Lookup[]);
      setJobTitles(jts as Lookup[]);
      setRoles(fetchedRoles as RoleLookup[]);

      const ess = (fetchedRoles as RoleLookup[]).find((r) => r.code === "EMPLOYEE");
      if (ess) setEssRoleId(ess.id);

      const settingsMap = settings as Record<string, string>;
      const multi = isMultiCompanyFeatureActive(getSystemSetting(settingsMap, "MultiCompanyFeatureActive"));
      setMultiCompanyActive(multi);
      const companyOpts = multi ? buildCompanyProfileFilterOptions(settingsMap).filter((o) => o.value !== "") : [];
      setCompanyProfileOptions(companyOpts);
      setCompanyProfileKey(PRIMARY_COMPANY_PROFILE_KEY);

      const isAuto = getSystemSetting(settings as Record<string, string>, "EmployeeCodeAutoGenerate") !== "false";
      setAutoGenerate(isAuto);
      if (isAuto) {
        apiFetch<{ code: string }>("/api/system-settings/next-employee-code")
          .then((r) => {
            setNextCode(r.code);
            setEmployeeCode(r.code);
          })
          .catch(() => {
            setNextCode("");
            setEmployeeCode("");
          });
      } else {
        setEmployeeCode("");
      }
    });
  }, [open]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoginUsernameError("");
    setLoginPasswordError("");
    setLoginConfirmPasswordError("");

    if (createLogin) {
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

    const fd = new FormData(e.currentTarget);
    const joinDate = ((fd.get("joinDate") as string) ?? "").trim();
    const dateOfBirth = ((fd.get("dateOfBirth") as string) ?? "").trim();
    const todayIso = formatLocalDateToIso(new Date());

    if (!dateOfBirth) {
      setError("Date of birth is required.");
      setSubmitting(false);
      return;
    }
    if (dateOfBirth > todayIso) {
      setError("Date of birth cannot be in the future.");
      setSubmitting(false);
      return;
    }

    if (!joinDate) {
      setError("Join date is required.");
      setSubmitting(false);
      return;
    }
    if (joinDate > todayIso) {
      setError("Join date cannot be in the future.");
      setSubmitting(false);
      return;
    }
    if (joinDate < dateOfBirth) {
      setError("Join date cannot be before date of birth.");
      setSubmitting(false);
      return;
    }

    const departmentId = ((fd.get("departmentId") as string) ?? "").trim();
    if (!departmentId) {
      setError("Department is required.");
      setSubmitting(false);
      return;
    }

    setSubmitting(true);

    const phoneRaw = sanitizePhoneInput(((fd.get("phone") as string) ?? "").trim());
    if (phoneRaw && !isValidPhone(phoneRaw)) {
      setError(PHONE_VALIDATION_MESSAGE);
      setSubmitting(false);
      return;
    }

    const emailRaw = ((fd.get("email") as string) ?? "").trim();
    if (emailRaw && !isValidEmailInput(emailRaw)) {
      setError(EMAIL_INPUT_VALIDATION_MESSAGE);
      setSubmitting(false);
      return;
    }
    if (emailRaw && !isValidEmailFormat(emailRaw)) {
      setError(EMAIL_FORMAT_VALIDATION_MESSAGE);
      setSubmitting(false);
      return;
    }
    if (candidateId && !emailRaw) {
      setError("Email is required for employee conversion.");
      setSubmitting(false);
      return;
    }

    const roleIds: string[] = [];
    if (essRoleId) roleIds.push(essRoleId);
    if (supervisorRoleId) roleIds.push(supervisorRoleId);
    if (adminRoleId) roleIds.push(adminRoleId);

    const readOptionalId = (name: string) => {
      const value = ((fd.get(name) as string) ?? "").trim();
      return value || null;
    };

    const payload: Record<string, unknown> = {
      employeeCode: (fd.get("employeeCode") as string)?.trim() || "",
      fingerprintId: ((fd.get("fingerprintId") as string) ?? "").trim() || null,
      firstName: fd.get("firstName"),
      middleName: fd.get("middleName") || null,
      lastName: fd.get("lastName"),
      email: ((fd.get("email") as string) ?? "").trim(),
      phone: phoneRaw || null,
      dateOfBirth,
      gender: fd.get("gender"),
      joinDate,
      departmentId,
      businessUnitId: readOptionalId("businessUnitId"),
      locationId: readOptionalId("locationId"),
      gradeId: readOptionalId("gradeId"),
      jobTitleId: readOptionalId("jobTitleId"),
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

    if (candidateId && withOnboarding && !onboardingTemplateId) {
      setError("Select an onboarding template or turn off With Onboarding.");
      setSubmitting(false);
      return;
    }

    try {
      if (candidateId) {
        const result = await apiFetch<{ employeeId: string; onboardingStarted?: boolean }>(
          `/api/recruitment/candidates/${candidateId}/hire`,
          { method: "POST", body: JSON.stringify({ employee: payload }) },
        );
        onConverted?.({ employeeId: result.employeeId, onboardingStarted: result.onboardingStarted });
      } else {
        await apiFetch("/api/employees", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        onCreated?.();
      }
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create employee";
      // Best-effort: route password-specific server validation to the password field.
      if (createLogin && /password/i.test(msg)) {
        setLoginPasswordError(msg);
      } else if (createLogin && /username/i.test(msg)) {
        setLoginUsernameError(msg);
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20";
  const labelClass = "mb-1 block text-xs font-medium text-[var(--text-muted)]";

  const essRoles = roles.filter((r) => r.code === "EMPLOYEE");
  const supRoles = roles.filter((r) => r.code === "SUPERVISOR");
  const adminRoles = roles.filter((r) => r.code === "ADMIN" || r.code === "HR_MANAGER");

  const formKey = `${candidateId ?? "new"}-${open ? "open" : "closed"}`;

  return (
    <Modal open={open} onClose={onClose} title={title} wide>
      <form key={formKey} onSubmit={handleSubmit} className="space-y-4">
        <FormErrorAlert message={error} onDismiss={() => setError("")} />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>
              Employee Code {autoGenerate ? "(auto-generated, editable)" : "*"}
            </label>
            <input
              name="employeeCode"
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value)}
              required={!autoGenerate}
              className={inputClass}
              placeholder={autoGenerate ? nextCode || "Auto code will be suggested" : "Enter employee code"}
            />
            {multiCompanyActive ? (
              <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">
                Multiple company setup is active. Employee ID must be unique — you cannot reuse the same ID for another employee.
              </p>
            ) : null}
          </div>
          <div>
            <label className={labelClass}>Fingerprint ID</label>
            <input
              name="fingerprintId"
              className={inputClass}
              placeholder="Device PIN when different from employee code"
              maxLength={50}
            />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <EmailInput
              name="email"
              required={Boolean(candidateId)}
              defaultValue={initialValues?.email ?? ""}
              title={candidateId ? "Email is required for employee conversion." : "Optional. When set, must be a valid email (e.g. name@company.com)"}
              className={inputClass}
              placeholder="Optional — name@company.com"
              onChange={(e) => {
                if (createLogin && !loginUsername) {
                  setLoginUsername(sanitizeUsernameInput(e.target.value.split("@")[0] ?? ""));
                }
              }}
            />
          </div>
          {multiCompanyActive && companyProfileOptions.length > 0 ? (
            <div>
              <label className={labelClass}>Company *</label>
              <FormSelect
                value={companyProfileKey}
                onValueChange={setCompanyProfileKey}
                options={companyProfileOptions}
                placeholder="Select company…"
                required
                clearable={false}
              />
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClass}>First Name *</label>
            <PersonNameInput name="firstName" required defaultValue={initialValues?.firstName ?? ""} className={inputClass} placeholder="John" />
          </div>
          <div>
            <label className={labelClass}>Middle Name</label>
            <PersonNameInput name="middleName" autoComplete="additional-name" className={inputClass} placeholder="William" />
          </div>
          <div>
            <label className={labelClass}>Last Name *</label>
            <PersonNameInput name="lastName" required defaultValue={initialValues?.lastName ?? ""} autoComplete="family-name" className={inputClass} placeholder="Doe" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClass} htmlFor="create-employee-dateOfBirth">
              Date of Birth *
            </label>
            <DatePickerField
              id="create-employee-dateOfBirth"
              name="dateOfBirth"
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Gender *</label>
            <FormSelect
              name="gender"
              required
              defaultValue=""
              placeholder="Select..."
              options={[
                { value: "", label: "Select..." },
                { value: "Male", label: "Male" },
                { value: "Female", label: "Female" },
                { value: "Other", label: "Other" },
              ]}
            />
          </div>
          <div>
            <label className={labelClass}>Join Date *</label>
            <DatePickerField
              name="joinDate"
              required
              defaultValue={initialValues?.joinDate ?? ""}
              className={inputClass}
              max={formatLocalDateToIso(new Date())}
            />
          </div>
        </div>

          <div>
            <label className={labelClass}>Phone</label>
            <PhoneInput
              name="phone"
              defaultValue={initialValues?.phone ?? ""}
              className={inputClass}
              placeholder="0762535363"
            />
          </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Department *</label>
            <FormSelect
              name="departmentId"
              required
              defaultValue={initialValues?.departmentId ?? ""}
              placeholder="Select..."
              options={[{ value: "", label: "Select..." }, ...departments.map((d) => ({ value: d.id, label: d.name }))]}
            />
          </div>
          <div>
            <label className={labelClass}>Business Unit</label>
            <FormSelect
              name="businessUnitId"
              defaultValue=""
              placeholder="Select..."
              options={[{ value: "", label: "Select..." }, ...businessUnits.map((b) => ({ value: b.id, label: b.name }))]}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClass}>Location</label>
            <FormSelect
              name="locationId"
              defaultValue={initialValues?.locationId ?? ""}
              placeholder="Select..."
              options={[{ value: "", label: "Select..." }, ...locations.map((l) => ({ value: l.id, label: l.name }))]}
            />
          </div>
          <div>
            <label className={labelClass}>Grade</label>
            <FormSelect
              name="gradeId"
              defaultValue=""
              placeholder="Select..."
              options={[{ value: "", label: "Select..." }, ...grades.map((g) => ({ value: g.id, label: g.name }))]}
            />
          </div>
          <div>
            <label className={labelClass}>Job Title</label>
            <FormSelect
              name="jobTitleId"
              defaultValue={initialValues?.jobTitleId ?? ""}
              placeholder="Select..."
              options={[{ value: "", label: "Select..." }, ...jobTitles.map((j) => ({ value: j.id, label: j.name }))]}
            />
          </div>
        </div>

        {/* ── Create Login Details ─────────────────────────────────── */}
        <div className="border-t border-[var(--border)] pt-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-[var(--text)]">Create Login Details</span>
            <button
              type="button"
              role="switch"
              aria-checked={createLogin}
              onClick={() => setCreateLogin(!createLogin)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                createLogin ? "bg-[var(--primary)]" : "bg-gray-200"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200 ease-in-out ${
                  createLogin ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        {createLogin && (
          <div className="space-y-4 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>User Name *</label>
                <UsernameInput
                  value={loginUsername}
                  onChange={(e) => {
                    setLoginUsername(e.target.value);
                    if (loginUsernameError) setLoginUsernameError("");
                  }}
                  className={`${inputClass} ${loginUsernameError ? "border-red-300 focus:border-red-400 focus:ring-red-200/20" : ""}`}
                  placeholder="john.doe"
                />
                {loginUsernameError && (
                  <p className="mt-1 text-xs font-medium text-red-600">{loginUsernameError}</p>
                )}
              </div>
              <div>
                <label className={labelClass}>Status</label>
                <div className="flex items-center gap-4 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="loginStatus"
                      checked={loginStatus === "enabled"}
                      onChange={() => setLoginStatus("enabled")}
                      className="h-4 w-4 text-[var(--primary)] accent-[var(--primary)]"
                    />
                    <span className="text-sm text-[var(--text)]">Enabled</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="loginStatus"
                      checked={loginStatus === "disabled"}
                      onChange={() => setLoginStatus("disabled")}
                      className="h-4 w-4 text-[var(--primary)] accent-[var(--primary)]"
                    />
                    <span className="text-sm text-[var(--text)]">Disabled</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Password *</label>
                <div className="relative">
                  <input
                    type={showLoginPassword ? "text" : "password"}
                    value={loginPassword}
                    onChange={(e) => {
                      setLoginPassword(e.target.value);
                      if (loginPasswordError) setLoginPasswordError("");
                      // keep confirm error live when user edits password
                      if (loginConfirmPasswordError && loginConfirmPassword && e.target.value === loginConfirmPassword) {
                        setLoginConfirmPasswordError("");
                      }
                    }}
                    className={`${inputClass} pr-11 ${loginPasswordError ? "border-red-300 focus:border-red-400 focus:ring-red-200/20" : ""}`}
                    placeholder="Enter password"
                    autoComplete="new-password"
                  />
                  <PasswordVisibilityToggle
                    visible={showLoginPassword}
                    onToggle={() => setShowLoginPassword((v) => !v)}
                  />
                </div>
                <p className={`mt-1 min-h-4 text-xs font-medium ${loginPasswordError ? "text-red-600" : "invisible"}`}>
                  {loginPasswordError || " "}
                </p>
              </div>
              <div>
                <label className={labelClass}>Confirm Password *</label>
                <div className="relative">
                  <input
                    type={showLoginConfirmPassword ? "text" : "password"}
                    value={loginConfirmPassword}
                    onChange={(e) => {
                      setLoginConfirmPassword(e.target.value);
                      if (loginConfirmPasswordError) setLoginConfirmPasswordError("");
                    }}
                    className={`${inputClass} pr-11 ${
                      loginConfirmPasswordError || (loginConfirmPassword && loginPassword !== loginConfirmPassword)
                        ? "border-red-300 focus:border-red-400 focus:ring-red-200/20"
                        : ""
                    }`}
                    placeholder="Re-enter password"
                    autoComplete="new-password"
                  />
                  <PasswordVisibilityToggle
                    visible={showLoginConfirmPassword}
                    onToggle={() => setShowLoginConfirmPassword((v) => !v)}
                    label={showLoginConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                  />
                </div>
                <p
                  className={`mt-1 min-h-4 text-xs font-medium ${
                    loginConfirmPasswordError || (loginConfirmPassword && loginPassword !== loginConfirmPassword)
                      ? "text-red-600"
                      : "invisible"
                  }`}
                >
                  {loginConfirmPasswordError || (loginConfirmPassword && loginPassword !== loginConfirmPassword)
                    ? loginConfirmPasswordError || "Passwords do not match."
                    : " "}
                </p>
              </div>
            </div>

            <p className="text-xs text-[var(--text-muted)]">
              For a strong password, please use a hard to guess combination of text with upper and lower case characters, symbols and numbers.
              The employee will be prompted to set a new password on their first sign-in.
            </p>

            <hr className="border-blue-100" />

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className={labelClass}>ESS Role *</label>
                <FormSelect
                  name="essRoleId"
                  value={essRoleId}
                  onValueChange={setEssRoleId}
                  options={
                    essRoles.length > 0
                      ? essRoles.map((r) => ({ value: r.id, label: r.name }))
                      : [{ value: "", label: "No ESS role found" }]
                  }
                />
              </div>
              <div>
                <label className={labelClass}>Supervisor Role *</label>
                <FormSelect
                  name="supervisorRoleId"
                  value={supervisorRoleId}
                  onValueChange={setSupervisorRoleId}
                  placeholder="-- Select --"
                  options={[{ value: "", label: "-- Select --" }, ...supRoles.map((r) => ({ value: r.id, label: r.name }))]}
                />
              </div>
              <div>
                <label className={labelClass}>Admin Role</label>
                <FormSelect
                  name="adminRoleId"
                  value={adminRoleId}
                  onValueChange={setAdminRoleId}
                  placeholder="-- Select --"
                  options={[{ value: "", label: "-- Select --" }, ...adminRoles.map((r) => ({ value: r.id, label: r.name }))]}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Onboarding ─────────────────────────────────────────── */}
        <div className="border-t border-[var(--border)] pt-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-[var(--text)]">With Onboarding</span>
            <button
              type="button"
              role="switch"
              aria-checked={withOnboarding}
              onClick={() => setWithOnboarding(!withOnboarding)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                withOnboarding ? "bg-[var(--primary)]" : "bg-gray-200"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200 ease-in-out ${
                  withOnboarding ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        {withOnboarding && (
          <div className="space-y-3 rounded-xl border border-green-100 bg-green-50/50 p-4">
            <div>
              <label className={labelClass}>Onboarding Template *</label>
              <FormSelect
                name="onboardingTemplateId"
                value={onboardingTemplateId}
                onValueChange={setOnboardingTemplateId}
                required={withOnboarding}
                placeholder="Select template..."
                options={[
                  { value: "", label: "Select template..." },
                  ...onboardingTemplates.map((t) => ({ value: t.id, label: `${t.name} (${t.itemCount} tasks)` })),
                ]}
              />
            </div>
            {onboardingTemplates.length === 0 && (
              <p className="text-xs text-amber-600">
                No onboarding templates found. Create one in Employee Tasks first.
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? (candidateId ? "Converting..." : "Creating...") : submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
