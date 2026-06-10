/**
 * Server-side utilities for tenant-aware Next.js route handlers.
 * Import only from server components and API route files (never from client components).
 */

import type { NextRequest } from "next/server";
import { getTenantByHostname } from "@/config/tenants";

function requestHostname(req: NextRequest): string {
  const raw =
    req.headers.get("x-forwarded-host")?.split(",")[0].trim() ??
    req.headers.get("host") ??
    "";
  return raw.split(":")[0];
}

/**
 * Resolves the IIS backend base URL for an incoming server-side request.
 */
export function backendBaseForRequest(req: NextRequest): string {
  const tenant = getTenantByHostname(requestHostname(req));
  if (tenant) return tenant.apiUrl.replace(/\/$/, "");

  return (
    process.env.API_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    "http://localhost:5000"
  ).replace(/\/$/, "");
}

/**
 * Proxy fetch to the tenant backend. Uses redirect: "manual" so an HTTP→HTTPS
 * redirect on IIS cannot turn POST into GET (which causes 405).
 */
export async function proxyToTenantBackend(
  req: NextRequest,
  backendPath: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs = 25_000, ...fetchInit } = init;
  const base = backendBaseForRequest(req);
  const path = backendPath.startsWith("/") ? backendPath : `/${backendPath}`;
  const target = `${base}${path}`;

  return fetch(target, {
    ...fetchInit,
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(timeoutMs),
  });
}
