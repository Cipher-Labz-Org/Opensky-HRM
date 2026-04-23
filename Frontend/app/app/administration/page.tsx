"use client";

import Link from "next/link";
import { useState, useRef, useMemo } from "react";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { Button } from "@/components/ui/Button";
import { API_BASE_URL } from "@/config/constants";
import { ROUTES } from "@/config/routes";
import { DonutMixChart, formatInt, HorizontalCompareBars } from "@/lib/workspace-charts";

const kpiTileClass =
  "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md";
const panelClass = "rounded-2xl border border-slate-200 bg-white shadow-sm";

// ──── Shared Types ────

interface RowResult {
  row: number;
  firstName: string;
  lastName: string;
  success: boolean;
  errors: string[];
}

interface UploadResult {
  created: number;
  skipped: number;
  totalRows: number;
  results: RowResult[];
}

interface LeaveBalanceRowResult {
  row: number;
  employeeCode: string;
  leaveType: string;
  status: string;
  errors: string[];
}

interface LeaveBalanceUploadResult {
  created: number;
  updated: number;
  skipped: number;
  totalRows: number;
  results: LeaveBalanceRowResult[];
}

type ActiveSection = "employees" | "leaveBalances";

// ──── Page ────

const roadmapModules = [
  { icon: "M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342", label: "Qualifications import", desc: "Education, skills, and languages" },
  { icon: "M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z", label: "Payroll import", desc: "Compensation and bank details" },
  { icon: "M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z", label: "Dependents import", desc: "Emergency contacts and dependents" },
  { icon: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z", label: "Immigration import", desc: "Visa and passport records" },
] as const;

const LIVE_IMPORTERS = 2;
const TEMPLATE_COUNT = 2;
const MAX_UPLOAD_MB = 20;

export default function AdministrationPage() {
  const [activeSection, setActiveSection] = useState<ActiveSection>("employees");

  const kpiStats = useMemo(
    () => [
      {
        label: "Live importers",
        value: formatInt(LIVE_IMPORTERS),
        sub: "Employee roster & leave balances",
      },
      {
        label: "Templates ready",
        value: formatInt(TEMPLATE_COUNT),
        sub: "Match columns to OpenSky fields",
      },
      {
        label: "Planned modules",
        value: formatInt(roadmapModules.length),
        sub: "On the product roadmap",
      },
      {
        label: "Max upload (MB)",
        value: formatInt(MAX_UPLOAD_MB),
        sub: "Per Excel file, server enforced",
      },
    ],
    []
  );

  const liveImporterBars = useMemo(
    () => [
      { label: "Employee bulk import", value: 1, color: "#3b82f6" },
      { label: "Leave balance import", value: 1, color: "#6366f1" },
    ],
    []
  );

  const roadmapPreviewBars = useMemo(
    () =>
      roadmapModules.map((mod, i) => ({
        label: mod.label.length > 22 ? `${mod.label.slice(0, 20)}…` : mod.label,
        value: 1,
        color: ["#94a3b8", "#cbd5e1", "#a8b9cf", "#9ca3af"][i % 4],
      })),
    []
  );

  const coverageDonut = useMemo(
    () => [
      { label: "Shipped importers", value: LIVE_IMPORTERS, color: "#22c55e" },
      { label: "Roadmap slots", value: roadmapModules.length, color: "#cbd5e1" },
    ],
    []
  );

  return (
    <>
      <AppTopbar
        title="Administration"
        subtitle="Bulk Excel import for people data and leave balances. Download a template before you upload."
      />

      <section className="relative mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 px-7 py-8 text-slate-900 shadow-sm">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-sky-100/50 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 h-72 w-72 rounded-full bg-indigo-100/40 blur-3xl" />
        <div className="relative z-10">
          <p className="mb-2 inline-flex rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
            Data operations
          </p>
          <h2 className="text-2xl font-semibold leading-tight text-slate-900 lg:text-3xl">Bulk import &amp; templates</h2>
          <p className="mt-3 max-w-2xl text-sm text-slate-600">
            Upload validated spreadsheets to create or update records at scale. Always start from the official template so column codes align with your tenant configuration — same Command Center visual language as the rest of the app.
          </p>
        </div>
      </section>

      <div className="space-y-6">
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {kpiStats.map((k) => (
            <div key={k.label} className={kpiTileClass}>
              <div className="text-xs font-medium uppercase tracking-wider text-slate-500">{k.label}</div>
              <div className="mt-2 text-2xl font-semibold leading-tight text-slate-900">{k.value}</div>
              <div className="mt-2 text-xs text-slate-600">{k.sub}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-800">Live importers</h3>
              <span className="text-xs text-slate-500">Available today</span>
            </div>
            <HorizontalCompareBars items={liveImporterBars} />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-800">Shipped vs roadmap</h3>
              <span className="text-xs text-slate-500">Product coverage</span>
            </div>
            <DonutMixChart values={coverageDonut} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-800">Roadmap importers (preview)</h3>
            <span className="text-xs text-slate-500">Equal weight placeholders</span>
          </div>
          <HorizontalCompareBars items={roadmapPreviewBars} />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-900">Quick links</h3>
            <p className="text-xs text-slate-500">People data, access, and related hubs</p>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href={ROUTES.people}
              className="group rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-800">People</div>
                  <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">Directory &amp; profiles</div>
                </div>
                <span className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700">
                  →
                </span>
              </div>
            </Link>
            <Link
              href={ROUTES.leave}
              className="group rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-800">Leave &amp; Absence</div>
                  <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">Balances &amp; policies</div>
                </div>
                <span className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700">
                  →
                </span>
              </div>
            </Link>
            <Link
              href={ROUTES.settings}
              className="group rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-800">Policy &amp; Settings</div>
                  <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">Lookups &amp; org master data</div>
                </div>
                <span className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700">
                  →
                </span>
              </div>
            </Link>
            <Link
              href={ROUTES.userManagement}
              className="group rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-800">User management</div>
                  <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">Accounts &amp; roles</div>
                </div>
                <span className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700">
                  →
                </span>
              </div>
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 rounded-2xl border border-slate-200 bg-slate-50/90 p-1.5 shadow-sm">
          <button
            type="button"
            onClick={() => setActiveSection("employees")}
            className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
              activeSection === "employees"
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/90"
                : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
            }`}
          >
            Employee bulk import
          </button>
          <button
            type="button"
            onClick={() => setActiveSection("leaveBalances")}
            className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
              activeSection === "leaveBalances"
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/90"
                : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
            }`}
          >
            Leave balance import
          </button>
        </div>

        {activeSection === "employees" && <EmployeeUploadSection />}
        {activeSection === "leaveBalances" && <LeaveBalanceUploadSection />}

        <div className={`${panelClass} overflow-hidden`}>
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-base font-semibold text-slate-800">More importers</h2>
            <p className="mt-1 text-xs text-slate-500">These paths are on the roadmap and will appear here when available.</p>
          </div>
          <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
            {roadmapModules.map((mod) => (
              <div
                key={mod.label}
                className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 shadow-sm"
              >
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white ring-1 ring-slate-200/80">
                    <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d={mod.icon} />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700">{mod.label}</h3>
                    <span className="mt-0.5 inline-flex rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                      Coming soon
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-500">{mod.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="footer-note">
          Imports run against your live tenant. Validate a small file first in non-production environments. Skipped rows are listed with row numbers so you can correct and re-upload. Coverage charts summarize shipped vs roadmap importers (static product map, not live API counts).
        </p>
      </div>
    </>
  );
}

async function downloadTemplate(path: string, fallbackFilename: string) {
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error((await res.text().catch(() => "")) || `Download failed (${res.status})`);

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fallbackFilename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

// ──── Employee Upload Section ────

function EmployeeUploadSection() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileChange(f: File | null) { setFile(f); setResult(null); setError(""); }

  async function handleUpload() {
    if (!file) return;
    setUploading(true); setError(""); setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_BASE_URL}/api/bulkupload/employees`, { method: "POST", body: formData, headers: { Authorization: `Bearer ${localStorage.getItem("auth_token") || ""}` } });
      if (!res.ok) throw new Error(await res.text().catch(() => "") || `Upload failed (${res.status})`);
      setResult(await res.json());
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) { setError(err instanceof Error ? err.message : "Upload failed"); }
    finally { setUploading(false); }
  }

  return (
    <>
      <div className={`${panelClass} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 ring-1 ring-sky-100">
              <svg className="h-5 w-5 text-sky-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-800">Employee bulk import</h2>
              <p className="text-xs text-slate-500">Personal, job, contact, and ID columns</p>
            </div>
          </div>
          <Button
            variant="secondary"
            className="gap-2"
            onClick={async () => {
              try {
                await downloadTemplate("/api/bulkupload/template", "EmployeeImportTemplate.xlsx");
              } catch (e) {
                setError(e instanceof Error ? e.message : "Template download failed");
              }
            }}
          >
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
            Download template
          </Button>
        </div>
        <div className="p-6">
          <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <h4 className="mb-2 text-sm font-semibold text-slate-800">How to import employees</h4>
            <ol className="list-inside list-decimal space-y-1 text-xs text-slate-600">
              <li>Click <strong>Download template</strong> to get the Excel file with all columns pre-formatted.</li>
              <li>Fill in employee data. <strong>First Name, Last Name, Email, Department, Gender, Date of Birth, Joined Date</strong> are required.</li>
              <li>Use values from the lookup sheets (Departments, Grades, etc.) for dropdown fields.</li>
              <li><strong>Employment Type</strong> and <strong>Employee Status</strong> must match the codes on the <strong>Reference</strong> sheet (same codes as Organization / People Hub).</li>
              <li>Leave <strong>Employee Code</strong> blank to auto-generate, or provide unique codes.</li>
              <li>Upload the completed file below.</li>
            </ol>
          </div>
          <DropZone file={file} fileRef={fileRef} dragOver={dragOver} setDragOver={setDragOver} onFileChange={handleFileChange} />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button disabled={!file || uploading} onClick={handleUpload}>
              {uploading && (
                <span className="mr-2 inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-200 border-t-[#2B7DE9]" aria-hidden />
              )}
              {uploading ? "Uploading…" : "Upload & import"}
            </Button>
            {error && (
              <div className="min-w-0 flex-1 rounded-xl border border-rose-200/80 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>
            )}
          </div>
        </div>
      </div>

      {result && (
        <div className={`${panelClass} overflow-hidden`}>
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-base font-semibold text-slate-800">Import results</h2>
            <p className="mt-0.5 text-xs text-slate-500">Row-level outcomes from the last upload</p>
          </div>
          <div className="p-6">
            <div className="mb-5 grid grid-cols-3 gap-4">
              <div className={kpiTileClass}>
                <div className="text-xs font-medium uppercase tracking-wider text-slate-500">Total rows</div>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{result.totalRows}</p>
              </div>
              <div className={kpiTileClass}>
                <div className="text-xs font-medium uppercase tracking-wider text-emerald-600">Created</div>
                <p className="mt-2 text-2xl font-semibold text-emerald-700">{result.created}</p>
              </div>
              <div className={kpiTileClass}>
                <div className="text-xs font-medium uppercase tracking-wider text-rose-600">Skipped</div>
                <p className="mt-2 text-2xl font-semibold text-rose-700">{result.skipped}</p>
              </div>
            </div>
            {result.results.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left">
                      <th className="px-4 py-2.5 font-semibold text-slate-600">Row</th>
                      <th className="px-4 py-2.5 font-semibold text-slate-600">Name</th>
                      <th className="px-4 py-2.5 font-semibold text-slate-600">Status</th>
                      <th className="px-4 py-2.5 font-semibold text-slate-600">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {result.results.map((r) => (
                      <tr key={r.row} className={r.success ? "" : "bg-rose-50/40"}>
                        <td className="px-4 py-2 text-slate-600">{r.row}</td>
                        <td className="px-4 py-2 font-medium text-slate-700">{r.firstName} {r.lastName}</td>
                        <td className="px-4 py-2">
                          {r.success
                            ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-100">Created</span>
                            : <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-800 ring-1 ring-rose-100">Skipped</span>}
                        </td>
                        <td className="px-4 py-2 text-xs text-rose-700">{r.errors.join("; ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ──── Leave Balance Upload Section ────

function LeaveBalanceUploadSection() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<LeaveBalanceUploadResult | null>(null);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileChange(f: File | null) { setFile(f); setResult(null); setError(""); }

  async function handleUpload() {
    if (!file) return;
    setUploading(true); setError(""); setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_BASE_URL}/api/bulkupload/leave-balances`, { method: "POST", body: formData, headers: { Authorization: `Bearer ${localStorage.getItem("auth_token") || ""}` } });
      if (!res.ok) throw new Error(await res.text().catch(() => "") || `Upload failed (${res.status})`);
      setResult(await res.json());
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) { setError(err instanceof Error ? err.message : "Upload failed"); }
    finally { setUploading(false); }
  }

  return (
    <>
      <div className={`${panelClass} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 ring-1 ring-indigo-100">
              <svg className="h-5 w-5 text-indigo-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-800">Leave balance bulk import</h2>
              <p className="text-xs text-slate-500">Entitled, used, and carried forward by year</p>
            </div>
          </div>
          <Button
            variant="secondary"
            className="gap-2"
            onClick={async () => {
              try {
                await downloadTemplate("/api/bulkupload/leave-balance-template", "LeaveBalanceImportTemplate.xlsx");
              } catch (e) {
                setError(e instanceof Error ? e.message : "Template download failed");
              }
            }}
          >
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
            Download template
          </Button>
        </div>
        <div className="p-6">
          <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <h4 className="mb-2 text-sm font-semibold text-slate-800">How to import leave balances</h4>
            <ol className="list-inside list-decimal space-y-1 text-xs text-slate-600">
              <li>Click <strong>Download template</strong> to get the Excel file with pre-formatted columns.</li>
              <li>The template includes an <strong>Employees</strong> sheet with all employee codes and a <strong>LeaveTypes</strong> sheet with valid leave types.</li>
              <li>Fill in: <strong>Employee Code, Leave Type, Year, Entitled</strong> (required). Used and Carried Forward default to 0.</li>
              <li>If a balance already exists for the same employee + leave type + year, it will be <strong>updated</strong>.</li>
              <li>Upload the completed file below.</li>
            </ol>
          </div>
          <DropZone file={file} fileRef={fileRef} dragOver={dragOver} setDragOver={setDragOver} onFileChange={handleFileChange} />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button disabled={!file || uploading} onClick={handleUpload}>
              {uploading && (
                <span className="mr-2 inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-200 border-t-[#2B7DE9]" aria-hidden />
              )}
              {uploading ? "Uploading…" : "Upload & import"}
            </Button>
            {error && (
              <div className="min-w-0 flex-1 rounded-xl border border-rose-200/80 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>
            )}
          </div>
        </div>
      </div>

      {result && (
        <div className={`${panelClass} overflow-hidden`}>
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-base font-semibold text-slate-800">Import results</h2>
            <p className="mt-0.5 text-xs text-slate-500">Created, updated, and skipped rows from the last upload</p>
          </div>
          <div className="p-6">
            <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className={kpiTileClass}>
                <div className="text-xs font-medium uppercase tracking-wider text-slate-500">Total rows</div>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{result.totalRows}</p>
              </div>
              <div className={kpiTileClass}>
                <div className="text-xs font-medium uppercase tracking-wider text-emerald-600">Created</div>
                <p className="mt-2 text-2xl font-semibold text-emerald-700">{result.created}</p>
              </div>
              <div className={kpiTileClass}>
                <div className="text-xs font-medium uppercase tracking-wider text-sky-600">Updated</div>
                <p className="mt-2 text-2xl font-semibold text-sky-700">{result.updated}</p>
              </div>
              <div className={kpiTileClass}>
                <div className="text-xs font-medium uppercase tracking-wider text-rose-600">Skipped</div>
                <p className="mt-2 text-2xl font-semibold text-rose-700">{result.skipped}</p>
              </div>
            </div>
            {result.results.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left">
                      <th className="px-4 py-2.5 font-semibold text-slate-600">Row</th>
                      <th className="px-4 py-2.5 font-semibold text-slate-600">Employee</th>
                      <th className="px-4 py-2.5 font-semibold text-slate-600">Leave type</th>
                      <th className="px-4 py-2.5 font-semibold text-slate-600">Status</th>
                      <th className="px-4 py-2.5 font-semibold text-slate-600">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {result.results.map((r) => (
                      <tr key={r.row} className={r.status === "Skipped" ? "bg-rose-50/40" : ""}>
                        <td className="px-4 py-2 text-slate-600">{r.row}</td>
                        <td className="px-4 py-2 font-medium text-slate-700">{r.employeeCode}</td>
                        <td className="px-4 py-2 text-slate-600">{r.leaveType}</td>
                        <td className="px-4 py-2">
                          {r.status === "Created" && <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-100">Created</span>}
                          {r.status === "Updated" && <span className="inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-800 ring-1 ring-sky-100">Updated</span>}
                          {r.status === "Skipped" && <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-800 ring-1 ring-rose-100">Skipped</span>}
                        </td>
                        <td className="px-4 py-2 text-xs text-rose-700">{r.errors.join("; ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ──── Shared Drop Zone Component ────

function DropZone({ file, fileRef, dragOver, setDragOver, onFileChange }: {
  file: File | null;
  fileRef: React.RefObject<HTMLInputElement>;
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  onFileChange: (f: File | null) => void;
}) {
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) onFileChange(f); }}
      onClick={() => fileRef.current?.click()}
      className={`relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition ${
        dragOver
          ? "border-indigo-400 bg-indigo-50/60"
          : file
            ? "border-emerald-300/90 bg-emerald-50/50"
            : "border-slate-300 bg-slate-50/80 hover:border-indigo-300 hover:bg-slate-50"
      }`}
    >
      <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => onFileChange(e.target.files?.[0] ?? null)} />
      {file ? (
        <div className="flex flex-col items-center gap-2">
          <svg className="h-10 w-10 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <p className="text-sm font-semibold text-slate-800">{file.name}</p>
          <p className="text-xs text-slate-600">{(file.size / 1024).toFixed(1)} KB</p>
          <button type="button" onClick={(e) => { e.stopPropagation(); onFileChange(null); if (fileRef.current) fileRef.current.value = ""; }} className="mt-1 text-xs font-medium text-rose-600 hover:text-rose-800">Remove</button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <svg className="h-10 w-10 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
          <p className="text-sm font-medium text-slate-700">Drop your Excel file here or click to browse</p>
          <p className="text-xs text-slate-500">Supports .xlsx and .xls (max 20MB)</p>
        </div>
      )}
    </div>
  );
}

