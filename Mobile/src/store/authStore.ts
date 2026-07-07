import { create } from "zustand";
import { router } from "expo-router";
import { STORAGE_KEYS } from "@/config/constants";
import type { AuthResponse, UserProfile } from "@/types/auth";
import { getSecureItem, setSecureItem, deleteSecureItem } from "@/utils/storage";
import { isTokenExpired } from "@/utils/jwt";
import * as authApi from "@/api/endpoints/auth";

interface AuthState {
  token: string | null;
  expiresAt: string | null;
  user: UserProfile | null;
  hydrated: boolean;
  isAuthenticating: boolean;
  hydrate: () => Promise<void>;
  login: (username: string, password: string) => Promise<AuthResponse>;
  refreshProfile: () => Promise<UserProfile>;
  logout: (redirect?: boolean) => Promise<void>;
  setSession: (response: AuthResponse) => Promise<void>;
  handleUnauthorized: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  expiresAt: null,
  user: null,
  hydrated: false,
  isAuthenticating: false,

  hydrate: async () => {
    const [token, expiresAt] = await Promise.all([
      getSecureItem(STORAGE_KEYS.AUTH_TOKEN),
      getSecureItem(STORAGE_KEYS.AUTH_EXPIRES_AT),
    ]);

    if (isTokenExpired(token, expiresAt)) {
      await get().logout(false);
      set({ hydrated: true });
      return;
    }

    set({ token, expiresAt, hydrated: true });

    if (token) {
      try {
        const user = await authApi.getMe();
        set({ user });
      } catch {
        await get().logout(false);
      }
    }
  },

  setSession: async (response) => {
    await setSecureItem(STORAGE_KEYS.AUTH_TOKEN, response.token);
    await setSecureItem(STORAGE_KEYS.AUTH_EXPIRES_AT, response.expiresAt);
    set({
      token: response.token,
      expiresAt: response.expiresAt,
      user: response.user,
    });
  },

  login: async (username, password) => {
    set({ isAuthenticating: true });
    try {
      const response = await authApi.login({ username, password });
      await get().setSession(response);
      return response;
    } finally {
      set({ isAuthenticating: false });
    }
  },

  refreshProfile: async () => {
    const user = await authApi.getMe();
    set({ user });
    return user;
  },

  logout: async (redirect = true) => {
    await deleteSecureItem(STORAGE_KEYS.AUTH_TOKEN);
    await deleteSecureItem(STORAGE_KEYS.AUTH_EXPIRES_AT);
    set({ token: null, expiresAt: null, user: null });
    if (redirect) {
      router.replace("/(auth)/login");
    }
  },

  handleUnauthorized: async () => {
    await get().logout(true);
  },
}));
