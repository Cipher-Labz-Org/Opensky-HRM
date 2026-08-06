import type { MobileConnectionInfo } from "@/types/auth";
import { APP_SCHEME } from "@/config/constants";

/** Production backends known to require HTTPS on real devices. */
const FORCE_HTTPS_HOST_SUFFIXES = [".openskyhrm.com"];

function stripWrappingQuotes(value: string): string {
  return value.trim().replace(/^['"]+|['"]+$/g, "").trim();
}

/** Hostname from a bare `host:port/path` or absolute URL (no normalize recursion). */
function peekHostname(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    if (/^https?:\/\//i.test(trimmed)) {
      return new URL(trimmed).hostname.toLowerCase();
    }
  } catch {
    // fall through
  }
  const hostPort = trimmed.split("/")[0] ?? "";
  if (hostPort.startsWith("[")) {
    const end = hostPort.indexOf("]");
    return end > 0 ? hostPort.slice(1, end).toLowerCase() : null;
  }
  const host = hostPort.split(":")[0] ?? "";
  return host.toLowerCase() || null;
}

function isLocalDevHostname(host: string | null | undefined): boolean {
  if (!host) return false;
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "0.0.0.0" ||
    host === "10.0.2.2"
  ) {
    return true;
  }
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  return false;
}

/**
 * Normalize user / QR / server URLs into a valid absolute API base.
 * Repairs common Android URL-field corruption like "://host" (missing https).
 * Bare local/LAN hosts default to http (local Kestrel); public hosts default to https.
 */
export function normalizeApiBaseUrl(input: string): string {
  let url = stripWrappingQuotes(input);
  if (!url) throw new Error("Backend URL is required.");

  // Repair "://gammabackend.openskyhrm.com" or "//host"
  if (url.startsWith("://") || url.startsWith("//")) {
    const rest = url.replace(/^:\/\//, "").replace(/^\/\//, "");
    const scheme = isLocalDevHostname(peekHostname(rest)) ? "http" : "https";
    url = url.startsWith("://") ? `${scheme}${url}` : `${scheme}:${url}`;
  }

  // Repair "https//host" / "http//host" (missing colon)
  url = url.replace(/^(https?)\/\//i, "$1://");

  // Bare host or host/path → http for local/LAN, otherwise https
  if (!/^https?:\/\//i.test(url)) {
    const scheme = isLocalDevHostname(peekHostname(url)) ? "http" : "https";
    url = `${scheme}://${url}`;
  }

  // Collapse accidental "https://https://host"
  url = url.replace(/^(https?:\/\/)(https?:\/\/)+/i, "$1");

  let normalized = url.replace(/\/+$/, "");
  try {
    const parsed = new URL(normalized);
    if (!parsed.hostname) {
      throw new Error("Backend URL is missing a host name.");
    }
    normalized = `${parsed.protocol}//${parsed.host}${parsed.pathname}`.replace(/\/+$/, "");
  } catch {
    throw new Error(
      `Invalid backend URL. Use a full https://… address (got: ${input.trim()}).`
    );
  }

  return preferHttpsForKnownHosts(normalized);
}

export function preferHttpsForKnownHosts(input: string): string {
  try {
    const parsed = new URL(input);
    const host = parsed.hostname.toLowerCase();
    const forceHttps = FORCE_HTTPS_HOST_SUFFIXES.some(
      (suffix) => host === suffix.slice(1) || host.endsWith(suffix)
    );
    if (forceHttps && parsed.protocol === "http:") {
      parsed.protocol = "https:";
      return `${parsed.protocol}//${parsed.host}${parsed.pathname}`.replace(/\/+$/, "");
    }
    return input.replace(/\/+$/, "");
  } catch {
    return input.replace(/\/+$/, "");
  }
}

export function isOpenSkyProductionHost(input: string | null | undefined): boolean {
  if (!input?.trim()) return false;
  try {
    const host = new URL(normalizeApiBaseUrl(input)).hostname.toLowerCase();
    return FORCE_HTTPS_HOST_SUFFIXES.some(
      (suffix) => host === suffix.slice(1) || host.endsWith(suffix)
    );
  } catch {
    return /openskyhrm\.com/i.test(input);
  }
}

/**
 * Prefer the URL the phone already reached successfully.
 * Never downgrade https → http when the server mis-reports PublicApiBaseUrl.
 */
export function resolveReachableApiBaseUrl(
  requestedBaseUrl: string,
  serverReportedBaseUrl?: string | null
): string {
  const requested = normalizeApiBaseUrl(requestedBaseUrl);
  if (!serverReportedBaseUrl?.trim()) {
    return requested;
  }

  let reported: string;
  try {
    reported = normalizeApiBaseUrl(serverReportedBaseUrl);
  } catch {
    return requested;
  }

  if (isLoopbackApiBaseUrl(reported) && !isLoopbackApiBaseUrl(requested)) {
    return requested;
  }

  try {
    const req = new URL(requested);
    const rep = new URL(reported);
    if (req.hostname.toLowerCase() === rep.hostname.toLowerCase()) {
      // Always keep HTTPS for OpenSky production hosts.
      if (isOpenSkyProductionHost(requested)) {
        return preferHttpsForKnownHosts(requested);
      }
      // Local Kestrel is HTTP-only on :5000 — never upgrade LAN http → https.
      if (isLocalDevHostname(req.hostname)) {
        return requested;
      }
      if (req.protocol === "https:" && rep.protocol === "http:") {
        return requested;
      }
      if (req.protocol === "http:" && rep.protocol === "https:") {
        return reported;
      }
    }
  } catch {
    // fall through
  }

  return requested;
}

function extractHostname(input: string): string | null {
  try {
    return new URL(normalizeApiBaseUrl(input)).hostname.toLowerCase();
  } catch {
    const cleaned = input.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0] ?? "";
    return cleaned || null;
  }
}

export function isLoopbackApiBaseUrl(input: string | null | undefined): boolean {
  if (!input?.trim()) return true;
  const host = extractHostname(input);
  if (!host) return true;
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "0.0.0.0" ||
    host === "10.0.2.2"
  );
}

