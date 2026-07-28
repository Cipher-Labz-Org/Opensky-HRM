"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { apiFetch } from "@/lib/api";
import {
  buildMobileConnectionDeepLink,
  getMobilePublicApiBaseUrl,
  type MobileConnectionPayload,
} from "@/lib/mobile-connection";

type ConnectionInfoResponse = {
  apiBaseUrl?: string;
  companyName?: string;
  companyLogoUrl?: string | null;
  companyId?: string;
};

type MobileConnectionQrProps = {
  companyName?: string;
};

export function MobileConnectionQr({ companyName = "OpenSky HRM" }: MobileConnectionQrProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);
      const fallbackBase = getMobilePublicApiBaseUrl();

      try {
        const connectionInfo = await apiFetch<ConnectionInfoResponse>("/api/mobile/connection-info", {
          baseUrl: fallbackBase,
        }).catch(() => null);

        const resolvedCompanyName =
          connectionInfo?.companyName?.trim() || companyName.trim() || "OpenSky HRM";

        const payload: MobileConnectionPayload = {
          apiBaseUrl: (connectionInfo?.apiBaseUrl || fallbackBase).replace(/\/+$/, ""),
          companyName: resolvedCompanyName,
          companyLogoUrl: connectionInfo?.companyLogoUrl ?? null,
          companyId: connectionInfo?.companyId || "default",
        };

        const deepLink = buildMobileConnectionDeepLink(payload);
        const dataUrl = await QRCode.toDataURL(deepLink, {
          width: 320,
          margin: 1,
          errorCorrectionLevel: "M",
        });

        if (!cancelled) {
          setQrDataUrl(dataUrl);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not generate QR code.");
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [companyName]);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <div className="flex h-48 w-48 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-white p-2">
        {qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qrDataUrl}
            alt="Mobile connection QR code"
            className="h-full w-full rounded-lg"
          />
        ) : error ? (
          <p className="px-2 text-center text-xs text-red-500">{error}</p>
        ) : (
          <p className="px-2 text-center text-xs text-[var(--text-muted)]">Generating QR code…</p>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-sm font-medium text-[var(--text)]">Scan with the mobile app</p>
        <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">
          Employees scan this code in OpenSky HRM mobile to connect to your company workspace. The
          connection details are embedded in the QR only — they are not shown here.
        </p>
        <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">
          Administrators: set <code className="rounded bg-slate-100 px-1">Mobile:PublicApiBaseUrl</code> on
          the API when the public URL differs from the request host (reverse proxy or IIS). For local phone
          testing, use your computer&apos;s LAN IP instead of localhost.
        </p>
      </div>
    </div>
  );
}
