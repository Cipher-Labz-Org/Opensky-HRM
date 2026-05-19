/**
 * Application constants.
 * Used for branding, support, and default behavior.
 */

export const APP_NAME = "OpenSky HRM";
export const SUPPORT_EMAIL = "support@openskyhrm.com";
export const DEFAULT_THEME = "light";
const rawApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

/**
 * On Vercel the browser calls same-origin `/api/*`; Next rewrites proxy to the real API (see next.config.js).
 * Direct cross-origin calls fail when the backend Cors list does not include every preview URL.
 */
const useSameOriginApi =
  process.env.NEXT_PUBLIC_USE_SAME_ORIGIN_API === "true" ||
  process.env.VERCEL === "1";

/** Empty string = relative `/api/...` (proxied). Local dev defaults to the ASP.NET API on port 5000. */
export const API_BASE_URL = useSameOriginApi
  ? ""
  : rawApiUrl && rawApiUrl.length > 0
    ? rawApiUrl
    : "http://127.0.0.1:5000";

/** Real API host for server-side proxy / rewrites (set API_URL on Vercel). */
export const API_UPSTREAM_URL = (
  process.env.API_URL?.trim() ||
  rawApiUrl ||
  "http://127.0.0.1:5000"
).replace(/\/$/, "");
