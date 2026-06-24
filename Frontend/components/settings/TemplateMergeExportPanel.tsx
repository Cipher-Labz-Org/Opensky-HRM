"use client";

import { useEffect, useMemo, useState } from "react";
import { appAlert } from "@/components/ui/appDialogs";
import {
  applyTemplateMergeHtml,
  applyTemplateMergePlain,
  buildInitialMergeValues,
  escapeHtml,
  extractTemplatePlaceholders,
  formatTemplateFieldLabel,
} from "@/lib/template-merge";
import { downloadHtmlAsPdf, shareHtmlAsPdf } from "@/lib/template-pdf";

type TemplateMergeExportPanelProps = {
  html: string;
  subject?: string | null;
  documentTitle: string;
  filenameBase: string;
};

export function TemplateMergeExportPanel({
  html,
  subject,
  documentTitle,
  filenameBase,
}: TemplateMergeExportPanelProps) {
  const placeholderKeys = useMemo(
    () => extractTemplatePlaceholders(html, subject ?? ""),
    [html, subject],
  );

  const [mergeValues, setMergeValues] = useState<Record<string, string>>(() =>
    buildInitialMergeValues(placeholderKeys),
  );
  const [exporting, setExporting] = useState<"pdf" | "share" | null>(null);

  useEffect(() => {
    setMergeValues((prev) => {
      const next = buildInitialMergeValues(placeholderKeys);
      for (const key of placeholderKeys) {
        if (prev[key] != null) next[key] = prev[key];
      }
      return next;
    });
  }, [placeholderKeys]);

  const mergedSubject = useMemo(
    () => (subject?.trim() ? applyTemplateMergePlain(subject, mergeValues) : null),
    [subject, mergeValues],
  );

  const mergedHtml = useMemo(() => applyTemplateMergeHtml(html, mergeValues), [html, mergeValues]);

  const pdfHtml = useMemo(() => {
    if (!mergedSubject) return mergedHtml;
    const subjectBlock = `<div style="font-family:Segoe UI,Arial,sans-serif;padding:0 0 16px;margin:0 0 16px;border-bottom:1px solid #e2e8f0;">
      <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;">Subject</div>
      <div style="font-size:15px;font-weight:600;color:#0f172a;">${escapeHtml(mergedSubject)}</div>
    </div>`;
    return subjectBlock + mergedHtml;
  }, [mergedHtml, mergedSubject]);

  const missingRequired = placeholderKeys.filter((key) => !mergeValues[key]?.trim());

  async function handleSavePdf() {
    if (missingRequired.length > 0) {
      await appAlert(`Fill all placeholders before saving: ${missingRequired.map(formatTemplateFieldLabel).join(", ")}`);
      return;
    }
    setExporting("pdf");
    try {
      await downloadHtmlAsPdf(pdfHtml, filenameBase, documentTitle);
    } catch (err) {
      await appAlert(err instanceof Error ? err.message : "Could not create PDF");
    } finally {
      setExporting(null);
    }
  }

  async function handleShare() {
    if (missingRequired.length > 0) {
      await appAlert(`Fill all placeholders before sharing: ${missingRequired.map(formatTemplateFieldLabel).join(", ")}`);
      return;
    }
    setExporting("share");
    try {
      const result = await shareHtmlAsPdf(pdfHtml, filenameBase, documentTitle);
      if (result === "downloaded") {
        await appAlert("Sharing is not available in this browser. The PDF was downloaded instead.");
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      await appAlert(err instanceof Error ? err.message : "Could not share PDF");
    } finally {
      setExporting(null);
    }
  }

  if (placeholderKeys.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 max-h-[400px] overflow-auto">
        <div dangerouslySetInnerHTML={{ __html: mergedHtml }} />
      </div>
    );
  }

  const inputClass =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold text-slate-800">Fill placeholders</h4>
            <p className="text-[11px] text-slate-500">Required before saving or sharing as PDF.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleSavePdf()}
              disabled={exporting != null}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              {exporting === "pdf" ? "Saving…" : "Save PDF"}
            </button>
            <button
              type="button"
              onClick={() => void handleShare()}
              disabled={exporting != null}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
            >
              {exporting === "share" ? "Sharing…" : "Share"}
            </button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {placeholderKeys.map((key) => (
            <div key={key}>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                {formatTemplateFieldLabel(key)} *
              </label>
              <input
                value={mergeValues[key] ?? ""}
                onChange={(e) => setMergeValues((prev) => ({ ...prev, [key]: e.target.value }))}
                placeholder={`{{${key}}}`}
                className={inputClass}
              />
            </div>
          ))}
        </div>
        {missingRequired.length > 0 && (
          <p className="mt-3 text-[11px] text-amber-700">
            {missingRequired.length} field{missingRequired.length !== 1 ? "s" : ""} still empty.
          </p>
        )}
      </div>

      {mergedSubject && (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Subject preview</div>
          <div className="mt-1 text-sm font-medium text-slate-800">{mergedSubject}</div>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4 max-h-[400px] overflow-auto">
        <div dangerouslySetInnerHTML={{ __html: mergedHtml }} />
      </div>
    </div>
  );
}
