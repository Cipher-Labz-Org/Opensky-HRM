/** Allow only in-app paths after login so email / query redirects cannot leave the site. */
export function safeAppRedirect(raw: string | null | undefined, fallback = "/app/dashboard"): string {
  if (!raw?.trim()) return fallback;

  const value = raw.trim();
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.includes("://")) return fallback;
  if (value.includes("\\") || /[\u0000-\u001F]/.test(value)) return fallback;
  if (
    value === "/login" ||
    value.startsWith("/login?") ||
    value.startsWith("/forgot-password") ||
    value.startsWith("/careers")
  ) {
    return fallback;
  }
  if (value !== "/app" && !value.startsWith("/app/") && !value.startsWith("/app?")) return fallback;
  return value;
}
