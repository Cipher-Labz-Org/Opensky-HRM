"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { apiFetch } from "@/lib/api";
import {
  buildMobileConnectionDeepLink,
  getMobilePublicApiBaseUrl,
  isPrivateLanApiBaseUrl,
  resolveMobileQrApiBaseUrl,
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
  const [apiBaseUrl, setApiBaseUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);

      try {
        // Prefer same-origin proxy (/hrm-backend) so localhost settings always reaches the API.
        const connectionInfo = await apiFetch<ConnectionInfoResponse>("/api/mobile/connection-info").catch(
          () => null
        );

        const resolvedCompanyName =
          connectionInfo?.companyName?.trim() || companyName.trim() || "OpenSky HRM";

        const phoneReachableBase = resolveMobileQrApiBaseUrl(
          connectionInfo?.apiBaseUrl,
          getMobilePublicApiBaseUrl()
        );

        const payload: MobileConnectionPayload = {
          apiBaseUrl: phoneReachableBase,
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
          setApiBaseUrl(phoneReachableBase);
          setQrDataUrl(dataUrl);
        }
      } catch (err) {
        if (!cancelled) {
          setQrDataUrl(null);
          setApiBaseUrl(null);
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
          Employees scan this code in OpenSky HRM mobile to connect to your company workspace. Phone and
          PC must be on the same Wi‑Fi for local testing.
        </p>
        {apiBaseUrl && isPrivateLanApiBaseUrl(apiBaseUrl) ? (
          <p className="break-all rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-2 text-[11px] leading-relaxed text-sky-900">
            Local backend in this QR: <code className="font-semibold">{apiBaseUrl}</code>
            <br />
            Use this if scanning fails — enter it manually on the Connect screen.
          </p>
        ) : null}
        <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">
          Administrators: set <code className="rounded bg-slate-100 px-1">Mobile:PublicApiBaseUrl</code> on
          the API when the public URL differs from the request host (reverse proxy or IIS). For local phone
          testing, use your computer&apos;s LAN IP instead of localhost.
        </p>
        {error ? <p className="text-[11px] text-red-600">{error}</p> : null}
      </div>
    </div>
  );
}
