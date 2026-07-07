"use client";

import Link from "next/link";
import { useState, useRef } from "react";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { Button } from "@/components/ui/Button";
import { InlinePageAlert } from "@/components/ui";
import { API_BASE_URL, API_ASSET_BASE_URL, getApiBaseUrl } from "@/config/constants";
import { ROUTES } from "@/config/routes";
import { apiFetch } from "@/lib/api";

const kpiTileClass =
  "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md";
const panelClass = "rounded-2xl border border-slate-200 bg-white shadow-sm";

/** Must match `BulkUploadController.BulkImportDefaultLoginPassword` in the API. */
const BULK_IMPORT_DEFAULT_LOGIN_PASSWORD = "123";

// ──── Shared Types ────

interface RowResult {
  row: number;
  firstName: string;
  lastName: string;
  success: boolean;
  errors: string[];
  notes?: string[] | null;
}

interface UploadResult {
  created: number;
  skipped: number;
  totalRows: number;
  results: RowResult[];
  loginsCreated?: number;
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

interface PayrollRowError {
  row: number;
  employeeCode?: string | null;
  message: string;
}

interface PayrollSheetSummary {
  created: number;
  skipped: number;
  errors: PayrollRowError[];
}

interface PayrollImportSummary {
  directDeposits: PayrollSheetSummary;
}

function parsePayrollImportSummary(json: unknown): PayrollImportSummary {
  const j = json as Record<string, unknown>;
  const sheet = (raw: unknown): PayrollSheetSummary => {
    const s = (raw ?? {}) as Record<string, unknown>;
    const errs = (s.errors ?? s.Errors ?? []) as unknown[];
    return {
      created: Number(s.created ?? s.Created ?? 0),
      skipped: Number(s.skipped ?? s.Skipped ?? 0),
      errors: errs.map((e) => {
        const r = (e ?? {}) as Record<string, unknown>;
        return {
          row: Number(r.row ?? r.Row ?? 0),
          employeeCode: (r.employeeCode ?? r.EmployeeCode) as string | null | undefined,
          message: String(r.message ?? r.Message ?? ""),
        };
      }),
    };
  };
  return {
    directDeposits: sheet(j.directDeposits ?? j.DirectDeposits),
  };
}

type ActiveSection = "employees" | "leaveBalances" | "payroll";

// ──── Page ────

const roadmapModules = [
  { icon: "M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342", label: "Qualifications import", desc: "Education, skills, and languages" },
  { icon: "M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z", label: "Dependents import", desc: "Emergency contacts and dependents" },
  { icon: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z", label: "Immigration import", desc: "Visa and passport records" },
] as const;

export default function AdministrationPage() {
  const [activeSection, setActiveSection] = useState<ActiveSection>("employees");

  return (
    <>
      <AppTopbar
        title="Administration"
        subtitle="Bulk Excel import for people data, leave balances, and direct deposit (bank accounts). Download a template before you upload."
      />

      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-900">Quick links</h3>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href={ROUTES.people}
              className="group rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-800">People</div>
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
          <button
            type="button"
            onClick={() => setActiveSection("payroll")}
            className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
              activeSection === "payroll"
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/90"
                : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
            }`}
          >
            Direct deposit import
          </button>
        </div>

        {activeSection === "employees" && <EmployeeUploadSection />}
        {activeSection === "leaveBalances" && <LeaveBalanceUploadSection />}
        {activeSection === "payroll" && <PayrollUploadSection />}

        <div className={`${panelClass} overflow-hidden`}>
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-base font-semibold text-slate-800">More importers</h2>
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

      </div>
    </>
  );
}

async function downloadTemplate(path: string, fallbackFilename: string) {
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    throw new Error(
      `Cannot reach API at ${API_BASE_URL}. Set NEXT_PUBLIC_API_URL and ensure the backend is running.`
    );
  }
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

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const escape = (value: string) => `"${value.replace(/"/g, "\"\"")}"`;
  const csv = [headers, ...rows].map((r) => r.map((c) => escape(c ?? "")).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
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
  const [createUserLogins, setCreateUserLogins] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileChange(f: File | null) { setFile(f); setResult(null); setError(""); }

  async function handleUpload() {
    if (!file) return;
    setUploading(true); setError(""); setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("createUserLogins", createUserLogins ? "true" : "false");
      const bulkUploadBase =
        typeof window !== "undefined" &&
        getApiBaseUrl() === "/hrm-backend"
          ? API_ASSET_BASE_URL
          : undefined;
      const json = await apiFetch<UploadResult>("/api/bulkupload/employees", {
        method: "POST",
        body: formData,
        timeoutMs: 300_000,
        baseUrl: bulkUploadBase,
      });
      setResult(json);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) { setError(err instanceof Error ? err.message : "Upload failed"); }
    finally { setUploading(false); }
  }

