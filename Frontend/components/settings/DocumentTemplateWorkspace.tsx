"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { apiFetch } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { appConfirm } from "@/components/ui/appDialogs";
import { FormErrorAlert } from "@/components/ui/FormErrorAlert";
import { FlashMessageBanner, type FlashMessage } from "@/components/ui/FlashMessageBanner";
import { sanitizeSearchInput } from "@/lib/input-validation";
import {
  applyPlaceholders,
  buildDefaultSamples,
  extractPlaceholders,
  getTemplateMeta,
  htmlToEditableText,
  htmlToPlainText,
  isLegacyLetterHtml,
  type TemplateKind,
} from "@/lib/document-template-meta";

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

/** A4 at 96 DPI — close to real print/PDF output size. */
const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;
/** Standard transactional email content width used in seeded templates. */
const EMAIL_WIDTH_PX = 600;

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

type DocumentTemplateWorkspaceProps = {
  kind: TemplateKind;
  onTemplatesChange?: (templates: TemplateListItem[]) => void;
};

const ALL_MODULES = "All modules";
const ALL_STATUSES = "All statuses";

const DEFAULT_NEW_EMAIL_MESSAGE = `I hope you are doing well.

Please read the details below and reply if you have any questions.`;

const SYSTEM_EMAIL_KEYS = new Set([
  "Email_LeaveApplication",
  "Email_LeaveApplicationSupervisor",
  "Email_LeaveApplicationCovering",
  "Email_LeaveApproved",
  "Email_LeaveRejected",
  "Email_RecruitmentOffer",
  "Email_RecruitmentInterviewCandidate",
  "Email_RecruitmentInterviewInterviewer",
]);

function wrapSimpleEmailMessage(message: string): string {
  const core = message.trim() || DEFAULT_NEW_EMAIL_MESSAGE;
  return `Hi {{RecipientName}},\n\n${core}\n\nThank you,\n{{CompanyName}}`;
}

/** Pull only the human paragraph out of a wrapped / messy body. */
function extractSimpleEmailCore(full: string): string {
  let t = full.trim();
  t = t.replace(/^(\{\{[A-Za-z0-9]+\}\}[\s,]*)+/g, "");
  t = t.replace(/^Hi\s+\{\{RecipientName\}\}\s*,?\s*/i, "");
  t = t.replace(/^Dear\s+\{\{[A-Za-z0-9]+\}\}\s*,?\s*/i, "");
  t = t.replace(/\n*Thank you,?\s*\n+\{\{CompanyName\}\}\s*$/i, "");
  t = t.replace(/\n*Thank you,?\s*\n+OpenSky HRM\s*$/i, "");
  t = t.replace(/You can use \{\{placeholders\}\}[^\n]*/gi, "");
  t = t.replace(/Write your message in this space[^\n]*/gi, "");
  t = t.replace(/You can click the blue tags[^\n]*/gi, "");
  t = t.replace(/Write your message here\.?/gi, "");
  t = t.replace(/\n{3,}/g, "\n\n").trim();
  return t || DEFAULT_NEW_EMAIL_MESSAGE;
}

function escapeEmailHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function LetterPreviewFrame({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (iframeRef.current) iframeRef.current.srcdoc = html;
  }, [html]);

  return (
    <iframe
      ref={iframeRef}
      title="Letter preview"
      className="block w-full border-0 bg-white"
      style={{ width: A4_WIDTH_PX, minHeight: A4_HEIGHT_PX, maxWidth: "100%" }}
    />
  );
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

