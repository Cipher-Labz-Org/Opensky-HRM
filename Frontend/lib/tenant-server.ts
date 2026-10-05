/**
 * Server-side utilities for tenant-aware Next.js route handlers.
 * Import only from server components and API route files (never from client components).
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getBackendUrlForHostname } from "@/config/tenants";

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
  const backend = getBackendUrlForHostname(requestHostname(req));
  if (backend) return backend;

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
  init: RequestInit & { timeoutMs?: number; backendBase?: string } = {},
): Promise<Response> {
  const { timeoutMs = 25_000, backendBase, ...fetchInit } = init;
  const base = (backendBase ?? backendBaseForRequest(req)).replace(/\/$/, "");
  const path = backendPath.startsWith("/") ? backendPath : `/${backendPath}`;
  const target = `${base}${path}`;

  return fetch(target, {
    ...fetchInit,
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(timeoutMs),
  });
}

const PROXY_FORWARD_REQUEST_HEADERS = [
  "authorization",
  "content-type",
  "accept",
  "accept-language",
  "if-none-match",
  "if-modified-since",
] as const;

function proxyRequestHeaders(req: NextRequest): Headers {
  const headers = new Headers();
  for (const name of PROXY_FORWARD_REQUEST_HEADERS) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

const PROXY_FORWARD_RESPONSE_HEADERS = [
  "content-type",
  "content-disposition",
  "cache-control",
  "etag",
  "last-modified",
] as const;

/** Build a Next.js response from an upstream tenant backend fetch. */
export async function nextResponseFromUpstream(res: Response): Promise<NextResponse> {
  const headers = new Headers();
  for (const name of PROXY_FORWARD_RESPONSE_HEADERS) {
    const value = res.headers.get(name);
    if (value) headers.set(name, value);
  }

  const body = await res.arrayBuffer();
  return new NextResponse(body, { status: res.status, headers });
}

/** Upstream timeout for tenant API proxy (Vercel route handlers). */
export function upstreamTimeoutMsForApiSegments(segments: string[]): number {
  const root = (segments[0] ?? "").toLowerCase();
  if (root === "bulkupload") return 300_000;

  const path = segments.join("/").toLowerCase();
  if (path === "payroll/batches/sync-from-employee-salary") return 300_000;
  if (path.startsWith("payroll/batches/")) {
    if (path.includes("/calculate") || path.includes("/import-attendance-leave")) {
      return 300_000;
    }
  }
  return 45_000;
}

/** Proxy an incoming Next.js request to the tenant IIS backend. */
export async function proxyTenantRequest(
  req: NextRequest,
  backendPath: string,
  options: { timeoutMs?: number; backendBase?: string } = {},
): Promise<NextResponse> {
  const { timeoutMs = 45_000, backendBase } = options;
  const method = req.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";
  const body = hasBody ? await req.arrayBuffer() : undefined;

  let res = await proxyToTenantBackend(req, backendPath, {
    method,
    headers: proxyRequestHeaders(req),
    body: body && body.byteLength > 0 ? body : undefined,
    timeoutMs,
    backendBase,
  });

  if (res.status >= 301 && res.status <= 308) {
    const location = res.headers.get("location");
    if (location && (res.status === 301 || res.status === 302 || res.status === 307 || res.status === 308)) {
      const retryUrl = location.startsWith("http") ? location : new URL(location, res.url).href;
      res = await fetch(retryUrl, {
        method,
        headers: proxyRequestHeaders(req),
        body: body && body.byteLength > 0 ? body : undefined,
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
      });
    }
  }

  return nextResponseFromUpstream(res);
}
