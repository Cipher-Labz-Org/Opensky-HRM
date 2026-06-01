/** @type {import('next').NextConfig} */
function apiUpstreamBase() {
  const url =
    process.env.API_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    "http://127.0.0.1:5000";
  return url.replace(/\/$/, "");
}

/**
 * Tenant backend URLs for Vercel rewrite rules.
 * Must stay in sync with Frontend/config/tenants.ts (TENANTS map).
 *
 * When adding a new company:
 *   1. Add "subdomain.openskyhrm.com": "https://api-subdomain.openskyhrm.com" here.
 *   2. Add the same entry in Frontend/config/tenants.ts.
 */
const TENANT_BACKENDS = {
  // --- Live tenants ---
  // NEXT_PUBLIC_MBKH_API_URL lets you override this for local testing:
  //   set NEXT_PUBLIC_MBKH_API_URL=http://localhost:5000 in .env.local
  "mbkh.openskyhrm.com":
    process.env.NEXT_PUBLIC_MBKH_API_URL || "http://mbkhbackend.openskyhrm.com",
  "gamma.openskyhrm.com":
    process.env.NEXT_PUBLIC_GAMMA_API_URL || "https://gammabackend.openskyhrm.com",

  // --- Placeholder examples (replace when provisioning new companies) ---
  "company1.openskyhrm.com": "https://api-company1.openskyhrm.com",
  "company2.openskyhrm.com": "https://api-company2.openskyhrm.com",
  "company3.openskyhrm.com": "https://api-company3.openskyhrm.com",
};

/**
 * Generate host-specific rewrite rules for each tenant.
 * These run before the catch-all rules so the right IIS backend is reached.
 */
function tenantRewrites() {
  return Object.entries(TENANT_BACKENDS).flatMap(([hostname, apiUrl]) => [
    {
      source: "/api/:path*",
      has: [{ type: "host", value: hostname }],
      destination: `${apiUrl}/api/:path*`,
    },
    {
      source: "/uploads/:path*",
      has: [{ type: "host", value: hostname }],
      destination: `${apiUrl}/uploads/:path*`,
    },
  ]);
}

const nextConfig = {
  reactStrictMode: true,
  // Vercel expects the default ".next" output unless project settings override it.
  // Keep ".dist" for local workflows to avoid churn with existing local caches.
  distDir: process.env.VERCEL ? ".next" : ".dist",
  transpilePackages: ["jspdf", "jspdf-autotable"],
  async rewrites() {
    const base = apiUpstreamBase();
    return [
      // --- Tenant-specific rules (checked first, one per company) ---
      ...tenantRewrites(),

      // --- Local dev: browser calls same-origin `/hrm-backend/...` → Kestrel ---
      {
        source: "/hrm-backend/:path*",
        destination: `${base}/:path*`,
      },
      // --- Fallback: single-backend / local dev ---
      {
        source: "/api/:path*",
        destination: `${base}/api/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${base}/uploads/:path*`,
      },
    ];
  },
  async redirects() {
    return [
      { source: "/dashboard", destination: "/app/dashboard", permanent: false },
      { source: "/people", destination: "/app/people", permanent: false },
      { source: "/people/audit-trail", destination: "/app/people/audit-trail", permanent: false },
      { source: "/employee-profile", destination: "/app/employee-profile", permanent: false },
      { source: "/recruitment", destination: "/app/recruitment", permanent: false },
      { source: "/onboarding", destination: "/app/onboarding", permanent: false },
      { source: "/leave", destination: "/app/leave", permanent: false },
      { source: "/attendance", destination: "/app/attendance", permanent: false },
      { source: "/payroll", destination: "/app/payroll", permanent: false },
      { source: "/performance", destination: "/app/performance", permanent: false },
      { source: "/learning", destination: "/app/learning", permanent: false },
      { source: "/org-structure", destination: "/app/org-structure", permanent: false },
      { source: "/org-chart", destination: "/app/org-chart", permanent: false },
      { source: "/analytics", destination: "/app/analytics", permanent: false },
      { source: "/settings", destination: "/app/settings", permanent: false },
      {
        source: "/app/audit/email-delivery-log",
        destination: "/app/email-delivery-log",
        permanent: false,
      },
      {
        source: "/app/settings/email-delivery-log",
        destination: "/app/email-delivery-log",
        permanent: false,
      },
      { source: "/billing", destination: "/app/billing", permanent: false },
    ];
  },
};

module.exports = nextConfig;
