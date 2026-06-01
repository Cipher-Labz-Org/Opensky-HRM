"use client";

import {
  createContext,
  useContext,
  type ReactNode,
  useMemo,
  useState,
  useEffect,
} from "react";
import { getTenantByHostname } from "@/config/tenants";

export type TenantInfo = {
  id: string;
  name: string;
  /** Full base URL of this tenant's IIS backend (no trailing slash). */
  apiUrl: string;
};

type TenantContextValue = {
  tenant: TenantInfo | null;
  isLoading: boolean;
};

const TenantContext = createContext<TenantContextValue | null>(null);

/**
 * Resolves the current tenant from the browser hostname on first render.
 * On local dev (localhost / 127.0.0.1) the tenant is null and the app falls
 * back to the standard API_URL / localhost:5000 behaviour.
 */
function useHostnameTenant(): TenantContextValue {
  const [state, setState] = useState<TenantContextValue>({ tenant: null, isLoading: true });

  useEffect(() => {
    const hostname = window.location.hostname.toLowerCase();
    const config = getTenantByHostname(hostname);

    setState({
      tenant: config
        ? { id: config.companyId, name: config.companyName, apiUrl: config.apiUrl }
        : null,
      isLoading: false,
    });
  }, []);

  return state;
}

/**
 * Wraps the subtree with tenant info derived from the browser hostname.
 * Place this in the root layout so all child components can call useTenantContext().
 */
export function TenantProvider({
  children,
  tenant = null,
  isLoading = false,
}: {
  children: ReactNode;
  tenant?: TenantInfo | null;
  isLoading?: boolean;
}) {
  // If an explicit tenant prop is passed (e.g. from a server component), use it;
  // otherwise auto-resolve from the hostname.
  const autoResolved = useHostnameTenant();

  const value = useMemo(
    () =>
      tenant !== null || isLoading
        ? { tenant, isLoading }
        : autoResolved,
    [tenant, isLoading, autoResolved],
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenantContext(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (ctx === null) {
    // Outside a provider — resolve directly from hostname on the client.
    if (typeof window !== "undefined") {
      const config = getTenantByHostname(window.location.hostname);
      if (config) {
        return {
          tenant: { id: config.companyId, name: config.companyName, apiUrl: config.apiUrl },
          isLoading: false,
        };
      }
    }
    return { tenant: null, isLoading: false };
  }
  return ctx;
}
