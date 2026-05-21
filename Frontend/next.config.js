/** @type {import('next').NextConfig} */
function apiUpstreamBase() {
  const url =
    process.env.API_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    "http://127.0.0.1:5000";
  return url.replace(/\/$/, "");
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
