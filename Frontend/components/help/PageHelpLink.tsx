"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ROUTES } from "@/config/routes";
import { useAuth } from "@/contexts/auth-context";
import { contextualHelpGuideHref, helpTopicForPathname } from "@/lib/help-topics";

/** Opens the guide for the current module. Hidden on the help pages themselves. */
export function PageHelpLink() {
  const pathname = usePathname() ?? "";
  const { user, hasPermission } = useAuth();
  const [query, setQuery] = useState("");

  useEffect(() => {
    const current = new URLSearchParams(window.location.search);
    const next = new URLSearchParams();
    const embedded =
      current.get("embed") === "1" || sessionStorage.getItem("opensky-erp-embed") === "1";
    if (embedded) next.set("embed", "1");
    const theme = current.get("theme") || sessionStorage.getItem("opensky-erp-theme");
    if (theme === "dark" || theme === "light") next.set("theme", theme);
    const value = next.toString();
    setQuery(value ? `?${value}` : "");
  }, [pathname]);

  if (!pathname || pathname === ROUTES.helpGuides || pathname.startsWith(`${ROUTES.helpGuides}/`)) {
    return null;
  }
  if (!user || !hasPermission("Help", "Read")) return null;

  const topic = helpTopicForPathname(pathname);
  const href = `${contextualHelpGuideHref(pathname, user.licensedModules)}${query}`;
  const label = topic ? `${topic.title} guide` : "Help & guides";

  return (
    <div className="mb-4 flex justify-end">
      <Link
        href={href}
        title={label}
        className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold shadow-sm transition hover:border-[var(--action)] hover:text-[var(--action)]"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "var(--panel)",
          color: "var(--text)",
        }}
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
          />
        </svg>
        Help
      </Link>
    </div>
  );
}
