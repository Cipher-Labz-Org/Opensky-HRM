import { API_ASSET_BASE_URL, API_UPSTREAM_URL, getApiBaseUrl, getAssetBaseUrl } from "@/config/constants";

const MOBILE_APP_SCHEME = "openskyhrm";

export type MobileConnectionPayload = {
  apiBaseUrl: string;
  companyName: string;
  companyLogoUrl?: string | null;
  companyId: string;
};

/** Absolute backend URL for mobile deep links (never a browser-only proxy path). */
export function getMobilePublicApiBaseUrl(): string {
  const base = getApiBaseUrl();
  if (/^https?:\/\//i.test(base)) {
    return base.replace(/\/+$/, "");
  }

  const assetBase = getAssetBaseUrl();
  if (/^https?:\/\//i.test(assetBase)) {
    return assetBase.replace(/\/+$/, "");
  }

  return (API_UPSTREAM_URL || API_ASSET_BASE_URL || "http://127.0.0.1:5000").replace(/\/+$/, "");
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
