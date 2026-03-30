"use client";

import { useState, useEffect, useMemo, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { DatePickerField } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { type EmploymentTypeCatalogItem, employmentTypeOptionsFromCatalog } from "@/lib/employment-types";

interface Lookup { id: string; name: string }
interface LocationLookup { id: string; name: string }

interface Props { open: boolean; onClose: () => void; onCreated?: () => void }

export function CreateRequisitionModal({ open, onClose, onCreated }: Props) {
  const [departments, setDepartments] = useState<Lookup[]>([]);
  const [jobTitles, setJobTitles] = useState<Lookup[]>([]);
  const [employees, setEmployees] = useState<Lookup[]>([]);
  const [locations, setLocations] = useState<LocationLookup[]>([]);
  const [employmentTypes, setEmploymentTypes] = useState<EmploymentTypeCatalogItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const employmentTypeOpts = useMemo(
    () => employmentTypeOptionsFromCatalog(employmentTypes),
    [employmentTypes]
  );

  useEffect(() => {
    if (!open) return;
    Promise.all([
      apiFetch<Lookup[]>("/api/organization/departments"),
      apiFetch<Lookup[]>("/api/organization/job-titles"),
      apiFetch<{ items: { id: string; firstName: string; lastName: string }[] }>("/api/employees?pageSize=200"),
      apiFetch<LocationLookup[]>("/api/organization/locations"),
      apiFetch<EmploymentTypeCatalogItem[]>("/api/organization/employment-statuses").catch(() => [] as EmploymentTypeCatalogItem[]),
    ]).then(([d, j, e, l, empTypes]) => {
      setDepartments(d);
      setJobTitles(j);
      setEmployees(e.items.map((x) => ({ id: x.id, name: `${x.firstName} ${x.lastName}` })));
      setLocations(l);
      setEmploymentTypes(empTypes);
    }).catch(() => {});
  }, [open]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      title: fd.get("title"),
      code: fd.get("code"),
      description: fd.get("description") || null,
      vacancies: Number(fd.get("vacancies")) || 1,
      targetDate: fd.get("targetDate") || null,
      priority: fd.get("priority") || null,
      employmentType: fd.get("employmentType") || null,
      experienceMin: fd.get("experienceMin") ? Number(fd.get("experienceMin")) : null,
      experienceMax: fd.get("experienceMax") ? Number(fd.get("experienceMax")) : null,
      salaryMin: fd.get("salaryMin") ? Number(fd.get("salaryMin")) : null,
      salaryMax: fd.get("salaryMax") ? Number(fd.get("salaryMax")) : null,
      skills: fd.get("skills") || null,
      departmentId: fd.get("departmentId"),
      jobTitleId: fd.get("jobTitleId") || null,
      hiringManagerId: fd.get("hiringManagerId") || null,
      locationId: fd.get("locationId") || null,
    };
    try {
      await apiFetch("/api/recruitment/requisitions", { method: "POST", body: JSON.stringify(payload) });
      onCreated?.();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create requisition");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = "w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20";
  const labelClass = "mb-1 block text-xs font-medium text-[var(--text-muted)]";

  return (
    <Modal open={open} onClose={onClose} title="Create Requisition" wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className={labelClass}>Title *</label><input name="title" required className={inputClass} placeholder="Senior Developer" /></div>
          <div><label className={labelClass}>Code *</label><input name="code" required className={inputClass} placeholder="REQ-2026-042" /></div>
        </div>
        <div><label className={labelClass}>Description</label><textarea name="description" rows={2} className={inputClass} placeholder="Job description..." /></div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div><label className={labelClass}>Vacancies</label><input name="vacancies" type="number" min={1} defaultValue={1} className={inputClass} /></div>
          <div><label className={labelClass}>Priority</label>
            <select name="priority" className={inputClass}>
              <option value="">Select...</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
          <div><label className={labelClass}>Employment Type</label>
            <select name="employmentType" className={inputClass}>
              <option value="">Select...</option>
              {employmentTypeOpts.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div><label className={labelClass}>Target Date</label><DatePickerField name="targetDate" className={inputClass} /></div>
          <div><label className={labelClass}>Exp. Min (years)</label><input name="experienceMin" type="number" min={0} className={inputClass} /></div>
          <div><label className={labelClass}>Exp. Max (years)</label><input name="experienceMax" type="number" min={0} className={inputClass} /></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className={labelClass}>Salary Min</label><input name="salaryMin" type="number" min={0} className={inputClass} /></div>
          <div><label className={labelClass}>Salary Max</label><input name="salaryMax" type="number" min={0} className={inputClass} /></div>
        </div>
        <div><label className={labelClass}>Skills (comma-separated)</label><input name="skills" className={inputClass} placeholder="React, TypeScript, C#..." /></div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div><label className={labelClass}>Department *</label>
            <select name="departmentId" required className={inputClass}>
              <option value="">Select...</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div><label className={labelClass}>Job Title</label>
            <select name="jobTitleId" className={inputClass}>
              <option value="">Select...</option>
              {jobTitles.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
            </select>
          </div>
          <div><label className={labelClass}>Hiring Manager</label>
            <select name="hiringManagerId" className={inputClass}>
              <option value="">Select...</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div><label className={labelClass}>Location</label>
            <select name="locationId" className={inputClass}>
              <option value="">Select...</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" disabled={submitting}>{submitting ? "Creating..." : "Create Requisition"}</Button>
        </div>
      </form>
    </Modal>
  );
}
