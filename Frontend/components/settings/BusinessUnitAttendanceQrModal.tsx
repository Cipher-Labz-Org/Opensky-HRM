"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api";

type BusinessUnitAttendanceQr = {
  businessUnitId: string;
  name: string;
  code: string;
  payload: string;
};

type BusinessUnitAttendanceQrModalProps = {
  open: boolean;
  onClose: () => void;
  businessUnitId: string | null;
  businessUnitName?: string;
  businessUnitCode?: string;
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
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #0f2744;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .sheet {
      width: 100%;
      max-width: 420px;
      text-align: center;
      padding: 24px;
    }
    .brand {
      display: inline-block;
      margin-bottom: 16px;
      padding: 4px 10px;
      border-radius: 999px;
      border: 1px solid #bfdbfe;
      background: #eff6ff;
      color: #1d4ed8;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    h1 {
      margin: 0 0 8px;
      font-size: 22px;
      line-height: 1.25;
    }
    .hint {
      margin: 0 0 16px;
      color: #5b6b7c;
      font-size: 13px;
      line-height: 1.45;
    }
    .code {
      display: inline-block;
      margin: 0 0 20px;
      padding: 6px 12px;
      border-radius: 8px;
      background: #f1f5f9;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 13px;
      font-weight: 600;
    }
    .qr-wrap {
      display: inline-block;
      padding: 16px;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      background: #fff;
    }
    img {
      display: block;
      width: 280px;
      height: 280px;
    }
    .footer {
      margin-top: 18px;
      color: #94a3b8;
      font-size: 11px;
    }
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
    <p class="footer">Business unit attendance QR</p>
  </div>
</body>
</html>`;
}

export function BusinessUnitAttendanceQrModal({
  open,
  onClose,
  businessUnitId,
  businessUnitName,
  businessUnitCode,
}: BusinessUnitAttendanceQrModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [payload, setPayload] = useState<BusinessUnitAttendanceQr | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const printFrameRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    if (!open || !businessUnitId) {
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
        const data = await apiFetch<BusinessUnitAttendanceQr>(
          `/api/Attendance/business-unit-qr/${businessUnitId}`
        );
        const dataUrl = await QRCode.toDataURL(data.payload, {
          width: 512,
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
  }, [open, businessUnitId]);

  const titleName = payload?.name || businessUnitName || "Business unit";
  const titleCode = payload?.code || businessUnitCode || "";

  function printViaIframe(html: string) {
    const existing = printFrameRef.current;
    if (existing?.parentNode) existing.parentNode.removeChild(existing);

    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";
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
        // Keep iframe briefly so the print dialog can use it, then clean up.
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

    const html = buildPrintHtml({
      titleName,
      titleCode,
      qrDataUrl,
    });

    try {
      // Prefer same-page iframe print (not blocked by popup blockers / noopener).
      printViaIframe(html);
    } catch (err) {
      setPrinting(false);
      setError(err instanceof Error ? err.message : "Print failed.");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Attendance QR">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="flex h-52 w-52 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-white p-2">
          {qrDataUrl && !loading ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt={`${titleName} attendance QR`} className="h-full w-full rounded-lg" />
          ) : error ? (
            <p className="px-3 text-center text-xs text-red-500">{error}</p>
          ) : (
            <p className="px-3 text-center text-xs text-[var(--text-muted)]">Generating QR code…</p>
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
            Print this QR and display it at the business unit. Employees scan it in the mobile app to
            punch in or out.
          </p>
          {error ? <p className="text-xs text-red-500">{error}</p> : null}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="button" onClick={handlePrint} disabled={!qrDataUrl || loading || printing}>
              {printing ? "Preparing…" : "Print"}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
