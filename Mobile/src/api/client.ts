import { DEFAULT_API_TIMEOUT_MS } from "@/config/constants";
import { useAuthStore } from "@/store/authStore";
import { useConfigStore } from "@/store/configStore";

export type ApiFetchOptions = RequestInit & {
  timeoutMs?: number;
  skipAuth?: boolean;
  baseUrl?: string;
};

function parseErrorMessage(text: string, status: number): string {
  if (!text?.trim()) {
    return status === 401
      ? "Session expired. Please sign in again."
      : `Request failed (${status}).`;
  }
  try {
    const parsed = JSON.parse(text) as {
      message?: string;
      detail?: string;
      title?: string;
      code?: string;
      module?: string;
    };
    if (parsed.code === "MODULE_NOT_LICENSED") {
      return `The "${parsed.module ?? "requested"}" module is not licensed.`;
    }
    return parsed.message ?? parsed.detail ?? parsed.title ?? text;
  } catch {
    return text;
  }
}

export async function apiFetch<T>(endpoint: string, options?: ApiFetchOptions): Promise<T> {
  const { timeoutMs = DEFAULT_API_TIMEOUT_MS, skipAuth = false, baseUrl, ...fetchInit } =
    options ?? {};

  const configBase = useConfigStore.getState().apiBaseUrl;
  const requestBase = (baseUrl ?? configBase)?.replace(/\/+$/, "");
  if (!requestBase) {
    throw new Error("Not connected to a company backend. Scan the QR code first.");
  }

  const token = skipAuth ? null : useAuthStore.getState().token;
  const isFormData =
    typeof FormData !== "undefined" && fetchInit.body instanceof FormData;

  const hasBody = fetchInit.body != null;
  const headers: Record<string, string> = {
    ...(hasBody && !isFormData ? { "Content-Type": "application/json" } : {}),
    ...(fetchInit.headers as Record<string, string>),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${requestBase}${endpoint}`, {
      ...fetchInit,
      headers,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms.`);
    }
    throw new Error("Cannot reach the server. Check your connection and backend URL.");
  } finally {
    clearTimeout(timeoutId);
  }

  if (response.status === 401 && !skipAuth) {
    await useAuthStore.getState().handleUnauthorized();
    throw new Error("Session expired. Please sign in again.");
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(parseErrorMessage(text, response.status));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return (await response.text()) as T;
  }

  return (await response.json()) as T;
}

export function getApiBaseUrl(): string | null {
  return useConfigStore.getState().apiBaseUrl;
}
