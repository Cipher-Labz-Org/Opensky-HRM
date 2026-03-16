import { DEFAULT_THEME } from "@/config/constants";

/**
 * Placeholder for future theme hook.
 * Will handle theme (light/dark/system) and persistence.
 */
export function useTheme() {
  return {
    theme: DEFAULT_THEME,
    setTheme: (_theme: string) => {},
  };
}
