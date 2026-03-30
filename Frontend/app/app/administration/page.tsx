"use client";

import { useState, useEffect, useRef } from "react";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { API_BASE_URL } from "@/config/constants";

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

type ActiveSection = "employees" | "leaveBalances" | null;

// ──── Page ────

export default function AdministrationPage() {
  const [activeSection, setActiveSection] = useState<ActiveSection>("employees");

  return (
    <>
      <AppTopbar title="Administration" />

      <div className="mx-auto max-w-5xl space-y-8 pt-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Data Import / Export</h1>
          <p className="mt-1 text-sm text-slate-500">Upload bulk data using Excel spreadsheets. Select a module below to get started.</p>
        </div>

        {/* Import Cards Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Employee Import */}
          <button onClick={() => setActiveSection("employees")} className={`rounded-2xl border-2 p-6 shadow-sm text-left transition ${activeSection === "employees" ? "border-blue-400 bg-blue-50/30 ring-2 ring-blue-200" : "border-blue-200 bg-white hover:border-blue-300"}`}>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
                <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Employee Import</h3>
                <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">Active</span>
              </div>
            </div>
            <p className="text-xs text-slate-500">Upload employee personal, job, contact, and identification details in bulk.</p>
          </button>

          {/* Leave Balance Import */}
          <button onClick={() => setActiveSection("leaveBalances")} className={`rounded-2xl border-2 p-6 shadow-sm text-left transition ${activeSection === "leaveBalances" ? "border-purple-400 bg-purple-50/30 ring-2 ring-purple-200" : "border-purple-200 bg-white hover:border-purple-300"}`}>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100">
                <svg className="h-5 w-5 text-purple-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Leave Balance Import</h3>
                <span className="text-[10px] font-medium text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">Active</span>
              </div>
            </div>
            <p className="text-xs text-slate-500">Upload initial leave balances for employees — entitled, used, and carried forward.</p>
          </button>

          {/* Future modules */}
          {[
            { icon: "M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342", label: "Qualifications Import", desc: "Education, skills, and languages" },
            { icon: "M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z", label: "Payroll Import", desc: "Compensation and bank details" },
            { icon: "M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z", label: "Dependents Import", desc: "Emergency contacts and dependents" },
            { icon: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z", label: "Immigration Import", desc: "Visa and passport records" },
          ].map((mod) => (
            <div key={mod.label} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm opacity-60">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                  <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={mod.icon} /></svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-600">{mod.label}</h3>
                  <span className="text-[10px] font-medium text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">Coming Soon</span>
                </div>
              </div>
              <p className="text-xs text-slate-400">{mod.desc}</p>
            </div>
          ))}
        </div>

        {/* Employee Upload Section */}
        {activeSection === "employees" && <EmployeeUploadSection />}

        {/* Leave Balance Upload Section */}
        {activeSection === "leaveBalances" && <LeaveBalanceUploadSection />}

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
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100">
              <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
            </div>
            <h2 className="text-[15px] font-bold text-slate-700">Employee Bulk Import</h2>
          </div>
          <button
            onClick={async () => {
              try {
                await downloadTemplate("/api/bulkupload/template", "EmployeeImportTemplate.xlsx");
              } catch (e) {
                setError(e instanceof Error ? e.message : "Template download failed");
              }
            }}
            className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 transition hover:bg-green-100"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
            Download Template
          </button>
        </div>
        <div className="p-6">
          <div className="mb-5 rounded-xl bg-blue-50 border border-blue-100 p-4">
            <h4 className="text-sm font-semibold text-blue-800 mb-2">How to import employees:</h4>
            <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
              <li>Click <strong>Download Template</strong> to get the Excel file with all columns pre-formatted.</li>
              <li>Fill in employee data. <strong>First Name, Last Name, Email, Department, Gender, Date of Birth, Joined Date</strong> are required.</li>
              <li>Use values from the lookup sheets (Departments, Grades, etc.) for dropdown fields.</li>
              <li><strong>Employment Type</strong> and <strong>Employee Status</strong> must match the codes on the <strong>Reference</strong> sheet (same codes as Administration → Organization / People Hub).</li>
              <li>Leave <strong>Employee Code</strong> blank to auto-generate, or provide unique codes.</li>
              <li>Upload the completed file below.</li>
            </ol>
          </div>
          <DropZone file={file} fileRef={fileRef} dragOver={dragOver} setDragOver={setDragOver} onFileChange={handleFileChange} />
          <div className="mt-4 flex items-center gap-4">
            <button onClick={handleUpload} disabled={!file || uploading} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
              {uploading && <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
              {uploading ? "Uploading & Processing..." : "Upload & Import"}
            </button>
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        </div>
      </div>

      {result && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-4"><h2 className="text-[15px] font-bold text-slate-700">Import Results</h2></div>
          <div className="p-6">
            <div className="mb-5 grid grid-cols-3 gap-4">
              <div className="rounded-xl bg-slate-50 p-4 text-center"><p className="text-2xl font-bold text-slate-700">{result.totalRows}</p><p className="text-xs text-slate-500">Total Rows</p></div>
              <div className="rounded-xl bg-green-50 p-4 text-center"><p className="text-2xl font-bold text-green-600">{result.created}</p><p className="text-xs text-green-600">Created</p></div>
              <div className="rounded-xl bg-red-50 p-4 text-center"><p className="text-2xl font-bold text-red-500">{result.skipped}</p><p className="text-xs text-red-500">Skipped</p></div>
            </div>
            {result.results.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead><tr className="bg-slate-50 text-left">
                    <th className="px-4 py-2.5 font-semibold text-slate-600">Row</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-600">Name</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-600">Status</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-600">Details</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {result.results.map((r) => (
                      <tr key={r.row} className={r.success ? "" : "bg-red-50/50"}>
                        <td className="px-4 py-2 text-slate-600">{r.row}</td>
                        <td className="px-4 py-2 text-slate-700 font-medium">{r.firstName} {r.lastName}</td>
                        <td className="px-4 py-2">
                          {r.success
                            ? <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Created</span>
                            : <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Skipped</span>}
                        </td>
                        <td className="px-4 py-2 text-xs text-red-500">{r.errors.join("; ")}</td>
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
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100">
              <svg className="h-5 w-5 text-purple-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
            </div>
            <h2 className="text-[15px] font-bold text-slate-700">Leave Balance Bulk Import</h2>
          </div>
          <button
            onClick={async () => {
              try {
                await downloadTemplate("/api/bulkupload/leave-balance-template", "LeaveBalanceImportTemplate.xlsx");
              } catch (e) {
                setError(e instanceof Error ? e.message : "Template download failed");
              }
            }}
            className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 transition hover:bg-green-100"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
            Download Template
          </button>
        </div>
        <div className="p-6">
          <div className="mb-5 rounded-xl bg-purple-50 border border-purple-100 p-4">
            <h4 className="text-sm font-semibold text-purple-800 mb-2">How to import leave balances:</h4>
            <ol className="text-xs text-purple-700 space-y-1 list-decimal list-inside">
              <li>Click <strong>Download Template</strong> to get the Excel file with pre-formatted columns.</li>
              <li>The template includes an <strong>Employees</strong> sheet with all employee codes and a <strong>LeaveTypes</strong> sheet with valid leave types.</li>
              <li>Fill in: <strong>Employee Code, Leave Type, Year, Entitled</strong> (required). Used and Carried Forward default to 0.</li>
              <li>If a balance already exists for the same employee + leave type + year, it will be <strong>updated</strong>.</li>
              <li>Upload the completed file below.</li>
            </ol>
          </div>
          <DropZone file={file} fileRef={fileRef} dragOver={dragOver} setDragOver={setDragOver} onFileChange={handleFileChange} />
          <div className="mt-4 flex items-center gap-4">
            <button onClick={handleUpload} disabled={!file || uploading} className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed">
              {uploading && <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
              {uploading ? "Uploading & Processing..." : "Upload & Import"}
            </button>
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        </div>
      </div>

      {result && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-4"><h2 className="text-[15px] font-bold text-slate-700">Import Results</h2></div>
          <div className="p-6">
            <div className="mb-5 grid grid-cols-4 gap-4">
              <div className="rounded-xl bg-slate-50 p-4 text-center"><p className="text-2xl font-bold text-slate-700">{result.totalRows}</p><p className="text-xs text-slate-500">Total Rows</p></div>
              <div className="rounded-xl bg-green-50 p-4 text-center"><p className="text-2xl font-bold text-green-600">{result.created}</p><p className="text-xs text-green-600">Created</p></div>
              <div className="rounded-xl bg-blue-50 p-4 text-center"><p className="text-2xl font-bold text-blue-600">{result.updated}</p><p className="text-xs text-blue-600">Updated</p></div>
              <div className="rounded-xl bg-red-50 p-4 text-center"><p className="text-2xl font-bold text-red-500">{result.skipped}</p><p className="text-xs text-red-500">Skipped</p></div>
            </div>
            {result.results.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead><tr className="bg-slate-50 text-left">
                    <th className="px-4 py-2.5 font-semibold text-slate-600">Row</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-600">Employee</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-600">Leave Type</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-600">Status</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-600">Details</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {result.results.map((r) => (
                      <tr key={r.row} className={r.status === "Skipped" ? "bg-red-50/50" : ""}>
                        <td className="px-4 py-2 text-slate-600">{r.row}</td>
                        <td className="px-4 py-2 text-slate-700 font-medium">{r.employeeCode}</td>
                        <td className="px-4 py-2 text-slate-600">{r.leaveType}</td>
                        <td className="px-4 py-2">
                          {r.status === "Created" && <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Created</span>}
                          {r.status === "Updated" && <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">Updated</span>}
                          {r.status === "Skipped" && <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Skipped</span>}
                        </td>
                        <td className="px-4 py-2 text-xs text-red-500">{r.errors.join("; ")}</td>
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
        dragOver ? "border-blue-400 bg-blue-50" : file ? "border-green-300 bg-green-50" : "border-slate-300 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/50"
      }`}
    >
      <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => onFileChange(e.target.files?.[0] ?? null)} />
      {file ? (
        <div className="flex flex-col items-center gap-2">
          <svg className="h-10 w-10 text-green-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <p className="text-sm font-semibold text-green-700">{file.name}</p>
          <p className="text-xs text-green-600">{(file.size / 1024).toFixed(1)} KB</p>
          <button type="button" onClick={(e) => { e.stopPropagation(); onFileChange(null); if (fileRef.current) fileRef.current.value = ""; }} className="mt-1 text-xs text-red-500 hover:text-red-700">Remove</button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <svg className="h-10 w-10 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
          <p className="text-sm font-medium text-slate-600">Drop your Excel file here or click to browse</p>
          <p className="text-xs text-slate-400">Supports .xlsx and .xls (max 20MB)</p>
        </div>
      )}
    </div>
  );
}

