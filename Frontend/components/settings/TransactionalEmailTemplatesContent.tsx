"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";

interface TemplateListItem {
  id: string;
  name: string;
  templateKey: string;
  isActive: boolean;
}

interface TemplateDetail extends TemplateListItem {
  subject?: string | null;
  htmlContent: string;
}

type ApiRow = Record<string, unknown>;

function str(v: unknown): string {
  return v == null ? "" : String(v);
}

function normalizeListRow(raw: ApiRow): TemplateListItem {
  return {
    id: str(raw.id ?? raw.Id),
    name: str(raw.name ?? raw.Name),
    templateKey: str(raw.templateKey ?? raw.TemplateKey),
    isActive: Boolean(raw.isActive ?? raw.IsActive),
  };
}

function normalizeDetail(raw: ApiRow): TemplateDetail {
  const base = normalizeListRow(raw);
  return {
    ...base,
    subject: (raw.subject ?? raw.Subject) as string | null | undefined,
    htmlContent: str(raw.htmlContent ?? raw.HtmlContent),
  };
}

export function TransactionalEmailTemplatesContent() {
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<TemplateDetail | null>(null);
  const [tplName, setTplName] = useState("");
  const [tplSubject, setTplSubject] = useState("");
  const [tplHtml, setTplHtml] = useState("");
  const [tplActive, setTplActive] = useState(true);
  const [tplSaving, setTplSaving] = useState(false);
  const [tplPreview, setTplPreview] = useState(false);
  const [bannerError, setBannerError] = useState("");

  function reloadList() {
    setBannerError("");
    apiFetch<ApiRow[]>("/api/documenttemplates")
      .then((all) => {
        const rows = all.map(normalizeListRow).filter((t) => t.templateKey.startsWith("Email_"));
        setTemplates(rows);
      })
      .catch((e: unknown) => {
        setTemplates([]);
        setBannerError(e instanceof Error ? e.message : "Could not load templates");
      });
  }

  useEffect(() => {
    reloadList();
  }, []);

  function openTemplateEditor(tpl: TemplateListItem) {
    setBannerError("");
    if (!tpl.id || tpl.id === "undefined") {
      setBannerError("This template has no valid id from the server. Check API JSON (expect camelCase id or Id).");
      return;
    }
    apiFetch<ApiRow>(`/api/documenttemplates/${tpl.id}`)
      .then((raw) => {
        const full = normalizeDetail(raw);
        setEditingTemplate(full);
        setTplName(full.name);
        setTplSubject(full.subject ?? "");
        setTplHtml(full.htmlContent);
        setTplActive(full.isActive);
        setTplPreview(false);
      })
      .catch((e: unknown) => {
        setBannerError(e instanceof Error ? e.message : "Could not open template");
      });
  }

  async function saveTemplate() {
    if (!editingTemplate?.id) return;
    setTplSaving(true);
    setBannerError("");
    const body = JSON.stringify({
      name: tplName,
      subject: tplSubject.trim() || null,
      htmlContent: tplHtml,
      isActive: tplActive,
    });
    const url = `/api/documenttemplates/${editingTemplate.id}`;
    try {
      let updated: ApiRow;
      try {
        updated = await apiFetch<ApiRow>(url, { method: "PUT", body });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg.includes("405") || /method.*not supported/i.test(msg)) {
          updated = await apiFetch<ApiRow>(url, { method: "POST", body });
        } else {
          throw e;
        }
      }
      const norm = normalizeDetail(updated);
      const patch = { id: norm.id, name: norm.name, templateKey: norm.templateKey, isActive: norm.isActive };
      setTemplates((prev) => prev.map((t) => (t.id === norm.id ? patch : t)));
      setEditingTemplate(null);
    } catch (e: unknown) {
      setBannerError(e instanceof Error ? e.message : "Failed to save template");
    } finally {
      setTplSaving(false);
    }
  }

  return (
    <>
      {bannerError && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {bannerError}
        </div>
      )}
      <div className="hris-card mb-6">
        <div className="section-title">
          <h3>Transactional email templates</h3>
          <span>Edit subject and HTML for system emails. Changes apply to the next send.</span>
        </div>
        <div className="space-y-2">
          <p className="text-xs text-[var(--text-muted)] mb-2">
            <strong>Leave</strong> (key <code className="text-[10px] bg-slate-100 px-1 rounded">Email_LeaveApplication</code>):{" "}
            <code className="text-[10px] bg-slate-100 px-1 rounded">{"{{EmployeeName}}"}</code>{" "}
            <code className="text-[10px] bg-slate-100 px-1 rounded">{"{{LeaveTypeName}}"}</code>{" "}
            <code className="text-[10px] bg-slate-100 px-1 rounded">{"{{StartDate}}"}</code>{" "}
            <code className="text-[10px] bg-slate-100 px-1 rounded">{"{{EndDate}}"}</code>{" "}
            <code className="text-[10px] bg-slate-100 px-1 rounded">{"{{TotalDays}}"}</code>{" "}
            <code className="text-[10px] bg-slate-100 px-1 rounded">{"{{Status}}"}</code>{" "}
            <code className="text-[10px] bg-slate-100 px-1 rounded">{"{{Reason}}"}</code>
            <br />
            <strong>Offer</strong> (key <code className="text-[10px] bg-slate-100 px-1 rounded">Email_RecruitmentOffer</code>):{" "}
            <code className="text-[10px] bg-slate-100 px-1 rounded">{"{{CandidateName}}"}</code>{" "}
            <code className="text-[10px] bg-slate-100 px-1 rounded">{"{{PositionTitle}}"}</code>{" "}
            <code className="text-[10px] bg-slate-100 px-1 rounded">{"{{SalaryFormatted}}"}</code>{" "}
            <code className="text-[10px] bg-slate-100 px-1 rounded">{"{{JoiningDate}}"}</code>{" "}
            <code className="text-[10px] bg-slate-100 px-1 rounded">{"{{RemarksHtml}}"}</code> (HTML snippet; omit in template if unused) and company fields{" "}
            <code className="text-[10px] bg-slate-100 px-1 rounded">{"{{CompanyName}}"}</code> etc.
          </p>
          {templates.length === 0 ? (
            <p className="text-sm text-slate-500 px-1">
              No email templates found. Run database migrations and restart the API so defaults can be seeded (<code className="text-xs">Email_*</code> keys).
            </p>
          ) : (
            templates.map((tpl) => (
              <div key={tpl.id} className="flex items-center justify-between rounded-xl bg-[var(--bg-subtle)] px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className={`h-2 w-2 rounded-full ${tpl.isActive ? "bg-green-500" : "bg-slate-300"}`} />
                  <div>
                    <strong className="text-sm font-semibold text-[var(--text)]">{tpl.name}</strong>
                    <div className="text-xs text-[var(--text-muted)]">{tpl.templateKey}</div>
                  </div>
                </div>
                <button type="button" onClick={() => openTemplateEditor(tpl)} className="text-sm font-medium text-[var(--primary)] hover:underline">
                  Edit
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {editingTemplate && (
        <Modal open={!!editingTemplate} onClose={() => setEditingTemplate(null)} title="Edit email template" wide>
          <div className="max-h-[80vh] overflow-y-auto pr-1">
            <p className="mb-4 text-sm text-slate-600">
              <span className="font-medium text-slate-800">{editingTemplate.name}</span>
              <span className="text-slate-400"> · </span>
              <code className="text-xs text-slate-600">{editingTemplate.templateKey}</code>
            </p>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Template name</label>
                <input
                  value={tplName}
                  onChange={(e) => setTplName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Email subject</label>
                <input
                  value={tplSubject}
                  onChange={(e) => setTplSubject(e.target.value)}
                  placeholder="e.g. Leave request received"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
                <p className="mt-1 text-[11px] text-slate-500">You can use the same {"{{placeholders}}"} as in the body (e.g. {"{{PositionTitle}}"} in the offer subject).</p>
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
                  <label className="mb-1 block text-xs font-medium text-slate-500">HTML body</label>
                  <textarea
                    value={tplHtml}
                    onChange={(e) => setTplHtml(e.target.value)}
                    rows={16}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-y"
                  />
                </div>
              )}
              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3">
                <button type="button" onClick={() => setEditingTemplate(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50">
                  Cancel
                </button>
                <button type="button" onClick={saveTemplate} disabled={tplSaving} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50">
                  {tplSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
