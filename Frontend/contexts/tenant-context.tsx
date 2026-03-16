"use client";

import {
  createContext,
  useContext,
  type ReactNode,
  useMemo,
} from "react";

/**
 * Placeholder tenant context for future multi-tenant support.
 * Will later hold: tenant id, name, theme, feature flags, data scope.
 */
export type TenantInfo = {
  id: string;
  name: string;
  // Future: theme, branding, featureFlags, etc.
};

type TenantContextValue = {
  tenant: TenantInfo | null;
  isLoading: boolean;
};

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({
  children,
  tenant = null,
  isLoading = false,
}: {
  children: ReactNode;
  tenant?: TenantInfo | null;
  isLoading?: boolean;
}) {
  const value = useMemo(
    () => ({ tenant, isLoading }),
    [tenant, isLoading]
  );
  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenantContext(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (ctx === null) {
    return { tenant: null, isLoading: false };
  }
  return ctx;
}
