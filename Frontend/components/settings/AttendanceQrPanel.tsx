"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api";

type AttendanceQrResponse = {
  businessUnitId?: string;
  locationId?: string;
  name: string;
  code: string;
  payload: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildPrintHtml(opts: {
  titleName: string;
  titleCode: string;
  qrDataUrl: string;
  footer: string;
}): string {
  const name = escapeHtml(opts.titleName);
  const code = escapeHtml(opts.titleCode);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${name} attendance QR</title>
  <style>
    @page { margin: 16mm; size: A4; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #0f2744; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
    body { min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .sheet { width: 100%; max-width: 420px; text-align: center; padding: 24px; }
    .brand { display: inline-block; margin-bottom: 16px; padding: 4px 10px; border-radius: 999px; border: 1px solid #bfdbfe; background: #eff6ff; color: #1d4ed8; font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
    h1 { margin: 0 0 8px; font-size: 22px; line-height: 1.25; }
    .hint { margin: 0 0 16px; color: #5b6b7c; font-size: 13px; line-height: 1.45; }
    .code { display: inline-block; margin: 0 0 20px; padding: 6px 12px; border-radius: 8px; background: #f1f5f9; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; font-weight: 600; }
    .qr-wrap { display: inline-block; padding: 16px; border: 1px solid #e2e8f0; border-radius: 16px; background: #fff; }
    img { display: block; width: 280px; height: 280px; }
    .footer { margin-top: 18px; color: #94a3b8; font-size: 11px; }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="brand">OpenSky HRM</div>
    <h1>${name}</h1>
    <p class="hint">Scan with OpenSky HRM mobile to punch attendance</p>
    ${code ? `<div class="code">${code}</div>` : ""}
    <div class="qr-wrap">
      <img id="qr" src="${opts.qrDataUrl}" alt="Attendance QR" width="280" height="280" />
    </div>
    <p class="footer">${escapeHtml(opts.footer)}</p>
  </div>
</body>
</html>`;
}

export type AttendanceQrKind = "location" | "businessUnit";

type AttendanceQrPanelProps = {
  kind: AttendanceQrKind;
  entityId: string | null;
  entityName?: string;
  entityCode?: string;
  compact?: boolean;
  /** Compact QR beside form fields (e.g. next to geofence radius). */
  inline?: boolean;
};

export function AttendanceQrPanel({
  kind,
  entityId,
  entityName,
  entityCode,
  compact = false,
  inline = false,
}: AttendanceQrPanelProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [payload, setPayload] = useState<AttendanceQrResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const printFrameRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    if (!entityId) {
      setQrDataUrl(null);
      setPayload(null);
      setError(null);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const path =
          kind === "location"
            ? `/api/Attendance/location-qr/${entityId}`
            : `/api/Attendance/business-unit-qr/${entityId}`;
        const data = await apiFetch<AttendanceQrResponse>(path);
        const dataUrl = await QRCode.toDataURL(data.payload, {
          width: inline ? 180 : compact ? 256 : 512,
          margin: 2,
          errorCorrectionLevel: "M",
        });
        if (!cancelled) {
          setPayload(data);
          setQrDataUrl(dataUrl);
        }
      } catch (err) {
        if (!cancelled) {
          setPayload(null);
          setQrDataUrl(null);
          setError(err instanceof Error ? err.message : "Could not generate QR code.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [entityId, kind, compact, inline]);

  const titleName = payload?.name || entityName || (kind === "location" ? "Location" : "Business unit");
  const titleCode = payload?.code || entityCode || "";
  const footer =
    kind === "location" ? "Location attendance QR" : "Business unit attendance QR";
  const placeLabel = kind === "location" ? "location" : "business unit";

  function printViaIframe(html: string) {
    const existing = printFrameRef.current;
    if (existing?.parentNode) existing.parentNode.removeChild(existing);

    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none";
    document.body.appendChild(iframe);
    printFrameRef.current = iframe;

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      iframe.remove();
      throw new Error("Could not prepare print view.");
    }

    doc.open();
    doc.write(html);
    doc.close();

    const runPrint = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } finally {
        window.setTimeout(() => {
          if (printFrameRef.current === iframe) {
            iframe.remove();
            printFrameRef.current = null;
          }
          setPrinting(false);
        }, 1000);
      }
    };

    const img = doc.getElementById("qr") as HTMLImageElement | null;
    if (img && !img.complete) {
      img.onload = () => window.setTimeout(runPrint, 50);
      img.onerror = () => {
        setPrinting(false);
        setError("QR image failed to load for printing.");
        iframe.remove();
        printFrameRef.current = null;
      };
    } else {
      window.setTimeout(runPrint, 150);
    }
  }

  function handlePrint() {
    if (!qrDataUrl || printing) return;
    setPrinting(true);
    setError(null);
    try {
      printViaIframe(buildPrintHtml({ titleName, titleCode, qrDataUrl, footer }));
    } catch (err) {
      setPrinting(false);
      setError(err instanceof Error ? err.message : "Print failed.");
    }
  }

  if (!entityId) {
    if (inline) {
      return (
        <div className="flex h-full min-h-[7.5rem] flex-col items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-gray-50/80 px-3 py-4 text-center">
          <p className="text-xs text-[var(--text-muted)]">
            Select a linked {placeLabel} to show QR
          </p>
        </div>
      );
    }
    return (
      <p className="text-xs text-[var(--text-muted)]">
        Select a {placeLabel} to generate the attendance QR code.
      </p>
    );
  }

  if (inline) {
    return (
      <div className="flex h-full min-h-[7.5rem] flex-col items-center justify-center rounded-lg border border-[var(--border)] bg-white px-3 py-3">
        <div className="flex h-28 w-28 items-center justify-center rounded-md border border-[var(--border)] bg-gray-50 p-1.5">
          {qrDataUrl && !loading ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt={`${titleName} attendance QR`} className="h-full w-full rounded-sm" />
          ) : error ? (
            <p className="px-1 text-center text-[10px] leading-tight text-red-500">{error}</p>
          ) : (
            <p className="px-1 text-center text-[10px] text-[var(--text-muted)]">Loading…</p>
          )}
        </div>
        <p className="mt-2 max-w-[10rem] truncate text-center text-[10px] font-medium text-[var(--text)]">
          {titleName}
        </p>
        <button
          type="button"
          onClick={handlePrint}
          disabled={!qrDataUrl || loading || printing}
          className="mt-2 text-xs font-medium text-[var(--primary)] hover:underline disabled:opacity-50"
        >
          {printing ? "Preparing…" : "Print QR"}
        </button>
      </div>
    );
  }

  const qrSize = compact ? "h-36 w-36" : "h-52 w-52";

  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-4">
      <div className="mb-2 text-xs font-medium text-[var(--text-muted)]">Attendance QR</div>
      <div className={`flex ${compact ? "flex-col items-center gap-3 sm:flex-row sm:items-start" : "flex-col items-center gap-4 sm:flex-row sm:items-start"}`}>
        <div className={`flex ${qrSize} shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-gray-50 p-2`}>
          {qrDataUrl && !loading ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt={`${titleName} attendance QR`} className="h-full w-full rounded-md" />
          ) : error ? (
            <p className="px-2 text-center text-xs text-red-500">{error}</p>
          ) : (
            <p className="px-2 text-center text-xs text-[var(--text-muted)]">Generating QR…</p>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-semibold text-[var(--text)]">{titleName}</p>
          {titleCode ? (
            <p className="text-xs text-[var(--text-muted)]">
              Code: <span className="rounded bg-gray-100 px-2 py-0.5 font-mono">{titleCode}</span>
            </p>
          ) : null}
          <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">
            Print and display at this {placeLabel}. Employees scan it in the mobile app to punch in or out.
          </p>
          <Button type="button" onClick={handlePrint} disabled={!qrDataUrl || loading || printing}>
            {printing ? "Preparing…" : "Print QR"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** @deprecated Use AttendanceQrPanel */
export function BusinessUnitAttendanceQrPanel(props: {
  businessUnitId: string | null;
  businessUnitName?: string;
  businessUnitCode?: string;
  compact?: boolean;
}) {
  return (
    <AttendanceQrPanel
      kind="businessUnit"
      entityId={props.businessUnitId}
      entityName={props.businessUnitName}
      entityCode={props.businessUnitCode}
      compact={props.compact}
    />
  );
}
