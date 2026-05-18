/**
 * Application constants.
 * Used for branding, support, and default behavior.
 */

export const APP_NAME = "OpenSky HRM";
export const SUPPORT_EMAIL = "support@openskyhrm.com";
export const DEFAULT_THEME = "light";
const rawApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
/**
 * - Production / CI: set `NEXT_PUBLIC_API_URL` to your public API origin.
 * - Local `npm run dev`: when unset, use same-origin `/hrm-backend` (see `next.config.js` rewrites → Kestrel).
 *   Set `NEXT_PUBLIC_API_DEV_PROXY=0` to use a direct URL default instead.
 */
const useDevSameOriginProxy =
  process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_API_DEV_PROXY !== "0";

export const API_BASE_URL =
  rawApiUrl && rawApiUrl.length > 0
    ? rawApiUrl.replace(/\/$/, "")
    : useDevSameOriginProxy
      ? "/hrm-backend"
      : "http://localhost:5000";