export function isPrivateLanApiBaseUrl(input: string | null | undefined): boolean {
  if (!input?.trim()) return false;
  // Never treat public OpenSky hosts as LAN — even if the URL was previously malformed.
  if (isOpenSkyProductionHost(input) || /openskyhrm\.com/i.test(input)) {
    return false;
  }
  const host = extractHostname(input);
  if (!host) return false;
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "0.0.0.0" ||
    host === "10.0.2.2"
  ) {
    return true;
  }
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  return false;
}

/** Candidate bases to try when connecting (HTTPS first for production hosts). */
export function buildConnectionCandidates(raw: string): string[] {
  const primary = normalizeApiBaseUrl(raw);
  const candidates = [primary];
  try {
    const parsed = new URL(primary);
    const httpsUrl = `https://${parsed.host}`.replace(/\/+$/, "");
    const httpUrl = `http://${parsed.host}`.replace(/\/+$/, "");
    if (isOpenSkyProductionHost(primary)) {
      candidates.length = 0;
      candidates.push(httpsUrl, httpUrl);
    } else if (isLocalDevHostname(parsed.hostname)) {
      // Local Kestrel HTTP profile has no TLS on :5000. Only try HTTPS when the
      // user/QR already asked for it, or when using the https launch port (:5001).
      candidates.length = 0;
      if (parsed.protocol === "https:" || parsed.port === "5001") {
        candidates.push(httpsUrl, httpUrl);
      } else {
        candidates.push(httpUrl);
      }
    }
  } catch {
    // keep primary only
  }
  return [...new Set(candidates)];
}

/**
 * When Expo web runs on localhost, prefer loopback HTTP for local/LAN API URLs.
 * Avoids stale NIC IPs from QR/PublicApiBaseUrl and HTTPS-without-cert failures.
 */
export function resolveRuntimeApiBaseUrl(apiBaseUrl: string): string {
  const normalized = normalizeApiBaseUrl(apiBaseUrl);
  if (typeof window === "undefined") return normalized;

  try {
    const pageHost = window.location.hostname.toLowerCase();
    const pageIsLoopback =
      pageHost === "localhost" || pageHost === "127.0.0.1" || pageHost === "::1";
    if (!pageIsLoopback) return normalized;
    if (isOpenSkyProductionHost(normalized)) return normalized;
    if (!isLoopbackApiBaseUrl(normalized) && !isPrivateLanApiBaseUrl(normalized)) {
      return normalized;
    }

    const parsed = new URL(normalized);
    const port = parsed.port;
    const protocol = parsed.protocol === "https:" && port === "5001" ? "https:" : "http:";
    const authority = port ? `localhost:${port}` : "localhost";
    return `${protocol}//${authority}${parsed.pathname}`.replace(/\/+$/, "");
  } catch {
    return normalized;
  }
}

export function parseConnectionPayload(raw: string): MobileConnectionInfo {
  const trimmed = raw.trim();

  if (trimmed.startsWith(`${APP_SCHEME}://`)) {
    const parsed = new URL(trimmed);
    const apiBaseUrl = parsed.searchParams.get("u");
    const companyName = parsed.searchParams.get("c") ?? "OpenSky HRM";
    const companyLogoUrl = parsed.searchParams.get("l");
    const companyId = parsed.searchParams.get("id") ?? "default";
    if (!apiBaseUrl) throw new Error("Invalid QR code: missing backend URL.");
    return {
      apiBaseUrl: normalizeApiBaseUrl(apiBaseUrl),
      companyName,
      companyLogoUrl,
      companyId,
    };
  }

  if (trimmed.startsWith("{")) {
    const json = JSON.parse(trimmed) as Partial<MobileConnectionInfo>;
    if (!json.apiBaseUrl) throw new Error("Invalid QR JSON: missing apiBaseUrl.");
    return {
      apiBaseUrl: normalizeApiBaseUrl(json.apiBaseUrl),
      companyName: json.companyName ?? "OpenSky HRM",
      companyLogoUrl: json.companyLogoUrl ?? null,
      companyId: json.companyId ?? "default",
    };
  }

  return {
    apiBaseUrl: normalizeApiBaseUrl(trimmed),
    companyName: "OpenSky HRM",
    companyLogoUrl: null,
    companyId: "default",
  };
}

export function buildAssetUrl(baseUrl: string, path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${baseUrl.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}
