"use client";

import * as React from "react";

type ThemeChoice = "light" | "dark" | null;
type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  /** Explicit user choice, or null when following the OS. */
  choice: ThemeChoice;
  /** Theme actually in effect. */
  resolved: ResolvedTheme;
  isDark: boolean;
  toggle: () => void;
  setTheme: (choice: ThemeChoice) => void;
};

const STORAGE_KEY = "opensky-theme";

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

function prefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function readStoredChoice(): ThemeChoice {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === "light" || raw === "dark" ? raw : null;
  } catch {
    return null;
  }
}

/**
 * Shell theme provider. Mirrors the React 18 UI concept's `useTheme`:
 *   - `choice` null  → follow the OS
 *   - `choice` light/dark → explicit, written as data-theme on <html>
 * `data-resolved` always carries the theme actually in effect.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [choice, setChoice] = React.useState<ThemeChoice>(() => readStoredChoice());
  const [resolved, setResolved] = React.useState<ResolvedTheme>("light");

  React.useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const dark = choice ? choice === "dark" : prefersDark();
      root.setAttribute("data-resolved", dark ? "dark" : "light");
      setResolved(dark ? "dark" : "light");
    };

    if (choice) root.setAttribute("data-theme", choice);
    else root.removeAttribute("data-theme");
    apply();

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [choice]);

  const setTheme = React.useCallback((next: ThemeChoice) => {
    setChoice(next);
    try {
      if (next) window.localStorage.setItem(STORAGE_KEY, next);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage unavailable (private mode) — theme still applies for this session */
    }
  }, []);

  const toggle = React.useCallback(() => {
    const currentlyDark = choice ? choice === "dark" : prefersDark();
    setTheme(currentlyDark ? "light" : "dark");
  }, [choice, setTheme]);

  const value = React.useMemo<ThemeContextValue>(
    () => ({ choice, resolved, isDark: resolved === "dark", toggle, setTheme }),
    [choice, resolved, toggle, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useOskyTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useOskyTheme must be used within a ThemeProvider");
  }
  return ctx;
}
