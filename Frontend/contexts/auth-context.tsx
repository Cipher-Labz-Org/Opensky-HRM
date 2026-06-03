"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { API_BASE_URL, getApiBaseUrl } from "@/config/constants";

const PROFILE_FETCH_MS = 10_000;
const LOGIN_FETCH_MS = 20_000;

/** Match role codes and display names returned by different API shapes / legacy data. */
const ROLE_ALIASES: Record<string, readonly string[]> = {
  ADMIN: ["ADMIN", "Admin"],
  HR_MANAGER: ["HR_MANAGER", "HR Manager"],
  SUPERVISOR: ["SUPERVISOR", "Supervisor"],
  EMPLOYEE: ["EMPLOYEE", "Employee"],
};

function roleListMatches(userRoles: string[], roleCode: string): boolean {
  const key = roleCode.trim().toUpperCase();
  const aliases = ROLE_ALIASES[key] ?? [roleCode];
  const want = new Set(aliases.map((a) => a.trim().toLowerCase()));
  return userRoles.some((r) => want.has(r.trim().toLowerCase()));
}

/** Best-effort JWT `exp` read; false = not clearly expired (validate with API). */
function isBearerTokenExpired(token: string): boolean {
  try {
    const segment = token.split(".")[1];
    if (!segment) return false;
    const b64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64.padEnd(Math.ceil(b64.length / 4) * 4, "=");
    const payload = JSON.parse(atob(padded)) as { exp?: unknown };
    if (typeof payload.exp !== "number") return false;
    return payload.exp * 1000 <= Date.now();
  } catch {
    return false;
  }
}

interface PermissionInfo {
  module: string;
  action: string;
  scope: string;
}

interface UserProfile {
  id: string;
  username: string;
  email: string;
  isActive: boolean;
  employeeId: string | null;
  employeeName: string | null;
  profileImageUrl: string | null;
  roles: string[];
  permissions: PermissionInfo[];
  /** Instance entitlements from the API (empty/omitted treated as unrestricted for older clients). */
  licensedModules?: string[];
  /** When set and non-empty, People APIs limit this user to employees at these work locations. */
  assignedLocationIds?: string[];
  /** When true, app layout forces password change before other pages. */
  mustChangePassword?: boolean;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<UserProfile>;
  logout: () => void;
  /** Reload /api/auth/me (e.g. after licensing changes). */
  refreshProfile: () => Promise<void>;
  hasPermission: (module: string, action: string) => boolean;
  getPeopleReadScope: () => "Own" | "Team" | "All" | null;
  getLeaveReadScope: () => "Own" | "Team" | "All" | null;
  hasRole: (roleCode: string) => boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => {
    throw new Error("AuthProvider not mounted");
  },
  logout: () => {},
  refreshProfile: async () => {},
  hasPermission: () => false,
  getPeopleReadScope: () => null,
  getLeaveReadScope: () => null,
  hasRole: () => false,
  isAdmin: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  /** Bumps on each bootstrap run so stale Strict-Mode / duplicate fetches cannot clear session or toggle loading. */
  const authBootstrapId = useRef(0);

