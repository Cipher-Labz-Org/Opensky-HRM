"use client";

import { useState, useEffect, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api";

interface Lookup {
  id: string;
  name: string;
  code: string;
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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    Promise.all([
      apiFetch<Lookup[]>("/api/organization/departments"),
      apiFetch<Lookup[]>("/api/organization/business-units"),
      apiFetch<Lookup[]>("/api/organization/locations"),
      apiFetch<Lookup[]>("/api/organization/grades"),
      apiFetch<Lookup[]>("/api/organization/job-titles"),
    ]).then(([depts, bus, locs, grs, jts]) => {
      setDepartments(depts);
      setBusinessUnits(bus);
      setLocations(locs);
      setGrades(grs);
      setJobTitles(jts);
    });
  }, [open]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const fd = new FormData(e.currentTarget);
    const payload = {
      employeeCode: fd.get("employeeCode"),
      firstName: fd.get("firstName"),
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

    try {
      await apiFetch("/api/employees", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      onCreated?.();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create employee");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20";
  const labelClass = "mb-1 block text-xs font-medium text-[var(--text-muted)]";

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
            <label className={labelClass}>Employee Code *</label>
            <input name="employeeCode" required className={inputClass} placeholder="EMP-0010" />
          </div>
          <div>
            <label className={labelClass}>Email *</label>
            <input name="email" type="email" required className={inputClass} placeholder="john@openskyhrm.com" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>First Name *</label>
            <input name="firstName" required className={inputClass} placeholder="John" />
          </div>
          <div>
            <label className={labelClass}>Last Name *</label>
            <input name="lastName" required className={inputClass} placeholder="Doe" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClass}>Date of Birth *</label>
            <input name="dateOfBirth" type="date" required className={inputClass} />
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
            <input name="joinDate" type="date" required className={inputClass} />
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
