"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { Button } from "@/components/ui/Button";
import { CompanyLogoDisplay } from "@/components/branding/CompanyLogoDisplay";
import { PhoneInput, EmailInput, FlashMessageBanner, type FlashMessage, FormSelect } from "@/components/ui";
import { isValidPhone, isValidEmailInput, isValidEmailFormat, PHONE_VALIDATION_MESSAGE, EMAIL_INPUT_VALIDATION_MESSAGE, EMAIL_FORMAT_VALIDATION_MESSAGE } from "@/lib/input-validation";
import { currencySelectOptions, DEFAULT_CURRENCY } from "@/lib/currencies";
import { CreateRoleModal } from "@/components/forms/CreateRoleModal";
import { MasterDataEditorModal } from "@/components/forms/MasterDataEditorModal";
import { apiFetch } from "@/lib/api";
import { getSystemSetting } from "@/lib/system-settings";
import {
  clampLogoOffset,
  clampLogoScale,
  isAllowedCompanyLogoFile,
  isPdfLogoUrl,
  LOGO_OFFSET_MAX,
  LOGO_OFFSET_MIN,
  LOGO_SCALE_MAX,
  LOGO_SCALE_MIN,
  normalizeLogoDisplaySettings,
  parseLogoDisplaySettings,
  resolveCompanyLogoSrc,
} from "@/lib/company-branding";
import { normalizeCompanyLogoUpload, pdfUrlToPngFile } from "@/lib/render-pdf-logo";
import { API_BASE_URL, getApiBaseUrl } from "@/config/constants";
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
  const [counts, setCounts] = useState<CountSummary>({ businessUnits: 0, grades: 0, jobTitles: 0, locations: 0, statuses: 0, empStatuses: 0, skills: 0, skillTemplates: 0, attachmentTypes: 0 });

  const [codeAutoGen, setCodeAutoGen] = useState(true);
  const [codeLength, setCodeLength] = useState("6");
  const [codePrefix, setCodePrefix] = useState("EMP");
  const [codeSaving, setCodeSaving] = useState(false);
  const [codeMsg, setCodeMsg] = useState("");
  const [codePreview, setCodePreview] = useState("");

  const [approvalLevels, setApprovalLevels] = useState(1);
  const [approvalConfigSaving, setApprovalConfigSaving] = useState(false);

  const [companyLogoUrl, setCompanyLogoUrl] = useState("");
  const [logoLoginScale, setLogoLoginScale] = useState(100);
  const [logoLoginOffsetX, setLogoLoginOffsetX] = useState(0);
  const [logoLoginOffsetY, setLogoLoginOffsetY] = useState(0);
  const [logoDisplaySaving, setLogoDisplaySaving] = useState(false);
  const logoDragRef = useRef<{ startX: number; startY: number; startOffsetX: number; startOffsetY: number } | null>(null);
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
  const [defaultCurrency, setDefaultCurrency] = useState(DEFAULT_CURRENCY);
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
      apiFetch<{ id: string }[]>("/api/recruitment/skill-templates").then((r) => r.length).catch(() => 0),
      apiFetch<{ id: string }[]>("/api/employees/profile-attachment-types").then((r) => r.length).catch(() => 0),
    ]).then(([businessUnits, grades, jobTitles, locations, statuses, empStatuses, skills, skillTemplates, attachmentTypes]) =>
      setCounts({ businessUnits, grades, jobTitles, locations, statuses, empStatuses, skills, skillTemplates, attachmentTypes })
    );
  }, [editBU, editGrades, editJobs, editLocations, editStatuses, editEmpStatuses, editSkills, editSkillTemplates, editAttachmentTypes]);

  async function persistLogoDisplaySettings(display: {
    scale: number;
    offsetX: number;
    offsetY: number;
  }) {
    await Promise.all([
      apiFetch("/api/system-settings/CompanyLogoLoginScale", {
        method: "PUT",
        body: JSON.stringify({ value: String(display.scale) }),
      }),
      apiFetch("/api/system-settings/CompanyLogoLoginOffsetX", {
        method: "PUT",
        body: JSON.stringify({ value: String(display.offsetX) }),
      }),
      apiFetch("/api/system-settings/CompanyLogoLoginOffsetY", {
        method: "PUT",
        body: JSON.stringify({ value: String(display.offsetY) }),
      }),
      apiFetch("/api/system-settings/CompanyLogoLoginFit", {
        method: "PUT",
        body: JSON.stringify({ value: "contain" }),
      }),
    ]);
  }

  function applySystemSettings(settings: Record<string, string>) {
    const autoGen = getSystemSetting(settings, "EmployeeCodeAutoGenerate");
    if (autoGen !== undefined) setCodeAutoGen(autoGen !== "false");
    const length = getSystemSetting(settings, "EmployeeCodeLength");
    if (length !== undefined) setCodeLength(length);
    const prefix = getSystemSetting(settings, "EmployeeCodePrefix");
    if (prefix !== undefined) setCodePrefix(prefix);
    setCompanyLogoUrl(getSystemSetting(settings, "CompanyLogoUrl") ?? "");
    const parsed = parseLogoDisplaySettings({
      CompanyLogoLoginScale: getSystemSetting(settings, "CompanyLogoLoginScale"),
      CompanyLogoLoginOffsetX: getSystemSetting(settings, "CompanyLogoLoginOffsetX"),
      CompanyLogoLoginOffsetY: getSystemSetting(settings, "CompanyLogoLoginOffsetY"),
    });
    const { settings: logoDisplay, repaired } = normalizeLogoDisplaySettings(parsed);
    setLogoLoginScale(logoDisplay.scale);
    setLogoLoginOffsetX(logoDisplay.offsetX);
    setLogoLoginOffsetY(logoDisplay.offsetY);
    if (repaired && getSystemSetting(settings, "CompanyLogoUrl")) {
      void persistLogoDisplaySettings(logoDisplay);
    }
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
    setDefaultCurrency((getSystemSetting(settings, "DefaultCurrency") ?? DEFAULT_CURRENCY).toUpperCase());
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

  async function uploadLogoFile(file: File, successMessage: string) {
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
    setLogoLoginScale(100);
    setLogoLoginOffsetX(0);
    setLogoLoginOffsetY(0);
    await persistLogoDisplaySettings({ scale: 100, offsetX: 0, offsetY: 0 }).catch(() => {});
    setLogoFlash({ type: "ok", text: successMessage });
  }

  async function handleLogoUpload(file: File) {
    if (!isAllowedCompanyLogoFile(file)) {
      setLogoFlash({ type: "err", text: "Use PNG, JPEG, WebP, GIF, SVG, or PDF." });
      return;
    }
    setLogoUploading(true);
    setLogoFlash(null);
    try {
      const wasPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      const uploadFile = await normalizeCompanyLogoUpload(file);
      await uploadLogoFile(
        uploadFile,
        wasPdf
          ? "PDF converted to image and uploaded — logo is ready for the sign-in circle"
          : "Logo uploaded successfully",
      );
    } catch (e: unknown) {
      setLogoFlash({
        type: "err",
        text: e instanceof Error ? e.message : "Upload failed",
      });
    } finally {
      setLogoUploading(false);
    }
  }

  /** Convert an existing PDF logo to PNG once so the circle works reliably. */
  useEffect(() => {
    if (!companyLogoUrl || !isPdfLogoUrl(companyLogoUrl)) return;
    let cancelled = false;
    (async () => {
      setLogoUploading(true);
      setLogoFlash({ type: "ok", text: "Converting PDF logo to image for the sign-in circle…" });
      try {
        const png = await pdfUrlToPngFile(
          resolveCompanyLogoSrc(companyLogoUrl) ?? companyLogoUrl,
          "company_logo.png",
        );
        if (cancelled) return;
        await uploadLogoFile(png, "PDF logo converted to image — sign-in circle is fixed");
      } catch {
        if (!cancelled) {
          setLogoFlash({
            type: "err",
            text: "Could not convert PDF logo. Click Replace and upload a PNG/JPG instead.",
          });
        }
      } finally {
        if (!cancelled) setLogoUploading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyLogoUrl]);

  async function handleLogoRemove() {
    try {
      await apiFetch("/api/system-settings/company-logo", { method: "DELETE" });
      setCompanyLogoUrl("");
      setLogoLoginScale(100);
      setLogoLoginOffsetX(0);
      setLogoLoginOffsetY(0);
      setLogoFlash({ type: "ok", text: "Logo removed successfully" });
    } catch {
      setLogoFlash({ type: "err", text: "Failed to remove logo" });
    }
  }

  async function saveLogoDisplaySettings() {
    setLogoDisplaySaving(true);
    setLogoFlash(null);
    const display = {
      scale: clampLogoScale(logoLoginScale),
      offsetX: logoLoginOffsetX,
      offsetY: logoLoginOffsetY,
    };
    setLogoLoginScale(display.scale);
    try {
      await persistLogoDisplaySettings(display);
      setLogoFlash({ type: "ok", text: "Login logo display saved" });
    } catch {
      setLogoFlash({ type: "err", text: "Failed to save logo display settings" });
    } finally {
      setLogoDisplaySaving(false);
    }
  }

  async function resetLogoDisplaySettings() {
    setLogoLoginScale(100);
    setLogoLoginOffsetX(0);
    setLogoLoginOffsetY(0);
    setLogoDisplaySaving(true);
    setLogoFlash(null);
    try {
      await persistLogoDisplaySettings({ scale: 100, offsetX: 0, offsetY: 0 });
      setLogoFlash({ type: "ok", text: "Logo display reset to center" });
    } catch {
      setLogoFlash({ type: "err", text: "Failed to reset logo display" });
    } finally {
      setLogoDisplaySaving(false);
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
        apiFetch("/api/system-settings/DefaultCurrency", { method: "PUT", body: JSON.stringify({ value: defaultCurrency.trim().toUpperCase() }) }),
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
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Upload your logo and adjust how it appears in the sign-in circle.
            </p>
          </div>
        </div>

        <FlashMessageBanner msg={logoFlash} onClear={() => setLogoFlash(null)} className="mt-4" />

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,280px)_1fr]">
          <div className="flex flex-col gap-4">
            <div className="overflow-hidden rounded-2xl bg-gradient-to-b from-[#5ba4e5] to-[#3a86ca] px-6 py-8 text-center shadow-inner">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-white/80">Sign-in preview</p>
              <p className="mb-4 text-[11px] text-white/70">Drag to move · scroll to zoom</p>
              <div
                className="mx-auto h-[104px] w-[104px] cursor-grab touch-none overflow-hidden rounded-full bg-white shadow-[0_12px_32px_rgba(15,76,120,0.25)] ring-2 ring-white/70 active:cursor-grabbing"
                onPointerDown={(e) => {
                  if (!companyLogoUrl) return;
                  logoDragRef.current = {
                    startX: e.clientX,
                    startY: e.clientY,
                    startOffsetX: logoLoginOffsetX,
                    startOffsetY: logoLoginOffsetY,
                  };
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  if (!logoDragRef.current) return;
                  const dx = e.clientX - logoDragRef.current.startX;
                  const dy = e.clientY - logoDragRef.current.startY;
                  setLogoLoginOffsetX(clampLogoOffset(logoDragRef.current.startOffsetX + dx));
                  setLogoLoginOffsetY(clampLogoOffset(logoDragRef.current.startOffsetY + dy));
                }}
                onPointerUp={() => {
                  logoDragRef.current = null;
                }}
                onPointerCancel={() => {
                  logoDragRef.current = null;
                }}
                onWheel={(e) => {
                  if (!companyLogoUrl) return;
                  e.preventDefault();
                  setLogoLoginScale((s) => clampLogoScale(s + (e.deltaY > 0 ? -5 : 5)));
                }}
              >
                {companyLogoUrl ? (
                  <CompanyLogoDisplay
                    src={resolveCompanyLogoSrc(companyLogoUrl)}
                    alt="Login logo preview"
                    fit="circle"
                    scale={logoLoginScale}
                    offsetX={logoLoginOffsetX}
                    offsetY={logoLoginOffsetY}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-100 text-xs text-slate-400">
                    No logo
                  </div>
                )}
              </div>
            </div>

            <div className="flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/80 px-6 py-8 shadow-inner">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Document preview</p>
              {companyLogoUrl ? (
                <div className="flex h-28 w-full max-w-full items-center justify-center overflow-hidden">
                  <CompanyLogoDisplay
                    src={resolveCompanyLogoSrc(companyLogoUrl)}
                    alt="Company logo preview"
                    className="max-h-28 max-w-full object-contain"
                    pdfClassName="h-36 w-full min-w-[10rem] border-0 bg-white"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/10 to-rose-500/10 text-slate-400">
                    <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.25} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-slate-600">No logo yet</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-5">
            {companyLogoUrl ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h4 className="text-sm font-semibold text-slate-900">Edit sign-in display</h4>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Wide logos are auto-centered in a square for the circle. Drag the preview, scroll to zoom, then save.
                </p>

                <div className="mt-5 space-y-5">
                  <div>
                    <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-600">
                      <label htmlFor="logo-login-scale">Zoom</label>
                      <input
                        id="logo-login-scale-num"
                        type="number"
                        min={LOGO_SCALE_MIN}
                        max={LOGO_SCALE_MAX}
                        value={logoLoginScale}
                        onChange={(e) =>
                          setLogoLoginScale(clampLogoScale(Number(e.target.value) || LOGO_SCALE_MIN))
                        }
                        className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-right text-xs"
                      />
                    </div>
                    <input
                      id="logo-login-scale"
                      type="range"
                      min={LOGO_SCALE_MIN}
                      max={LOGO_SCALE_MAX}
                      step={1}
                      value={logoLoginScale}
                      onChange={(e) => setLogoLoginScale(clampLogoScale(Number(e.target.value)))}
                      className="w-full accent-[#2B7DE9]"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-600">
                        <label htmlFor="logo-login-offset-x">Horizontal (px)</label>
                        <input
                          type="number"
                          min={LOGO_OFFSET_MIN}
                          max={LOGO_OFFSET_MAX}
                          value={logoLoginOffsetX}
                          onChange={(e) => setLogoLoginOffsetX(clampLogoOffset(Number(e.target.value) || 0))}
                          className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-right text-xs"
                        />
                      </div>
                      <input
                        id="logo-login-offset-x"
                        type="range"
                        min={LOGO_OFFSET_MIN}
                        max={LOGO_OFFSET_MAX}
                        step={1}
                        value={logoLoginOffsetX}
                        onChange={(e) => setLogoLoginOffsetX(Number(e.target.value))}
                        className="w-full accent-[#2B7DE9]"
                      />
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-600">
                        <label htmlFor="logo-login-offset-y">Vertical (px)</label>
                        <input
                          type="number"
                          min={LOGO_OFFSET_MIN}
                          max={LOGO_OFFSET_MAX}
                          value={logoLoginOffsetY}
                          onChange={(e) => setLogoLoginOffsetY(clampLogoOffset(Number(e.target.value) || 0))}
                          className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-right text-xs"
                        />
                      </div>
                      <input
                        id="logo-login-offset-y"
                        type="range"
                        min={LOGO_OFFSET_MIN}
                        max={LOGO_OFFSET_MAX}
                        step={1}
                        value={logoLoginOffsetY}
                        onChange={(e) => setLogoLoginOffsetY(Number(e.target.value))}
                        className="w-full accent-[#2B7DE9]"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={saveLogoDisplaySettings}
                      disabled={logoDisplaySaving}
                      className="rounded-xl bg-[#2B7DE9] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2569c7] disabled:opacity-60"
                    >
                      {logoDisplaySaving ? "Saving…" : "Save display"}
                    </button>
                    <button
                      type="button"
                      onClick={resetLogoDisplaySettings}
                      disabled={logoDisplaySaving}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 disabled:opacity-60"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex flex-col gap-2 sm:max-w-xs">
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,application/pdf,.pdf"
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
                {logoUploading ? "Uploading…" : companyLogoUrl ? (isPdfLogoUrl(companyLogoUrl) ? "Replace PDF logo" : "Replace logo") : "Upload logo"}
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
              <p className="text-xs text-[var(--text-muted)]">
                PDF uploads are converted to PNG automatically so the sign-in circle displays correctly.
              </p>
            </div>
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
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Default currency</label>
              <FormSelect
                value={defaultCurrency}
                onValueChange={(v) => setDefaultCurrency(v.toUpperCase())}
                options={currencySelectOptions()}
              />
              <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">
                Used as the default for recruitment salary ranges and other monetary fields.
              </p>
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

      {/* Connect mobile app */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm mb-6">
        <div className="section-title">
          <h3>Connect mobile app</h3>
        </div>
        <div className="space-y-4 px-1 py-3">
          <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">
            Employees scan this QR code in the <strong>OpenSky HRM</strong> mobile app to connect to this
            company&apos;s backend. You can also share the backend URL manually if scanning is not possible.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <img
              src={`${getApiBaseUrl()}/api/mobile/connection-qr?pixelsPerModule=8`}
              alt="Mobile connection QR code"
              className="h-48 w-48 shrink-0 rounded-xl border border-[var(--border)] bg-white p-2"
            />
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-xs font-medium text-[var(--text-muted)]">Backend URL encoded in QR</p>
              <p className="break-all rounded-lg border border-[var(--border)] bg-slate-50 px-3 py-2 text-sm text-[var(--text)]">
                {getApiBaseUrl() || API_BASE_URL || "Configure API URL"}
              </p>
              <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">
                Set <code className="rounded bg-slate-100 px-1">Mobile:PublicApiBaseUrl</code> on the API when
                the public URL differs from the request host (e.g. reverse proxy or IIS binding).
              </p>
            </div>
          </div>
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
