"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const EMBED_KEY = "opensky-erp-embed";
const THEME_KEY = "opensky-erp-theme";

function themeFromRedirect(redirect: string): "dark" | "light" | null {
  const queryIndex = redirect.indexOf("?");
  if (queryIndex < 0) return null;
  const theme = new URLSearchParams(redirect.slice(queryIndex + 1)).get("theme");
  return theme === "dark" || theme === "light" ? theme : null;
}

/** Apply ERP light/dark tokens when HR is opened inside the ERP iframe. Returns whether embed mode is on. */
export function syncErpEmbedChrome(): boolean {
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get("redirect") ?? "";
  const redirectEmbed = redirect.includes("embed=1");
  const embed =
    params.get("embed") === "1" || redirectEmbed || sessionStorage.getItem(EMBED_KEY) === "1";

  if (params.get("embed") === "1" || redirectEmbed) {
    sessionStorage.setItem(EMBED_KEY, "1");
    document.cookie = "opensky_erp_embed=1; path=/; samesite=lax";
  }

  const queryTheme = params.get("theme");
  const theme =
    queryTheme === "dark" || queryTheme === "light"
      ? queryTheme
      : themeFromRedirect(redirect) ??
        (sessionStorage.getItem(THEME_KEY) === "light" ? "light" : "dark");

  if (queryTheme === "dark" || queryTheme === "light" || themeFromRedirect(redirect)) {
    sessionStorage.setItem(THEME_KEY, theme);
  }

  document.documentElement.classList.toggle("erp-embed", embed);
  if (embed) {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }
  return embed;
}

export function ErpEmbedTheme() {
  const pathname = usePathname();

  useEffect(() => {
    syncErpEmbedChrome();
  }, [pathname]);

  return null;
}
