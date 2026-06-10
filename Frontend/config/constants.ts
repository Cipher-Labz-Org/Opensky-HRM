/**
 * Application constants.
 * Used for branding, support, and default behavior.
 */

import { getTenantByHostname } from "./tenants";

export const APP_NAME = "OpenSky HRM";
export const SUPPORT_EMAIL = "support@openskyhrm.com";
export const DEFAULT_THEME = "light";
const rawApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
const defaultLocalApi = "http://127.0.0.1:5000";

/** True when NEXT_PUBLIC_API_URL points at localhost (direct browser → API is fine). */
function isLocalApiUrl(url: string | undefined): boolean {
  if (!url) return true;
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(url);
}

/**
 * Local dev: same-origin `/hrm-backend` proxy (see next.config.js). Omit NEXT_PUBLIC_API_URL in .env.local.
 */
const useDevSameOriginProxy =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_API_DEV_PROXY !== "0" &&
  !rawApiUrl;

/**
 * Production / custom domains (e.g. gamma.openskyhrm.com): same-origin `/api/*` rewrites — avoids CORS.
 */
const useProductionSameOriginProxy =
  process.env.NEXT_PUBLIC_USE_SAME_ORIGIN_API === "true" ||
  process.env.VERCEL === "1" ||
  Boolean(rawApiUrl && !isLocalApiUrl(rawApiUrl));

export const API_BASE_URL = useProductionSameOriginProxy
  ? ""
  : rawApiUrl && rawApiUrl.length > 0
    ? rawApiUrl.replace(/\/$/, "")
    : useDevSameOriginProxy
      ? "/hrm-backend"
      : defaultLocalApi;

/** Hostnames that must call the API via same-origin `/api/*` (Vercel rewrites / route handlers). */
function isProductionAppHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h.endsWith(".openskyhrm.com") || h.endsWith(".vercel.app");
}

/**
 * API base URL for browser `fetch` calls.
 * Registered tenants (mbkh, gamma, …) call their IIS backend directly — avoids Vercel
 * proxying to private/local IPs (DNS_HOSTNAME_RESOLVED_PRIVATE).
 */
export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const tenant = getTenantByHostname(window.location.hostname);
    if (tenant) return tenant.apiUrl.replace(/\/$/, "");
    if (isProductionAppHost(window.location.hostname)) return "";
  }
  return API_BASE_URL;
}

/** Registered tenant hostname in the browser (mbkh.openskyhrm.com, gamma.openskyhrm.com, …). */
export function isTenantBrowserHost(): boolean {
  if (typeof window === "undefined") return false;
  return getTenantByHostname(window.location.hostname) != null;
}

/** IIS backend URL for the current tenant (for error messages). */
export function tenantBackendUrl(): string | null {
  if (typeof window === "undefined") return null;
  const tenant = getTenantByHostname(window.location.hostname);
  return tenant ? tenant.apiUrl.replace(/\/$/, "") : null;
}

/**
 * Auth endpoints on tenant hosts use same-origin `/api/auth/*` so Vercel proxies to IIS.
 * Avoids browser CORS blocks when the backend returns 500 without CORS headers.
 */
export function resolveAuthApiPath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (isTenantBrowserHost()) return normalized;
  const base = getApiBaseUrl().replace(/\/$/, "");
  return base ? `${base}${normalized}` : normalized;
}

/** Backend origin for static assets (profile images, company logo). <img src> does not need CORS. */
export function getAssetBaseUrl(): string {
  if (typeof window !== "undefined") {
    const tenant = getTenantByHostname(window.location.hostname);
    if (tenant) return tenant.apiUrl.replace(/\/$/, "");
  }
  return (rawApiUrl && rawApiUrl.length > 0 ? rawApiUrl : defaultLocalApi).replace(/\/$/, "");
}

/** @deprecated Use getAssetBaseUrl() — kept for existing imports. */
export const API_ASSET_BASE_URL = (
  rawApiUrl && rawApiUrl.length > 0 ? rawApiUrl : defaultLocalApi
).replace(/\/$/, "");

/** Real API host for server-side proxy / rewrites (set API_URL on Vercel). */
export const API_UPSTREAM_URL = (
  process.env.API_URL?.trim() ||
  rawApiUrl ||
  defaultLocalApi
).replace(/\/$/, "");
