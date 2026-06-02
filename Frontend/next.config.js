/** @type {import('next').NextConfig} */
const tenantBackends = require("./config/tenant-backends.json");

function apiUpstreamBase() {
  const url =
    process.env.API_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    "http://127.0.0.1:5000";
  return url.replace(/\/$/, "");
}

/** Env overrides for local dev (see .env.local). */
function resolveTenantBackends() {
  return {
    "mbkh.openskyhrm.com":
      process.env.NEXT_PUBLIC_MBKH_API_URL || tenantBackends["mbkh.openskyhrm.com"],
    "gamma.openskyhrm.com":
      process.env.NEXT_PUBLIC_GAMMA_API_URL || tenantBackends["gamma.openskyhrm.com"],
  };
}

function tenantRewrites(backends) {
  const rules = [];
  for (const [hostname, apiUrl] of Object.entries(backends)) {
    if (!apiUrl) continue;
    const base = String(apiUrl).replace(/\/$/, "");
    const hosts = [hostname, `www.${hostname}`];
    for (const host of hosts) {
      rules.push(
        {
          source: "/api/:path*",
          has: [{ type: "host", value: host }],
          destination: `${base}/api/:path*`,
        },
        {
          source: "/uploads/:path*",
          has: [{ type: "host", value: host }],
          destination: `${base}/uploads/:path*`,
        },
      );
    }
  }
  return rules;
}

const nextConfig = {
  reactStrictMode: true,
  distDir: process.env.VERCEL ? ".next" : ".dist",
  transpilePackages: ["jspdf", "jspdf-autotable"],
  async rewrites() {
    const base = apiUpstreamBase();
    const tenants = resolveTenantBackends();
    const tenantRules = tenantRewrites(tenants);

    return {
      // Proxy to IIS *before* App Router (avoids 405 on /api/auth/login route handlers).
      beforeFiles: tenantRules,
      afterFiles: [
        {
          source: "/hrm-backend/:path*",
          destination: `${base}/:path*`,
        },
      ],
      fallback: [
        {
          source: "/api/:path*",
          destination: `${base}/api/:path*`,
        },
        {
          source: "/uploads/:path*",
          destination: `${base}/uploads/:path*`,
        },
      ],
    };
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
