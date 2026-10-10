"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CompanyLogoDisplay } from "@/components/branding/CompanyLogoDisplay";
import { CurrencySearchCombobox } from "@/components/forms/CurrencySearchCombobox";
import {
  EmailInput,
  FlashMessageBanner,
  ListAutocompleteInput,
  PhoneInput,
  SectionRecordHeaderActions,
  type FlashMessage,
} from "@/components/ui";
import { apiFetch } from "@/lib/api";
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
import { bankNameOptions } from "@/lib/bank-names";
import { DEFAULT_CURRENCY } from "@/lib/currencies";
import {
  EMAIL_FORMAT_VALIDATION_MESSAGE,
  EMAIL_INPUT_VALIDATION_MESSAGE,
  isValidEmailFormat,
  isValidEmailInput,
  isValidPhone,
  PHONE_VALIDATION_MESSAGE,
} from "@/lib/input-validation";
import { normalizeCompanyLogoUpload, pdfUrlToPngFile } from "@/lib/render-pdf-logo";
import { getSystemSetting } from "@/lib/system-settings";
import {
  EMPTY_BANK_ACCOUNT,
  isBlankBankAccount,
  parseCompanyBankAccounts,
  type CompanyBankAccount,
} from "@/lib/company-bank-accounts";
import {
  createEmptyAdditionalCompanyProfile,
  isBlankAdditionalCompanyProfile,
  parseAdditionalCompanyProfiles,
  PRIMARY_COMPANY_PROFILE_KEY,
  sanitizeAdditionalCompanyProfiles,
  type AdditionalCompanyProfile,
} from "@/lib/additional-company-profiles";
import { AdditionalCompanyProfileCard } from "@/components/settings/AdditionalCompanyProfileCard";
import { useMultiCompanyFeature } from "@/lib/use-multi-company-feature";

