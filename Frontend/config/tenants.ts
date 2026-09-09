/**
 * Tenant registry — one entry per company deployment.
 *
 * Backend URLs live in tenant-backends.json (shared with next.config.js).
 * When provisioning a new company:
 *   1. Add hostname → apiUrl in tenant-backends.json
 *   2. Add metadata entry below in TENANT_META
 *   3. Create PostgreSQL DB + IIS site; copy appsettings.Production.*.example.json (e.g. DonAndSon)
 *   4. DNS + Vercel domain
 */

import tenantBackends from "./tenant-backends.json";

export type TenantConfig = {
  companyId: string;
  companyName: string;
  apiUrl: string;
};

/** Per-host display metadata (apiUrl comes from tenant-backends.json). */
const TENANT_META: Record<string, Omit<TenantConfig, "apiUrl">> = {
  "mbkh.openskyhrm.com": {
    companyId: "mbkh",
    companyName: "MBKH",
  },
  "gamma.openskyhrm.com": {
    companyId: "gamma",
    companyName: "Gamma",
  },
  "tasty.openskyhrm.com": {
    companyId: "tasty",
    companyName: "Tasty",
  },
  "donandson.openskyhrm.com": {
    companyId: "donandson",
    companyName: "Don & Son",
  },
  "stagecafe.openskyhrm.com": {
    companyId: "stagecafe",
    companyName: "Stage Cafe",
  },
  "demo.openskyhrm.com": {
    companyId: "demo",
    companyName: "Demo",
  },
  "cipherlabz.openskyhrm.com": {
    companyId: "cipherlabz",
    companyName: "Cipherlabz",
  },
  "nexawave.openskyhrm.com": {
    companyId: "nexawave",
    companyName: "NexaWave",
  },
  "besttrend.openskyhrm.com": {
    companyId: "besttrend",
    companyName: "Best Trend",
  },
  "epic.openskyhrm.com": {
    companyId: "epic",
    companyName: "Epic",
  },
  "rambank.openskyhrm.com": {
    companyId: "rambank",
    companyName: "Rambank",
  },
};

function buildTenants(): Record<string, TenantConfig> {
  const out: Record<string, TenantConfig> = {};
  for (const [host, apiUrl] of Object.entries(tenantBackends)) {
    const meta = TENANT_META[host];
    if (!meta) continue;
    out[host] = { ...meta, apiUrl };
  }
  return out;
}

export const TENANTS: Record<string, TenantConfig> = buildTenants();

/** Strip www. so www.mbkh.openskyhrm.com resolves like mbkh.openskyhrm.com */
function normalizeHostname(hostname: string): string {
  const h = hostname.toLowerCase().split(":")[0];
  return h.startsWith("www.") ? h.slice(4) : h;
}

export function getTenantByHostname(hostname: string): TenantConfig | null {
  return TENANTS[normalizeHostname(hostname)] ?? null;
}

export function isKnownTenant(hostname: string): boolean {
  return normalizeHostname(hostname) in TENANTS;
}

/**
 * IIS backend base URL for a company hostname.
 * 1. Explicit entry in tenant-backends.json (+ TENANT_META)
 * 2. Convention: {slug}.openskyhrm.com → https://{slug}backend.openskyhrm.com
 */
export function getBackendUrlForHostname(hostname: string): string | null {
  const normalized = normalizeHostname(hostname);
  const tenant = TENANTS[normalized];
  if (tenant) return tenant.apiUrl.replace(/\/$/, "");

  const match = /^([a-z0-9-]+)\.openskyhrm\.com$/i.exec(normalized);
  if (!match) return null;

  const slug = match[1].toLowerCase();
  if (slug === "www" || slug === "app" || slug === "api") return null;

  return `https://${slug}backend.openskyhrm.com`;
}

/**
 * HTTP-only IIS backends cannot be called from the HTTPS frontend (mixed content).
 * Route browser traffic through same-origin Vercel proxy handlers instead.
 */
export function tenantBackendRequiresBrowserProxy(hostname: string): boolean {
  const backend = getBackendUrlForHostname(hostname);
  return backend != null && backend.startsWith("http://");
}
