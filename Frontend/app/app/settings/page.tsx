"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { Button } from "@/components/ui/Button";
import { PhoneInput, EmailInput, FlashMessageBanner, type FlashMessage } from "@/components/ui";
import { isValidPhone, isValidEmailInput, isValidEmailFormat, PHONE_VALIDATION_MESSAGE, EMAIL_INPUT_VALIDATION_MESSAGE, EMAIL_FORMAT_VALIDATION_MESSAGE } from "@/lib/input-validation";
import { CreateRoleModal } from "@/components/forms/CreateRoleModal";
import { MasterDataEditorModal } from "@/components/forms/MasterDataEditorModal";
import { apiFetch } from "@/lib/api";
import { getSystemSetting } from "@/lib/system-settings";
import { API_BASE_URL } from "@/config/constants";
import Link from "next/link";
import { ROUTES } from "@/config/routes";
import { useAuth } from "@/contexts/auth-context";
import { DonutMixChart, formatInt, HorizontalCompareBars } from "@/lib/workspace-charts";

interface CountSummary {
  businessUnits: number;
  grades: number;
  jobTitles: number;
  locations: number;
  statuses: number;
  empStatuses: number;
  skills: number;
  attachmentTypes: number;
}

export default function SettingsPage() {
  const { isAdmin } = useAuth();
  const searchParams = useSearchParams();
  const [showCreate, setShowCreate] = useState(false);
  const [editBU, setEditBU] = useState(false);
  const [editGrades, setEditGrades] = useState(false);
  const [editJobs, setEditJobs] = useState(false);
  const [editDocs, setEditDocs] = useState(false);
  const [editLocations, setEditLocations] = useState(false);
  const [editStatuses, setEditStatuses] = useState(false);
  const [editEmpStatuses, setEditEmpStatuses] = useState(false);
  const [editSkills, setEditSkills] = useState(false);
  const [editAttachmentTypes, setEditAttachmentTypes] = useState(false);
  const [counts, setCounts] = useState<CountSummary>({ businessUnits: 0, grades: 0, jobTitles: 0, locations: 0, statuses: 0, empStatuses: 0, skills: 0, attachmentTypes: 0 });

  const [codeAutoGen, setCodeAutoGen] = useState(true);
  const [codeLength, setCodeLength] = useState("6");
  const [codePrefix, setCodePrefix] = useState("EMP");
  const [codeSaving, setCodeSaving] = useState(false);
  const [codeMsg, setCodeMsg] = useState("");
  const [codePreview, setCodePreview] = useState("");

  const [approvalLevels, setApprovalLevels] = useState(1);
  const [approvalConfigSaving, setApprovalConfigSaving] = useState(false);

  const [companyLogoUrl, setCompanyLogoUrl] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoFlash, setLogoFlash] = useState<FlashMessage | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [companyName, setCompanyName] = useState("");
  const [companyAddress1, setCompanyAddress1] = useState("");
  const [companyAddress2, setCompanyAddress2] = useState("");
  const [companyCity, setCompanyCity] = useState("");
  const [companyState, setCompanyState] = useState("");
  const [companyCountry, setCompanyCountry] = useState("");
  const [companyPostalCode, setCompanyPostalCode] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [companyRegNo, setCompanyRegNo] = useState("");
  const [companySaving, setCompanySaving] = useState(false);
  const [companyMsg, setCompanyMsg] = useState("");

  useEffect(() => {
    const edit = searchParams.get("edit");
    if (edit === "business-units") setEditBU(true);
    else if (edit === "grades") setEditGrades(true);
    else if (edit === "job-titles") setEditJobs(true);
    else if (edit === "document-types") setEditDocs(true);
  }, [searchParams]);

  useEffect(() => {
    Promise.all([
      apiFetch<{ id: string }[]>("/api/organization/business-units").then((r) => r.length).catch(() => 0),
      apiFetch<{ id: string }[]>("/api/organization/grades").then((r) => r.length).catch(() => 0),
      apiFetch<{ id: string }[]>("/api/organization/job-titles").then((r) => r.length).catch(() => 0),
      apiFetch<{ id: string }[]>("/api/organization/locations").then((r) => r.length).catch(() => 0),
      apiFetch<{ id: string }[]>("/api/organization/employment-statuses").then((r) => r.length).catch(() => 0),
      apiFetch<{ id: string }[]>("/api/organization/employee-statuses").then((r) => r.length).catch(() => 0),
      apiFetch<{ id: string }[]>("/api/employees/skills-catalog").then((r) => r.length).catch(() => 0),
      apiFetch<{ id: string }[]>("/api/employees/profile-attachment-types").then((r) => r.length).catch(() => 0),
    ]).then(([businessUnits, grades, jobTitles, locations, statuses, empStatuses, skills, attachmentTypes]) =>
      setCounts({ businessUnits, grades, jobTitles, locations, statuses, empStatuses, skills, attachmentTypes })
    );
  }, [editBU, editGrades, editJobs, editLocations, editStatuses, editEmpStatuses, editSkills, editAttachmentTypes]);

  function applySystemSettings(settings: Record<string, string>) {
    const autoGen = getSystemSetting(settings, "EmployeeCodeAutoGenerate");
    if (autoGen !== undefined) setCodeAutoGen(autoGen !== "false");
    const length = getSystemSetting(settings, "EmployeeCodeLength");
    if (length !== undefined) setCodeLength(length);
    const prefix = getSystemSetting(settings, "EmployeeCodePrefix");
    if (prefix !== undefined) setCodePrefix(prefix);
    setCompanyLogoUrl(getSystemSetting(settings, "CompanyLogoUrl") ?? "");
    setCompanyName(getSystemSetting(settings, "CompanyName") ?? "");
    setCompanyAddress1(getSystemSetting(settings, "CompanyAddress1") ?? "");
    setCompanyAddress2(getSystemSetting(settings, "CompanyAddress2") ?? "");
    setCompanyCity(getSystemSetting(settings, "CompanyCity") ?? "");
    setCompanyState(getSystemSetting(settings, "CompanyState") ?? "");
    setCompanyCountry(getSystemSetting(settings, "CompanyCountry") ?? "");
    setCompanyPostalCode(getSystemSetting(settings, "CompanyPostalCode") ?? "");
    setCompanyPhone(getSystemSetting(settings, "CompanyPhone") ?? "");
    setCompanyEmail(getSystemSetting(settings, "CompanyEmail") ?? "");
    setCompanyWebsite(getSystemSetting(settings, "CompanyWebsite") ?? "");
    setCompanyRegNo(getSystemSetting(settings, "CompanyRegNo") ?? "");
  }

  useEffect(() => {
    apiFetch<Record<string, string>>("/api/system-settings")
      .then(applySystemSettings)
      .catch(() => {});
  }, []);

  async function handleLogoUpload(file: File) {
    setLogoUploading(true);
    setLogoFlash(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
      const res = await fetch(`${API_BASE_URL}/api/system-settings/company-logo`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error || "Upload failed");
      }
      const data = await res.json();
      setCompanyLogoUrl(data.logoUrl);
      setLogoFlash({ type: "ok", text: "Logo uploaded successfully" });
    } catch (e: unknown) {
      setLogoFlash({ type: "err", text: e instanceof Error ? e.message : "Upload failed" });
    } finally {
      setLogoUploading(false);
    }
  }

  async function handleLogoRemove() {
    try {
      await apiFetch("/api/system-settings/company-logo", { method: "DELETE" });
      setCompanyLogoUrl("");
      setLogoFlash({ type: "ok", text: "Logo removed successfully" });
    } catch {
      setLogoFlash({ type: "err", text: "Failed to remove logo" });
    }
  }

  async function saveCompanyDetails() {
    setCompanySaving(true);
    setCompanyMsg("");
    if (companyPhone.trim() && !isValidPhone(companyPhone)) {
      setCompanyMsg(PHONE_VALIDATION_MESSAGE);
      setCompanySaving(false);
      return;
    }
    const trimmedCompanyEmail = companyEmail.trim();
    if (trimmedCompanyEmail && !isValidEmailInput(trimmedCompanyEmail)) {
      setCompanyMsg(EMAIL_INPUT_VALIDATION_MESSAGE);
      setCompanySaving(false);
      return;
    }
    if (trimmedCompanyEmail && !isValidEmailFormat(trimmedCompanyEmail)) {
      setCompanyMsg(EMAIL_FORMAT_VALIDATION_MESSAGE);
      setCompanySaving(false);
      return;
    }
    try {
      await Promise.all([
        apiFetch("/api/system-settings/CompanyName", { method: "PUT", body: JSON.stringify({ value: companyName }) }),
        apiFetch("/api/system-settings/CompanyAddress1", { method: "PUT", body: JSON.stringify({ value: companyAddress1 }) }),
        apiFetch("/api/system-settings/CompanyAddress2", { method: "PUT", body: JSON.stringify({ value: companyAddress2 }) }),
        apiFetch("/api/system-settings/CompanyCity", { method: "PUT", body: JSON.stringify({ value: companyCity }) }),
        apiFetch("/api/system-settings/CompanyState", { method: "PUT", body: JSON.stringify({ value: companyState }) }),
        apiFetch("/api/system-settings/CompanyCountry", { method: "PUT", body: JSON.stringify({ value: companyCountry }) }),
        apiFetch("/api/system-settings/CompanyPostalCode", { method: "PUT", body: JSON.stringify({ value: companyPostalCode }) }),
        apiFetch("/api/system-settings/CompanyPhone", { method: "PUT", body: JSON.stringify({ value: companyPhone }) }),
        apiFetch("/api/system-settings/CompanyEmail", { method: "PUT", body: JSON.stringify({ value: companyEmail }) }),
        apiFetch("/api/system-settings/CompanyWebsite", { method: "PUT", body: JSON.stringify({ value: companyWebsite }) }),
        apiFetch("/api/system-settings/CompanyRegNo", { method: "PUT", body: JSON.stringify({ value: companyRegNo }) }),
      ]);
      const settings = await apiFetch<Record<string, string>>("/api/system-settings");
      applySystemSettings(settings);
      setCompanyMsg("Company details saved successfully");
      setTimeout(() => setCompanyMsg(""), 3000);
    } catch {
      setCompanyMsg("Failed to save company details");
    } finally {
      setCompanySaving(false);
    }
  }

  useEffect(() => {
    const len = parseInt(codeLength, 10) || 6;
    setCodePreview(`${codePrefix}-${"0".repeat(Math.max(len - 1, 0))}1`);
  }, [codeLength, codePrefix]);

  async function saveCodeSettings() {
    setCodeSaving(true);
    setCodeMsg("");
    try {
      await Promise.all([
        apiFetch("/api/system-settings/EmployeeCodeAutoGenerate", {
          method: "PUT",
          body: JSON.stringify({ value: String(codeAutoGen) }),
        }),
        apiFetch("/api/system-settings/EmployeeCodeLength", {
          method: "PUT",
          body: JSON.stringify({ value: codeLength }),
        }),
        apiFetch("/api/system-settings/EmployeeCodePrefix", {
          method: "PUT",
          body: JSON.stringify({ value: codePrefix }),
        }),
      ]);
      setCodeMsg("Saved successfully");
      setTimeout(() => setCodeMsg(""), 3000);
    } catch {
      setCodeMsg("Failed to save");
    } finally {
      setCodeSaving(false);
    }
  }

  useEffect(() => {
    apiFetch<{ levels: number }>("/api/leave/approval-config")
      .then((cfg) => setApprovalLevels(cfg.levels))
      .catch(() => {});
  }, []);

  async function saveLeaveApprovalConfig(levels: number) {
    setApprovalConfigSaving(true);
    try {
      const res = await apiFetch<{ levels: number }>("/api/leave/approval-config", { method: "PUT", body: JSON.stringify({ levels }) });
      setApprovalLevels(res.levels);
    } catch { /* ignore */ } finally { setApprovalConfigSaving(false); }
  }

  const totalMasterRecords = useMemo(
    () =>
      counts.businessUnits +
      counts.grades +
      counts.jobTitles +
      counts.locations +
      counts.statuses +
      counts.empStatuses +
      counts.skills +
      counts.attachmentTypes,
    [counts]
  );

  const settingsDashboardKpis = useMemo(
    () => [
      {
        label: "Master data records",
        value: formatInt(totalMasterRecords),
      },
      {
        label: "Leave approval depth",
        value: approvalLevels === 2 ? "2 levels" : "1 level",
      },
      {
        label: "Employee code mode",
        value: codeAutoGen ? "Auto" : "Manual",
      },
    ],
    [totalMasterRecords, approvalLevels, codeAutoGen]
  );

  const masterDataDistributionBars = useMemo(() => {
    const colors = ["#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#64748b", "#eab308"];
    const rows = [
      { label: "Business units", value: counts.businessUnits },
      { label: "Grades", value: counts.grades },
      { label: "Job titles", value: counts.jobTitles },
      { label: "Locations", value: counts.locations },
      { label: "Employment types", value: counts.statuses },
      { label: "Employee statuses", value: counts.empStatuses },
      { label: "Skills", value: counts.skills },
      { label: "Attachment types", value: counts.attachmentTypes },
    ].sort((a, b) => b.value - a.value);
    return rows.map((r, i) => ({ ...r, color: colors[i % colors.length] }));
  }, [counts]);

  const masterDataDonut = useMemo(() => {
    const palette = ["#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6"];
    return [
      { label: "Business units", value: counts.businessUnits },
      { label: "Grades", value: counts.grades },
      { label: "Job titles", value: counts.jobTitles },
      { label: "Locations", value: counts.locations },
      { label: "Employment types", value: counts.statuses },
      { label: "Employee statuses", value: counts.empStatuses },
      { label: "Skills", value: counts.skills },
      { label: "Attachments", value: counts.attachmentTypes },
    ]
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
      .map((c, i) => ({
        label: c.label.length > 20 ? `${c.label.slice(0, 18)}…` : c.label,
        value: c.value,
        color: palette[i % palette.length],
      }));
  }, [counts]);

  return (
    <>
      <AppTopbar title="Policy, Security & Configuration" />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Security roles</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ New Security Role</Button>
      </div>

      <CreateRoleModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => window.location.reload()}
      />

      {isAdmin && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Customer onboarding reset</h3>
            </div>
            <Link
              href={ROUTES.billingCustomerReset}
              className="inline-flex shrink-0 items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
            >
              Open reset
            </Link>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {settingsDashboardKpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="text-xs font-medium uppercase tracking-wider text-slate-500">{kpi.label}</div>
            <div className="mt-2 text-2xl font-semibold leading-tight text-slate-900">{kpi.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-800">Master data footprint</h3>
          </div>
          <HorizontalCompareBars items={masterDataDistributionBars} />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-800">Catalog mix</h3>
          </div>
          {masterDataDonut.some((d) => d.value > 0) ? (
            <DonutMixChart values={masterDataDonut} />
          ) : (
            <p className="py-10 text-center text-sm text-slate-500">Add master data rows to see a distribution chart.</p>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-slate-900">Quick links</h3>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href={ROUTES.emailTemplates}
            className="group rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-800">Email &amp; letter templates</div>
              </div>
              <span className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700">→</span>
            </div>
          </Link>
          <Link
            href={ROUTES.emailDeliveryLog}
            className="group rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-800">Email delivery log</div>
              </div>
              <span className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700">→</span>
            </div>
          </Link>
          <Link
            href={ROUTES.userManagement}
            className="group rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-800">User management</div>
              </div>
              <span className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700">→</span>
            </div>
          </Link>
          <Link
            href={ROUTES.reports}
            className="group rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-800">Reports</div>
              </div>
              <span className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700">→</span>
            </div>
          </Link>
        </div>
      </div>

      {/* Leave Approval Workflow */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm mb-6">
        <div className="section-title">
          <h3>Leave Approval Workflow</h3>
        </div>
        <div className="flex flex-wrap items-center gap-4 px-1 py-2">
          <p className="text-sm text-[var(--text-muted)]">Approval levels:</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => saveLeaveApprovalConfig(1)}
              disabled={approvalConfigSaving}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                approvalLevels === 1
                  ? "border-slate-300 bg-white text-slate-900 shadow-sm"
                  : "border-slate-200/80 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white"
              }`}
            >
              1 Level
            </button>
            <button
              type="button"
              onClick={() => saveLeaveApprovalConfig(2)}
              disabled={approvalConfigSaving}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                approvalLevels === 2
                  ? "border-slate-300 bg-white text-slate-900 shadow-sm"
                  : "border-slate-200/80 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white"
              }`}
            >
              2 Levels
            </button>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            {approvalLevels === 1
              ? "Supervisor approves → Approved"
              : "Supervisor approves (L1) → Second approver (L2) → Approved"}
          </p>
        </div>
      </div>

      {/* Company Logo — shown on the sign-in page for all users */}
      <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/80 p-6 shadow-sm ring-1 ring-slate-100">
        <div className="mb-1 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Company logo</h3>
          </div>
        </div>

        <FlashMessageBanner msg={logoFlash} onClear={() => setLogoFlash(null)} className="mt-4" />

        <div className="mt-6 flex max-w-[280px] flex-col items-stretch gap-4">
          <div className="flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/80 px-6 py-10 shadow-inner">
            {companyLogoUrl ? (
              <img
                src={`${API_BASE_URL}${companyLogoUrl}`}
                alt="Company logo preview"
                className="max-h-36 max-w-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/10 to-rose-500/10 text-slate-400">
                  <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={1.25} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-slate-600">No logo yet</p>
              </div>
            )}
          </div>

          <div className="flex w-full flex-col items-stretch gap-2">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) handleLogoUpload(e.target.files[0]);
              }}
            />
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              disabled={logoUploading}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-[#2B7DE9] hover:text-[#2B7DE9] disabled:opacity-60"
            >
              {logoUploading ? "Uploading…" : companyLogoUrl ? "Replace logo" : "Upload logo"}
            </button>
            {companyLogoUrl ? (
              <button
                type="button"
                onClick={handleLogoRemove}
                className="w-full rounded-xl border border-red-100 bg-red-50/80 px-4 py-3 text-sm font-semibold text-red-600 transition hover:border-red-200 hover:bg-red-50"
              >
                Remove logo
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Company Details */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm mb-6">
        <div className="section-title">
          <h3>Company Details</h3>
        </div>
        <div className="space-y-4 px-1 py-3">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Company Name *</label>
              <input value={companyName} onChange={(e) => setCompanyName(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Registration No.</label>
              <input value={companyRegNo} onChange={(e) => setCompanyRegNo(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Address Line 1</label>
            <input value={companyAddress1} onChange={(e) => setCompanyAddress1(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Address Line 2</label>
            <input value={companyAddress2} onChange={(e) => setCompanyAddress2(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">City</label>
              <input value={companyCity} onChange={(e) => setCompanyCity(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">State / Province</label>
              <input value={companyState} onChange={(e) => setCompanyState(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Postal Code</label>
              <input value={companyPostalCode} onChange={(e) => setCompanyPostalCode(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Country</label>
            <input value={companyCountry} onChange={(e) => setCompanyCountry(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Phone</label>
              <PhoneInput value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Email</label>
              <EmailInput value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Website</label>
              <input value={companyWebsite} onChange={(e) => setCompanyWebsite(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20" />
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 pt-1">
            {companyMsg && (
              <span className={`text-xs font-medium ${companyMsg.includes("success") ? "text-green-600" : "text-red-500"}`}>
                {companyMsg}
              </span>
            )}
            <button onClick={saveCompanyDetails} disabled={companySaving}
              className="rounded-lg bg-[var(--primary)] px-5 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50">
              {companySaving ? "Saving..." : "Save Company Details"}
            </button>
          </div>
        </div>
      </div>

      {/* Master Data Editors */}
      <MasterDataEditorModal
        open={editBU}
        onClose={() => setEditBU(false)}
        title="Business Units"
        apiBase="/api/organization/business-units"
        fields={[
          { key: "name", label: "Name", placeholder: "Head Office" },
          { key: "code", label: "Code", placeholder: "BU-HO" },
          { key: "description", label: "Description", type: "textarea", required: false, placeholder: "Optional description" },
        ]}
      />

      <MasterDataEditorModal
        open={editGrades}
        onClose={() => setEditGrades(false)}
        title="Grades & Bands"
        apiBase="/api/organization/grades"
        fields={[
          { key: "name", label: "Name", placeholder: "Senior Manager" },
          { key: "code", label: "Code", placeholder: "GR-SM" },
          { key: "level", label: "Level", type: "number", placeholder: "5" },
          { key: "description", label: "Description", type: "textarea", required: false, placeholder: "Optional description" },
        ]}
      />

      <MasterDataEditorModal
        open={editJobs}
        onClose={() => setEditJobs(false)}
        title="Job Catalog"
        apiBase="/api/organization/job-titles"
        fields={[
          { key: "title", label: "Title", placeholder: "Software Engineer" },
          { key: "code", label: "Code", placeholder: "JT-SE" },
          { key: "description", label: "Description", type: "textarea", required: false, placeholder: "Optional description" },
        ]}
        toForm={(item) => ({ title: item.name, code: item.code, description: item.description ?? "" })}
        toPayload={(fd) => ({ title: fd.get("title"), code: fd.get("code"), description: fd.get("description") || null })}
      />

      <MasterDataEditorModal
        open={editDocs}
        onClose={() => setEditDocs(false)}
        title="Document Types"
        apiBase="/api/settings/document-types"
        fields={[
          { key: "name", label: "Name", placeholder: "NDA" },
          { key: "code", label: "Code", placeholder: "DOC-NDA" },
          { key: "description", label: "Description", type: "textarea", required: false, placeholder: "Optional description" },
        ]}
      />

      <MasterDataEditorModal
        open={editLocations}
        onClose={() => setEditLocations(false)}
        title="Locations"
        apiBase="/api/organization/locations"
        fields={[
          { key: "name", label: "Name", placeholder: "Head Office" },
          { key: "code", label: "Code", placeholder: "LOC-HO" },
          { key: "address", label: "Address", required: false, placeholder: "123 Main Street" },
          { key: "city", label: "City", required: false, placeholder: "Colombo" },
          { key: "country", label: "Country", required: false, placeholder: "Sri Lanka" },
        ]}
        toForm={(item) => ({
          name: item.name,
          code: item.code,
          address: (item.address as string) ?? "",
          city: (item.city as string) ?? "",
          country: (item.country as string) ?? "",
        })}
        toPayload={(fd) => ({
          name: fd.get("name"),
          code: fd.get("code"),
          address: fd.get("address") || null,
          city: fd.get("city") || null,
          country: fd.get("country") || null,
          isActive: true,
        })}
      />

      <MasterDataEditorModal
        open={editStatuses}
        onClose={() => setEditStatuses(false)}
        title="Employment Types"
        apiBase="/api/organization/employment-statuses"
        fields={[
          { key: "name", label: "Name", placeholder: "Full Time Permanent" },
          { key: "code", label: "Code", placeholder: "FullTimePermanent" },
          { key: "description", label: "Description", type: "textarea", required: false, placeholder: "Optional description" },
          { key: "sortOrder", label: "Sort Order", type: "number", required: false, placeholder: "0" },
        ]}
        toForm={(item) => ({
          name: item.name,
          code: item.code,
          description: (item.description as string) ?? "",
          sortOrder: String(item.sortOrder ?? 0),
        })}
        toPayload={(fd) => ({
          name: fd.get("name"),
          code: fd.get("code"),
          description: fd.get("description") || null,
          isActive: true,
          sortOrder: parseInt(String(fd.get("sortOrder") || "0"), 10),
        })}
      />

      <MasterDataEditorModal
        open={editEmpStatuses}
        onClose={() => setEditEmpStatuses(false)}
        title="Employee Statuses"
        apiBase="/api/organization/employee-statuses"
        fields={[
          { key: "name", label: "Name", placeholder: "Active" },
          { key: "code", label: "Code", placeholder: "Active" },
          { key: "description", label: "Description", type: "textarea", required: false, placeholder: "Optional description" },
          { key: "sortOrder", label: "Sort Order", type: "number", required: false, placeholder: "0" },
        ]}
        toForm={(item) => ({
          name: item.name,
          code: item.code,
          description: (item.description as string) ?? "",
          sortOrder: String(item.sortOrder ?? 0),
        })}
        toPayload={(fd) => ({
          name: fd.get("name"),
          code: fd.get("code"),
          description: fd.get("description") || null,
          isActive: true,
          sortOrder: parseInt(String(fd.get("sortOrder") || "0"), 10),
        })}
      />

      <MasterDataEditorModal
        open={editSkills}
        onClose={() => setEditSkills(false)}
        title="Skills (People Hub qualifications)"
        apiBase="/api/employees/skills-catalog"
        codeColumnHeader="Category"
        fields={[
          { key: "name", label: "Skill name", placeholder: "e.g. Project management" },
          { key: "code", label: "Category", required: false, placeholder: "e.g. Leadership (optional)" },
          { key: "description", label: "Description", type: "textarea", required: false, placeholder: "Optional notes" },
          { key: "isActive", label: "Active (shown in People Hub skill dropdown)", type: "checkbox", required: false, defaultForAdd: true },
        ]}
        toForm={(item) => ({
          name: item.name,
          code: (item.category as string) ?? item.code ?? "",
          description: (item.description as string) ?? "",
          isActive: item.isActive !== false,
        })}
        toPayload={(fd) => ({
          name: fd.get("name"),
          category: fd.get("code") || null,
          description: fd.get("description") || null,
          isActive: fd.get("isActive") === "on",
        })}
      />

      <MasterDataEditorModal
        open={editAttachmentTypes}
        onClose={() => setEditAttachmentTypes(false)}
        title="Profile attachment types (People Hub)"
        apiBase="/api/employees/profile-attachment-types"
        fields={[
          { key: "name", label: "Name", placeholder: "e.g. Passport copy" },
          { key: "code", label: "Code", placeholder: "ATT-PASS" },
          { key: "description", label: "Description", type: "textarea", required: false, placeholder: "Optional" },
          { key: "sortOrder", label: "Sort order", type: "number", required: false, placeholder: "0" },
          { key: "isActive", label: "Active (available in profile upload)", type: "checkbox", required: false, defaultForAdd: true },
        ]}
        toForm={(item) => ({
          name: item.name,
          code: item.code,
          description: (item.description as string) ?? "",
          sortOrder: String(item.sortOrder ?? 0),
          isActive: item.isActive !== false,
        })}
        toPayload={(fd) => ({
          name: fd.get("name"),
          code: fd.get("code"),
          description: fd.get("description") || null,
          sortOrder: parseInt(String(fd.get("sortOrder") || "0"), 10),
          isActive: fd.get("isActive") === "on",
        })}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="section-title">
            <h3>Workflow Builder</h3>
          </div>
          <div className="hris-list">
            <div className="hris-list-item">
              <div><strong>Leave approval chain</strong><small>Employee &rarr; Manager &rarr; HR for exceptions</small></div>
              <span className="badge badge-blue">Live</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Salary revision</strong><small>Manager &rarr; HR &rarr; Finance &rarr; CEO</small></div>
              <span className="badge badge-orange">Restricted</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Separation clearance</strong><small>HR, IT, Admin, Finance sign-off</small></div>
              <span className="badge badge-blue">Live</span>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="section-title">
            <h3>Security Model</h3>
          </div>
          <table className="hris-table">
            <thead><tr><th>Role</th><th>Scope</th></tr></thead>
            <tbody>
              <tr><td>Employee</td><td>Self-service only</td></tr>
              <tr><td>Manager</td><td>Direct team and approvals</td></tr>
              <tr><td>HRBP</td><td>Assigned business units</td></tr>
              <tr><td>HR Admin</td><td>Full operational control</td></tr>
              <tr><td>Payroll Admin</td><td>Compensation-restricted</td></tr>
            </tbody>
          </table>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="section-title">
            <h3>Localization</h3>
          </div>
          <div className="hris-list">
            <div className="hris-list-item">
              <div><strong>Company calendars</strong><small>Public holidays and work week</small></div>
              <span>&#10003;</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Leave rules</strong><small>Country/entity specific entitlements</small></div>
              <span>&#10003;</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Currencies &amp; language packs</strong><small>Regional deployment ready</small></div>
              <span>&#10003;</span>
            </div>
          </div>
        </div>
      </div>

      {/* Master Data Blocks */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="section-title">
            <h3>Master Data Blocks</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-[var(--bg-subtle)] px-4 py-3">
              <div>
                <strong className="text-sm font-semibold text-[var(--text)]">Business Units</strong>
                <div className="text-xs text-[var(--text-muted)]">{counts.businessUnits} configured</div>
              </div>
              <button onClick={() => setEditBU(true)} className="text-sm font-medium text-[var(--primary)] hover:underline">Edit</button>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-[var(--bg-subtle)] px-4 py-3">
              <div>
                <strong className="text-sm font-semibold text-[var(--text)]">Grades &amp; Bands</strong>
                <div className="text-xs text-[var(--text-muted)]">{counts.grades} pay grades</div>
              </div>
              <button onClick={() => setEditGrades(true)} className="text-sm font-medium text-[var(--primary)] hover:underline">Edit</button>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-[var(--bg-subtle)] px-4 py-3">
              <div>
                <strong className="text-sm font-semibold text-[var(--text)]">Job Catalog</strong>
                <div className="text-xs text-[var(--text-muted)]">{counts.jobTitles} job titles</div>
              </div>
              <button onClick={() => setEditJobs(true)} className="text-sm font-medium text-[var(--primary)] hover:underline">Edit</button>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-[var(--bg-subtle)] px-4 py-3">
              <div>
                <strong className="text-sm font-semibold text-[var(--text)]">Document Types</strong>
                <div className="text-xs text-[var(--text-muted)]">NDA, contract, visa, NIC</div>
              </div>
              <button onClick={() => setEditDocs(true)} className="text-sm font-medium text-[var(--primary)] hover:underline">Edit</button>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-[var(--bg-subtle)] px-4 py-3">
              <div>
                <strong className="text-sm font-semibold text-[var(--text)]">Locations</strong>
                <div className="text-xs text-[var(--text-muted)]">{counts.locations} location{counts.locations !== 1 ? "s" : ""} configured</div>
              </div>
              <button onClick={() => setEditLocations(true)} className="text-sm font-medium text-[var(--primary)] hover:underline">Edit</button>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-[var(--bg-subtle)] px-4 py-3">
              <div>
                <strong className="text-sm font-semibold text-[var(--text)]">Employment Types</strong>
                <div className="text-xs text-[var(--text-muted)]">{counts.statuses} type{counts.statuses !== 1 ? "s" : ""} configured</div>
              </div>
              <button onClick={() => setEditStatuses(true)} className="text-sm font-medium text-[var(--primary)] hover:underline">Edit</button>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-[var(--bg-subtle)] px-4 py-3">
              <div>
                <strong className="text-sm font-semibold text-[var(--text)]">Employee Statuses</strong>
                <div className="text-xs text-[var(--text-muted)]">{counts.empStatuses} status{counts.empStatuses !== 1 ? "es" : ""} configured</div>
              </div>
              <button onClick={() => setEditEmpStatuses(true)} className="text-sm font-medium text-[var(--primary)] hover:underline">Edit</button>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-[var(--bg-subtle)] px-4 py-3">
              <div>
                <strong className="text-sm font-semibold text-[var(--text)]">Skills</strong>
                <div className="text-xs text-[var(--text-muted)]">{counts.skills} skill{counts.skills !== 1 ? "s" : ""} in catalog (People qualifications)</div>
              </div>
              <button type="button" onClick={() => setEditSkills(true)} className="text-sm font-medium text-[var(--primary)] hover:underline">Edit</button>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-[var(--bg-subtle)] px-4 py-3">
              <div>
                <strong className="text-sm font-semibold text-[var(--text)]">Profile attachment types</strong>
                <div className="text-xs text-[var(--text-muted)]">{counts.attachmentTypes} type{counts.attachmentTypes !== 1 ? "s" : ""} (Personal details attachments)</div>
              </div>
              <button type="button" onClick={() => setEditAttachmentTypes(true)} className="text-sm font-medium text-[var(--primary)] hover:underline">Edit</button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="section-title">
            <h3>Audit &amp; Compliance</h3>
          </div>
          <table className="hris-table">
            <thead><tr><th>Control</th><th>Description</th></tr></thead>
            <tbody>
              <tr>
                <td>Outbound email log</td>
                <td>
                  Status of every transactional email (SendGrid/SMTP): recipient, subject, sent/failed/skipped, provider response.{" "}
                  <Link href={ROUTES.emailDeliveryLog} className="font-medium text-blue-600 hover:underline">
                    Open email delivery log
                  </Link>
                </td>
              </tr>
              <tr><td>Audit trail</td><td>Every master and transaction change logged with user, time, old/new value</td></tr>
              <tr><td>Document retention</td><td>Controlled storage and expiry/removal policies</td></tr>
              <tr><td>PII protection</td><td>Field masking, encryption, scoped exports</td></tr>
              <tr><td>Approval evidence</td><td>Who approved, comments, timestamps, attached files</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="section-title">
            <h3>Employee Code Format</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl bg-[var(--bg-subtle)] px-4 py-3">
              <div>
                <strong className="text-sm font-semibold text-[var(--text)]">Auto-generate employee code</strong>
                <div className="text-xs text-[var(--text-muted)]">
                  {codeAutoGen ? "Codes are automatically assigned on creation" : "Users must enter the code manually"}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={codeAutoGen}
                onClick={() => setCodeAutoGen(!codeAutoGen)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${codeAutoGen ? "bg-[var(--primary)]" : "bg-gray-300"}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${codeAutoGen ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>

            {codeAutoGen && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Prefix</label>
                    <input
                      value={codePrefix}
                      onChange={(e) => setCodePrefix(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
                      placeholder="EMP"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Numeric Length</label>
                    <input
                      type="number"
                      min={3}
                      max={12}
                      value={codeLength}
                      onChange={(e) => setCodeLength(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
                    />
                  </div>
                </div>
                <div className="rounded-xl bg-[var(--bg-subtle)] px-4 py-3">
                  <span className="text-xs text-[var(--text-muted)]">Preview: </span>
                  <span className="font-mono text-sm font-semibold text-[var(--text)]">{codePreview}</span>
                </div>
              </>
            )}

            <div className="flex items-center justify-end gap-3">
              {codeMsg && (
                <span className={`text-xs ${codeMsg.includes("success") ? "text-green-600" : "text-red-500"}`}>
                  {codeMsg}
                </span>
              )}
              <button
                onClick={saveCodeSettings}
                disabled={codeSaving}
                className="rounded-lg bg-[var(--primary)] px-4 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {codeSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="section-title">
            <h3>Platform Settings</h3>
          </div>
          <div className="hris-list">
            <div className="hris-list-item">
              <div><strong>API integrations</strong><small>Payroll, biometrics, email, identity provider</small></div>
              <span>&rarr;</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Notification engine</strong><small>Email, in-app, SMS, Teams/Slack optional</small></div>
              <span>&rarr;</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Master configuration</strong><small>Legal entities, documents, lookups, numbering</small></div>
              <span>&rarr;</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
