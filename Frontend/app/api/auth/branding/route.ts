import { NextRequest, NextResponse } from "next/server";
import { proxyToTenantBackend } from "@/lib/tenant-server";

/**
 * Fallback proxy when beforeFiles rewrites do not apply (e.g. local dev).
 */
export async function GET(req: NextRequest) {
  const upstreamTimeoutMs = 15_000;

  try {
    const res = await proxyToTenantBackend(req, "/api/auth/branding", {
      method: "GET",
      headers: { Accept: "application/json" },
      timeoutMs: upstreamTimeoutMs,
    });

    const text = await res.text();
    const ct = res.headers.get("content-type") || "application/json";

    if (!res.ok) {
      console.error("[api/auth/branding] upstream error:", res.status, text.slice(0, 200));
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
    console.error("[api/auth/branding] upstream unreachable:", err);
    return NextResponse.json(
      { companyName: "OpenSky HRM", companyLogoUrl: null },
      { status: 200 },
    );
  }
}
