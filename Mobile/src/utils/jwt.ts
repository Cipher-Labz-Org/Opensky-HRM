export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json = globalThis.atob(padded);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string | null, expiresAtIso?: string | null): boolean {
  if (expiresAtIso) {
    const expiresAt = new Date(expiresAtIso).getTime();
    if (!Number.isNaN(expiresAt) && Date.now() >= expiresAt - 60_000) {
      return true;
    }
  }
  if (!token) return true;
  const payload = decodeJwtPayload(token);
  const exp = payload?.exp;
  if (typeof exp !== "number") return false;
  return Date.now() >= exp * 1000 - 60_000;
}
