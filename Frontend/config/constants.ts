/**
 * Application constants.
 * Used for branding, support, and default behavior.
 */

import { getBackendUrlForHostname, tenantBackendRequiresBrowserProxy } from "./tenants";

export const APP_NAME = "OpenSky HRM";
export const SUPPORT_EMAIL = "support@openskyhrm.com";
export const DEFAULT_THEME = "light";
const envApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
const defaultLocalApi = "http://127.0.0.1:5000";

/** True when NEXT_PUBLIC_API_URL points at localhost (direct browser → API is fine). */
function isLocalApiUrl(url: string | undefined): boolean {
  if (!url) return true;
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(url);
}

const rawApiUrl =
  process.env.VERCEL === "1" && isLocalApiUrl(envApiUrl) ? undefined : envApiUrl;

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
 * Tenant sites on *.openskyhrm.com use same-origin `/api/*` (server proxies to that tenant's IIS backend).
 * Avoids browser → Cloudflare HTTP/3 (QUIC) failures on *backend.openskyhrm.com and CORS.
 * HTTP-only backends always use the proxy (mixed-content).
 */
function tenantUsesSameOriginApi(hostname: string): boolean {
  if (!isProductionAppHost(hostname)) return false;
  if (tenantBackendRequiresBrowserProxy(hostname)) return true;
  return getBackendUrlForHostname(hostname) != null;
}

/**
 * API base URL for browser `fetch` calls.
 */
export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (tenantUsesSameOriginApi(hostname)) return "";
    const backend = getBackendUrlForHostname(hostname);
    if (backend) return backend;
    if (isProductionAppHost(hostname)) return "";
  }
  return API_BASE_URL;
}

/** Registered or convention-mapped tenant hostname (e.g. gamma.openskyhrm.com, demo.openskyhrm.com). */
export function isTenantBrowserHost(): boolean {
  if (typeof window === "undefined") return false;
  return getBackendUrlForHostname(window.location.hostname) != null;
}

/** IIS backend URL for the current tenant (for error messages). */
export function tenantBackendUrl(): string | null {
  if (typeof window === "undefined") return null;
  return getBackendUrlForHostname(window.location.hostname);
}

/**
 * Resolve `/uploads/...` (or absolute URL) for the current host.
 * Tenant *.openskyhrm.com uses same-origin `/uploads/*` (proxied like `/api/*`).
 */
export function resolveAssetUrl(path: string | null | undefined, cacheBuster?: number | string): string | null {
  const raw = path?.trim() ?? "";
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;

  const normalized = raw.startsWith("/") ? raw : `/${raw}`;
  let url: string;

  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (tenantBackendRequiresBrowserProxy(hostname) || tenantUsesSameOriginApi(hostname)) {
      url = normalized;
    } else {
      const backend = getBackendUrlForHostname(hostname);
      if (backend) {
        url = `${backend}${normalized}`;
      } else if (isProductionAppHost(hostname)) {
        url = normalized;
      } else {
        const base = getApiBaseUrl().replace(/\/$/, "");
        url = base ? `${base}${normalized}` : normalized;
      }
    }
  } else {
    url = `${getAssetBaseUrl()}${normalized}`;
  }

  if (cacheBuster !== undefined && cacheBuster !== "") {
    const sep = url.includes("?") ? "&" : "?";
    url = `${url}${sep}v=${encodeURIComponent(String(cacheBuster))}`;
  }

  return url;
}

/**
 * Auth endpoints (login, branding, forgot-password) for browser `fetch`.
 * Uses same-origin `/api/*` on tenant *.openskyhrm.com hosts (see getApiBaseUrl).
 */
export function resolveAuthApiPath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const base = getApiBaseUrl().replace(/\/$/, "");
  return base ? `${base}${normalized}` : normalized;
}

/** Backend origin for static assets (profile images, company logo). <img src> does not need CORS. */
export function getAssetBaseUrl(): string {
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (tenantBackendRequiresBrowserProxy(hostname)) return "";
    const backend = getBackendUrlForHostname(hostname);
    if (backend) return backend;
  }
  return (rawApiUrl && rawApiUrl.length > 0 ? rawApiUrl : defaultLocalApi).replace(/\/$/, "");
}

/**
 * Real API origin for calls that must bypass same-origin rewrites (multipart uploads get 405 there on live).
 * Null when no backend origin is configured — local dev then only knows the :5000 placeholder,
 * which is not where OpenSkyHRM.Api listens, so callers should stay on the `/hrm-backend` proxy.
 */
export function getConfiguredBackendOrigin(): string | null {
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (tenantBackendRequiresBrowserProxy(hostname)) return null;
    const backend = getBackendUrlForHostname(hostname);
    if (backend) return backend.replace(/\/$/, "");
  }
  return rawApiUrl && rawApiUrl.length > 0 ? rawApiUrl.replace(/\/$/, "") : null;
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
