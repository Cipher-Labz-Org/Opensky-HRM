"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { CreateRoleModal } from "@/components/forms/CreateRoleModal";
import { MasterDataEditorModal } from "@/components/forms/MasterDataEditorModal";
import { apiFetch } from "@/lib/api";
import { getSystemSetting } from "@/lib/system-settings";
import { AttendancePlacesModal } from "@/components/settings/AttendancePlacesModal";
import { MobileConnectionQr } from "@/components/settings/MobileConnectionQr";
import Link from "next/link";
import { ROUTES } from "@/config/routes";
import { useAuth } from "@/contexts/auth-context";
import { formatInt } from "@/lib/workspace-charts";

interface CountSummary {
  businessUnits: number;
  grades: number;
  jobTitles: number;
  locations: number;
  statuses: number;
  empStatuses: number;
  skills: number;
  skillTemplates: number;
  attachmentTypes: number;
  attendancePlaces: number;
}

export default function SettingsPage() {
  const { isAdmin } = useAuth();
  const searchParams = useSearchParams();
  const [editBU, setEditBU] = useState(false);
  const [editGrades, setEditGrades] = useState(false);
  const [editJobs, setEditJobs] = useState(false);
  const [editDocs, setEditDocs] = useState(false);
  const [editLocations, setEditLocations] = useState(false);
  const [editStatuses, setEditStatuses] = useState(false);
  const [editEmpStatuses, setEditEmpStatuses] = useState(false);
  const [editSkills, setEditSkills] = useState(false);
  const [editSkillTemplates, setEditSkillTemplates] = useState(false);
  const [editAttachmentTypes, setEditAttachmentTypes] = useState(false);
  const [editAttendancePlaces, setEditAttendancePlaces] = useState(false);
  const [attendanceCheckInMode, setAttendanceCheckInMode] = useState("BusinessUnitQr");
  const [attendanceModeSaving, setAttendanceModeSaving] = useState(false);
  const [attendanceModeMsg, setAttendanceModeMsg] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [counts, setCounts] = useState<CountSummary>({ businessUnits: 0, grades: 0, jobTitles: 0, locations: 0, statuses: 0, empStatuses: 0, skills: 0, skillTemplates: 0, attachmentTypes: 0, attendancePlaces: 0 });

  const [codeAutoGen, setCodeAutoGen] = useState(true);
  const [codeLength, setCodeLength] = useState("6");
  const [codePrefix, setCodePrefix] = useState("EMP");
  const [codeSaving, setCodeSaving] = useState(false);
  const [codeMsg, setCodeMsg] = useState("");
  const [codePreview, setCodePreview] = useState("");

  const [approvalLevels, setApprovalLevels] = useState(1);
  const [approvalConfigSaving, setApprovalConfigSaving] = useState(false);

  const [openAiEnabled, setOpenAiEnabled] = useState(false);
  const [openAiSidekickEnabled, setOpenAiSidekickEnabled] = useState(true);
  const [openAiModel, setOpenAiModel] = useState("gpt-4o-mini");
  const [openAiProvider, setOpenAiProvider] = useState("OpenAI");
  const [openAiAzureEndpoint, setOpenAiAzureEndpoint] = useState("");
  const [openAiAzureDeployment, setOpenAiAzureDeployment] = useState("");
  const [openAiAzureApiVersion, setOpenAiAzureApiVersion] = useState("2024-02-15-preview");
  const [openAiRegion, setOpenAiRegion] = useState("");
  const [openAiChatRetentionDays, setOpenAiChatRetentionDays] = useState(90);
  const [openAiAuditRetentionDays, setOpenAiAuditRetentionDays] = useState(365);
  const [openAiAllowPersonalNames, setOpenAiAllowPersonalNames] = useState(false);
  const [openAiApiKey, setOpenAiApiKey] = useState("");
  const [openAiApiKeyConfigured, setOpenAiApiKeyConfigured] = useState(false);
  const [openAiSaving, setOpenAiSaving] = useState(false);
  const [openAiMsg, setOpenAiMsg] = useState("");

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
      apiFetch<{ id: string }[]>("/api/recruitment/skill-templates").then((r) => r.length).catch(() => 0),
      apiFetch<{ id: string }[]>("/api/employees/profile-attachment-types").then((r) => r.length).catch(() => 0),
      apiFetch<{ id: string }[]>("/api/attendance/places").then((r) => r.length).catch(() => 0),
    ]).then(([businessUnits, grades, jobTitles, locations, statuses, empStatuses, skills, skillTemplates, attachmentTypes, attendancePlaces]) =>
      setCounts({ businessUnits, grades, jobTitles, locations, statuses, empStatuses, skills, skillTemplates, attachmentTypes, attendancePlaces })
    );
  }, [editBU, editGrades, editJobs, editLocations, editStatuses, editEmpStatuses, editSkills, editSkillTemplates, editAttachmentTypes, editAttendancePlaces]);

  function applySystemSettings(settings: Record<string, string>) {
    const autoGen = getSystemSetting(settings, "EmployeeCodeAutoGenerate");
    if (autoGen !== undefined) setCodeAutoGen(autoGen !== "false");
    const length = getSystemSetting(settings, "EmployeeCodeLength");
    if (length !== undefined) setCodeLength(length);
    const prefix = getSystemSetting(settings, "EmployeeCodePrefix");
    if (prefix !== undefined) setCodePrefix(prefix);
    setAttendanceCheckInMode(getSystemSetting(settings, "AttendanceCheckInMode") ?? "BusinessUnitQr");
    setCompanyName(getSystemSetting(settings, "CompanyName") ?? "");
  }

  useEffect(() => {
    apiFetch<Record<string, string>>("/api/system-settings")
      .then(applySystemSettings)
      .catch(() => {});
    apiFetch<{
      enabled: boolean;
      sidekickEnabled: boolean;
      model: string;
      apiKeyConfigured: boolean;
      provider?: string;
      azureEndpoint?: string;
      azureDeployment?: string;
      azureApiVersion?: string;
      region?: string;
      chatRetentionDays?: number;
      auditRetentionDays?: number;
      allowPersonalNamesInLlm?: boolean;
    }>("/api/system-settings/openai")
      .then((data) => {
        setOpenAiEnabled(data.enabled);
        setOpenAiSidekickEnabled(data.sidekickEnabled ?? true);
        setOpenAiModel(data.model || "gpt-4o-mini");
        setOpenAiProvider(data.provider || "OpenAI");
        setOpenAiAzureEndpoint(data.azureEndpoint || "");
        setOpenAiAzureDeployment(data.azureDeployment || "");
        setOpenAiAzureApiVersion(data.azureApiVersion || "2024-02-15-preview");
        setOpenAiRegion(data.region || "");
        setOpenAiChatRetentionDays(data.chatRetentionDays ?? 90);
        setOpenAiAuditRetentionDays(data.auditRetentionDays ?? 365);
        setOpenAiAllowPersonalNames(data.allowPersonalNamesInLlm ?? false);
        setOpenAiApiKeyConfigured(data.apiKeyConfigured);
        setOpenAiApiKey("");
      })
      .catch(() => {});
  }, []);

  async function saveOpenAiSettings() {
    setOpenAiSaving(true);
    setOpenAiMsg("");
    try {
      const updated = await apiFetch<{
        enabled: boolean;
        sidekickEnabled: boolean;
        model: string;
        apiKeyConfigured: boolean;
        provider?: string;
        azureEndpoint?: string;
        azureDeployment?: string;
        azureApiVersion?: string;
        region?: string;
        chatRetentionDays?: number;
        auditRetentionDays?: number;
        allowPersonalNamesInLlm?: boolean;
      }>(
        "/api/system-settings/openai",
        {
          method: "PUT",
          body: JSON.stringify({
            enabled: openAiEnabled,
            sidekickEnabled: openAiSidekickEnabled,
            model: openAiModel.trim() || "gpt-4o-mini",
            apiKey: openAiApiKey.trim() || null,
            provider: openAiProvider,
            azureEndpoint: openAiAzureEndpoint.trim() || null,
            azureDeployment: openAiAzureDeployment.trim() || null,
            azureApiVersion: openAiAzureApiVersion.trim() || "2024-02-15-preview",
            region: openAiRegion.trim() || null,
            chatRetentionDays: openAiChatRetentionDays,
            auditRetentionDays: openAiAuditRetentionDays,
            allowPersonalNamesInLlm: openAiAllowPersonalNames,
          }),
        }
      );
      setOpenAiEnabled(updated.enabled);
      setOpenAiSidekickEnabled(updated.sidekickEnabled ?? true);
      setOpenAiModel(updated.model || "gpt-4o-mini");
      setOpenAiProvider(updated.provider || "OpenAI");
      setOpenAiAzureEndpoint(updated.azureEndpoint || "");
      setOpenAiAzureDeployment(updated.azureDeployment || "");
      setOpenAiAzureApiVersion(updated.azureApiVersion || "2024-02-15-preview");
      setOpenAiRegion(updated.region || "");
      setOpenAiChatRetentionDays(updated.chatRetentionDays ?? 90);
      setOpenAiAuditRetentionDays(updated.auditRetentionDays ?? 365);
      setOpenAiAllowPersonalNames(updated.allowPersonalNamesInLlm ?? false);
      setOpenAiApiKeyConfigured(updated.apiKeyConfigured);
      setOpenAiApiKey("");
      setOpenAiMsg("OpenAI settings saved successfully");
      setTimeout(() => setOpenAiMsg(""), 3000);
    } catch (err) {
      setOpenAiMsg(err instanceof Error ? err.message : "Failed to save OpenAI settings");
    } finally {
      setOpenAiSaving(false);
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

  async function saveAttendanceCheckInMode() {
    setAttendanceModeSaving(true);
    setAttendanceModeMsg("");
    try {
      await apiFetch("/api/system-settings/AttendanceCheckInMode", {
        method: "PUT",
        body: JSON.stringify({ value: attendanceCheckInMode }),
      });
      setAttendanceModeMsg("Saved successfully.");
    } catch (err) {
      setAttendanceModeMsg(err instanceof Error ? err.message : "Failed to save attendance check-in mode.");
    } finally {
      setAttendanceModeSaving(false);
    }
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

  return (
    <>
      <AppTopbar title="Policy, Security & Configuration" />

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

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-slate-900">Quick links</h3>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href={ROUTES.companyProfile}
            className="group rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-800">Company Profile</div>
              </div>
              <span className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700">→</span>
            </div>
          </Link>
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

      {/* Recruitment / OpenAI */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm mb-6">
        <div className="section-title">
          <h3>Recruitment — OpenAI</h3>
        </div>
        <div className="space-y-4 px-1 py-3">
          <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">
            Powers <strong>Suggest with AI</strong> on the Create Requisition form. Your API key is stored securely and never shown again after saving.
          </p>
          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={openAiEnabled}
              onChange={(e) => setOpenAiEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]/20"
            />
            <span className="text-sm font-medium text-[var(--text)]">Enable OpenAI integration</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={openAiSidekickEnabled}
              onChange={(e) => setOpenAiSidekickEnabled(e.target.checked)}
              disabled={!openAiEnabled}
              className="h-4 w-4 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]/20 disabled:opacity-50"
            />
            <span className="text-sm font-medium text-[var(--text)]">Enable OpenSky AI (global HR assistant)</span>
          </label>
          <p className="text-[11px] leading-relaxed text-[var(--text-muted)] -mt-2">
            OpenSky AI uses the same API key and model. For GDPR production use, choose <strong>Azure OpenAI</strong> in an EU region and keep personal names disabled.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">AI provider</label>
              <select
                value={openAiProvider}
                onChange={(e) => setOpenAiProvider(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
              >
                <option value="OpenAI">OpenAI API</option>
                <option value="AzureOpenAI">Azure OpenAI (recommended for EU)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Region (audit label)</label>
              <input
                value={openAiRegion}
                onChange={(e) => setOpenAiRegion(e.target.value)}
                placeholder="e.g. swedencentral"
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
              />
            </div>
          </div>
          {openAiProvider === "AzureOpenAI" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Azure endpoint</label>
                <input
                  value={openAiAzureEndpoint}
                  onChange={(e) => setOpenAiAzureEndpoint(e.target.value)}
                  placeholder="https://your-resource.openai.azure.com"
                  className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Deployment name</label>
                <input
                  value={openAiAzureDeployment}
                  onChange={(e) => setOpenAiAzureDeployment(e.target.value)}
                  placeholder="gpt-4o-mini"
                  className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">API version</label>
                <input
                  value={openAiAzureApiVersion}
                  onChange={(e) => setOpenAiAzureApiVersion(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
                />
              </div>
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">OpenAI API key</label>
              <input
                type="password"
                value={openAiApiKey}
                onChange={(e) => setOpenAiApiKey(e.target.value)}
                autoComplete="off"
                placeholder={openAiApiKeyConfigured ? "Configured — leave blank to keep current key" : "sk-…"}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
              />
              {openAiApiKeyConfigured ? (
                <p className="mt-1.5 text-[11px] text-green-700">An API key is saved on the server.</p>
              ) : null}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Model</label>
              <input
                value={openAiModel}
                onChange={(e) => setOpenAiModel(e.target.value)}
                placeholder="gpt-4o-mini"
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
              />
              <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">
                Default: gpt-4o-mini. Server env <code className="text-[10px]">OPENAI_API_KEY</code> is used if no key is saved here.
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Chat retention (days)</label>
              <input
                type="number"
                min={1}
                value={openAiChatRetentionDays}
                onChange={(e) => setOpenAiChatRetentionDays(Number(e.target.value) || 90)}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Audit log retention (days)</label>
              <input
                type="number"
                min={1}
                value={openAiAuditRetentionDays}
                onChange={(e) => setOpenAiAuditRetentionDays(Number(e.target.value) || 365)}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
              />
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={openAiAllowPersonalNames}
              onChange={(e) => setOpenAiAllowPersonalNames(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]/20"
            />
            <span className="text-sm font-medium text-[var(--text)]">Allow employee names in AI requests (not recommended for GDPR)</span>
          </label>
          <div className="flex items-center justify-end gap-3 pt-1">
            {openAiMsg ? (
              <span className={`text-xs font-medium ${openAiMsg.includes("success") ? "text-green-600" : "text-red-500"}`}>
                {openAiMsg}
              </span>
            ) : null}
            <button
              type="button"
              onClick={saveOpenAiSettings}
              disabled={openAiSaving}
              className="rounded-lg bg-[var(--primary)] px-5 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {openAiSaving ? "Saving..." : "Save OpenAI Settings"}
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
      <AttendancePlacesModal
        open={editAttendancePlaces}
        onClose={() => setEditAttendancePlaces(false)}
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
        open={editSkillTemplates}
        onClose={() => setEditSkillTemplates(false)}
        title="Recruitment role skill templates"
        apiBase="/api/recruitment/skill-templates"
        codeColumnHeader="Keywords"
        fields={[
          { key: "name", label: "Template name", placeholder: "e.g. Chef / Culinary" },
          { key: "code", label: "Keywords (pipe-separated)", placeholder: "chef|sous chef|culinary|cook" },
          { key: "description", label: "Skills (comma-separated)", type: "textarea", placeholder: "Food safety, Menu costing, Knife skills…" },
          { key: "sortOrder", label: "Sort order", type: "number", required: false, placeholder: "0" },
          { key: "isActive", label: "Active", type: "checkbox", required: false, defaultForAdd: true },
        ]}
        toForm={(item) => ({
          name: item.name,
          code: (item.keywords as string) ?? item.code ?? "",
          description: (item.skills as string) ?? item.description ?? "",
          sortOrder: typeof item.sortOrder === "number" ? item.sortOrder : 0,
          isActive: item.isActive !== false,
        })}
        toPayload={(fd) => ({
          name: fd.get("name"),
          keywords: fd.get("code"),
          skills: fd.get("description"),
          sortOrder: parseInt(String(fd.get("sortOrder") || "0"), 10),
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

      {/* Mobile connection & attendance */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="section-title">
            <h3>Connect mobile app</h3>
          </div>
          <div className="space-y-4 px-1 py-3">
            <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">
              Employees scan this QR code in the <strong>OpenSky HRM</strong> mobile app to connect to this
              company&apos;s backend. You can also share the backend URL manually if scanning is not possible.
            </p>
            <MobileConnectionQr companyName={companyName} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="section-title">
            <h3>Attendance Check-in</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Check-in mode</label>
              <select
                value={attendanceCheckInMode}
                onChange={(e) => setAttendanceCheckInMode(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
              >
                <option value="Open">Open — GPS and QR optional (not recommended)</option>
                <option value="LocationGeofence">Location geofence — employee home location</option>
                <option value="BusinessUnitQr">QR required — business unit or location QR</option>
                <option value="BusinessUnitGeofence">Business unit geofence</option>
                <option value="Hybrid">Hybrid — QR + geofence</option>
              </select>
              <p className="mt-1.5 text-xs text-[var(--text-muted)]">
                Use &quot;QR required&quot; so mobile users must scan a business unit or location QR to punch.
                The web header Punch in / out still maps to attendance without a QR scan.
                Configure attendance places with coordinates before enabling geofence modes.
              </p>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-[var(--bg-subtle)] px-4 py-3">
              <div>
                <strong className="text-sm font-semibold text-[var(--text)]">Attendance places</strong>
                <div className="text-xs text-[var(--text-muted)]">
                  {counts.attendancePlaces} place{counts.attendancePlaces !== 1 ? "s" : ""} with geo coordinates
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditAttendancePlaces(true)}
                className="text-sm font-medium text-[var(--primary)] hover:underline"
              >
                Edit
              </button>
            </div>
            <div className="flex items-center justify-end gap-3">
              {attendanceModeMsg ? (
                <span className={`text-xs font-medium ${attendanceModeMsg.includes("success") ? "text-green-600" : "text-red-500"}`}>
                  {attendanceModeMsg}
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => void saveAttendanceCheckInMode()}
                disabled={attendanceModeSaving}
                className="rounded-lg bg-[var(--primary)] px-5 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {attendanceModeSaving ? "Saving..." : "Save Check-in Mode"}
              </button>
            </div>
          </div>
        </div>
      </div>

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
                <strong className="text-sm font-semibold text-[var(--text)]">Recruitment skill templates</strong>
                <div className="text-xs text-[var(--text-muted)]">{counts.skillTemplates} role template{counts.skillTemplates !== 1 ? "s" : ""} (e.g. Chef, Engineer)</div>
              </div>
              <button type="button" onClick={() => setEditSkillTemplates(true)} className="text-sm font-medium text-[var(--primary)] hover:underline">Edit</button>
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
