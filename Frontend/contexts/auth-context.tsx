"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import {
  API_BASE_URL,
  getApiBaseUrl,
  resolveAuthApiPath,
  tenantBackendUrl,
} from "@/config/constants";
import { resolveHttpErrorMessage } from "@/lib/api-errors";
import {
  getLeaveRequestsReadScope,
  getModuleReadScope,
  type RbacScope,
} from "@/lib/permission-scopes";

const PROFILE_FETCH_MS = 25_000;
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
  assignedBusinessUnitIds?: string[];
  assignedGradeIds?: string[];
  assignedJobTitleIds?: string[];
  assignedCompanyProfileKeys?: string[];
  /** When true, app layout forces password change before other pages. */
  mustChangePassword?: boolean;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<UserProfile>;
  logout: () => void;
  /** Reload /api/auth/me (e.g. after licensing changes). */
  refreshProfile: () => Promise<void>;
  hasPermission: (module: string, action: string) => boolean;
  getPeopleReadScope: () => RbacScope | null;
  getLeaveReadScope: () => RbacScope | null;
  getApprovalsReadScope: () => RbacScope | null;
  /** Broadest scope for leave request / Approvals workspace lists (Leave ∪ Approvals Read). */
  getLeaveRequestsReadScope: () => RbacScope | null;
  /** Read scope for any RBAC module row (People, EmployeeBio, Attendance, …). */
  getModuleReadScope: (module: string) => RbacScope | null;
  hasRole: (roleCode: string) => boolean;
  isAdmin: boolean;
  /** True when the user has any People dimension scope (location, BU, grade, or job catalog). */
  hasPeopleDimensionRestrictions: () => boolean;
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
  getApprovalsReadScope: () => null,
  getLeaveRequestsReadScope: () => null,
  getModuleReadScope: () => null,
  hasRole: () => false,
  isAdmin: false,
  hasPeopleDimensionRestrictions: () => false,
});

const AUTH_TOKEN_KEY = "auth_token";
/** Cached profile from login / last successful /me — avoids blocking the app shell on cold load. */
const AUTH_USER_KEY = "auth_user";
/** Small marker for Next.js middleware. JWTs with permissions exceed the ~4KB cookie limit. */
const AUTH_OK_COOKIE = "auth_ok";
/** Rotates on each login; stable across refresh within the same browser session. */
export const AUTH_VISIT_ID_KEY = "opensky:auth-visit-id";

function writeAuthSessionCookie(rememberMe: boolean) {
  // Drop any leftover JWT cookie so an oversized Cookie header cannot block auth_ok.
  document.cookie = `${AUTH_TOKEN_KEY}=; path=/; max-age=0`;
  const maxAge = rememberMe ? `; max-age=${8 * 60 * 60}` : "";
  document.cookie = `${AUTH_OK_COOKIE}=1; path=/; samesite=lax${maxAge}`;
}

function clearAuthBrowserCookies() {
  document.cookie = `${AUTH_TOKEN_KEY}=; path=/; max-age=0`;
  document.cookie = `${AUTH_OK_COOKIE}=; path=/; max-age=0`;
}

function ensureAuthVisitId() {
  if (typeof window === "undefined") return;
  if (!sessionStorage.getItem(AUTH_VISIT_ID_KEY)) {
    sessionStorage.setItem(
      AUTH_VISIT_ID_KEY,
      `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
    );
  }
}

function rotateAuthVisitId() {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(
    AUTH_VISIT_ID_KEY,
    `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
  );
}

function readStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AUTH_TOKEN_KEY) ?? sessionStorage.getItem(AUTH_TOKEN_KEY);
}

function authUsesLocalStorage(): boolean {
  return typeof window !== "undefined" && Boolean(localStorage.getItem(AUTH_TOKEN_KEY));
}

function readStoredProfile(): UserProfile | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(AUTH_USER_KEY) ?? sessionStorage.getItem(AUTH_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

function persistAuthToken(token: string, rememberMe: boolean) {
  if (rememberMe) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
  } else {
    sessionStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }
  writeAuthSessionCookie(rememberMe);
}

