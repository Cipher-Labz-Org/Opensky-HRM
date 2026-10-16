"use client";

import { useOskyTheme } from "@/components/shell/ThemeProvider";

/** Sun/moon switch for the command bar. Uses the shell `.osky-ib` button style. */
export function ThemeToggle() {
  const { isDark, toggle } = useOskyTheme();
  return (
    <button
      type="button"
      className="osky-ib"
      onClick={toggle}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      aria-pressed={isDark}
    >
      {isDark ? (
        <svg fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41"
          />
        </svg>
      ) : (
        <svg fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
          />
        </svg>
      )}
    </button>
  );
}
