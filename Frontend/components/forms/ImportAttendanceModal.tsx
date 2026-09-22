"use client";

import { useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormErrorAlert } from "@/components/ui/FormErrorAlert";
import { API_ASSET_BASE_URL, getApiBaseUrl, getAssetBaseUrl } from "@/config/constants";
import { apiFetch, apiFetchBlob, isMissingApiRoute } from "@/lib/api";
import {
  buildAttendanceImportTemplateCsv,
  importAttendanceFromWorkbook,
  type AttendanceImportUploadResult,
} from "@/lib/attendance-excel-import";
import { downloadBlob } from "@/lib/template-pdf";

/**
 * Multipart POSTs through Next.js `/hrm-backend` or same-origin `/api` rewrites
 * return HTTP 405. Prefer the real IIS/API origin when one is available.
 */
function attendanceImportApiBase(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const base = getApiBaseUrl();
  if (base === "/hrm-backend" || base === "") {
    const direct = getAssetBaseUrl() || API_ASSET_BASE_URL;
    return direct || undefined;
  }
  return undefined;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onImported?: () => void;
}

export function ImportAttendanceModal({ open, onClose, onImported }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [result, setResult] = useState<AttendanceImportUploadResult | null>(null);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function resetState() {
    setFile(null);
    setResult(null);
    setError("");
    setProgress("");
    setDragOver(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleClose() {
    resetState();
    onClose();
  }

  function handleFileChange(next: File | null) {
    setFile(next);
    setResult(null);
    setError("");
  }

  async function handleDownloadTemplate() {
    setDownloadingTemplate(true);
    setError("");
    try {
      const blob = await apiFetchBlob("/api/attendance/import-template", {
        baseUrl: attendanceImportApiBase(),
      });
      downloadBlob(blob, "AttendanceImportTemplate.xlsx");
    } catch (err) {
      if (isMissingApiRoute(err)) {
        downloadBlob(buildAttendanceImportTemplateCsv(), "AttendanceImportTemplate.csv");
        return;
      }
      setError(err instanceof Error ? err.message : "Could not download the template.");
    } finally {
      setDownloadingTemplate(false);
    }
  }

  async function handleImport() {
    if (!file) return;
    setUploading(true);
    setError("");
    setProgress("");
    setResult(null);
    try {
      const json = await postAttendanceWorkbook(file);
      setProgress("");
      setResult(json);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      if ((json.created ?? 0) + (json.updated ?? 0) > 0) {
        onImported?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setUploading(false);
    }
  }

  async function postAttendanceWorkbook(workbook: File): Promise<AttendanceImportUploadResult> {
    const formData = new FormData();
    formData.append("file", workbook);
    try {
      return await apiFetch<AttendanceImportUploadResult>("/api/attendance/import", {
        method: "POST",
        body: formData,
        timeoutMs: 300_000,
        baseUrl: attendanceImportApiBase(),
      });
    } catch (err) {
      if (!isMissingApiRoute(err)) throw err;
      setProgress("Saving attendance rows…");
      return importAttendanceFromWorkbook(workbook, (done, total) => {
        setProgress(`Saving ${done} of ${total} attendance rows…`);
      });
    }
  }

  const skippedRows = result?.results.filter((r) => r.status === "Skipped") ?? [];

  return (
    <Modal open={open} onClose={handleClose} title="Import Attendance from Excel">
      <div className="space-y-4">
        <FormErrorAlert message={error} onDismiss={() => setError("")} />

        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-medium text-slate-700">Required Excel columns</p>
              <p className="mt-2 text-xs">
                Your sheet must include <strong>Employee Code</strong> and <strong>Date</strong> column headers.
                Optional: Punch In, Punch Out, Status, Remarks.
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Save as Excel Workbook (.xlsx). Employee code must match an active employee. Existing records for the same employee and date are updated.
                Night shifts can use the same Date with Punch Out after midnight (e.g. In 22:00, Out 06:00).
              </p>
            </div>
            <Button
              variant="secondary"
              type="button"
              onClick={() => void handleDownloadTemplate()}
              disabled={downloadingTemplate}
            >
              {downloadingTemplate ? "Downloading…" : "Download template"}
            </Button>
          </div>
        </div>

        <div
          className={`rounded-xl border-2 border-dashed p-6 text-center transition ${
            dragOver ? "border-blue-400 bg-blue-50/50" : "border-slate-200 bg-white"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const dropped = e.dataTransfer.files?.[0];
            if (dropped) handleFileChange(dropped);
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">{file.name}</p>
              <Button variant="secondary" type="button" onClick={() => fileRef.current?.click()}>
                Choose a different file
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-slate-600">Drag and drop your attendance Excel file here, or</p>
              <Button variant="secondary" type="button" onClick={() => fileRef.current?.click()}>
                Upload Excel
              </Button>
            </div>
          )}
        </div>

        {result && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-800">Import summary</p>
            <p className="mt-1 text-xs text-slate-500">
              Created {result.created}, updated {result.updated}, skipped {result.skipped} of {result.totalRows} rows.
            </p>
            {(result.created + result.updated) > 0 && (
              <p className="mt-2 text-xs text-slate-500">
                Payroll uses these records. Open the salary batch, choose Import Attendance & Leave, then Calculate so no-pay and overtime follow this sheet.
              </p>
            )}
            {skippedRows.length > 0 && (
              <div className="mt-3 max-h-40 overflow-y-auto rounded-lg border border-slate-100">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Row</th>
                      <th className="px-3 py-2">Employee</th>
                      <th className="px-3 py-2">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {skippedRows.map((r) => (
                      <tr key={r.row} className="border-t border-slate-100">
                        <td className="px-3 py-2">{r.row}</td>
                        <td className="px-3 py-2">{r.employeeCode || "—"}</td>
                        <td className="px-3 py-2 text-rose-700">{r.errors.join("; ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          {progress && <p className="mr-auto text-xs text-slate-500">{progress}</p>}
          <Button variant="secondary" type="button" onClick={handleClose}>
            Close
          </Button>
          <Button type="button" onClick={handleImport} disabled={!file || uploading}>
            {uploading ? "Importing…" : "Import"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
