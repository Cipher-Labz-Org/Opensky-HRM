"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { AppTopbar } from "@/components/navigation/AppTopbar";
import { Button } from "@/components/ui/Button";
import { CreateRoleModal } from "@/components/forms/CreateRoleModal";
import { MasterDataEditorModal } from "@/components/forms/MasterDataEditorModal";
import { apiFetch } from "@/lib/api";

import { Modal } from "@/components/ui/Modal";

interface CountSummary {
  businessUnits: number;
  grades: number;
  jobTitles: number;
}

interface LetterTemplate {
  id: string;
  name: string;
  templateKey: string;
  htmlContent: string;
  isActive: boolean;
}

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const [showCreate, setShowCreate] = useState(false);
  const [editBU, setEditBU] = useState(false);
  const [editGrades, setEditGrades] = useState(false);
  const [editJobs, setEditJobs] = useState(false);
  const [editDocs, setEditDocs] = useState(false);
  const [counts, setCounts] = useState<CountSummary>({ businessUnits: 0, grades: 0, jobTitles: 0 });

  const [codeAutoGen, setCodeAutoGen] = useState(true);
  const [codeLength, setCodeLength] = useState("6");
  const [codePrefix, setCodePrefix] = useState("EMP");
  const [codeSaving, setCodeSaving] = useState(false);
  const [codeMsg, setCodeMsg] = useState("");
  const [codePreview, setCodePreview] = useState("");

  const [letterTemplates, setLetterTemplates] = useState<LetterTemplate[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<LetterTemplate | null>(null);
  const [tplName, setTplName] = useState("");
  const [tplHtml, setTplHtml] = useState("");
  const [tplActive, setTplActive] = useState(true);
  const [tplSaving, setTplSaving] = useState(false);
  const [tplPreview, setTplPreview] = useState(false);

  const [approvalLevels, setApprovalLevels] = useState(1);
  const [approvalConfigSaving, setApprovalConfigSaving] = useState(false);

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
    ]).then(([businessUnits, grades, jobTitles]) =>
      setCounts({ businessUnits, grades, jobTitles })
    );
  }, [editBU, editGrades, editJobs]);

  useEffect(() => {
    apiFetch<Record<string, string>>("/api/system-settings")
      .then((settings) => {
        if (settings.EmployeeCodeAutoGenerate) setCodeAutoGen(settings.EmployeeCodeAutoGenerate !== "false");
        if (settings.EmployeeCodeLength) setCodeLength(settings.EmployeeCodeLength);
        if (settings.EmployeeCodePrefix) setCodePrefix(settings.EmployeeCodePrefix);
      })
      .catch(() => {});
  }, []);

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
    apiFetch<LetterTemplate[]>("/api/documenttemplates")
      .then(setLetterTemplates)
      .catch(() => {});
  }, []);

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

  function openTemplateEditor(tpl: LetterTemplate) {
    apiFetch<LetterTemplate>(`/api/documenttemplates/${tpl.id}`)
      .then((full) => {
        setEditingTemplate(full);
        setTplName(full.name);
        setTplHtml(full.htmlContent);
        setTplActive(full.isActive);
        setTplPreview(false);
      })
      .catch(() => {});
  }

  async function saveTemplate() {
    if (!editingTemplate) return;
    setTplSaving(true);
    try {
      const updated = await apiFetch<LetterTemplate>(`/api/documenttemplates/${editingTemplate.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: tplName, htmlContent: tplHtml, isActive: tplActive }),
      });
      setLetterTemplates((prev) =>
        prev.map((t) => (t.id === updated.id ? { ...t, name: updated.name, isActive: updated.isActive } : t))
      );
      setEditingTemplate(null);
    } catch {
      alert("Failed to save template");
    } finally {
      setTplSaving(false);
    }
  }

  return (
    <>
      <AppTopbar
        title="Policy, Security & Configuration"
        subtitle="Workflow engine, role-based access, localization, statutory rules, and platform administration."
      />

      <div className="mb-6 flex items-center justify-between">
        <div />
        <Button onClick={() => setShowCreate(true)}>+ New Security Role</Button>
      </div>

      <CreateRoleModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => window.location.reload()}
      />

      {/* Leave Approval Workflow */}
      <div className="hris-card mb-6">
        <div className="section-title">
          <h3>Leave Approval Workflow</h3>
          <span>Number of approval levels for leave requests</span>
        </div>
        <div className="flex flex-wrap items-center gap-4 px-1 py-2">
          <p className="text-sm text-[var(--text-muted)]">Approval levels:</p>
          <div className="flex gap-2">
            <button
              onClick={() => saveLeaveApprovalConfig(1)}
              disabled={approvalConfigSaving}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${approvalLevels === 1 ? "bg-[var(--primary)] text-white shadow" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              1 Level
            </button>
            <button
              onClick={() => saveLeaveApprovalConfig(2)}
              disabled={approvalConfigSaving}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${approvalLevels === 2 ? "bg-[var(--primary)] text-white shadow" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
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

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="hris-card">
          <div className="section-title">
            <h3>Workflow Builder</h3>
            <span>No-code flow control</span>
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
        <div className="hris-card">
          <div className="section-title">
            <h3>Security Model</h3>
            <span>Granular access</span>
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
        <div className="hris-card">
          <div className="section-title">
            <h3>Localization</h3>
            <span>Multi-country ready</span>
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
        <div className="hris-card">
          <div className="section-title">
            <h3>Master Data Blocks</h3>
            <span>Reusable configuration</span>
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
          </div>
        </div>

        <div className="hris-card">
          <div className="section-title">
            <h3>Letter Templates</h3>
            <span>Configure document templates for employee letters</span>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-[var(--text-muted)] mb-2">
              Available placeholders: <code className="text-[10px] bg-slate-100 px-1 rounded">{"{{EmployeeName}}"}</code> <code className="text-[10px] bg-slate-100 px-1 rounded">{"{{EmployeeCode}}"}</code> <code className="text-[10px] bg-slate-100 px-1 rounded">{"{{JobTitle}}"}</code> <code className="text-[10px] bg-slate-100 px-1 rounded">{"{{Department}}"}</code> <code className="text-[10px] bg-slate-100 px-1 rounded">{"{{JoinDate}}"}</code> <code className="text-[10px] bg-slate-100 px-1 rounded">{"{{CurrentDate}}"}</code> <code className="text-[10px] bg-slate-100 px-1 rounded">{"{{CompanyName}}"}</code> and more.
            </p>
            {letterTemplates.map((tpl) => (
              <div key={tpl.id} className="flex items-center justify-between rounded-xl bg-[var(--bg-subtle)] px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className={`h-2 w-2 rounded-full ${tpl.isActive ? "bg-green-500" : "bg-slate-300"}`} />
                  <div>
                    <strong className="text-sm font-semibold text-[var(--text)]">{tpl.name}</strong>
                    <div className="text-xs text-[var(--text-muted)]">{tpl.templateKey}</div>
                  </div>
                </div>
                <button onClick={() => openTemplateEditor(tpl)} className="text-sm font-medium text-[var(--primary)] hover:underline">Edit</button>
              </div>
            ))}
          </div>
        </div>

        {editingTemplate && (
          <Modal open={!!editingTemplate} onClose={() => setEditingTemplate(null)} title="">
            <div className="max-h-[80vh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-slate-700 mb-4">Edit Template: {editingTemplate.name}</h3>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Template Name</label>
                  <input value={tplName} onChange={(e) => setTplName(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={tplActive} onChange={(e) => setTplActive(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                    <span className="text-sm text-slate-600">Active</span>
                  </label>
                  <button type="button" onClick={() => setTplPreview(!tplPreview)} className="ml-auto text-sm font-medium text-blue-600 hover:underline">
                    {tplPreview ? "Edit HTML" : "Preview"}
                  </button>
                </div>
                {tplPreview ? (
                  <div className="rounded-lg border border-slate-200 bg-white p-4 max-h-[400px] overflow-auto">
                    <div dangerouslySetInnerHTML={{ __html: tplHtml }} />
                  </div>
                ) : (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">HTML Content</label>
                    <textarea value={tplHtml} onChange={(e) => setTplHtml(e.target.value)} rows={16} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-y" />
                  </div>
                )}
                <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3">
                  <button type="button" onClick={() => setEditingTemplate(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50">Cancel</button>
                  <button type="button" onClick={saveTemplate} disabled={tplSaving} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50">{tplSaving ? "Saving..." : "Save Template"}</button>
                </div>
              </div>
            </div>
          </Modal>
        )}

        <div className="hris-card">
          <div className="section-title">
            <h3>Audit &amp; Compliance</h3>
            <span>Non-negotiable enterprise controls</span>
          </div>
          <table className="hris-table">
            <thead><tr><th>Control</th><th>Description</th></tr></thead>
            <tbody>
              <tr><td>Audit trail</td><td>Every master and transaction change logged with user, time, old/new value</td></tr>
              <tr><td>Document retention</td><td>Controlled storage and expiry/removal policies</td></tr>
              <tr><td>PII protection</td><td>Field masking, encryption, scoped exports</td></tr>
              <tr><td>Approval evidence</td><td>Who approved, comments, timestamps, attached files</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="hris-card">
          <div className="section-title">
            <h3>Employee Code Format</h3>
            <span>Numbering configuration</span>
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

        <div className="hris-card">
          <div className="section-title">
            <h3>Platform Settings</h3>
            <span>Architecture hooks</span>
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

      <p className="footer-note">
        Prototype prepared as a downloadable UI concept. All numbers and employee records are sample data for design purposes.
      </p>
    </>
  );
}