function persistAuthProfile(user: UserProfile, rememberMe: boolean) {
  const json = JSON.stringify(user);
  if (rememberMe) {
    localStorage.setItem(AUTH_USER_KEY, json);
    sessionStorage.removeItem(AUTH_USER_KEY);
  } else {
    sessionStorage.setItem(AUTH_USER_KEY, json);
    localStorage.removeItem(AUTH_USER_KEY);
  }
}

function clearStoredProfile() {
  localStorage.removeItem(AUTH_USER_KEY);
  sessionStorage.removeItem(AUTH_USER_KEY);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  /** Bumps on each bootstrap run so stale Strict-Mode / duplicate fetches cannot clear session or toggle loading. */
  const authBootstrapId = useRef(0);

  const clearAuth = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    clearStoredProfile();
    clearAuthBrowserCookies();
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
    const onErpSession = (event: MessageEvent) => {
      const data = event.data as { type?: string; token?: string; user?: UserProfile } | null;
      if (!data || data.type !== "opensky-erp-session" || !data.token || !data.user) return;
      let allowed = false;
      try {
        const origin = new URL(event.origin);
        const host = origin.hostname;
        allowed =
          origin.port === "5173" &&
          (host === "localhost" ||
            host === "127.0.0.1" ||
            host.startsWith("192.168.") ||
            host.startsWith("10."));
      } catch {
        allowed = false;
      }
      if (!allowed) return;
      persistAuthToken(data.token, true);
      persistAuthProfile(data.user, true);
      ensureAuthVisitId();
      setToken(data.token);
      setUser(data.user);
      setIsLoading(false);
    };
    window.addEventListener("message", onErpSession);
    return () => window.removeEventListener("message", onErpSession);
  }, []);

  useEffect(() => {
    const embedded =
      typeof window !== "undefined" &&
      (new URLSearchParams(window.location.search).get("embed") === "1" ||
        sessionStorage.getItem("opensky-erp-embed") === "1");
    if (embedded) {
      // ERP parent supplies the session via postMessage — ignore stale HRM tokens from standalone dev.
      localStorage.removeItem(AUTH_TOKEN_KEY);
      sessionStorage.removeItem(AUTH_TOKEN_KEY);
      clearStoredProfile();
      clearAuthBrowserCookies();
      setUser(null);
      setToken(null);
      setIsLoading(false);
      return;
    }

    const stored = readStoredToken();
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
    writeAuthSessionCookie(authUsesLocalStorage());

    const cachedProfile = readStoredProfile();
    if (cachedProfile) {
      ensureAuthVisitId();
      setUser(cachedProfile);
      setIsLoading(false);
    }

    const bootstrapId = ++authBootstrapId.current;
    fetchProfile(stored)
      .then((profile) => {
        if (bootstrapId !== authBootstrapId.current) return;
        if (profile) {
          ensureAuthVisitId();
          setUser(profile);
          persistAuthProfile(profile, authUsesLocalStorage());
        } else if (!cachedProfile) {
          clearAuth();
        }
      })
      .finally(() => {
        if (bootstrapId === authBootstrapId.current && !cachedProfile) setIsLoading(false);
      });
  }, [fetchProfile, clearAuth]);

  const refreshProfile = useCallback(async () => {
    const t = token ?? readStoredToken();
    if (!t) return;
    const profile = await fetchProfile(t);
    if (profile) {
      setUser(profile);
      persistAuthProfile(profile, authUsesLocalStorage());
    }
  }, [fetchProfile, token]);

  const login = async (username: string, password: string, rememberMe = true): Promise<UserProfile> => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), LOGIN_FETCH_MS);
    let res: Response;
    try {
      const loginUrl = resolveAuthApiPath("/api/auth/login");
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
        const backend = tenantBackendUrl() || API_BASE_URL || getApiBaseUrl();
        throw new Error(
          backend
            ? `Login request timed out after ${LOGIN_FETCH_MS / 1000}s. Check that the API is running at ${backend} (open ${backend}/health in a browser).`
            : `Login request timed out after ${LOGIN_FETCH_MS / 1000}s. The frontend could not reach the HR API. On Vercel set API_URL and NEXT_PUBLIC_API_URL to your backend (e.g. https://gammabackend.openskyhrm.com) and ensure that host responds to /health.`
        );
      }
      const backend = tenantBackendUrl() || API_BASE_URL || getApiBaseUrl();
      throw new Error(
        backend
          ? `Cannot reach the HR API at ${backend}. Open ${backend}/health — HTTP 500.30 means that IIS site failed to start. Recycle that site's app pool (not another company's), keep that tenant's own appsettings.json, and set Load User Profile = True.`
          : "Cannot reach the HR API. On Vercel set API_URL and NEXT_PUBLIC_API_URL to your backend URL and redeploy."
      );
    } finally {
      window.clearTimeout(timeoutId);
    }

    const text = await res.text();
    if (!res.ok) {
      throw new Error(
        resolveHttpErrorMessage(text, {
          status: res.status,
          endpoint: "/api/auth/login",
          backendUrl: tenantBackendUrl() || getApiBaseUrl() || API_BASE_URL,
        }),
      );
    }

    let data: { token: string; user: UserProfile };
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Invalid response from server.");
    }
    persistAuthToken(data.token, rememberMe);
    persistAuthProfile(data.user, rememberMe);
    rotateAuthVisitId();
    setToken(data.token);
    setUser(data.user);
    setIsLoading(false);
    return data.user;
  };

  const logout = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("opensky:before-logout"));
      sessionStorage.removeItem(AUTH_VISIT_ID_KEY);
    }
    clearAuth();
    window.location.href = "/login";
  };

  const hasPermission = (module: string, action: string): boolean => {
    if (!user) return false;
    if (roleListMatches(user.roles, "ADMIN")) return true;
    return user.permissions.some((p) => p.module === module && p.action === action);
  };

  const getPeopleReadScope = (): RbacScope | null => {
    if (!user) return null;
    if (roleListMatches(user.roles, "ADMIN")) return "All";
    return getModuleReadScope(user.permissions, "People");
  };

  const getLeaveReadScope = (): RbacScope | null => {
    if (!user) return null;
    if (roleListMatches(user.roles, "ADMIN")) return "All";
    return getModuleReadScope(user.permissions, "Leave");
  };

  const getApprovalsReadScope = (): RbacScope | null => {
    if (!user) return null;
    if (roleListMatches(user.roles, "ADMIN")) return "All";
    return getModuleReadScope(user.permissions, "Approvals");
  };

  const getLeaveRequestsReadScopeFn = (): RbacScope | null => {
    if (!user) return null;
    if (roleListMatches(user.roles, "ADMIN")) return "All";
    return getLeaveRequestsReadScope(user.permissions);
  };

  const getModuleReadScopeFn = (module: string): RbacScope | null => {
    if (!user) return null;
    if (roleListMatches(user.roles, "ADMIN")) return "All";
    return getModuleReadScope(user.permissions, module);
  };

  const hasRole = (roleCode: string): boolean => {
    if (!user) return false;
    return roleListMatches(user.roles, roleCode);
  };

  const isAdmin = user ? roleListMatches(user.roles, "ADMIN") : false;

  const hasPeopleDimensionRestrictions = (): boolean => {
    if (!user) return false;
    return (
      (user.assignedLocationIds?.length ?? 0) > 0
      || (user.assignedBusinessUnitIds?.length ?? 0) > 0
      || (user.assignedGradeIds?.length ?? 0) > 0
      || (user.assignedJobTitleIds?.length ?? 0) > 0
      || (user.assignedCompanyProfileKeys?.length ?? 0) > 0
    );
  };

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
        getApprovalsReadScope,
        getLeaveRequestsReadScope: getLeaveRequestsReadScopeFn,
        getModuleReadScope: getModuleReadScopeFn,
        hasRole,
        isAdmin,
        hasPeopleDimensionRestrictions,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