  const clearAuth = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("auth_token");
    document.cookie = "auth_token=; path=/; max-age=0";
  }, []);

  const fetchProfile = useCallback(async (authToken: string): Promise<UserProfile | null> => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), PROFILE_FETCH_MS);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` },
        signal: controller.signal,
      });
      if (!res.ok) return null;
      const bodyText = await res.text();
      const trimmed = bodyText.replace(/^\uFEFF/, "").trim();
      if (!trimmed) return null;
      try {
        return JSON.parse(trimmed) as UserProfile;
      } catch {
        return null;
      }
    } catch (e) {
      const aborted =
        e instanceof DOMException
          ? e.name === "AbortError"
          : e instanceof Error && e.name === "AbortError";
      if (aborted) return null;
      return null;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("auth_token");
    if (!stored) {
      setIsLoading(false);
      return;
    }
    if (isBearerTokenExpired(stored)) {
      clearAuth();
      setIsLoading(false);
      return;
    }
    setToken(stored);
    // Middleware gates `/app/*` on this cookie; localStorage alone would loop: /login → /app → /login.
    document.cookie = `auth_token=${stored}; path=/; max-age=${8 * 60 * 60}; samesite=lax`;

    const bootstrapId = ++authBootstrapId.current;
    fetchProfile(stored)
      .then((profile) => {
        if (bootstrapId !== authBootstrapId.current) return;
        if (profile) {
          setUser(profile);
        } else {
          clearAuth();
        }
      })
      .finally(() => {
        if (bootstrapId === authBootstrapId.current) setIsLoading(false);
      });
  }, [fetchProfile, clearAuth]);

  const refreshProfile = useCallback(async () => {
    const t = token ?? localStorage.getItem("auth_token");
    if (!t) return;
    const profile = await fetchProfile(t);
    if (profile) setUser(profile);
  }, [fetchProfile, token]);

  const login = async (username: string, password: string): Promise<UserProfile> => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), LOGIN_FETCH_MS);
    let res: Response;
    try {
      const apiBase = getApiBaseUrl().replace(/\/$/, "");
      const loginUrl = apiBase ? `${apiBase}/api/auth/login` : "/api/auth/login";
      res = await fetch(loginUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        signal: controller.signal,
      });
    } catch (e) {
      const aborted =
        e instanceof DOMException
          ? e.name === "AbortError"
          : e instanceof Error && e.name === "AbortError";
      if (aborted) {
        throw new Error(
          API_BASE_URL
            ? `Login request timed out after ${LOGIN_FETCH_MS / 1000}s. Check that the API is running and NEXT_PUBLIC_API_URL points to it (${API_BASE_URL}).`
            : `Login request timed out after ${LOGIN_FETCH_MS / 1000}s. The frontend could not reach the HR API via /api/auth/login. On Vercel set API_URL and NEXT_PUBLIC_API_URL to your backend (e.g. https://gammabackend.openskyhrm.com) and ensure that host responds to /health.`
        );
      }
      throw new Error(
        API_BASE_URL
          ? `Cannot reach API at ${API_BASE_URL}. Set NEXT_PUBLIC_API_URL and ensure the backend is running.`
          : "Cannot reach the HR API. On Vercel set API_URL and NEXT_PUBLIC_API_URL to your backend URL and redeploy."
      );
    } finally {
      window.clearTimeout(timeoutId);
    }

    const text = await res.text();
    if (!res.ok) {
      let msg = "Login failed";
      if (/42P01|relation ["']?Instanc/i.test(text)) {
        msg =
          "Database is missing licensing tables. From the Backend folder run: dotnet ef database update --project OpenSkyHRM.Persistence --startup-project OpenSkyHRM.Api, then restart the API.";
      } else {
        try {
          const errBody = JSON.parse(text) as { message?: string; detail?: string; title?: string };
          msg = errBody.message || errBody.title || msg;
          const detail = errBody.detail;
          if (
            detail &&
            detail.length < 280 &&
            !/Npgsql\.| at |\n|Exception \(0x/i.test(detail) &&
            (msg === "Login failed" ||
              /sign-in failed|database|migration|schema/i.test(msg))
          ) {
            msg = `${msg} ${detail}`.trim();
          }
        } catch {
          if (text.trim()) msg = text.trim().slice(0, 200);
        }
      }
      throw new Error(msg || "Invalid credentials");
    }

    let data: { token: string; user: UserProfile };
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Invalid response from server.");
    }
    localStorage.setItem("auth_token", data.token);
    document.cookie = `auth_token=${data.token}; path=/; max-age=${8 * 60 * 60}; samesite=lax`;
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    clearAuth();
    window.location.href = "/login";
  };

  const hasPermission = (module: string, action: string): boolean => {
    if (!user) return false;
    if (roleListMatches(user.roles, "ADMIN")) return true;
    return user.permissions.some((p) => p.module === module && p.action === action);
  };

  const getPeopleReadScope = (): "Own" | "Team" | "All" | null => {
    if (!user) return null;
    if (roleListMatches(user.roles, "ADMIN")) return "All";
    const p = user.permissions.find((x) => x.module === "People" && x.action === "Read");
    if (!p) return null;
    const scope = p.scope ?? "Own";
    if (scope === "Team" || scope === "All") return scope;
    return "Own";
  };

  const getLeaveReadScope = (): "Own" | "Team" | "All" | null => {
    if (!user) return null;
    if (roleListMatches(user.roles, "ADMIN")) return "All";
    const leaveReadPerms = user.permissions.filter((x) => x.module === "Leave" && x.action === "Read");
    if (leaveReadPerms.length === 0) return null;
    // Prefer highest scope when user has multiple roles (e.g. Employee + Supervisor)
    if (leaveReadPerms.some((p) => (p.scope ?? "Own") === "All")) return "All";
    if (leaveReadPerms.some((p) => (p.scope ?? "Own") === "Team")) return "Team";
    return "Own";
  };

  const hasRole = (roleCode: string): boolean => {
    if (!user) return false;
    return roleListMatches(user.roles, roleCode);
  };

  const isAdmin = user ? roleListMatches(user.roles, "ADMIN") : false;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        login,
        logout,
        refreshProfile,
        hasPermission,
        getPeopleReadScope,
        getLeaveReadScope,
        hasRole,
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