export function CompanyProfileContent() {
  const [companyLogoUrl, setCompanyLogoUrl] = useState("");
  const [logoLoginScale, setLogoLoginScale] = useState(100);
  const [logoLoginOffsetX, setLogoLoginOffsetX] = useState(0);
  const [logoLoginOffsetY, setLogoLoginOffsetY] = useState(0);
  const [logoDisplaySaving, setLogoDisplaySaving] = useState(false);
  const logoDragRef = useRef<{
    startX: number;
    startY: number;
    startOffsetX: number;
    startOffsetY: number;
  } | null>(null);
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
  const [companySaving, setCompanySaving] = useState(false);
  const [companyMsg, setCompanyMsg] = useState("");
  const [additionalCompanies, setAdditionalCompanies] = useState<AdditionalCompanyProfile[]>([]);

  const [epfRegNo, setEpfRegNo] = useState("");
  const [etfRegNo, setEtfRegNo] = useState("");
  const [bankAccounts, setBankAccounts] = useState<CompanyBankAccount[]>([]);
  const [additionalSaving, setAdditionalSaving] = useState(false);
  const [additionalMsg, setAdditionalMsg] = useState("");
  const { multiCompanyActive } = useMultiCompanyFeature();

  const companyBankNameOptions = useMemo(
    () => bankNameOptions(bankAccounts.map((account) => account.bankName)),
    [bankAccounts],
  );
  const bankCompanyOptions = useMemo(
    () => [
      { value: PRIMARY_COMPANY_PROFILE_KEY, label: companyName.trim() || "Primary company" },
      ...additionalCompanies.map((profile, index) => ({
        value: profile.id,
        label: profile.name.trim() || `Company profile ${index + 1}`,
      })),
    ],
    [additionalCompanies, companyName],
  );

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
    setEpfRegNo(getSystemSetting(settings, "CompanyEpfRegNo") ?? "");
    setEtfRegNo(getSystemSetting(settings, "CompanyEtfRegNo") ?? "");
    setBankAccounts(parseCompanyBankAccounts(getSystemSetting(settings, "CompanyBankAccounts")));
    setAdditionalCompanies(parseAdditionalCompanyProfiles(getSystemSetting(settings, "AdditionalCompanyProfiles")));
  }

  useEffect(() => {
    apiFetch<Record<string, string>>("/api/system-settings")
      .then(applySystemSettings)
      .catch(() => {});
  }, []);

  async function uploadLogoFile(file: File, successMessage: string) {
    const formData = new FormData();
    formData.append("file", file);
    const data = await apiFetch<{ logoUrl: string }>("/api/system-settings/company-logo", {
      method: "POST",
      body: formData,
    });
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

    const cleanedAdditional = sanitizeAdditionalCompanyProfiles(additionalCompanies);
    for (let i = 0; i < additionalCompanies.length; i += 1) {
      const row = additionalCompanies[i];
      if (isBlankAdditionalCompanyProfile(row)) continue;
      if (!row.name.trim()) {
        setCompanyMsg(`Company name is required for additional company ${i + 1}.`);
        setCompanySaving(false);
        return;
      }
      if (row.phone.trim() && !isValidPhone(row.phone)) {
        setCompanyMsg(`${PHONE_VALIDATION_MESSAGE} (additional company ${i + 1})`);
        setCompanySaving(false);
        return;
      }
      const trimmedEmail = row.email.trim();
      if (trimmedEmail && !isValidEmailInput(trimmedEmail)) {
        setCompanyMsg(`${EMAIL_INPUT_VALIDATION_MESSAGE} (additional company ${i + 1})`);
        setCompanySaving(false);
        return;
      }
      if (trimmedEmail && !isValidEmailFormat(trimmedEmail)) {
        setCompanyMsg(`${EMAIL_FORMAT_VALIDATION_MESSAGE} (additional company ${i + 1})`);
        setCompanySaving(false);
        return;
      }
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
        apiFetch("/api/system-settings/AdditionalCompanyProfiles", {
          method: "PUT",
          body: JSON.stringify({ value: JSON.stringify(cleanedAdditional) }),
        }),
      ]);
      const settings = await apiFetch<Record<string, string>>("/api/system-settings");
      applySystemSettings(settings);
      setAdditionalCompanies(cleanedAdditional);
      setCompanyMsg("Company details saved successfully");
      setTimeout(() => setCompanyMsg(""), 3000);
    } catch {
      setCompanyMsg("Failed to save company details");
    } finally {
      setCompanySaving(false);
    }
  }

  function updateBankAccount(index: number, field: keyof CompanyBankAccount, value: string) {
    setBankAccounts((accounts) =>
      accounts.map((account, i) => (i === index ? { ...account, [field]: value } : account)),
    );
  }

  function addAnotherCompanyProfile() {
    setAdditionalCompanies((rows) => [...rows, createEmptyAdditionalCompanyProfile()]);
    setCompanyMsg("");
  }

  async function saveAdditionalDetails() {
    setAdditionalSaving(true);
    setAdditionalMsg("");
    const cleanedAccounts = bankAccounts
      .map((account) => ({
        fullName: account.fullName.trim(),
        bankName: account.bankName.trim(),
        branchName: account.branchName.trim(),
        bankCode: account.bankCode.trim(),
        branchCode: account.branchCode.trim(),
        accountNo: account.accountNo.trim(),
        companyProfileKey: (account.companyProfileKey?.trim() || PRIMARY_COMPANY_PROFILE_KEY),
      }))
      .filter((account) => !isBlankBankAccount(account));

    if (cleanedAccounts.some((account) => !account.bankName || !account.accountNo)) {
      setAdditionalMsg("Each bank account needs at least a bank name and an account number");
      setAdditionalSaving(false);
      return;
    }

    try {
      await Promise.all([
        apiFetch("/api/system-settings/CompanyEpfRegNo", { method: "PUT", body: JSON.stringify({ value: epfRegNo.trim() }) }),
        apiFetch("/api/system-settings/CompanyEtfRegNo", { method: "PUT", body: JSON.stringify({ value: etfRegNo.trim() }) }),
        apiFetch("/api/system-settings/CompanyBankAccounts", { method: "PUT", body: JSON.stringify({ value: JSON.stringify(cleanedAccounts) }) }),
      ]);
      setBankAccounts(cleanedAccounts);
      setAdditionalMsg("Additional details saved successfully");
      setTimeout(() => setAdditionalMsg(""), 3000);
    } catch {
      setAdditionalMsg("Failed to save additional details");
    } finally {
      setAdditionalSaving(false);
    }
  }

  return (
    <>
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="section-title">
          <h3>Company Details</h3>
          {multiCompanyActive ? (
            <SectionRecordHeaderActions
              count={additionalCompanies.length}
              addTitle="Add another company profile"
              onAdd={addAnotherCompanyProfile}
            />
          ) : null}
        </div>
        <div className="space-y-4 px-1 py-3">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Company Name *</label>
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Registration No.</label>
              <input
                value={companyRegNo}
                onChange={(e) => setCompanyRegNo(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Default currency</label>
              <CurrencySearchCombobox
                value={defaultCurrency}
                onValueChange={(v) => setDefaultCurrency(v.toUpperCase())}
              />
              <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">
                Used as the default for recruitment salary ranges and other monetary fields.
              </p>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Address Line 1</label>
            <input
              value={companyAddress1}
              onChange={(e) => setCompanyAddress1(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Address Line 2</label>
            <input
              value={companyAddress2}
              onChange={(e) => setCompanyAddress2(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">City</label>
              <input
                value={companyCity}
                onChange={(e) => setCompanyCity(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">State / Province</label>
              <input
                value={companyState}
                onChange={(e) => setCompanyState(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Postal Code</label>
              <input
                value={companyPostalCode}
                onChange={(e) => setCompanyPostalCode(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Country</label>
            <input
              value={companyCountry}
              onChange={(e) => setCompanyCountry(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Phone</label>
              <PhoneInput
                value={companyPhone}
                onChange={(e) => setCompanyPhone(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Email</label>
              <EmailInput
                value={companyEmail}
                onChange={(e) => setCompanyEmail(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Website</label>
              <input
                value={companyWebsite}
                onChange={(e) => setCompanyWebsite(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
              />
            </div>
          </div>

          {multiCompanyActive && additionalCompanies.length > 0 ? (
            <div className="space-y-3 border-t border-slate-100 pt-4">
              {additionalCompanies.map((profile, index) => (
                <AdditionalCompanyProfileCard
                  key={profile.id}
                  index={index}
                  profile={profile}
                  onChange={(next) =>
                    setAdditionalCompanies((rows) =>
                      rows.map((row) => (row.id === profile.id ? next : row)),
                    )
                  }
                  onRemove={() =>
                    setAdditionalCompanies((rows) => rows.filter((row) => row.id !== profile.id))
                  }
                />
              ))}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-3 pt-1">
            {companyMsg && (
              <span className={`text-xs font-medium ${companyMsg.includes("success") ? "text-green-600" : "text-red-500"}`}>
                {companyMsg}
              </span>
            )}
            <button
              onClick={saveCompanyDetails}
              disabled={companySaving}
              className="rounded-lg bg-[var(--primary)] px-5 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {companySaving ? "Saving..." : "Save Company Details"}
            </button>
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="section-title">
          <h3>Company Statutory &amp; Banking Details</h3>
        </div>
        <div className="space-y-5 px-1 py-3">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Company EPF Registration No.</label>
              <input
                value={epfRegNo}
                onChange={(e) => setEpfRegNo(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">ETF Registration No.</label>
              <input
                value={etfRegNo}
                onChange={(e) => setEtfRegNo(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <strong className="text-sm font-semibold text-[var(--text)]">Company bank accounts</strong>
                <div className="text-xs text-[var(--text-muted)]">Accounts used for payroll payments and EPF/ETF remittances.</div>
              </div>
              <button
                type="button"
                onClick={() => setBankAccounts((accounts) => [...accounts, { ...EMPTY_BANK_ACCOUNT }])}
                className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--primary)] transition hover:border-[var(--primary)]"
              >
                + Add bank account
              </button>
            </div>

            {bankAccounts.length === 0 ? (
              <p className="rounded-xl bg-[var(--bg-subtle)] px-4 py-3 text-xs text-[var(--text-muted)]">
                No bank accounts added yet.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                <table className="w-full min-w-[60rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-[var(--bg-subtle)] text-xs font-semibold uppercase text-slate-400">
                      {multiCompanyActive ? <th className="px-3 py-2.5">Company</th> : null}
                      <th className="px-3 py-2.5">Full Name</th>
                      <th className="px-3 py-2.5">Bank Name</th>
                      <th className="px-3 py-2.5">Branch Name</th>
                      <th className="px-3 py-2.5">Bank Code</th>
                      <th className="px-3 py-2.5">Branch Code</th>
                      <th className="px-3 py-2.5">Account No.</th>
                      <th className="px-3 py-2.5 text-right"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {bankAccounts.map((account, index) => (
                      <tr key={index} className="border-b border-slate-100 last:border-b-0">
                        {multiCompanyActive ? (
                          <td className="px-2 py-2">
                            <select
                              value={account.companyProfileKey?.trim() || PRIMARY_COMPANY_PROFILE_KEY}
                              onChange={(e) => updateBankAccount(index, "companyProfileKey", e.target.value)}
                              className="w-full min-w-[10rem] rounded-lg border border-[var(--border)] bg-white px-2.5 py-2 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
                            >
                              {bankCompanyOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </td>
                        ) : null}
                        <td className="px-2 py-2">
                          <input
                            value={account.fullName}
                            onChange={(e) => updateBankAccount(index, "fullName", e.target.value)}
                            className="w-full rounded-lg border border-[var(--border)] bg-white px-2.5 py-2 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <ListAutocompleteInput
                            name={`company-bank-name-${index}`}
                            value={account.bankName}
                            onChange={(next) => updateBankAccount(index, "bankName", next)}
                            options={companyBankNameOptions}
                            className="w-full rounded-lg border border-[var(--border)] bg-white px-2.5 py-2 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
                            placeholder="Choose a bank"
                            showAllOnFocus
                            maxSuggestions={200}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            value={account.branchName}
                            onChange={(e) => updateBankAccount(index, "branchName", e.target.value)}
                            className="w-full rounded-lg border border-[var(--border)] bg-white px-2.5 py-2 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            value={account.bankCode}
                            onChange={(e) => updateBankAccount(index, "bankCode", e.target.value)}
                            className="w-full rounded-lg border border-[var(--border)] bg-white px-2.5 py-2 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            value={account.branchCode}
                            onChange={(e) => updateBankAccount(index, "branchCode", e.target.value)}
                            className="w-full rounded-lg border border-[var(--border)] bg-white px-2.5 py-2 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            value={account.accountNo}
                            onChange={(e) => updateBankAccount(index, "accountNo", e.target.value)}
                            className="w-full rounded-lg border border-[var(--border)] bg-white px-2.5 py-2 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
                          />
                        </td>
                        <td className="px-2 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => setBankAccounts((accounts) => accounts.filter((_, i) => i !== index))}
                            className="whitespace-nowrap text-xs font-medium text-red-600 hover:underline"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            {additionalMsg && (
              <span className={`text-xs font-medium ${additionalMsg.includes("success") ? "text-green-600" : "text-red-500"}`}>
                {additionalMsg}
              </span>
            )}
            <button
              onClick={saveAdditionalDetails}
              disabled={additionalSaving}
              className="rounded-lg bg-[var(--primary)] px-5 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {additionalSaving ? "Saving..." : "Save Company Statutory & Banking Details"}
            </button>
          </div>
        </div>
      </div>

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

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(240px,300px)_1fr] lg:items-start">
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

          <div className="flex flex-col gap-4">
            {companyLogoUrl ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h4 className="text-sm font-semibold text-slate-900">Edit sign-in display</h4>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Drag the preview, use the sliders, then save.
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

            <div className="flex flex-col gap-3">
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,application/pdf,.pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleLogoUpload(e.target.files[0]);
                }}
              />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={logoUploading}
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-[#2B7DE9] hover:text-[#2B7DE9] disabled:opacity-60"
                >
                  {logoUploading ? "Uploading…" : companyLogoUrl ? (isPdfLogoUrl(companyLogoUrl) ? "Replace PDF logo" : "Replace logo") : "Upload logo"}
                </button>
                {companyLogoUrl ? (
                  <button
                    type="button"
                    onClick={handleLogoRemove}
                    className="flex-1 rounded-xl border border-red-100 bg-red-50/80 px-4 py-3 text-sm font-semibold text-red-600 transition hover:border-red-200 hover:bg-red-50"
                  >
                    Remove logo
                  </button>
                ) : null}
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                PDF uploads are converted to PNG automatically so the sign-in circle displays correctly.
              </p>
            </div>
          </div>
        </div>
      </div>

    </>
  );
}
