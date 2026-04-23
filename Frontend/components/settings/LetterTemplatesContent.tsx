"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { ROUTES } from "@/config/routes";
import type { TemplateListItem } from "./TransactionalEmailTemplatesContent";

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

type LetterTemplatesContentProps = {
  onTemplatesChange?: (templates: TemplateListItem[]) => void;
};

/** HR letters (PDF/Word from People → Create Document); all `DocumentTemplates` rows whose key does not start with `Email_`. */
export function LetterTemplatesContent({ onTemplatesChange }: LetterTemplatesContentProps) {
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<TemplateDetail | null>(null);
  const [tplName, setTplName] = useState("");
  const [tplHtml, setTplHtml] = useState("");
  const [tplActive, setTplActive] = useState(true);
  const [tplSaving, setTplSaving] = useState(false);
  const [tplPreview, setTplPreview] = useState(false);
  const [bannerError, setBannerError] = useState("");

  function reloadList() {
    setBannerError("");
    apiFetch<ApiRow[]>("/api/documenttemplates")
      .then((all) => {
        const rows = all.map(normalizeListRow).filter((t) => !t.templateKey.startsWith("Email_"));
        setTemplates(rows);
      })
      .catch((e: unknown) => {
        setTemplates([]);
        setBannerError(e instanceof Error ? e.message : "Could not load letter templates");
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
      setBannerError("This template has no valid id from the server.");
      return;
    }
    apiFetch<ApiRow>(`/api/documenttemplates/${tpl.id}`)
      .then((raw) => {
        const full = normalizeDetail(raw);
        setEditingTemplate(full);
        setTplName(full.name);
        setTplHtml(full.htmlContent);
        setTplActive(full.isActive);
        setTplPreview(false);
      })
      .catch((e: unknown) => {
        setBannerError(e instanceof Error ? e.message : "Could not open template");
      });
  }

  const saveTemplate = useCallback(async () => {
    if (!editingTemplate?.id) return;
    setTplSaving(true);
    setBannerError("");
    const body = JSON.stringify({
      name: tplName,
      subject: null,
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
  }, [editingTemplate?.id, tplName, tplHtml, tplActive]);

  return (
    <>
      {bannerError && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {bannerError}
        </div>
      )}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="section-title">
          <h3>Employee letter templates</h3>
          <span>HTML used for PDF/Word from People → Job Details → Create Document. Not sent as email.</span>
        </div>
        <div className="space-y-2">
          <p className="mb-2 text-xs text-slate-600">
            Placeholders merged when rendering:{" "}
            <code className="text-[10px] bg-slate-100 px-1 rounded">{"{{EmployeeName}}"}</code>{" "}
            <code className="text-[10px] bg-slate-100 px-1 rounded">{"{{EmployeeCode}}"}</code>{" "}
            <code className="text-[10px] bg-slate-100 px-1 rounded">{"{{JobTitle}}"}</code>{" "}
            <code className="text-[10px] bg-slate-100 px-1 rounded">{"{{Department}}"}</code>{" "}
            <code className="text-[10px] bg-slate-100 px-1 rounded">{"{{JoinDate}}"}</code>{" "}
            <code className="text-[10px] bg-slate-100 px-1 rounded">{"{{CurrentDate}}"}</code>{" "}
            <code className="text-[10px] bg-slate-100 px-1 rounded">{"{{CompanyName}}"}</code> and more (see API render).
          </p>
          <p className="mb-3 text-xs text-slate-500">
            Master data and branding stay in{" "}
            <Link href={ROUTES.settings} className="font-medium text-blue-600 hover:underline">
              Settings
            </Link>
            .
          </p>
          {templates.length === 0 ? (
            <p className="text-sm text-slate-500 px-1">
              No letter templates found. Run API database seeding so defaults are inserted (keys other than <code className="text-xs">Email_*</code>).
            </p>
          ) : (
            templates.map((tpl) => (
              <div
                key={tpl.id}
                className="flex items-center justify-between rounded-xl border border-slate-200/90 bg-slate-50/50 px-4 py-3 transition hover:border-slate-300 hover:bg-white"
              >
                <div className="flex items-center gap-3">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${tpl.isActive ? "bg-blue-500" : "bg-slate-300"}`} />
                  <div>
                    <strong className="text-sm font-semibold text-slate-900">{tpl.name}</strong>
                    <div className="text-xs text-slate-500">{tpl.templateKey}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openTemplateEditor(tpl)}
                  className="text-sm font-medium text-blue-600 hover:underline"
                >
                  Edit
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {editingTemplate && (
        <Modal open={!!editingTemplate} onClose={() => setEditingTemplate(null)} title="Edit letter template" wide>
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
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tplActive}
                    onChange={(e) => setTplActive(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600"
                  />
                  <span className="text-sm text-slate-600">Active</span>
                </label>
                <button
                  type="button"
                  onClick={() => setTplPreview(!tplPreview)}
                  className="ml-auto text-sm font-medium text-blue-600 hover:underline"
                >
                  {tplPreview ? "Edit HTML" : "Preview"}
                </button>
              </div>
              {tplPreview ? (
                <div className="rounded-lg border border-slate-200 bg-white p-4 max-h-[400px] overflow-auto">
                  <div dangerouslySetInnerHTML={{ __html: tplHtml }} />
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">HTML content</label>
                  <textarea
                    value={tplHtml}
                    onChange={(e) => setTplHtml(e.target.value)}
                    rows={16}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-y"
                  />
                </div>
              )}
              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingTemplate(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void saveTemplate()}
                  disabled={tplSaving}
                  className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
                >
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
