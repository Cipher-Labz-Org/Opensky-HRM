"use client";

import { useState, useEffect } from "react";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { apiFetch } from "@/lib/api";

interface Employee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string | null;
  dateOfBirth: string;
  gender: string;
  joinDate: string;
  status: string;
  departmentName: string | null;
  businessUnitName: string | null;
  positionTitle: string | null;
  locationName: string | null;
  gradeName: string | null;
  jobTitleName: string | null;
  managerName: string | null;
}

export default function EmployeeProfilePage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Employee[]>([]);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await apiFetch<{ items: Employee[] }>(
          `/api/employees?search=${encodeURIComponent(query)}&pageSize=10`
        );
        setResults(res.items);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
        setSearched(true);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  function selectEmployee(emp: Employee) {
    setSelected(emp);
    setQuery("");
    setResults([]);
    setSearched(false);
  }

  const initials = selected
    ? `${selected.firstName[0]}${selected.lastName[0]}`
    : "AP";

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  return (
    <>
      <AppTopbar
        title="Employee 360 Profile"
        subtitle="Single employee view across personal data, job, leave, assets, payroll touchpoints, and performance."
      />

      {/* Search bar */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, or employee code..."
            className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 pl-10 text-sm text-[var(--text)] shadow-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
          />
          <svg className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {loading && <span className="absolute right-3 top-3.5 text-xs text-gray-400">Searching...</span>}

          {results.length > 0 && (
            <div className="absolute z-20 mt-1 w-full rounded-xl border border-[var(--border)] bg-white shadow-lg">
              {results.map((emp) => (
                <button
                  key={emp.id}
                  onClick={() => selectEmployee(emp)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition hover:bg-[var(--bg-subtle)]"
                >
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--primary)] text-xs font-bold text-white">
                    {emp.firstName[0]}{emp.lastName[0]}
                  </div>
                  <div>
                    <div className="font-medium text-[var(--text)]">{emp.fullName}</div>
                    <div className="text-xs text-[var(--text-muted)]">{emp.employeeCode} · {emp.jobTitleName ?? emp.positionTitle ?? "—"} · {emp.departmentName ?? "—"}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {searched && query.length >= 2 && results.length === 0 && !loading && (
            <div className="absolute z-20 mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm text-gray-500 shadow-lg">
              No employees found for &ldquo;{query}&rdquo;
            </div>
          )}
        </div>
      </div>

      {/* Profile card */}
      <div className="hris-card">
        <div className="hris-profile">
          <div className="hris-avatar">{initials}</div>
          <div>
            <h3 className="m-0 text-xl font-semibold">
              {selected ? selected.fullName : "Amali Perera"}
            </h3>
            <p className="mt-1.5 text-sm text-[var(--muted)]">
              {selected
                ? `${selected.employeeCode} · ${selected.jobTitleName ?? selected.positionTitle ?? "—"} · ${selected.departmentName ?? "—"}`
                : "EMP-001284 · Senior Accountant · Finance Shared Services"}
            </p>
            <div className="hris-chips mt-2">
              <span className="hris-chip" style={{ background: "#eff6ff", color: "#1e40af" }}>
                {selected?.locationName ?? "Colombo HQ"}
              </span>
              <span className="hris-chip">
                Manager: {selected?.managerName ?? "R. Fernando"}
              </span>
              <span className="hris-chip">
                {selected?.gradeName ?? "Band M2"}
              </span>
              <span className="hris-chip">
                Joined {selected ? formatDate(selected.joinDate) : "12 Jun 2021"}
              </span>
            </div>
          </div>
        </div>
        <div className="hris-meta-grid">
          <div className="hris-meta-box">
            <label>Status</label>
            <strong>{selected?.status ?? "Active"}</strong>
          </div>
          <div className="hris-meta-box">
            <label>Gender</label>
            <strong>{selected?.gender ?? "Female"}</strong>
          </div>
          <div className="hris-meta-box">
            <label>Business Unit</label>
            <strong>{selected?.businessUnitName ?? "Head Office"}</strong>
          </div>
          <div className="hris-meta-box">
            <label>Email</label>
            <strong className="truncate">{selected?.email ?? "amali.perera@company.com"}</strong>
          </div>
          <div className="hris-meta-box">
            <label>Phone</label>
            <strong>{selected?.phone ?? "+94 77 555 2345"}</strong>
          </div>
          <div className="hris-meta-box">
            <label>Date of Birth</label>
            <strong>{selected ? formatDate(selected.dateOfBirth) : "05 Nov 1990"}</strong>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="hris-card">
          <div className="section-title">
            <h3>Core Information</h3>
            <span>Editable sections</span>
          </div>
          <div className="hris-form-grid">
            <div className="hris-field">
              <label>Employee Code</label>
              <div>{selected?.employeeCode ?? "EMP-001284"}</div>
            </div>
            <div className="hris-field">
              <label>Mobile</label>
              <div>{selected?.phone ?? "+94 77 555 2345"}</div>
            </div>
            <div className="hris-field">
              <label>Email</label>
              <div>{selected?.email ?? "amali.perera@company.com"}</div>
            </div>
            <div className="hris-field">
              <label>Department</label>
              <div>{selected?.departmentName ?? "Finance"}</div>
            </div>
            <div className="hris-field">
              <label>Position</label>
              <div>{selected?.positionTitle ?? "Senior Accountant"}</div>
            </div>
            <div className="hris-field">
              <label>Location</label>
              <div>{selected?.locationName ?? "Colombo HQ"}</div>
            </div>
          </div>
        </div>
        <div className="hris-card">
          <div className="section-title">
            <h3>Active Cases</h3>
            <span>HR + manager actions</span>
          </div>
          <div className="hris-list">
            <div className="hris-list-item">
              <div><strong>Goal cycle 2026 Q1</strong><small>Employee self-assessment submitted</small></div>
              <span className="badge badge-blue">Review</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Salary increment proposal</strong><small>Effective 01 Apr 2026</small></div>
              <span className="badge badge-orange">Pending</span>
            </div>
            <div className="hris-list-item">
              <div><strong>Training nomination</strong><small>Advanced IFRS workshop</small></div>
              <span className="badge badge-green">Approved</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="hris-card">
          <div className="section-title">
            <h3>Leave History</h3>
            <span>Last 6 months</span>
          </div>
          <table className="hris-table">
            <thead><tr><th>Type</th><th>Days</th><th>Status</th></tr></thead>
            <tbody>
              <tr><td>Annual Leave</td><td>3.0</td><td><span className="badge badge-green">Taken</span></td></tr>
              <tr><td>Medical</td><td>1.0</td><td><span className="badge badge-green">Taken</span></td></tr>
              <tr><td>Half Day</td><td>0.5</td><td><span className="badge badge-blue">Planned</span></td></tr>
            </tbody>
          </table>
        </div>
        <div className="hris-card">
          <div className="section-title">
            <h3>Assets & Access</h3>
            <span>IT and admin</span>
          </div>
          <table className="hris-table">
            <thead><tr><th>Item</th><th>ID</th><th>Status</th></tr></thead>
            <tbody>
              <tr><td>Laptop</td><td>IT-8891</td><td><span className="badge badge-green">Assigned</span></td></tr>
              <tr><td>ID Card</td><td>ID-1284</td><td><span className="badge badge-green">Active</span></td></tr>
              <tr><td>Finance ERP Role</td><td>ERP-FN-07</td><td><span className="badge badge-blue">Provisioned</span></td></tr>
            </tbody>
          </table>
        </div>
        <div className="hris-card">
          <div className="section-title">
            <h3>Compensation Summary</h3>
            <span>Protected access</span>
          </div>
          <table className="hris-table">
            <thead><tr><th>Component</th><th>Value</th></tr></thead>
            <tbody>
              <tr><td>Base Salary</td><td>LKR 245,000</td></tr>
              <tr><td>Travel Allowance</td><td>LKR 18,000</td></tr>
              <tr><td>Last Revision</td><td>01 Jan 2026</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <p className="footer-note">
        Prototype prepared as a downloadable UI concept. All numbers and employee records are sample data for design purposes.
      </p>
    </>
  );
}