  function downloadSkippedRows() {
    if (!result) return;
    const skippedRows = result.results.filter((r) => !r.success);
    if (skippedRows.length === 0) return;
    const rows = skippedRows.map((r) => [
      String(r.row),
      r.firstName,
      r.lastName,
      "Skipped",
      r.errors.join("; "),
    ]);
    downloadCsv("employee-import-skipped-rows.csv", ["Row", "First Name", "Last Name", "Status", "Details"], rows);
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
              <li>
                Fill in employee data. <strong>First Name, Last Name, Department, Gender, Date of Birth, Joined Date</strong> are required.{" "}
                <strong>Email</strong> is optional. Leave blank if the employee has no company email address. Leave <strong>Employee Code</strong> blank to auto-generate a code for the employee record only. If you enable <strong>Create employee logins</strong>, a login is created only for rows with <strong>Employee Code</strong> filled in — that code becomes the username (letters, digits, <code className="text-[11px]">.</code>, <code className="text-[11px]">_</code>, or <code className="text-[11px]">-</code>; unique). Rows with a blank Employee Code are imported without a login.
              </li>
              <li>Use values from the lookup sheets (Departments, Grades, etc.) for dropdown fields.</li>
              <li><strong>Employment Type</strong> and <strong>Employee Status</strong> must match the codes on the <strong>Reference</strong> sheet (same codes as Organization / People Hub).</li>
              <li>Upload the completed file below.</li>
            </ol>
            <p className="mt-3 text-xs text-slate-600">
              When <strong>Create employee logins</strong> is checked, a login is created only for rows with <strong>Employee Code</strong> filled in (used as username). Blank Employee Code rows are imported as employees only. Default password{" "}
              <strong>{BULK_IMPORT_DEFAULT_LOGIN_PASSWORD}</strong> and mandatory password change on first sign-in. Allowed username characters: letters, digits, <code className="text-[11px]">.</code>, <code className="text-[11px]">_</code>, <code className="text-[11px]">-</code> (unique; a numeric suffix may be added to avoid collisions). With the option off, no logins are created.
            </p>
          </div>
          <DropZone file={file} fileRef={fileRef} dragOver={dragOver} setDragOver={setDragOver} onFileChange={handleFileChange} />
          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-[#1a92d5] focus:ring-[#1a92d5]"
              checked={createUserLogins}
              onChange={(e) => setCreateUserLogins(e.target.checked)}
            />
            <span>
              <span className="font-semibold text-slate-900">Create employee logins</span> — uses <strong>Employee Code</strong> as username when filled in (blank code = employee only); default password{" "}
              <strong>{BULK_IMPORT_DEFAULT_LOGIN_PASSWORD}</strong>, mandatory password change on first login.
            </span>
          </label>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button disabled={!file || uploading} onClick={handleUpload}>
              {uploading && (
                <span className="mr-2 inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-200 border-t-[#2B7DE9]" aria-hidden />
              )}
              {uploading ? "Uploading…" : "Upload & import"}
            </Button>
            <InlinePageAlert message={error} className="min-w-0 flex-1 rounded-xl border border-rose-200/80 bg-rose-50 px-3 py-2 text-sm text-rose-800 scroll-mt-20" />
          </div>
        </div>
      </div>

      {result && (
        <div className={`${panelClass} overflow-hidden`}>
          <div className="border-b border-slate-100 px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-800">Import results</h2>
                <p className="mt-0.5 text-xs text-slate-500">Row-level outcomes from the last upload</p>
              </div>
              {result.skipped > 0 && (
                <Button variant="secondary" className="gap-2" onClick={downloadSkippedRows}>
                  <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Download skipped list
                </Button>
              )}
            </div>
          </div>
          <div className="p-6">
            <div className={`mb-5 grid gap-4 ${(result.loginsCreated ?? 0) > 0 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"}`}>
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
              {(result.loginsCreated ?? 0) > 0 ? (
                <div className={kpiTileClass}>
                  <div className="text-xs font-medium uppercase tracking-wider text-sky-600">Logins created</div>
                  <p className="mt-2 text-2xl font-semibold text-sky-700">{result.loginsCreated}</p>
                </div>
              ) : null}
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
                      <th className="px-4 py-2.5 font-semibold text-slate-600">Notes</th>
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
                        <td className="px-4 py-2 text-xs text-slate-600">{r.notes?.length ? r.notes.join(" ") : "—"}</td>
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
      const json = await apiFetch<LeaveBalanceUploadResult>("/api/bulkupload/leave-balances", { method: "POST", body: formData });
      setResult(json);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) { setError(err instanceof Error ? err.message : "Upload failed"); }
    finally { setUploading(false); }
  }

  function downloadSkippedRows() {
    if (!result) return;
    const skippedRows = result.results.filter((r) => r.status === "Skipped");
    if (skippedRows.length === 0) return;
    const rows = skippedRows.map((r) => [
      String(r.row),
      r.employeeCode,
      r.leaveType,
      r.status,
      r.errors.join("; "),
    ]);
    downloadCsv(
      "leave-balance-import-skipped-rows.csv",
      ["Row", "Employee Code", "Leave Type", "Status", "Details"],
      rows
    );
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
            <InlinePageAlert message={error} className="min-w-0 flex-1 rounded-xl border border-rose-200/80 bg-rose-50 px-3 py-2 text-sm text-rose-800 scroll-mt-20" />
          </div>
        </div>
      </div>

      {result && (
        <div className={`${panelClass} overflow-hidden`}>
          <div className="border-b border-slate-100 px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-800">Import results</h2>
                <p className="mt-0.5 text-xs text-slate-500">Created, updated, and skipped rows from the last upload</p>
              </div>
              {result.skipped > 0 && (
                <Button variant="secondary" className="gap-2" onClick={downloadSkippedRows}>
                  <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Download skipped list
                </Button>
              )}
            </div>
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

// ──── Direct deposit (payroll bulk) upload ────

function PayrollUploadSection() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<PayrollImportSummary | null>(null);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileChange(f: File | null) {
    setFile(f);
    setResult(null);
    setError("");
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError("");
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const json = await apiFetch<unknown>("/api/bulkupload/payroll", { method: "POST", body: formData });
      setResult(parsePayrollImportSummary(json));
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function downloadErrorRows() {
    if (!result) return;
    const rows = result.directDeposits.errors.map((e) => [String(e.row), e.employeeCode ?? "", e.message]);
    if (rows.length === 0) return;
    downloadCsv("direct-deposit-import-errors.csv", ["Row", "Employee Code", "Message"], rows);
  }

  const totalCreated = result ? result.directDeposits.created : 0;
  const totalSkipped = result ? result.directDeposits.skipped : 0;
  const totalErrors = result ? result.directDeposits.errors.length : 0;

  return (
    <>
      <div className={`${panelClass} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 ring-1 ring-teal-100">
              <svg className="h-5 w-5 text-teal-700" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-800">Direct deposit bulk import</h2>
              <p className="text-xs text-slate-500">Bank accounts / splits on the employee profile — keyed by employee code (same columns as People → bank accounts)</p>
            </div>
          </div>
          <Button
            variant="secondary"
            className="gap-2"
            onClick={async () => {
              try {
                await downloadTemplate("/api/bulkupload/payroll-template", "DirectDepositImportTemplate.xlsx");
              } catch (e) {
                setError(e instanceof Error ? e.message : "Template download failed");
              }
            }}
          >
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Download template
          </Button>
        </div>
        <div className="p-6">
          <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <h4 className="mb-2 text-sm font-semibold text-slate-800">How to import direct deposits</h4>
            <ol className="list-inside list-decimal space-y-1 text-xs text-slate-600">
              <li>
                The file contains one sheet, <strong>DirectDeposits</strong>, with the same header style as the employee import template (navy row, white text).
              </li>
              <li>
                Each data row needs a valid <strong>Employee Code</strong> and <strong>Account Number</strong>. Optional: Bank Name, Account Type (e.g. Checking), Bank/Branch codes and location.
              </li>
              <li>Blank employee rows are ignored. Only data rows under the header are imported as bank accounts on the employee profile.</li>
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
            <InlinePageAlert message={error} className="min-w-0 flex-1 rounded-xl border border-rose-200/80 bg-rose-50 px-3 py-2 text-sm text-rose-800 scroll-mt-20" />
          </div>
        </div>
      </div>

      {result && (
        <div className={`${panelClass} overflow-hidden`}>
          <div className="border-b border-slate-100 px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-800">Import results</h2>
                <p className="mt-0.5 text-xs text-slate-500">Created, skipped, and row-level errors for DirectDeposits</p>
              </div>
              {totalErrors > 0 && (
                <Button variant="secondary" className="gap-2" onClick={downloadErrorRows}>
                  <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Download errors CSV
                </Button>
              )}
            </div>
          </div>
          <div className="p-6">
            <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div className={kpiTileClass}>
                <div className="text-xs font-medium uppercase tracking-wider text-emerald-600">Created</div>
                <p className="mt-2 text-2xl font-semibold text-emerald-700">{totalCreated}</p>
              </div>
              <div className={kpiTileClass}>
                <div className="text-xs font-medium uppercase tracking-wider text-rose-600">Skipped</div>
                <p className="mt-2 text-2xl font-semibold text-rose-700">{totalSkipped}</p>
              </div>
              <div className={kpiTileClass}>
                <div className="text-xs font-medium uppercase tracking-wider text-slate-500">Row errors</div>
                <p className="mt-2 text-2xl font-semibold text-slate-800">{totalErrors}</p>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <h3 className="text-sm font-semibold text-slate-800">DirectDeposits sheet</h3>
              <p className="mt-2 text-xs text-slate-600">
                Created <strong className="text-emerald-700">{result.directDeposits.created}</strong> · Skipped{" "}
                <strong className="text-rose-700">{result.directDeposits.skipped}</strong> · Errors{" "}
                <strong>{result.directDeposits.errors.length}</strong>
              </p>
            </div>
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

