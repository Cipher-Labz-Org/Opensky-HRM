"use client";

import { useState, useEffect, useMemo, useRef, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { DatePickerField, FormSelect, FormErrorAlert, type FormSelectOption } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { type EmploymentTypeCatalogItem, employmentTypeOptionsFromCatalog } from "@/lib/employment-types";
import {
  generateRequisitionDescription,
  type RequisitionDescriptionSnapshot,
} from "@/lib/generate-requisition-description";
import { formatDate } from "@/lib/date-utils";
import { DEFAULT_CURRENCY } from "@/lib/currencies";
import { CurrencySearchCombobox } from "@/components/forms/CurrencySearchCombobox";
import { getSystemSetting } from "@/lib/system-settings";
import { RequisitionSkillsPicker } from "@/components/recruitment/RequisitionSkillsPicker";

/** Sparkles — common “AI assist” affordance (inline SVG, no extra dependency). */
function AiAssistIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423L16.5 15.75l.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
      />
    </svg>
  );
}

function generateRequisitionCode(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `REQ-${y}${m}${day}-${rand}`;
}

interface Lookup { id: string; name: string }
interface LocationLookup { id: string; name: string }

/** Shape returned by POST /api/recruitment/requisitions (camelCase JSON). */
export interface CreatedRequisition {
  id: string;
  title: string;
  code: string;
  status: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called with the created requisition from the API so the parent can navigate to a detail view. */
  onCreated?: (requisition: CreatedRequisition) => void;
}

const REQ_PRIORITY_CREATE_OPTS: FormSelectOption[] = [
  { value: "", label: "Select…" },
  { value: "High", label: "High" },
  { value: "Medium", label: "Medium" },
  { value: "Low", label: "Low" },
];

