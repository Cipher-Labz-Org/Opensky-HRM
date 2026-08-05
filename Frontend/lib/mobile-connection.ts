import { API_ASSET_BASE_URL, API_UPSTREAM_URL, getApiBaseUrl, getAssetBaseUrl } from "@/config/constants";

const MOBILE_APP_SCHEME = "openskyhrm";

export type MobileConnectionPayload = {
  apiBaseUrl: string;
  companyName: string;
  companyLogoUrl?: string | null;
  companyId: string;
};

function isLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "0.0.0.0" ||
    host === "10.0.2.2"
  );
}

/** True when a phone on Wi‑Fi cannot use this URL (loopback / emulator-only). */
export function isPhoneUnreachableApiBaseUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return true;
  try {
    return isLoopbackHost(new URL(url).hostname);
  } catch {
    return true;
  }
}

export function isPrivateLanApiBaseUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (isLoopbackHost(host)) return true;
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
    return false;
  } catch {
    return false;
  }
}

/** Absolute backend URL for mobile deep links (never a browser-only proxy path). */
export function getMobilePublicApiBaseUrl(): string {
  const envOverride = process.env.NEXT_PUBLIC_MOBILE_API_URL?.trim();
  if (envOverride && /^https?:\/\//i.test(envOverride) && !isPhoneUnreachableApiBaseUrl(envOverride)) {
    return envOverride.replace(/\/+$/, "");
  }

  const base = getApiBaseUrl();
  if (/^https?:\/\//i.test(base) && !isPhoneUnreachableApiBaseUrl(base)) {
    return base.replace(/\/+$/, "");
  }

  const assetBase = getAssetBaseUrl();
  if (/^https?:\/\//i.test(assetBase) && !isPhoneUnreachableApiBaseUrl(assetBase)) {
    return assetBase.replace(/\/+$/, "");
  }

  return (API_UPSTREAM_URL || API_ASSET_BASE_URL || "http://127.0.0.1:5000").replace(/\/+$/, "");
}

/**
 * Prefer the API-reported phone-reachable URL. Never fall back to localhost in the QR.
 */
export function resolveMobileQrApiBaseUrl(
  serverReportedBaseUrl?: string | null,
  fallbackBaseUrl?: string | null
): string {
  const candidates = [serverReportedBaseUrl, fallbackBaseUrl, process.env.NEXT_PUBLIC_MOBILE_API_URL];
  for (const candidate of candidates) {
    const value = candidate?.trim().replace(/\/+$/, "");
    if (!value || !/^https?:\/\//i.test(value)) continue;
    if (!isPhoneUnreachableApiBaseUrl(value)) return value;
  }
  throw new Error(
    "Mobile QR needs a phone-reachable API URL (LAN IP or public HTTPS). Set Mobile:PublicApiBaseUrl on the API, or NEXT_PUBLIC_MOBILE_API_URL in the frontend."
  );
}

export function buildMobileConnectionDeepLink(payload: MobileConnectionPayload): string {
  const params = new URLSearchParams({
    u: payload.apiBaseUrl,
    c: payload.companyName,
    id: payload.companyId,
  });
  if (payload.companyLogoUrl) {
    params.set("l", payload.companyLogoUrl);
  }
  return `${MOBILE_APP_SCHEME}://connect?${params.toString()}`;
}
