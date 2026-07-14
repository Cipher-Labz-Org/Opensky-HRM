"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { appConfirm } from "@/components/ui/appDialogs";
import { TemplateMergeExportPanel } from "@/components/settings/TemplateMergeExportPanel";
import { FormErrorAlert } from "@/components/ui/FormErrorAlert";
import { FlashMessageBanner, type FlashMessage } from "@/components/ui/FlashMessageBanner";

export interface TemplateListItem {
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

type TransactionalEmailTemplatesContentProps = {
  /** Fired whenever the loaded template list changes (including initial load). */
  onTemplatesChange?: (templates: TemplateListItem[]) => void;
};

const DEFAULT_NEW_EMAIL_BODY = `Hi {{RecipientName}},

Write your message here. You can use {{placeholders}} for dynamic values.

Thank you,
OpenSky HRM`;

/** Strip tags for easy editing while keeping line breaks and {{placeholders}}. */
function htmlToEditableText(html: string): string {
  const raw = html.trim();
  if (!raw) return "";
  if (!/<[a-z][\s\S]*>/i.test(raw)) return raw;

  let text = raw
    .replace(/\r\n/g, "\n")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/\s*p\s*>/gi, "\n\n")
    .replace(/<\s*\/\s*div\s*>/gi, "\n")
    .replace(/<\s*\/\s*h[1-6]\s*>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "• ")
    .replace(/<\s*\/\s*li\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

  text = text
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text;
}

function escapeEmailHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Wrap plain body text in a simple HTML email shell for sending. */
function editableTextToEmailHtml(body: string, title = "OpenSky HRM"): string {
  const trimmed = body.trim();
  const paragraphs = trimmed
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const withBreaks = escapeEmailHtml(block).replace(/\n/g, "<br>\n");
      return `<p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px;">${withBreaks}</p>`;
    })
    .join("\n");

  const safeTitle = escapeEmailHtml(title.trim() || "OpenSky HRM");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; margin: 0; padding: 0; background: #f5f6fa;">
  <div style="max-width: 600px; margin: 20px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
    <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2B7DE9 100%); padding: 28px 36px; color: white;">
      <h1 style="margin: 0; font-size: 22px; font-weight: 600;">${safeTitle}</h1>
      <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">OpenSky HRM</p>
    </div>
    <div style="padding: 28px 36px;">
${paragraphs || `<p style="font-size: 15px; line-height: 1.6; margin: 0;"> </p>`}
    </div>
    <div style="background: #f5f6fa; padding: 16px 36px; text-align: center; font-size: 12px; color: #999;">
      This is an automated message from OpenSky HRM.
    </div>
  </div>