export function CreateRequisitionModal({ open, onClose, onCreated }: Props) {
  const [departments, setDepartments] = useState<Lookup[]>([]);
  const [jobTitles, setJobTitles] = useState<Lookup[]>([]);
  const [locations, setLocations] = useState<LocationLookup[]>([]);
  const [employmentTypes, setEmploymentTypes] = useState<EmploymentTypeCatalogItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [formKey, setFormKey] = useState(0);
  const [requisitionTitle, setRequisitionTitle] = useState("");
  const [jobTitleId, setJobTitleId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [applicationNotificationEmail, setApplicationNotificationEmail] = useState("");
  const [salaryCurrency, setSalaryCurrency] = useState(DEFAULT_CURRENCY);
  const formRef = useRef<HTMLFormElement>(null);
  const autoCodeRef = useRef("");

  const employmentTypeOpts = useMemo(
    () => employmentTypeOptionsFromCatalog(employmentTypes),
    [employmentTypes]
  );

  const employmentTypeFormOpts = useMemo<FormSelectOption[]>(
    () => [{ value: "", label: "Select…" }, ...employmentTypeOpts],
    [employmentTypeOpts]
  );

  const departmentFormOpts = useMemo<FormSelectOption[]>(
    () => [{ value: "", label: "Select…" }, ...departments.map((d) => ({ value: d.id, label: d.name }))],
    [departments]
  );
  const jobTitleFormOpts = useMemo<FormSelectOption[]>(
    () => [{ value: "", label: "Select…" }, ...jobTitles.map((j) => ({ value: j.id, label: j.name }))],
    [jobTitles]
  );
  const locationFormOpts = useMemo<FormSelectOption[]>(
    () => [{ value: "", label: "Select…" }, ...locations.map((l) => ({ value: l.id, label: l.name }))],
    [locations]
  );

  const jobTitleLabel = useMemo(
    () => jobTitles.find((j) => j.id === jobTitleId)?.name ?? "",
    [jobTitles, jobTitleId]
  );

  useEffect(() => {
    if (!open) return;
    setFormKey((k) => k + 1);
    setRequisitionTitle("");
    setJobTitleId("");
    setDepartmentId("");
    setSelectedSkills([]);
    setDescription("");
    setApplicationNotificationEmail("");
    setSalaryCurrency(DEFAULT_CURRENCY);
    autoCodeRef.current = generateRequisitionCode();
    Promise.all([
      apiFetch<Lookup[]>("/api/organization/departments"),
      apiFetch<Lookup[]>("/api/organization/job-titles"),
      apiFetch<LocationLookup[]>("/api/organization/locations"),
      apiFetch<EmploymentTypeCatalogItem[]>("/api/organization/employment-statuses").catch(() => [] as EmploymentTypeCatalogItem[]),
      apiFetch<Record<string, string>>("/api/system-settings").catch(() => ({} as Record<string, string>)),
    ]).then(([d, j, l, empTypes, settings]) => {
      setDepartments(d);
      setJobTitles(j);
      setLocations(l);
      setEmploymentTypes(empTypes);
      const defaultCur = getSystemSetting(settings, "DefaultCurrency");
      if (defaultCur) setSalaryCurrency(defaultCur.toUpperCase());
    }).catch(() => {});
  }, [open]);

  function getCreateValidationError(fd: FormData): string | null {
    const title = String(fd.get("title") ?? "").trim();
    const departmentId = String(fd.get("departmentId") ?? "").trim();
    const locationId = String(fd.get("locationId") ?? "").trim();
    const missing: string[] = [];
    if (!title) missing.push("Title");
    if (!departmentId) missing.push("Department");
    if (!locationId) missing.push("Location");
    if (missing.length > 0) {
      return `To create a requisition, please provide: ${missing.join(", ")}.`;
    }

    const email = applicationNotificationEmail.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return "Application notification email must be a valid email address (e.g. hr@company.com).";
    }

    const vacancies = Number(fd.get("vacancies"));
    if (fd.get("vacancies") && (!Number.isFinite(vacancies) || vacancies < 1)) {
      return "Vacancies must be at least 1.";
    }

    const expMinRaw = String(fd.get("experienceMin") ?? "").trim();
    if (!expMinRaw) {
      return "Exp. Min (years) is required.";
    }
    const expMin = Number(expMinRaw);
    const expMax = fd.get("experienceMax") ? Number(fd.get("experienceMax")) : null;
    if (!Number.isFinite(expMin) || expMin < 0) {
      return "Exp. Min (years) must be 0 or greater.";
    }
    if (expMax != null && Number.isFinite(expMax) && expMin > expMax) {
      return "Experience minimum cannot be greater than experience maximum.";
    }

    const salMin = fd.get("salaryMin") ? Number(fd.get("salaryMin")) : null;
    const salMax = fd.get("salaryMax") ? Number(fd.get("salaryMax")) : null;
    if (salMin != null && salMax != null && salMin > salMax) {
      return "Salary minimum cannot be greater than salary maximum.";
    }

    return null;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    const validationError = getCreateValidationError(fd);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSubmitting(true);
    const locId = String(fd.get("locationId") ?? "").trim();
    const locationName = locations.find((l) => l.id === locId)?.name?.trim() ?? "";
    const payload = {
      title: fd.get("title"),
      code: autoCodeRef.current || generateRequisitionCode(),
      description: description.trim() || null,
      vacancies: Number(fd.get("vacancies")) || 1,
      targetDate: fd.get("targetDate") || null,
      priority: fd.get("priority") || null,
      employmentType: fd.get("employmentType") || null,
      experienceMin: fd.get("experienceMin") ? Number(fd.get("experienceMin")) : null,
      experienceMax: fd.get("experienceMax") ? Number(fd.get("experienceMax")) : null,
      salaryMin: fd.get("salaryMin") ? Number(fd.get("salaryMin")) : null,
      salaryMax: fd.get("salaryMax") ? Number(fd.get("salaryMax")) : null,
      salaryCurrency: salaryCurrency.trim() || null,
      skills: selectedSkills.length ? selectedSkills.join(", ") : null,
      departmentId: fd.get("departmentId"),
      jobTitleId: jobTitleId || null,
      hiringManagerId: null,
      locationId: locId || null,
      workLocation: locationName || null,
      applicationNotificationEmail: applicationNotificationEmail.trim() || null,
    };
    try {
      const created = await apiFetch<CreatedRequisition>("/api/recruitment/requisitions", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      onCreated?.(created);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create requisition");
    } finally {
      setSubmitting(false);
    }
  }

  function handleGenerateDescription() {
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);
    const g = (k: string) => String(fd.get(k) ?? "").trim();
    const deptId = g("departmentId");
    const locId = g("locationId");
    const empVal = g("employmentType");
    const empOpt = employmentTypeFormOpts.find((o) => o.value === empVal);
    const employmentTypeLabel = empOpt && empOpt.value !== "" ? empOpt.label : "";
    const targetRaw = g("targetDate");
    const snapshot: RequisitionDescriptionSnapshot = {
      title: g("title"),
      code: autoCodeRef.current || generateRequisitionCode(),
      vacancies: Number(fd.get("vacancies")) || 1,
      targetDate: targetRaw ? formatDate(targetRaw) : "",
      priority: g("priority"),
      employmentType: empVal,
      employmentTypeLabel,
      experienceMin: g("experienceMin"),
      experienceMax: g("experienceMax"),
      salaryMin: g("salaryMin"),
      salaryMax: g("salaryMax"),
      salaryCurrency,
      departmentName: departments.find((d) => d.id === deptId)?.name ?? "",
      jobTitleName: jobTitleLabel,
      hiringManagerName: "",
      locationName: locations.find((l) => l.id === locId)?.name ?? "",
      skills: [...selectedSkills],
    };
    setDescription(generateRequisitionDescription(snapshot));
  }

  const inputClass = "w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20";
  const labelClass = "mb-1 block text-xs font-medium text-[var(--text-muted)]";

  return (
    <Modal open={open} onClose={onClose} title="Create Requisition" wide>
      <form ref={formRef} key={formKey} onSubmit={handleSubmit} className="space-y-4">
        <FormErrorAlert
          message={error}
          onDismiss={() => setError("")}
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        />
        <div>
          <label className={labelClass}>Title *</label>
          <input
            name="title"
            required
            className={inputClass}
            placeholder="Senior Developer"
            value={requisitionTitle}
            onChange={(e) => setRequisitionTitle(e.target.value)}
          />
          <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">
            A requisition code is assigned automatically when you create (e.g. REQ-20260420-ABC12X).
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div><label className={labelClass}>Vacancies</label><input name="vacancies" type="number" min={1} defaultValue={1} className={inputClass} /></div>
          <div><label className={labelClass}>Priority</label>
            <FormSelect name="priority" defaultValue="" options={REQ_PRIORITY_CREATE_OPTS} placeholder="Select…" />
          </div>
          <div><label className={labelClass}>Employment Type</label>
            <FormSelect name="employmentType" defaultValue="" options={employmentTypeFormOpts} placeholder="Select…" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div><label className={labelClass}>Target Date</label><DatePickerField name="targetDate" className={inputClass} /></div>
          <div><label className={labelClass}>Exp. Min (years) *</label><input name="experienceMin" type="number" min={0} required className={inputClass} /></div>
          <div><label className={labelClass}>Exp. Max (years)</label><input name="experienceMax" type="number" min={0} className={inputClass} /></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClass}>Salary currency</label>
            <CurrencySearchCombobox
              value={salaryCurrency}
              onValueChange={setSalaryCurrency}
            />
          </div>
          <div><label className={labelClass}>Salary Min</label><input name="salaryMin" type="number" min={0} className={inputClass} /></div>
          <div><label className={labelClass}>Salary Max</label><input name="salaryMax" type="number" min={0} className={inputClass} /></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div><label className={labelClass}>Department *</label>
            <FormSelect
              name="departmentId"
              required
              value={departmentId}
              onValueChange={setDepartmentId}
              options={departmentFormOpts}
              placeholder="Select…"
            />
          </div>
          <div><label className={labelClass}>Job Title</label>
            <FormSelect
              name="jobTitleId"
              value={jobTitleId}
              onValueChange={setJobTitleId}
              options={jobTitleFormOpts}
              placeholder="Select…"
            />
          </div>
          <div><label className={labelClass}>Location *</label>
            <FormSelect name="locationId" required defaultValue="" options={locationFormOpts} placeholder="Select…" />
          </div>
        </div>
        <div>
          <label className={labelClass} htmlFor="req-application-inbox">
            Application notification email
          </label>
          <input
            id="req-application-inbox"
            type="email"
            inputMode="email"
            autoComplete="email"
            className={inputClass}
            placeholder="hr@company.com"
            value={applicationNotificationEmail}
            onChange={(e) => setApplicationNotificationEmail(e.target.value)}
          />
          <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--text-muted)]">
            When candidates submit an application for this job, OpenSky HRM sends the notification to this address (SendGrid).
            Leave blank to use the organization default from Policy &amp; Settings / appsettings.
          </p>
        </div>
        <div>
          <label className={labelClass}>Skills</label>
          <RequisitionSkillsPicker
            title={requisitionTitle}
            jobTitleId={jobTitleId || undefined}
            departmentId={departmentId || undefined}
            value={selectedSkills}
            onChange={setSelectedSkills}
            inputClass={inputClass}
          />
        </div>
        <div>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-[var(--text-muted)]">Description</span>
            <Button
              variant="secondary"
              type="button"
              className="shrink-0 gap-1.5 px-3 py-2 text-xs min-h-0"
              onClick={handleGenerateDescription}
            >
              <AiAssistIcon className="shrink-0 text-slate-600" />
              <span>Generate from details</span>
            </Button>
          </div>
          <p className="mb-2 text-[11px] leading-relaxed text-[var(--text-muted)]">
            Fills a draft from title, auto-generated code, department, job title, location, dates, compensation, employment type, and selected skills. Edit freely after generating.
          </p>
          <textarea
            name="description"
            rows={12}
            className={`${inputClass} min-h-[200px] font-mono text-[13px] leading-relaxed`}
            placeholder="Use “Generate from details” after filling the form, or write your own description…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" disabled={submitting}>{submitting ? "Creating..." : "Create Requisition"}</Button>
        </div>
      </form>
    </Modal>
  );
}
