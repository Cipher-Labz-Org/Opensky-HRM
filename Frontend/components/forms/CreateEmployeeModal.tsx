"use client";

import { useState, useEffect, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { DatePickerField } from "@/components/ui";
import { apiFetch } from "@/lib/api";

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

interface CreateEmployeeModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export function CreateEmployeeModal({
  open,
  onClose,
  onCreated,
}: CreateEmployeeModalProps) {
  const [departments, setDepartments] = useState<Lookup[]>([]);
  const [businessUnits, setBusinessUnits] = useState<Lookup[]>([]);
  const [locations, setLocations] = useState<Lookup[]>([]);
  const [grades, setGrades] = useState<Lookup[]>([]);
  const [jobTitles, setJobTitles] = useState<Lookup[]>([]);
  const [roles, setRoles] = useState<RoleLookup[]>([]);
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [nextCode, setNextCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [createLogin, setCreateLogin] = useState(false);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginStatus, setLoginStatus] = useState<"enabled" | "disabled">("enabled");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginConfirmPassword, setLoginConfirmPassword] = useState("");
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
    setLoginUsernameError("");
    setLoginPasswordError("");
    setLoginConfirmPasswordError("");
    setEssRoleId("");
    setSupervisorRoleId("");
    setAdminRoleId("");
    setNextCode("");
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

      const isAuto = (settings as Record<string, string>).EmployeeCodeAutoGenerate !== "false";
      setAutoGenerate(isAuto);
      if (isAuto) {
        apiFetch<{ code: string }>("/api/system-settings/next-employee-code")
          .then((r) => setNextCode(r.code))
          .catch(() => setNextCode("(auto)"));
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
      if (!loginUsername.trim()) {
        setLoginUsernameError("Username is required.");
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

    setSubmitting(true);

    const fd = new FormData(e.currentTarget);
    const roleIds: string[] = [];
    if (essRoleId) roleIds.push(essRoleId);
    if (supervisorRoleId) roleIds.push(supervisorRoleId);
    if (adminRoleId) roleIds.push(adminRoleId);

    const payload: Record<string, unknown> = {
      employeeCode: autoGenerate ? "" : (fd.get("employeeCode") || ""),
      firstName: fd.get("firstName"),
      middleName: fd.get("middleName") || null,
      lastName: fd.get("lastName"),
      email: fd.get("email"),
      phone: fd.get("phone") || null,
      dateOfBirth: fd.get("dateOfBirth"),
      gender: fd.get("gender"),
      joinDate: fd.get("joinDate"),
      departmentId: fd.get("departmentId"),
      businessUnitId: fd.get("businessUnitId") || null,
      locationId: fd.get("locationId") || null,
      gradeId: fd.get("gradeId") || null,
      jobTitleId: fd.get("jobTitleId") || null,
    };

    if (createLogin) {
      payload.createLogin = {
        username: loginUsername,
        password: loginPassword,
        isActive: loginStatus === "enabled",
        roleIds,
      };
    }

    if (withOnboarding && onboardingTemplateId) {
      payload.withOnboarding = true;
      payload.onboardingTemplateId = onboardingTemplateId;
    }

    try {
      await apiFetch("/api/employees", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      onCreated?.();
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

  return (
    <Modal open={open} onClose={onClose} title="Create New Employee" wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>
              Employee Code {autoGenerate ? "(auto-generated)" : "*"}
            </label>
            {autoGenerate ? (
              <input name="employeeCode" className={`${inputClass} bg-gray-50`} value={nextCode} readOnly />
            ) : (
              <input name="employeeCode" required className={inputClass} placeholder="Enter employee code" />
            )}
          </div>
          <div>
            <label className={labelClass}>Email *</label>
            <input
              name="email"
              type="email"
              required
              pattern="[^\s@]+@[^\s@]+\.[^\s@]{2,}"
              title="Enter a valid email (e.g. name@company.com)"
              className={inputClass}
              placeholder="john@openskyhrm.com"
              onChange={(e) => {
                if (createLogin && !loginUsername) {
                  setLoginUsername(e.target.value.split("@")[0]);
                }
              }}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClass}>First Name *</label>
            <input name="firstName" required className={inputClass} placeholder="John" />
          </div>
          <div>
            <label className={labelClass}>Middle Name</label>
            <input name="middleName" className={inputClass} placeholder="William" />
          </div>
          <div>
            <label className={labelClass}>Last Name *</label>
            <input name="lastName" required className={inputClass} placeholder="Doe" />
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
            <select name="gender" required className={inputClass}>
              <option value="">Select...</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Join Date *</label>
            <DatePickerField name="joinDate" required className={inputClass} />
          </div>
        </div>

        <div>
          <label className={labelClass}>Phone</label>
          <input name="phone" className={inputClass} placeholder="+94771234567" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Department *</label>
            <select name="departmentId" required className={inputClass}>
              <option value="">Select...</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Business Unit</label>
            <select name="businessUnitId" className={inputClass}>
              <option value="">Select...</option>
              {businessUnits.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClass}>Location</label>
            <select name="locationId" className={inputClass}>
              <option value="">Select...</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Grade</label>
            <select name="gradeId" className={inputClass}>
              <option value="">Select...</option>
              {grades.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Job Title</label>
            <select name="jobTitleId" className={inputClass}>
              <option value="">Select...</option>
              {jobTitles.map((j) => (
                <option key={j.id} value={j.id}>{j.name}</option>
              ))}
            </select>
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
                <input
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
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => {
                    setLoginPassword(e.target.value);
                    if (loginPasswordError) setLoginPasswordError("");
                    // keep confirm error live when user edits password
                    if (loginConfirmPasswordError && loginConfirmPassword && e.target.value === loginConfirmPassword) {
                      setLoginConfirmPasswordError("");
                    }
                  }}
                  className={`${inputClass} ${loginPasswordError ? "border-red-300 focus:border-red-400 focus:ring-red-200/20" : ""}`}
                  placeholder="Enter password"
                />
                {loginPasswordError && (
                  <p className="mt-1 text-xs font-medium text-red-600">{loginPasswordError}</p>
                )}
              </div>
              <div>
                <label className={labelClass}>Confirm Password *</label>
                <input
                  type="password"
                  value={loginConfirmPassword}
                  onChange={(e) => {
                    setLoginConfirmPassword(e.target.value);
                    if (loginConfirmPasswordError) setLoginConfirmPasswordError("");
                  }}
                  className={`${inputClass} ${
                    loginConfirmPasswordError || (loginConfirmPassword && loginPassword !== loginConfirmPassword)
                      ? "border-red-300 focus:border-red-400 focus:ring-red-200/20"
                      : ""
                  }`}
                  placeholder="Re-enter password"
                />
                {(loginConfirmPasswordError || (loginConfirmPassword && loginPassword !== loginConfirmPassword)) && (
                  <p className="mt-1 text-xs font-medium text-red-600">
                    {loginConfirmPasswordError || "Passwords do not match."}
                  </p>
                )}
              </div>
            </div>

            <p className="text-xs text-[var(--text-muted)]">
              For a strong password, please use a hard to guess combination of text with upper and lower case characters, symbols and numbers
            </p>

            <hr className="border-blue-100" />

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className={labelClass}>ESS Role *</label>
                <select
                  value={essRoleId}
                  onChange={(e) => setEssRoleId(e.target.value)}
                  className={inputClass}
                >
                  {essRoles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                  {essRoles.length === 0 && <option value="">No ESS role found</option>}
                </select>
              </div>
              <div>
                <label className={labelClass}>Supervisor Role *</label>
                <select
                  value={supervisorRoleId}
                  onChange={(e) => setSupervisorRoleId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">-- Select --</option>
                  {supRoles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Admin Role</label>
                <select
                  value={adminRoleId}
                  onChange={(e) => setAdminRoleId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">-- Select --</option>
                  {adminRoles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
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
              <select
                value={onboardingTemplateId}
                onChange={(e) => setOnboardingTemplateId(e.target.value)}
                className={inputClass}
                required={withOnboarding}
              >
                <option value="">Select template...</option>
                {onboardingTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.itemCount} tasks)
                  </option>
                ))}
              </select>
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
            {submitting ? "Creating..." : "Create Employee"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
