import { useTenantContext } from "@/contexts/tenant-context";

/**
 * Placeholder hook for tenant data.
 * Re-exports tenant context; can later add tenant-specific data fetching.
 */
export function useTenant() {
  const { tenant, isLoading } = useTenantContext();
  return { tenant, isLoading };
}
