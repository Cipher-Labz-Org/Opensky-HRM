import { NextRequest, NextResponse } from "next/server";
import { proxyToTenantBackend } from "@/lib/tenant-server";

/**
 * Fallback proxy when beforeFiles rewrites do not apply (e.g. local dev).
 * Production tenant hosts should hit IIS via next.config.js beforeFiles rewrites.
 */
export async function POST(req: NextRequest) {
  let body: string;
  try {
    body = await req.text();
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const upstreamTimeoutMs = 25_000;
  try {
    let res = await proxyToTenantBackend(req, "/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body || "{}",
      timeoutMs: upstreamTimeoutMs,
    });

    // Retry once over HTTPS if IIS redirected HTTP → HTTPS (POST would become GET → 405).
    if (res.status >= 301 && res.status <= 308) {
      const location = res.headers.get("location");
      if (location && (res.status === 301 || res.status === 302 || res.status === 307 || res.status === 308)) {
        const retryUrl = location.startsWith("http") ? location : new URL(location, res.url).href;
        res = await fetch(retryUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: body || "{}",
          cache: "no-store",
          signal: AbortSignal.timeout(upstreamTimeoutMs),
        });
      }
    }

    const text = await res.text();
    const ct = res.headers.get("content-type") || "application/json";

    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": ct },
    });
  } catch (err) {
    console.error("[api/auth/login] upstream unreachable:", err);
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    return NextResponse.json(
      {
        message: timedOut
          ? `HR API did not respond within ${upstreamTimeoutMs / 1000}s. Check tenant config in Frontend/config/tenant-backends.json.`
          : "Cannot reach the HR API. Ensure the backend is running and the tenant is registered.",
      },
      { status: 503 },
    );
  }
}
