"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { API_BASE_URL } from "@/config/constants";

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
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
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
  login: async () => {},
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

  const clearAuth = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("auth_token");
    document.cookie = "auth_token=; path=/; max-age=0";
  }, []);

  const fetchProfile = useCallback(async (authToken: string): Promise<UserProfile | null> => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("auth_token");
    if (!stored) {
      setIsLoading(false);
      return;
    }
    setToken(stored);
    fetchProfile(stored).then((profile) => {
      if (profile) {
        setUser(profile);
      } else {
        clearAuth();
      }
      setIsLoading(false);
    });
  }, [fetchProfile, clearAuth]);

  const refreshProfile = useCallback(async () => {
    const t = token ?? localStorage.getItem("auth_token");
    if (!t) return;
    const profile = await fetchProfile(t);
    if (profile) setUser(profile);
  }, [fetchProfile, token]);

  const login = async (username: string, password: string) => {
    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
    } catch {
      throw new Error(
        `Cannot reach API at ${API_BASE_URL}. Set NEXT_PUBLIC_API_URL and ensure the backend is running.`
      );
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
            msg === "Login failed" &&
            detail &&
            detail.length < 200 &&
            !/Npgsql\.| at |\n|Exception \(0x/i.test(detail)
          ) {
            msg = detail;
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
  };

  const logout = () => {
    clearAuth();
    window.location.href = "/login";
  };

  const hasPermission = (module: string, action: string): boolean => {
    if (!user) return false;
    if (user.roles.includes("ADMIN")) return true;
    return user.permissions.some((p) => p.module === module && p.action === action);
  };

  const getPeopleReadScope = (): "Own" | "Team" | "All" | null => {
    if (!user) return null;
    if (user.roles.includes("ADMIN")) return "All";
    const p = user.permissions.find((x) => x.module === "People" && x.action === "Read");
    if (!p) return null;
    const scope = p.scope ?? "Own";
    if (scope === "Team" || scope === "All") return scope;
    return "Own";
  };

  const getLeaveReadScope = (): "Own" | "Team" | "All" | null => {
    if (!user) return null;
    if (user.roles.includes("ADMIN")) return "All";
    const leaveReadPerms = user.permissions.filter((x) => x.module === "Leave" && x.action === "Read");
    if (leaveReadPerms.length === 0) return null;
    // Prefer highest scope when user has multiple roles (e.g. Employee + Supervisor)
    if (leaveReadPerms.some((p) => (p.scope ?? "Own") === "All")) return "All";
    if (leaveReadPerms.some((p) => (p.scope ?? "Own") === "Team")) return "Team";
    return "Own";
  };

  const hasRole = (roleCode: string): boolean => {
    if (!user) return false;
    return user.roles.includes(roleCode);
  };

  const isAdmin = user?.roles.includes("ADMIN") ?? false;

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
