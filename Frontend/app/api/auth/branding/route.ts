import { NextRequest, NextResponse } from "next/server";
import { backendBaseForRequest } from "@/lib/tenant-server";

/**
 * Proxies GET /api/auth/branding → the tenant's IIS backend.
 * The backend is resolved from the request hostname via the tenant registry
 * (Frontend/config/tenants.ts), with a fallback to API_URL / localhost for dev.
 */
export async function GET(req: NextRequest) {
  const target = `${backendBaseForRequest(req)}/api/auth/branding`;
  const upstreamTimeoutMs = 15_000;

  try {
    const res = await fetch(target, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(upstreamTimeoutMs),
    });

    const text = await res.text();
    const ct = res.headers.get("content-type") || "application/json";

    if (!res.ok) {
      console.error("[api/auth/branding] upstream error:", res.status, target, text.slice(0, 200));
      return NextResponse.json(
        { companyName: "OpenSky HRM", companyLogoUrl: null },
        { status: 200 },
      );
    }

    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": ct },
    });
  } catch (err) {
    console.error("[api/auth/branding] upstream unreachable:", target, err);
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    return NextResponse.json(
      {
        companyName: "OpenSky HRM",
        companyLogoUrl: null,
        message: timedOut
          ? `HR API did not respond within ${upstreamTimeoutMs / 1000}s (${target}).`
          : "Cannot reach the HR API for branding. Ensure the tenant is configured in Frontend/config/tenants.ts.",
      },
      { status: 503 },
    );
  }
}
