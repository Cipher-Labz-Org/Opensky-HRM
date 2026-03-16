/**
 * Application configuration.
 * Placeholder for future environment and feature flags.
 */

import { APP_NAME, DEFAULT_THEME, SUPPORT_EMAIL } from "./constants";

export const appConfig = {
  name: APP_NAME,
  supportEmail: SUPPORT_EMAIL,
  defaultTheme: DEFAULT_THEME,
  // Future: feature flags, env-based config
} as const;
