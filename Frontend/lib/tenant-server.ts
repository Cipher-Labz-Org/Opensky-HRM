/**
 * Server-side utilities for tenant-aware Next.js route handlers.
 * Import only from server components and API route files (never from client components).
 */

import type { NextRequest } from "next/server";
import { getTenantByHostname } from "@/config/tenants";

/**
 * Resolves the IIS backend base URL for an incoming server-side request.
 *
 * Resolution order:
 *   1. x-forwarded-host header (set by Vercel in front of Next.js)
 *   2. host header
 *   3. API_URL env var (set on the Vercel project per deployment if needed)
 *   4. NEXT_PUBLIC_API_URL env var
 *   5. localhost:5000 (local dev fallback)
 */
export function backendBaseForRequest(req: NextRequest): string {
  const raw =
    req.headers.get("x-forwarded-host")?.split(",")[0].trim() ??
    req.headers.get("host") ??
    "";

  // Strip port — tenant map keys never contain ports.
  const hostname = raw.split(":")[0].toLowerCase();

  const tenant = getTenantByHostname(hostname);
  if (tenant) return tenant.apiUrl;

  // Dev / single-instance fallback.
  return (
    process.env.API_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    "http://localhost:5000"
  ).replace(/\/$/, "");
}
