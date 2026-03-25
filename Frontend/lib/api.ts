import { API_BASE_URL } from "@/config/constants";

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("auth_token");
}

export async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error(
      `Cannot reach API at ${API_BASE_URL}. Set NEXT_PUBLIC_API_URL and ensure the backend is running.`
    );
  }

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("auth_token");
      window.location.href = "/login";
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
  return res.json();
}
