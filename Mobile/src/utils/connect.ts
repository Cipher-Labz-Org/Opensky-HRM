import type { MobileConnectionInfo } from "@/types/auth";
import { APP_SCHEME } from "@/config/constants";

export function normalizeApiBaseUrl(input: string): string {
  let url = input.trim();
  if (!url) throw new Error("Backend URL is required.");
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  return url.replace(/\/+$/, "");
}

export function parseConnectionPayload(raw: string): MobileConnectionInfo {
  const trimmed = raw.trim();

  if (trimmed.startsWith(`${APP_SCHEME}://`)) {
    const parsed = new URL(trimmed);
    const apiBaseUrl = parsed.searchParams.get("u");
    const companyName = parsed.searchParams.get("c") ?? "OpenSky HRM";
    const companyLogoUrl = parsed.searchParams.get("l");
    const companyId = parsed.searchParams.get("id") ?? "default";
    if (!apiBaseUrl) throw new Error("Invalid QR code: missing backend URL.");
    return {
      apiBaseUrl: normalizeApiBaseUrl(apiBaseUrl),
      companyName,
      companyLogoUrl,
      companyId,
    };
  }

  if (trimmed.startsWith("{")) {
    const json = JSON.parse(trimmed) as Partial<MobileConnectionInfo>;
    if (!json.apiBaseUrl) throw new Error("Invalid QR JSON: missing apiBaseUrl.");
    return {
      apiBaseUrl: normalizeApiBaseUrl(json.apiBaseUrl),
      companyName: json.companyName ?? "OpenSky HRM",
      companyLogoUrl: json.companyLogoUrl ?? null,
      companyId: json.companyId ?? "default",
    };
  }

  return {
    apiBaseUrl: normalizeApiBaseUrl(trimmed),
    companyName: "OpenSky HRM",
    companyLogoUrl: null,
    companyId: "default",
  };
}

export function buildAssetUrl(baseUrl: string, path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${baseUrl.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}
