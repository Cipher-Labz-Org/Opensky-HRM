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

  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

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
      const parsed = JSON.parse(text);
      if (parsed.message) errorMessage = parsed.message;
    } catch { /* use raw text */ }
    throw new Error(errorMessage);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}
