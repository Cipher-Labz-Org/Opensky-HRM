import { API_BASE_URL, getApiBaseUrl, getAssetBaseUrl, resolveAssetUrl } from "@/config/constants";
import { resolveHttpErrorMessage } from "@/lib/api-errors";

export { getAssetBaseUrl, resolveAssetUrl };

function apiReachabilityHint(): string {
  const base = getApiBaseUrl();
  if (!base) {
    return "On Vercel set API_URL and NEXT_PUBLIC_API_URL to your backend URL and ensure the API is running.";
  }
  return `Set NEXT_PUBLIC_API_URL and ensure the backend is running (${base || API_BASE_URL}).`;
}

/** Abort hanging requests so pages do not spin forever if the API stalls. */
const DEFAULT_API_TIMEOUT_MS = 45_000;

/** Payroll calculate / import can exceed 45s on tenant IIS — match Vercel proxy maxDuration. */
export const PAYROLL_LONG_REQUEST_MS = 300_000;

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("auth_token") ?? sessionStorage.getItem("auth_token");
}

function parseHttpErrorMessage(text: string, status: number, endpoint: string): string {
  try {
    const parsed = JSON.parse(text) as { code?: string; module?: string };
    if (parsed.code === "MODULE_NOT_LICENSED") {
      return `The "${parsed.module ?? "requested"}" module is not licensed for this instance.`;
    }
  } catch {
    /* resolved below */
  }
  return resolveHttpErrorMessage(text, {
    status,
    endpoint,
    backendUrl: getApiBaseUrl() || API_BASE_URL,
  });
}

export type ApiFetchOptions = RequestInit & {
  timeoutMs?: number;
  baseUrl?: string;
  /** When true, 401 does not clear the company session or redirect to /login. */
  skipAuthRedirect?: boolean;
};

