/**
 * Tenant registry — one entry per company deployment.
 *
 * When provisioning a new company:
 *   1. Add an entry here.
 *   2. Add the same hostname → apiUrl pair to TENANT_BACKENDS in next.config.js.
 *   3. Create the PostgreSQL database & run EF migrations on the IIS server.
 *   4. Add DNS records (subdomain → Vercel, api-subdomain → IIS server).
 *   5. Add the domain in Vercel project settings.
 */

export type TenantConfig = {
  /** Short slug used in logs. E.g. "company1". */
  companyId: string;
  /** Fallback display name when the branding API is unreachable. */
  companyName: string;
  /** Full base URL of this company's IIS backend (no trailing slash). */
  apiUrl: string;
};

export const TENANTS: Record<string, TenantConfig> = {
  // --- Live tenants ---
  "mbkh.openskyhrm.com": {
    companyId: "mbkh",
    companyName: "MBKH",
    apiUrl: "http://mbkhbackend.openskyhrm.com",
  },

  // --- Placeholder examples (replace with real companies when provisioned) ---
  "company1.openskyhrm.com": {
    companyId: "company1",
    companyName: "Company One",
    apiUrl: "https://api-company1.openskyhrm.com",
  },
  "company2.openskyhrm.com": {
    companyId: "company2",
    companyName: "Company Two",
    apiUrl: "https://api-company2.openskyhrm.com",
  },
  "company3.openskyhrm.com": {
    companyId: "company3",
    companyName: "Company Three",
    apiUrl: "https://api-company3.openskyhrm.com",
  },
};

/** Returns the config for a given hostname, or null if unknown. */
export function getTenantByHostname(hostname: string): TenantConfig | null {
  return TENANTS[hostname.toLowerCase()] ?? null;
}

/** True when the hostname is a registered tenant domain. */
export function isKnownTenant(hostname: string): boolean {
  return hostname.toLowerCase() in TENANTS;
}
