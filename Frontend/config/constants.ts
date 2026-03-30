/**
 * Application constants.
 * Used for branding, support, and default behavior.
 */

export const APP_NAME = "OpenSky HRM";
export const SUPPORT_EMAIL = "support@openskyhrm.com";
export const DEFAULT_THEME = "light";
const rawApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
/** Empty string in env must not defeat the localhost default (would same-origin-fetch Next.js → API 404). */
export const API_BASE_URL =
  rawApiUrl && rawApiUrl.length > 0 ? rawApiUrl : "http://127.0.0.1:5000";
