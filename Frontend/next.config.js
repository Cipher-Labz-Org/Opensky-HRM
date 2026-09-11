/** @type {import('next').NextConfig} */

function isLocalhostApiUrl(url) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(url || "");
}

function apiUpstreamBase() {
  let url = process.env.API_URL?.trim() || process.env.NEXT_PUBLIC_API_URL?.trim() || "";
  // Never bake a loopback rewrite into the Vercel production bundle.
  if (process.env.VERCEL && (!url || isLocalhostApiUrl(url))) {
    return "";
  }
  if (!url) url = "http://127.0.0.1:5000";
  return url.replace(/\/$/, "");
}

const nextConfig = {
  reactStrictMode: true,
  distDir: process.env.VERCEL ? ".next" : ".dist",
  transpilePackages: ["jspdf", "jspdf-autotable", "pdfjs-dist"],
  webpack: (config) => {
    // pdfjs-dist references canvas in Node builds; not needed in the browser bundle.
    config.resolve.alias = { ...config.resolve.alias, canvas: false };
    return config;
  },
  async rewrites() {
    const base = apiUpstreamBase();
    if (!base) {
      return { afterFiles: [], fallback: [] };
    }

    return {
      // Tenant domains (mbkh.openskyhrm.com, gamma.openskyhrm.com) call their IIS
      // backends DIRECTLY from the browser via getApiBaseUrl() — no Vercel proxy needed.
      // beforeFiles tenant rewrites were removed: Vercel cannot proxy to private IPs
      // (DNS_HOSTNAME_RESOLVED_PRIVATE) and the direct-call approach bypasses that entirely.
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
