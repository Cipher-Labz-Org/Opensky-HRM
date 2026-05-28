import { API_BASE_URL, getApiBaseUrl } from "@/config/constants";

function apiReachabilityHint(): string {
  const base = getApiBaseUrl();
  if (!base) {
    return "On Vercel set API_URL and NEXT_PUBLIC_API_URL to your backend URL and ensure the API is running.";
  }
  return `Set NEXT_PUBLIC_API_URL and ensure the backend is running (${base || API_BASE_URL}).`;
}

/** Abort hanging requests so pages do not spin forever if the API stalls. */
const DEFAULT_API_TIMEOUT_MS = 45_000;

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("auth_token");
}

export type ApiFetchOptions = RequestInit & { timeoutMs?: number };

export async function apiFetch<T>(
  endpoint: string,
  options?: ApiFetchOptions
): Promise<T> {
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

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("auth_token");
      document.cookie = "auth_token=; path=/; max-age=0";
      // Avoid redirect loops: login page or parallel 401s must not stack full navigations.
      if (!window.location.pathname.startsWith("/login")) {
        window.location.replace("/login");
      }
    }
    throw new Error("Session expired. Please login again.");
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    let errorMessage = `API ${res.status}: ${text}`;
    try {
      const parsed = JSON.parse(text) as {
        message?: string;
        title?: string;
        detail?: string;
        code?: string;
        module?: string;
      };
      if (parsed.code === "MODULE_NOT_LICENSED") {
        errorMessage = `The "${parsed.module ?? "requested"}" module is not licensed for this instance.`;
      } else if (typeof parsed.message === "string") errorMessage = parsed.message;
      else if (typeof parsed.detail === "string") errorMessage = parsed.detail;
      else if (typeof parsed.title === "string") errorMessage = parsed.title;
    } catch {
      /* use raw text */
    }
    if (res.status === 404 && !text?.trim()) {
      errorMessage = `API 404: no route for ${endpoint}. Restart the API after pulling changes, or set NEXT_PUBLIC_API_URL to your API (using ${API_BASE_URL}).`;
    }
    throw new Error(errorMessage);
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
    let errorMessage = `API ${res.status}: ${text}`;
    try {
      const parsed = JSON.parse(text) as {
        message?: string;
        title?: string;
        detail?: string;
        code?: string;
        module?: string;
      };
      if (parsed.code === "MODULE_NOT_LICENSED") {
        errorMessage = `The "${parsed.module ?? "requested"}" module is not licensed for this instance.`;
      } else if (typeof parsed.message === "string") errorMessage = parsed.message;
      else if (typeof parsed.detail === "string") errorMessage = parsed.detail;
      else if (typeof parsed.title === "string") errorMessage = parsed.title;
    } catch {
      /* use raw text */
    }
    if (res.status === 404 && !text?.trim()) {
      errorMessage = `API 404: no route for ${endpoint}. Restart the API after pulling changes, or set NEXT_PUBLIC_API_URL to your API (using ${API_BASE_URL}).`;
    }
    throw new Error(errorMessage);
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
  const { timeoutMs = DEFAULT_API_TIMEOUT_MS, ...fetchInit } = options ?? {};
  const token = getAuthToken();
  const headers: Record<string, string> = {
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
      throw new Error(`Request timed out after ${timeoutMs}ms (${endpoint}).`);
    }
    throw new Error(`Cannot reach API. ${apiReachabilityHint()}`);
  } finally {
    clearTimeout(timeoutId);
  }

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("auth_token");
      document.cookie = "auth_token=; path=/; max-age=0";
      // Avoid redirect loops: login page or parallel 401s must not stack full navigations.
      if (!window.location.pathname.startsWith("/login")) {
        window.location.replace("/login");
      }
    }
    throw new Error("Session expired. Please login again.");
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new Error(`API ${res.status}: ${text.slice(0, 300)}`);
  }

  return res.blob();
}