function headerRecord(init?: HeadersInit): Record<string, string> {
  const out: Record<string, string> = {};
  if (!init) return out;
  if (init instanceof Headers) {
    init.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  if (Array.isArray(init)) {
    for (const [key, value] of init) out[key] = value;
    return out;
  }
  return { ...init };
}

function hasAuthorizationHeader(headers: Record<string, string>): boolean {
  return Object.keys(headers).some((key) => key.toLowerCase() === "authorization");
}

export class ApiHttpError extends Error {
  readonly status: number;
  readonly endpoint: string;

  constructor(message: string, status: number, endpoint: string) {
    super(message);
    this.name = "ApiHttpError";
    this.status = status;
    this.endpoint = endpoint;
  }
}

export function isMissingApiRoute(err: unknown): boolean {
  if (err instanceof ApiHttpError) return err.status === 404 || err.status === 405;
  const msg = err instanceof Error ? err.message : String(err);
  return /Request failed \(40[45]\)|Method Not Allowed/i.test(msg);
}

export async function apiFetch<T>(
  endpoint: string,
  options?: ApiFetchOptions
): Promise<T> {
  const { timeoutMs = DEFAULT_API_TIMEOUT_MS, baseUrl, skipAuthRedirect, ...fetchInit } = options ?? {};
  const token = getAuthToken();
  const isFormData =
    typeof FormData !== "undefined" && fetchInit.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...headerRecord(fetchInit.headers),
  };

  if (token && !hasAuthorizationHeader(headers)) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const requestBase = (baseUrl ?? getApiBaseUrl()).replace(/\/$/, "");

  let res: Response;
  try {
    res = await fetch(`${requestBase}${endpoint}`, {
      ...fetchInit,
      headers,
      signal: controller.signal,
    });
  } catch (e) {
    const aborted =
      e instanceof DOMException
        ? e.name === "AbortError"
        : e instanceof Error && e.name === "AbortError";
    if (aborted) {
      throw new Error(
        `Request timed out after ${timeoutMs}ms (${endpoint}). Is ${API_BASE_URL} reachable?`
      );
    }
    throw new Error(
      `Cannot reach API. ${apiReachabilityHint()}`
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (res.status === 401) {
    if (!skipAuthRedirect && typeof window !== "undefined") {
      localStorage.removeItem("auth_token");
      sessionStorage.removeItem("auth_token");
      document.cookie = "auth_token=; path=/; max-age=0";
      document.cookie = "auth_ok=; path=/; max-age=0";
      // Avoid redirect loops: login page or parallel 401s must not stack full navigations.
      if (!window.location.pathname.startsWith("/login")) {
        window.location.replace("/login");
      }
    }
    if (skipAuthRedirect) {
      const text = await res.text().catch(() => "");
      throw new ApiHttpError(parseHttpErrorMessage(text, res.status, endpoint), res.status, endpoint);
    }
    throw new Error("Session expired. Please login again.");
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new ApiHttpError(parseHttpErrorMessage(text, res.status, endpoint), res.status, endpoint);
  }

  if (res.status === 204) return undefined as T;

  const bodyText = await res.text();
  const trimmed = bodyText.replace(/^\uFEFF/, "").trim();
  if (!trimmed) return undefined as T;

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    throw new Error(
      `Invalid JSON from API (${endpoint}). First characters: ${trimmed.slice(0, 120)}`
    );
  }
}

/**
 * Like apiFetch for unauthenticated flows (public careers). Does not clear auth or redirect on 401.
 * Still sends Bearer token when present (e.g. HR previewing the public link while logged in).
 */
export async function publicApiFetch<T>(endpoint: string, options?: ApiFetchOptions): Promise<T> {
  const { timeoutMs = DEFAULT_API_TIMEOUT_MS, ...fetchInit } = options ?? {};
  const token = getAuthToken();
  const isFormData =
    typeof FormData !== "undefined" && fetchInit.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(fetchInit?.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${getApiBaseUrl()}${endpoint}`, {
      ...fetchInit,
      headers,
      signal: controller.signal,
    });
  } catch (e) {
    const aborted =
      e instanceof DOMException
        ? e.name === "AbortError"
        : e instanceof Error && e.name === "AbortError";
    if (aborted) {
      throw new Error(
        `Request timed out after ${timeoutMs}ms (${endpoint}). Is ${API_BASE_URL} reachable?`
      );
    }
    throw new Error(
      `Cannot reach API. ${apiReachabilityHint()}`
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new ApiHttpError(parseHttpErrorMessage(text, res.status, endpoint), res.status, endpoint);
  }

  if (res.status === 204) return undefined as T;

  const bodyText = await res.text();
  const trimmed = bodyText.replace(/^\uFEFF/, "").trim();
  if (!trimmed) return undefined as T;

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    throw new Error(
      `Invalid JSON from API (${endpoint}). First characters: ${trimmed.slice(0, 120)}`
    );
  }
}

/** GET binary content (e.g. PDF) with auth. Caller should revoke blob URLs when done. */
export async function apiFetchBlob(endpoint: string, options?: ApiFetchOptions): Promise<Blob> {
  const { timeoutMs = DEFAULT_API_TIMEOUT_MS, baseUrl, ...fetchInit } = options ?? {};
  const token = getAuthToken();
  const headers: Record<string, string> = {
    ...(fetchInit?.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const requestBase = (baseUrl ?? getApiBaseUrl()).replace(/\/$/, "");

  let res: Response;
  try {
    res = await fetch(`${requestBase}${endpoint}`, {
      ...fetchInit,
      headers,
      signal: controller.signal,
    });
  } catch (e) {
    const aborted =
      e instanceof DOMException
        ? e.name === "AbortError"
        : e instanceof Error && e.name === "AbortError";
    if (aborted) {
      throw new Error(`Request timed out after ${timeoutMs}ms (${endpoint}).`);
    }
    throw new Error(`Cannot reach API. ${apiReachabilityHint()}`);
  } finally {
    clearTimeout(timeoutId);
  }

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("auth_token");
      sessionStorage.removeItem("auth_token");
      document.cookie = "auth_token=; path=/; max-age=0";
      document.cookie = "auth_ok=; path=/; max-age=0";
      // Avoid redirect loops: login page or parallel 401s must not stack full navigations.
      if (!window.location.pathname.startsWith("/login")) {
        window.location.replace("/login");
      }
    }
    throw new Error("Session expired. Please login again.");
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new ApiHttpError(
      parseHttpErrorMessage(text, res.status, endpoint),
      res.status,
      endpoint,
    );
  }

  return res.blob();
}