</body>
</html>`;
}

function slugEmailTemplateKey(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `Email_Custom_${slug || "Template"}`;
}

export function TransactionalEmailTemplatesContent({ onTemplatesChange }: TransactionalEmailTemplatesContentProps) {
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<TemplateDetail | null>(null);
  const [tplName, setTplName] = useState("");
  const [tplSubject, setTplSubject] = useState("");
  const [tplHtml, setTplHtml] = useState("");
  const [tplBody, setTplBody] = useState("");
  const [tplActive, setTplActive] = useState(true);
  const [tplSaving, setTplSaving] = useState(false);
  const [tplPreview, setTplPreview] = useState(false);
  const [bannerError, setBannerError] = useState("");
  const [flash, setFlash] = useState<FlashMessage | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [seedingDefaults, setSeedingDefaults] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newBody, setNewBody] = useState(DEFAULT_NEW_EMAIL_BODY);
  const [newActive, setNewActive] = useState(true);
  const [createSaving, setCreateSaving] = useState(false);
  const [keyTouched, setKeyTouched] = useState(false);

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

  useEffect(() => {
    onTemplatesChange?.(templates);
  }, [templates, onTemplatesChange]);

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
        setTplBody(htmlToEditableText(full.htmlContent));
        setTplActive(full.isActive);
        setTplPreview(false);
      })
      .catch((e: unknown) => {
        setBannerError(e instanceof Error ? e.message : "Could not open template");
      });
  }

  async function saveTemplate() {
    if (!editingTemplate?.id) return;
    if (!tplBody.trim()) {
      setBannerError("Email body is required.");
      return;
    }
    setTplSaving(true);
    setBannerError("");
    const htmlContent = editableTextToEmailHtml(tplBody, tplName || editingTemplate.name);
    const body = JSON.stringify({
      name: tplName,
      subject: tplSubject.trim() || null,
      htmlContent,
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

  async function seedDefaults() {
    setSeedingDefaults(true);
    setBannerError("");
    try {
      await apiFetch("/api/documenttemplates/seed-defaults", { method: "POST" });
      setFlash({ type: "ok", text: "Default email templates loaded." });
      reloadList();
    } catch (e: unknown) {
      setBannerError(e instanceof Error ? e.message : "Could not load default templates");
    } finally {
      setSeedingDefaults(false);
    }
  }

  function openCreateModal() {
    setBannerError("");
    setNewName("");
    setNewKey("");
    setNewSubject("");
    setNewBody(DEFAULT_NEW_EMAIL_BODY);
    setNewActive(true);
    setKeyTouched(false);
    setShowCreate(true);
  }

  async function createTemplate() {
    const name = newName.trim();
    const key = (newKey.trim() || slugEmailTemplateKey(name)).trim();
    if (!name) {
      setBannerError("Template name is required.");
      return;
    }
    if (!key.startsWith("Email_")) {
      setBannerError('Template key must start with "Email_".');
      return;
    }
    if (!newBody.trim()) {
      setBannerError("Email body is required.");
      return;
    }
    setCreateSaving(true);
    setBannerError("");
    try {
      const created = await apiFetch<ApiRow>("/api/documenttemplates", {
        method: "POST",
        body: JSON.stringify({
          name,
          templateKey: key,
          subject: newSubject.trim() || null,
          htmlContent: editableTextToEmailHtml(newBody, name),
          isActive: newActive,
        }),
      });
      const norm = normalizeListRow(created);
      setTemplates((prev) => [...prev, norm].sort((a, b) => a.name.localeCompare(b.name)));
      setShowCreate(false);
      setFlash({ type: "ok", text: `Template "${name}" created.` });
    } catch (e: unknown) {
      setBannerError(e instanceof Error ? e.message : "Failed to create template");
    } finally {
      setCreateSaving(false);
    }
  }

  async function deleteTemplate(tpl: TemplateListItem) {
    if (!tpl.id || tpl.id === "undefined") return;
    if (!(await appConfirm(`Delete "${tpl.name}"? This cannot be undone.`, { confirmLabel: "Delete" }))) return;
    setDeletingId(tpl.id);
    setBannerError("");
    try {
      await apiFetch(`/api/documenttemplates/${tpl.id}`, { method: "DELETE" });
      setTemplates((prev) => prev.filter((t) => t.id !== tpl.id));
      if (editingTemplate?.id === tpl.id) setEditingTemplate(null);
    } catch (e: unknown) {
      setBannerError(e instanceof Error ? e.message : "Failed to delete template");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <FlashMessageBanner msg={flash} onClear={() => setFlash(null)} className="mb-4" />
      <FormErrorAlert
        message={bannerError}
        onDismiss={() => setBannerError("")}
        className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
      />
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="section-title mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3>Transactional email templates</h3>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" onClick={() => void seedDefaults()} disabled={seedingDefaults}>
              {seedingDefaults ? "LoadingΓÇª" : "Load defaults"}
            </Button>
            <Button type="button" onClick={openCreateModal}>
              Create template
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          {templates.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center">
              <p className="text-sm text-slate-600">No email templates yet.</p>
              <p className="mt-1 text-xs text-slate-500">
                Click <strong>Load defaults</strong> for leave, recruitment, and interview emails, or <strong>Create template</strong> for your own.
              </p>
            </div>
          ) : (
            templates.map((tpl) => (
              <div
                key={tpl.id}
                className="flex items-center justify-between rounded-xl border border-slate-200/90 bg-slate-50/50 px-4 py-3 transition hover:border-slate-300 hover:bg-white"
              >
                <div className="flex items-center gap-3">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${tpl.isActive ? "bg-emerald-500" : "bg-slate-300"}`} />
                  <div>
                    <strong className="text-sm font-semibold text-slate-900">{tpl.name}</strong>
                    <div className="text-[11px] text-slate-500">{tpl.templateKey}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => openTemplateEditor(tpl)}
                    className="text-sm font-medium text-blue-600 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteTemplate(tpl)}
                    disabled={deletingId === tpl.id}
                    className="text-sm font-medium text-rose-600 hover:underline disabled:opacity-50"
                  >
                    {deletingId === tpl.id ? "DeletingΓÇª" : "Delete"}
                  </button>
                </div>
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
              <span className="text-slate-400"> ┬╖ </span>
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
                <button
                  type="button"
                  onClick={() => {
                    if (!tplPreview) {
                      setTplHtml(editableTextToEmailHtml(tplBody, tplName || editingTemplate.name));
                    }
                    setTplPreview(!tplPreview);
                  }}
                  className="ml-auto text-sm font-medium text-blue-600 hover:underline"
                >
                  {tplPreview ? "Edit body" : "Preview & fill"}
                </button>
              </div>
              {tplPreview ? (
                <TemplateMergeExportPanel
                  html={tplHtml}
                  subject={tplSubject}
                  documentTitle={tplName || editingTemplate.name}
                  filenameBase={tplName || editingTemplate.templateKey}
                />
              ) : (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Email body</label>
                  <textarea
                    value={tplBody}
                    onChange={(e) => setTplBody(e.target.value)}
                    rows={12}
                    placeholder={"Hi {{RecipientName}},\n\nWrite your message here…"}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-y"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Write in plain text. Use {"{{placeholders}}"} for dynamic values (e.g. {"{{RecipientName}}"}).
                  </p>
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

      {showCreate && (
        <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create email template" wide>
          <div className="max-h-[80vh] overflow-y-auto pr-1">
            <p className="mb-4 text-sm text-slate-600">
              Custom templates use an <code className="text-xs">Email_</code> key. System emails (leave, offer, interviews) use built-in keys when you load defaults.
            </p>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Template name</label>
                <input
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    if (!keyTouched) setNewKey(slugEmailTemplateKey(e.target.value));
                  }}
                  placeholder="e.g. Welcome email"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Template key</label>
                <input
                  value={newKey}
                  onChange={(e) => {
                    setKeyTouched(true);
                    setNewKey(e.target.value);
                  }}
                  placeholder="Email_Custom_Welcome"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Email subject</label>
                <input
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="e.g. Welcome to the team"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={newActive} onChange={(e) => setNewActive(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                <span className="text-sm text-slate-600">Active</span>
              </label>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Email body</label>
                <textarea
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  rows={10}
                  placeholder={"Hi {{RecipientName}},\n\nWrite your message here…"}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-y"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Write in plain text. Use {"{{placeholders}}"} for dynamic values (e.g. {"{{RecipientName}}"}).
                </p>
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3">
                <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50">
                  Cancel
                </button>
                <button type="button" onClick={() => void createTemplate()} disabled={createSaving} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50">
                  {createSaving ? "CreatingΓÇª" : "Create template"}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