/** Wrap plain body text in a print-friendly formal letter HTML shell. */
function editableTextToLetterHtml(body: string, title = "Letter"): string {
  const trimmed = body.trim();
  const paragraphs = trimmed
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const withBreaks = escapeEmailHtml(block).replace(/\n/g, "<br>\n");
      return `<p>${withBreaks}</p>`;
    })
    .join("\n");

  const safeTitle = escapeEmailHtml(title.trim() || "Letter");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: Georgia, "Times New Roman", Times, serif;
    color: #1c1917;
    padding: 52px 56px 56px;
    line-height: 1.7;
    font-size: 14.5px;
    background: #fff;
  }
  .letterhead { text-align: center; margin-bottom: 4px; }
  .letterhead .company {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #0f172a;
  }
  .letterhead .doc-title {
    margin: 10px 0 0;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: #57534e;
  }
  .rule { border: 0; border-top: 1.5px solid #0f172a; margin: 18px 0 28px; }
  .date-line {
    text-align: right;
    margin: 0 0 26px;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 13px;
    color: #44403c;
  }
  .body-text p { margin: 0 0 14px; text-align: justify; }
  .signature { margin-top: 36px; }
  .sig-space { height: 56px; }
  .sig-name { margin: 0; font-weight: 700; }
  .sig-role {
    margin: 2px 0 0;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12.5px;
    color: #57534e;
  }
</style>
</head>
<body>
  <div class="letterhead">
    <p class="company">{{CompanyName}}</p>
    <p class="doc-title">${safeTitle}</p>
  </div>
  <hr class="rule" />
  <div class="date-line">{{CurrentDate}}</div>
  <div class="body-text">
${paragraphs || "<p> </p>"}
    <div class="signature">
      <p>Yours faithfully,</p>
      <div class="sig-space"></div>
      <p class="sig-name">_______________________________</p>
      <p class="sig-role">Authorized Signatory<br/>{{CompanyName}}</p>
    </div>
  </div>
</body>
</html>`;
}

function editableTextToTemplateHtml(body: string, title: string, kind: TemplateKind): string {
  return kind === "email" ? editableTextToEmailHtml(body, title) : editableTextToLetterHtml(body, title);
}

function slugEmailTemplateKey(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `Email_Custom_${slug || "Template"}`;
}

export function DocumentTemplateWorkspace({ kind, onTemplatesChange }: DocumentTemplateWorkspaceProps) {
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TemplateDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState(ALL_MODULES);
  const [statusFilter, setStatusFilter] = useState(ALL_STATUSES);
  const [previewTab, setPreviewTab] = useState<"html" | "text">("html");
  const [editMode, setEditMode] = useState(false);
  const [sampleVars, setSampleVars] = useState<Record<string, string>>({});
  const [tplName, setTplName] = useState("");
  const [tplSubject, setTplSubject] = useState("");
  const [tplHtml, setTplHtml] = useState("");
  const [tplBody, setTplBody] = useState("");
  const [tplActive, setTplActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bannerError, setBannerError] = useState("");
  const [listLoading, setListLoading] = useState(true);
  const [flash, setFlash] = useState<FlashMessage | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [seedingDefaults, setSeedingDefaults] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newBody, setNewBody] = useState(DEFAULT_NEW_EMAIL_MESSAGE);
  const [newActive, setNewActive] = useState(true);
  const [createSaving, setCreateSaving] = useState(false);
  const [keyTouched, setKeyTouched] = useState(false);
  const [tplMessageCore, setTplMessageCore] = useState(DEFAULT_NEW_EMAIL_MESSAGE);
  const refreshedLegacyRef = useRef<Set<string>>(new Set());

  const isEmail = kind === "email";

  function toEditableBody(html: string, templateKey: string, name: string): string {
    const meta = getTemplateMeta(templateKey, kind, name);
    const text = htmlToEditableText(html, { preferredDefaultBody: meta.defaultBody });
    // Old confusing starter included literal {{placeholders}} — replace with clean suggested copy
    if (/\{\{\s*placeholders\s*\}\}/i.test(text) && meta.defaultBody) {
      return meta.defaultBody;
    }
    return text;
  }

  const reloadList = useCallback(() => {
    setBannerError("");
    setListLoading(true);
    apiFetch<ApiRow[]>("/api/documenttemplates")
      .then((all) => {
        const rows = all
          .map(normalizeListRow)
          .filter((t) => (isEmail ? t.templateKey.startsWith("Email_") : !t.templateKey.startsWith("Email_")));
        setTemplates(rows);
      })
      .catch((e: unknown) => {
        setTemplates([]);
        setBannerError(e instanceof Error ? e.message : "Could not load templates");
      })
      .finally(() => setListLoading(false));
  }, [isEmail]);

  useEffect(() => {
    reloadList();
  }, [reloadList]);

  useEffect(() => {
    onTemplatesChange?.(templates);
  }, [templates, onTemplatesChange]);

  const modules = useMemo(() => {
    const set = new Set(templates.map((t) => getTemplateMeta(t.templateKey, kind, t.name).module));
    return [ALL_MODULES, ...[...set].sort()];
  }, [templates, kind]);

  const filteredTemplates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates.filter((t) => {
      const meta = getTemplateMeta(t.templateKey, kind, t.name);
      if (moduleFilter !== ALL_MODULES && meta.module !== moduleFilter) return false;
      if (statusFilter === "Active" && !t.isActive) return false;
      if (statusFilter === "Inactive" && t.isActive) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.templateKey.toLowerCase().includes(q) ||
        meta.description.toLowerCase().includes(q) ||
        meta.module.toLowerCase().includes(q)
      );
    });
  }, [templates, search, moduleFilter, statusFilter, kind]);

  const selectedListItem = useMemo(
    () => templates.find((t) => t.id === selectedId) ?? null,
    [templates, selectedId]
  );

  const applyDetail = useCallback(
    (full: TemplateDetail) => {
      setDetail(full);
      setTplName(full.name);
      setTplSubject(full.subject ?? "");
      setTplHtml(full.htmlContent);
      const editable = toEditableBody(full.htmlContent, full.templateKey, full.name);
      setTplBody(editable);
      setTplMessageCore(extractSimpleEmailCore(editable));
      setTplActive(full.isActive);
      setSampleVars(buildDefaultSamples(full.htmlContent, full.templateKey, kind, full.name));
      setPreviewTab("html");
    },
    [kind],
  );

  const loadDetail = useCallback(
    (tpl: TemplateListItem) => {
      if (!tpl.id || tpl.id === "undefined") {
        setBannerError("This template has no valid id from the server.");
        return;
      }
      setSelectedId(tpl.id);
      setEditMode(false);
      setDetailLoading(true);
      setBannerError("");
      apiFetch<ApiRow>(`/api/documenttemplates/${tpl.id}`)
        .then(async (raw) => {
          let full = normalizeDetail(raw);
          if (
            !isEmail &&
            isLegacyLetterHtml(full.htmlContent) &&
            !refreshedLegacyRef.current.has(full.templateKey)
          ) {
            refreshedLegacyRef.current.add(full.templateKey);
            try {
              await apiFetch("/api/documenttemplates/seed-defaults", { method: "POST" });
              const refreshed = await apiFetch<ApiRow>(`/api/documenttemplates/${tpl.id}`);
              full = normalizeDetail(refreshed);
            } catch {
              /* keep loaded copy */
            }
          }
          applyDetail(full);
        })
        .catch((e: unknown) => {
          setBannerError(e instanceof Error ? e.message : "Could not load template");
        })
        .finally(() => setDetailLoading(false));
    },
    [applyDetail, isEmail],
  );

  useEffect(() => {
    if (filteredTemplates.length === 0) {
      setSelectedId(null);
      setDetail(null);
      return;
    }
    const stillVisible = selectedId && filteredTemplates.some((t) => t.id === selectedId);
    if (!stillVisible) {
      loadDetail(filteredTemplates[0]);
    }
  }, [filteredTemplates, selectedId, loadDetail]);

  const selectedMeta = useMemo(() => {
    if (!detail) return null;
    return getTemplateMeta(detail.templateKey, kind, detail.name);
  }, [detail, kind]);

  const isSimpleEmailEdit = isEmail && !(detail && SYSTEM_EMAIL_KEYS.has(detail.templateKey));

  const composedEmailBody = useMemo(() => {
    if (!isEmail) return tplBody;
    if (isSimpleEmailEdit) return wrapSimpleEmailMessage(tplMessageCore);
    return tplBody;
  }, [isEmail, isSimpleEmailEdit, tplMessageCore, tplBody]);

  const previewVars = useMemo(() => {
    const source = editMode
      ? editableTextToTemplateHtml(
          isEmail ? composedEmailBody : tplBody,
          tplName || detail?.name || (isEmail ? "OpenSky HRM" : "Letter"),
          kind,
        )
      : detail?.htmlContent ?? "";
    const defaults =
      detail != null ? buildDefaultSamples(source, detail.templateKey, kind, detail.name) : {};
    return { ...defaults, ...sampleVars };
  }, [editMode, kind, isEmail, composedEmailBody, tplBody, tplName, detail, sampleVars]);

  const previewHtml = useMemo(() => {
    const source = editMode
      ? editableTextToTemplateHtml(
          isEmail ? composedEmailBody : tplBody,
          tplName || detail?.name || (isEmail ? "OpenSky HRM" : "Letter"),
          kind,
        )
      : detail?.htmlContent ?? "";
    return applyPlaceholders(source, previewVars);
  }, [editMode, kind, isEmail, composedEmailBody, tplBody, tplName, detail?.htmlContent, detail?.name, previewVars]);

  const previewSubject = useMemo(() => {
    const subject = editMode ? tplSubject : detail?.subject ?? "";
    return applyPlaceholders(subject, previewVars);
  }, [editMode, tplSubject, detail?.subject, previewVars]);

  const previewPlain = useMemo(() => htmlToPlainText(previewHtml), [previewHtml]);

  const placeholders = useMemo(() => {
    const source = editMode
      ? editableTextToTemplateHtml(
          isEmail ? composedEmailBody : tplBody,
          tplName || detail?.name || (isEmail ? "OpenSky HRM" : "Letter"),
          kind,
        )
      : detail?.htmlContent ?? "";
    const fromSubject = extractPlaceholders(editMode ? tplSubject : detail?.subject ?? "");
    return [...new Set([...extractPlaceholders(source), ...fromSubject])].sort();
  }, [editMode, kind, isEmail, composedEmailBody, tplBody, tplName, tplSubject, detail]);

  const activeCount = templates.filter((t) => t.isActive).length;
  const inactiveCount = templates.length - activeCount;
  const bodyTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const filledMessagePreview = useMemo(
    () => applyPlaceholders(isEmail ? composedEmailBody : tplBody, sampleVars),
    [isEmail, composedEmailBody, tplBody, sampleVars],
  );

  function resetSamples() {
    if (!detail) return;
    setSampleVars(buildDefaultSamples(detail.htmlContent, detail.templateKey, kind, detail.name));
  }

  async function saveTemplate() {
    if (!detail?.id) return;
    if (!tplBody.trim() && !tplMessageCore.trim()) {
      setBannerError(isEmail ? "Email body is required." : "Letter body is required.");
      return;
    }
    setSaving(true);
    setBannerError("");
    const htmlContent = editableTextToTemplateHtml(
      isEmail ? composedEmailBody : tplBody,
      tplName || detail.name,
      kind,
    );
    const body = JSON.stringify({
      name: tplName,
      subject: isEmail ? tplSubject.trim() || null : null,
      htmlContent,
      isActive: tplActive,
    });
    const url = `/api/documenttemplates/${detail.id}`;
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
      setDetail(norm);
      setTplName(norm.name);
      setTplSubject(norm.subject ?? "");
      setTplHtml(norm.htmlContent);
      const editable = toEditableBody(norm.htmlContent, norm.templateKey, norm.name);
      setTplBody(editable);
      setTplMessageCore(extractSimpleEmailCore(editable));
      setTplActive(norm.isActive);
      setSampleVars(buildDefaultSamples(norm.htmlContent, norm.templateKey, kind, norm.name));
      const patch = { id: norm.id, name: norm.name, templateKey: norm.templateKey, isActive: norm.isActive };
      setTemplates((prev) => prev.map((t) => (t.id === norm.id ? patch : t)));
      setEditMode(false);
    } catch (e: unknown) {
      setBannerError(e instanceof Error ? e.message : "Failed to save template");
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    if (!detail) return;
    setTplName(detail.name);
    setTplSubject(detail.subject ?? "");
    setTplHtml(detail.htmlContent);
    const editable = toEditableBody(detail.htmlContent, detail.templateKey, detail.name);
    setTplBody(editable);
    setTplMessageCore(extractSimpleEmailCore(editable));
    setTplActive(detail.isActive);
    setEditMode(false);
  }

  async function seedDefaults() {
    setSeedingDefaults(true);
    setBannerError("");
    try {
      await apiFetch("/api/documenttemplates/seed-defaults", { method: "POST" });
      setFlash({ type: "ok", text: "Default templates loaded." });
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
    setNewBody(DEFAULT_NEW_EMAIL_MESSAGE);
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
      setBannerError("Write your message before creating the template.");
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
          htmlContent: editableTextToEmailHtml(wrapSimpleEmailMessage(newBody), name),
          isActive: newActive,
        }),
      });
      const norm = normalizeListRow(created);
      setTemplates((prev) => [...prev, norm].sort((a, b) => a.name.localeCompare(b.name)));
      setShowCreate(false);
      setFlash({ type: "ok", text: `Template "${name}" created.` });
      loadDetail(norm);
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
      if (detail?.id === tpl.id) {
        setDetail(null);
        setSelectedId(null);
      }
      setFlash({ type: "ok", text: `Template "${tpl.name}" deleted.` });
    } catch (e: unknown) {
      setBannerError(e instanceof Error ? e.message : "Failed to delete template");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <FlashMessageBanner msg={flash} onClear={() => setFlash(null)} />
      <FormErrorAlert
        message={bannerError}
        onDismiss={() => setBannerError("")}
        className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
      />

        <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-slate-900">
            {isEmail ? "Transactional email templates" : "Employee letter templates"}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            {isEmail
              ? "Preview, edit, and test notification emails before rolling out changes across modules."
              : "Preview and edit letter content used for PDF and Word documents from People."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" onClick={() => void seedDefaults()} disabled={seedingDefaults}>
            {seedingDefaults ? "Loading…" : "Load defaults"}
          </Button>
          {isEmail && (
            <Button type="button" onClick={openCreateModal}>
              Create template
            </Button>
          )}
          <StatPill label="Total" value={templates.length} tone="neutral" />
          <StatPill label="Active" value={activeCount} tone="success" />
          <StatPill label="Inactive" value={inactiveCount} tone="warning" />
        </div>
      </div>

      <div
        className={
          isEmail
            ? "grid gap-4 xl:grid-cols-[minmax(200px,220px)_minmax(0,3fr)_minmax(200px,240px)]"
            : "grid gap-4 xl:grid-cols-[minmax(200px,220px)_minmax(0,1fr)]"
        }
      >
        {/* Left — template library */}
        <aside className="flex flex-col rounded-xl border border-slate-200/90 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4">
            <h3 className="text-sm font-semibold text-slate-800">Template library</h3>
            <div className="mt-3 space-y-2">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(sanitizeSearchInput(e.target.value))}
                placeholder="Search templates…"
                className="w-full rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={moduleFilter}
                  onChange={(e) => setModuleFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                >
                  {modules.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                >
                  <option value={ALL_STATUSES}>{ALL_STATUSES}</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>
          </div>
          <div className={`flex-1 overflow-y-auto p-3 ${isEmail ? "max-h-[min(62vh,560px)]" : "max-h-[min(88vh,960px)]"}`}>
            {listLoading ? (
              <p className="px-2 py-6 text-center text-sm text-slate-500">Loading templates…</p>
            ) : filteredTemplates.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-slate-500">
                {templates.length === 0
                  ? isEmail
                    ? "No email templates yet. Use Load defaults or Create template above."
                    : "No letter templates found. Use Load defaults or restart the API so defaults can be seeded."
                  : "No templates match your filters."}
              </p>
            ) : (
              <div className="space-y-2">
                {filteredTemplates.map((tpl) => {
                  const meta = getTemplateMeta(tpl.templateKey, kind, tpl.name);
                  const selected = tpl.id === selectedId;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => loadDetail(tpl)}
                      className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                        selected
                          ? "border-blue-400 bg-blue-50/60 shadow-sm ring-1 ring-blue-200"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            {meta.module}
                          </div>
                          <div className="mt-0.5 truncate text-sm font-semibold text-slate-900">{tpl.name}</div>
                        </div>
                        <StatusBadge active={tpl.isActive} />
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-500">{meta.description}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                          {meta.category}
                        </span>
                        <code className="truncate text-[10px] text-slate-400">{tpl.templateKey}</code>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* Center — preview / editor (primary focus) */}
        <section
          className={`relative flex flex-col overflow-hidden rounded-2xl border-2 border-blue-200/70 bg-white shadow-[0_8px_30px_rgba(37,99,235,0.08)] ring-1 ring-blue-100 ${
            isEmail ? "min-h-[min(80vh,780px)]" : "min-h-[min(92vh,980px)] xl:col-span-1"
          }`}
        >
          {!detail && !detailLoading ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-gradient-to-b from-slate-50 to-slate-100/80 p-10 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-2xl text-blue-600">✉</div>
              <p className="text-sm font-medium text-slate-600">Select a template from the library to preview.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-blue-100 bg-gradient-to-r from-blue-50/80 to-white px-5 py-4">
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-blue-600/80">Preview</div>
                  <h3 className="truncate text-lg font-semibold text-slate-900">
                    {editMode ? tplName : detail?.name ?? "Loading…"}
                  </h3>
                  {detail && (
                    <code className="mt-0.5 block truncate text-xs text-slate-400">{detail.templateKey}</code>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {editMode ? (
                    <>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void saveTemplate()}
                        disabled={saving}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                      >
                        {saving ? "Saving…" : "Save changes"}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => selectedListItem && loadDetail(selectedListItem)}
                        disabled={detailLoading}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                      >
                        ↻ Refresh
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTplMessageCore(extractSimpleEmailCore(tplBody));
                          setEditMode(true);
                        }}
                        disabled={!detail || detailLoading}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                      >
                        ✎ Edit
                      </button>
                      {selectedListItem && (
                        <button
                          type="button"
                          onClick={() => void deleteTemplate(selectedListItem)}
                          disabled={deletingId === selectedListItem.id}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                        >
                          {deletingId === selectedListItem.id ? "Deleting…" : "Delete"}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {editMode ? (
                <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/50 p-5">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-950">
                    <p className="font-semibold">Easy edit</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-emerald-900/80">
                      {isEmail
                        ? "Only type your message words below. Greeting and company name are added automatically. Check the preview to see how the email will look."
                        : "Type the letter in normal words. The system formats it for PDF / Word."}
                    </p>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Name in library</label>
                    <input
                      value={tplName}
                      onChange={(e) => setTplName(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  {isEmail && (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">Subject (inbox title)</label>
                      <input
                        value={tplSubject}
                        onChange={(e) => setTplSubject(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        placeholder="e.g. Welcome to the team"
                      />
                    </div>
                  )}
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={tplActive}
                      onChange={(e) => setTplActive(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600"
                    />
                    <span className="text-sm text-slate-600">Active (ready to send)</span>
                  </label>

                  {isEmail && isSimpleEmailEdit ? (
                    <div className="space-y-3">
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Starts with</span>
                        <p className="mt-1 text-slate-700">
                          Hi <span className="rounded bg-blue-50 px-1.5 py-0.5 font-medium text-blue-800">{sampleVars.RecipientName || sampleVars.EmployeeName || "Alex Morgan"}</span>,
                        </p>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-500">Your message</label>
                        <textarea
                          ref={bodyTextareaRef}
                          value={tplMessageCore}
                          onChange={(e) => setTplMessageCore(e.target.value)}
                          rows={8}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm leading-relaxed outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-y"
                          placeholder="Type the email in normal sentences…"
                        />
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Ends with</span>
                        <p className="mt-1 text-slate-700">
                          Thank you,<br />
                          <span className="rounded bg-blue-50 px-1.5 py-0.5 font-medium text-blue-800">{sampleVars.CompanyName || "OpenSky HRM"}</span>
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <label className="block text-xs font-medium text-slate-500">
                          {isEmail ? "Message text" : "Letter text"}
                        </label>
                        {selectedMeta?.defaultBody ? (
                          <button
                            type="button"
                            onClick={() => {
                              setTplBody(selectedMeta.defaultBody ?? "");
                              setTplMessageCore(extractSimpleEmailCore(selectedMeta.defaultBody ?? ""));
                            }}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
                          >
                            Load suggested message
                          </button>
                        ) : null}
                      </div>
                      <textarea
                        ref={bodyTextareaRef}
                        value={tplBody}
                        onChange={(e) => setTplBody(e.target.value)}
                        rows={12}
                        spellCheck={false}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm leading-relaxed outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-y"
                        placeholder="Type the message in normal sentences…"
                      />
                    </div>
                  )}

                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">How it looks when sent</div>
                    {isEmail && previewSubject ? (
                      <p className="mt-2 text-sm font-semibold text-slate-900">Subject: {previewSubject}</p>
                    ) : null}
                    <pre className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{filledMessagePreview}</pre>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-1 border-b border-blue-100 bg-white px-5">
                    <TabButton active={previewTab === "html"} onClick={() => setPreviewTab("html")}>
                      HTML preview
                    </TabButton>
                    <TabButton active={previewTab === "text"} onClick={() => setPreviewTab("text")}>
                      Plain text
                    </TabButton>
                  </div>
                  <div
                    className={`flex flex-1 flex-col overflow-y-auto bg-gradient-to-b from-slate-100 via-slate-100/90 to-slate-200/70 ${
                      isEmail ? "p-5 sm:p-6" : "p-6 sm:p-8"
                    }`}
                  >
                    {detailLoading ? (
                      <p className="py-16 text-center text-sm text-slate-500">Loading preview…</p>
                    ) : previewTab === "html" ? (
                      <div className={`mx-auto flex w-full flex-1 flex-col gap-4 ${isEmail ? "max-w-[640px]" : "max-w-none"}`}>
                        {isEmail && previewSubject && (
                          <div className="rounded-xl border border-slate-200/90 bg-white px-5 py-3.5 shadow-md shadow-slate-900/[0.06]">
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Subject line</div>
                            <div className="mt-1.5 text-base font-semibold text-slate-900">{previewSubject}</div>
                          </div>
                        )}
                        {isEmail ? (
                          <div className="flex min-h-[min(62vh,680px)] flex-1 flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-xl shadow-slate-900/[0.10]">
                            <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                              <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                              <span className="ml-2 text-xs font-medium text-slate-500">
                                Email preview · {EMAIL_WIDTH_PX}px wide
                              </span>
                            </div>
                            <div className="flex flex-1 justify-center overflow-auto bg-slate-100/80 p-6">
                              <div
                                className="shrink-0 bg-white shadow-lg shadow-slate-900/10"
                                style={{ width: EMAIL_WIDTH_PX, maxWidth: "100%" }}
                              >
                                <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-1 flex-col gap-3">
                            <div className="flex items-center justify-between px-1">
                              <span className="text-xs font-medium text-slate-500">
                                A4 document · 210 × 297 mm
                              </span>
                              <span className="text-xs text-slate-400">Scroll to view full page</span>
                            </div>
                            <div className="flex flex-1 justify-center overflow-auto rounded-xl border border-slate-300/70 bg-slate-200/60 p-8 sm:p-10">
                              <div
                                className="shrink-0 overflow-hidden bg-white shadow-[0_8px_40px_rgba(15,23,42,0.14)] ring-1 ring-slate-300/80"
                                style={{
                                  width: A4_WIDTH_PX,
                                  minHeight: A4_HEIGHT_PX,
                                  maxWidth: "100%",
                                }}
                              >
                                <LetterPreviewFrame html={previewHtml} />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <pre
                        className={`mx-auto flex-1 whitespace-pre-wrap rounded-xl border border-slate-200/90 bg-white p-6 text-sm leading-relaxed text-slate-700 shadow-xl shadow-slate-900/[0.08] ${
                          isEmail ? "max-w-[640px] w-full" : "w-full max-w-[794px]"
                        }`}
                        style={!isEmail ? { minHeight: A4_HEIGHT_PX } : undefined}
                      >
                        {previewPlain || "No plain-text content."}
                      </pre>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </section>

        {/* Right — details & sample variables (email tab only; letters use panel below) */}
        {isEmail && (
          <TemplateDetailsPanel
            detail={detail}
            selectedMeta={selectedMeta}
            placeholders={placeholders}
            sampleVars={sampleVars}
            onSampleChange={(key, value) => setSampleVars((prev) => ({ ...prev, [key]: value }))}
            onResetSamples={resetSamples}
            compact
          />
        )}
      </div>

      {!isEmail && (
        <TemplateDetailsPanel
          detail={detail}
          selectedMeta={selectedMeta}
          placeholders={placeholders}
          sampleVars={sampleVars}
          onSampleChange={(key, value) => setSampleVars((prev) => ({ ...prev, [key]: value }))}
          onResetSamples={resetSamples}
          horizontal
        />
      )}

      {showCreate && isEmail && (
        <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create email template" wide>
          <div className="max-h-[80vh] overflow-y-auto pr-1">
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-950">
              <p className="font-semibold">Easy create</p>
              <p className="mt-1 text-[13px] leading-relaxed text-emerald-900/80">
                Only type your message words. Greeting and company name are added automatically.
              </p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Name in library</label>
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
                <label className="mb-1 block text-xs font-medium text-slate-500">Subject (inbox title)</label>
                <input
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="e.g. Welcome to the team"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={newActive} onChange={(e) => setNewActive(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                <span className="text-sm text-slate-600">Active (ready to send)</span>
              </label>

              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Starts with</span>
                <p className="mt-1 text-slate-700">
                  Hi <span className="rounded bg-blue-50 px-1.5 py-0.5 font-medium text-blue-800">Alex Morgan</span>,
                </p>
              </div>

              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <label className="block text-xs font-medium text-slate-500">Your message</label>
                  <button
                    type="button"
                    onClick={() => setNewBody(DEFAULT_NEW_EMAIL_MESSAGE)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
                  >
                    Reset message
                  </button>
                </div>
                <textarea
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  rows={8}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-relaxed text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-y"
                  placeholder="Type the email in normal sentences…"
                />
              </div>

              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Ends with</span>
                <p className="mt-1 text-slate-700">
                  Thank you,<br />
                  <span className="rounded bg-blue-50 px-1.5 py-0.5 font-medium text-blue-800">OpenSky HRM</span>
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">How it looks when sent</div>
                {newSubject.trim() ? (
                  <p className="mt-2 text-sm font-semibold text-slate-900">Subject: {newSubject.trim()}</p>
                ) : null}
                <pre className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {applyPlaceholders(wrapSimpleEmailMessage(newBody), {
                    RecipientName: "Alex Morgan",
                    CompanyName: "OpenSky HRM",
                  })}
                </pre>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3">
                <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50">
                  Cancel
                </button>
                <button type="button" onClick={() => void createTemplate()} disabled={createSaving} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50">
                  {createSaving ? "Creating…" : "Create template"}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function TemplateDetailsPanel({
  detail,
  selectedMeta,
  placeholders,
  sampleVars,
  onSampleChange,
  onResetSamples,
  compact = false,
  horizontal = false,
}: {
  detail: TemplateDetail | null;
  selectedMeta: ReturnType<typeof getTemplateMeta> | null;
  placeholders: string[];
  sampleVars: Record<string, string>;
  onSampleChange: (key: string, value: string) => void;
  onResetSamples: () => void;
  compact?: boolean;
  horizontal?: boolean;
}) {
  const detailsBlock = (
    <>
      <dl className={`space-y-3 text-sm ${horizontal ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-4" : ""}`}>
        <DetailRow label="Event type" value={detail?.templateKey ?? "—"} mono />
        <DetailRow label="Trigger" value={selectedMeta?.trigger ?? "—"} />
        <DetailRow label="Module" value={selectedMeta?.module ?? "—"} />
        <DetailRow label="Category" value={selectedMeta?.category ?? "—"} />
        {selectedMeta?.senderProfile && <DetailRow label="Sender profile" value={selectedMeta.senderProfile} />}
      </dl>
      {(selectedMeta?.recipients.length ?? 0) > 0 && (
        <div className="mt-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Recipients</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {selectedMeta!.recipients.map((r) => (
              <span
                key={r}
                className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-100"
              >
                {r}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );

  const variablesBlock = (
    <div className={horizontal ? "" : "border-t border-slate-100 pt-4"}>
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-800">Sample variables</h4>
        <button type="button" onClick={onResetSamples} className="text-xs font-medium text-blue-600 hover:underline">
          Reset
        </button>
      </div>
      {placeholders.length === 0 ? (
        <p className="text-xs text-slate-500">No placeholders in this template.</p>
      ) : (
        <div className={`gap-2.5 ${horizontal ? "grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "space-y-2.5"}`}>
          {placeholders.map((key) => (
            <div key={key}>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {key.replace(/([A-Z])/g, " $1").trim()}
              </label>
              <input
                value={sampleVars[key] ?? ""}
                onChange={(e) => onSampleChange(key, e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          ))}
        </div>
      )}
      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
        Changes update the preview instantly. Use {"{{Placeholder}}"} syntax in HTML and subject lines.
      </p>
    </div>
  );

  if (horizontal) {
    return (
      <aside className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm">
        {!detail || !selectedMeta ? (
          <p className="text-sm text-slate-500">Select a template to view details and sample variables.</p>
        ) : (
          <div className="space-y-5">
            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Template details</h3>
              {detailsBlock}
            </div>
            {variablesBlock}
          </div>
        )}
      </aside>
    );
  }

  return (
    <aside className="flex flex-col rounded-xl border border-slate-200/90 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-4">
        <h3 className="text-sm font-semibold text-slate-800">Template details</h3>
      </div>
      <div className={`flex-1 overflow-y-auto p-4 ${compact ? "max-h-[min(62vh,560px)]" : ""}`}>
        {!detail || !selectedMeta ? (
          <p className="text-sm text-slate-500">Select a template to view details.</p>
        ) : (
          <div className="space-y-5">
            {detailsBlock}
            {variablesBlock}
          </div>
        )}
      </div>
    </aside>
  );
}

function StatPill({ label, value, tone }: { label: string; value: number; tone: "neutral" | "success" | "warning" }) {
  const tones = {
    neutral: "border-slate-200 bg-slate-50 text-slate-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
  };
  return (
    <div className={`rounded-xl border px-4 py-2 text-center ${tones[tone]}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider opacity-70">{label}</div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-3 text-sm font-semibold transition ${
        active ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</dt>
      <dd className={`mt-1 text-sm text-slate-700 ${mono ? "font-mono text-xs break-all" : ""}`}>{value}</dd>
    </div>
  );
}
