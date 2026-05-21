/**
 * Application constants.
 * Used for branding, support, and default behavior.
 */

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
 * Production/custom domains (e.g. gamma.openskyhrm.com): browser calls same-origin `/api/*`;
 * Next rewrites proxy to the real API. Avoids CORS on every preview/custom hostname.
 */
const useSameOriginApi =
  process.env.NEXT_PUBLIC_USE_SAME_ORIGIN_API === "true" ||
  process.env.VERCEL === "1" ||
  Boolean(rawApiUrl && !isLocalApiUrl(rawApiUrl));

/** Empty string = relative `/api/...` (proxied). Local dev defaults to the ASP.NET API on port 5000. */
export const API_BASE_URL = useSameOriginApi
  ? ""
  : rawApiUrl && rawApiUrl.length > 0
    ? rawApiUrl
    : defaultLocalApi;

/** Backend origin for static assets (profile images, company logo). <img src> does not need CORS. */
export const API_ASSET_BASE_URL = (
  rawApiUrl && rawApiUrl.length > 0 ? rawApiUrl : defaultLocalApi
).replace(/\/$/, "");

/** Real API host for server-side proxy / rewrites (set API_URL on Vercel). */
export const API_UPSTREAM_URL = (
  process.env.API_URL?.trim() ||
  rawApiUrl ||
  defaultLocalApi
).replace(/\/$/, "");
