import { create } from "zustand";
import { STORAGE_KEYS } from "@/config/constants";
import { getSecureItem, setSecureItem, deleteSecureItem } from "@/utils/storage";
import { normalizeApiBaseUrl } from "@/utils/connect";

interface ConfigState {
  apiBaseUrl: string | null;
  companyName: string;
  companyLogoUrl: string | null;
  companyId: string;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setConnection: (input: {
    apiBaseUrl: string;
    companyName: string;
    companyLogoUrl?: string | null;
    companyId?: string;
  }) => Promise<void>;
  clearConnection: () => Promise<void>;
}

export const useConfigStore = create<ConfigState>((set) => ({
  apiBaseUrl: null,
  companyName: "OpenSky HRM",
  companyLogoUrl: null,
  companyId: "default",
  hydrated: false,

  hydrate: async () => {
    const [apiBaseUrl, companyName, companyLogoUrl] = await Promise.all([
      getSecureItem(STORAGE_KEYS.API_BASE_URL),
      getSecureItem(STORAGE_KEYS.COMPANY_NAME),
      getSecureItem(STORAGE_KEYS.COMPANY_LOGO_URL),
    ]);
    set({
      apiBaseUrl,
      companyName: companyName ?? "OpenSky HRM",
      companyLogoUrl,
      hydrated: true,
    });
  },

  setConnection: async ({ apiBaseUrl, companyName, companyLogoUrl, companyId }) => {
    const normalized = normalizeApiBaseUrl(apiBaseUrl);
    await setSecureItem(STORAGE_KEYS.API_BASE_URL, normalized);
    await setSecureItem(STORAGE_KEYS.COMPANY_NAME, companyName);
    if (companyLogoUrl) {
      await setSecureItem(STORAGE_KEYS.COMPANY_LOGO_URL, companyLogoUrl);
    } else {
      await deleteSecureItem(STORAGE_KEYS.COMPANY_LOGO_URL);
    }
    set({
      apiBaseUrl: normalized,
      companyName,
      companyLogoUrl: companyLogoUrl ?? null,
      companyId: companyId ?? "default",
    });
  },

  clearConnection: async () => {
    await deleteSecureItem(STORAGE_KEYS.API_BASE_URL);
    await deleteSecureItem(STORAGE_KEYS.COMPANY_NAME);
    await deleteSecureItem(STORAGE_KEYS.COMPANY_LOGO_URL);
    set({
      apiBaseUrl: null,
      companyName: "OpenSky HRM",
      companyLogoUrl: null,
      companyId: "default",
    });
  },
}));
