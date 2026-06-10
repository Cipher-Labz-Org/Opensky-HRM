import { NextRequest, NextResponse } from "next/server";
import { backendBaseForRequest, proxyToTenantBackend } from "@/lib/tenant-server";

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

    if (res.status >= 500) {
      const base = backendBaseForRequest(req);
      let message = `HR API error (${res.status}) from ${base}.`;
      try {
        const body = JSON.parse(text) as { message?: string };
        if (body.message) message = body.message;
      } catch {
        /* use default */
      }
      if (res.status === 500) {
        message += ` Open ${base}/health — fix IIS (pool MBKH: Load User Profile = True), recycle, then try again.`;
      }
      return NextResponse.json({ message }, { status: res.status });
    }

    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": ct },
    });
  } catch (err) {
    console.error("[api/auth/login] upstream unreachable:", err);
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    const base = backendBaseForRequest(req);
    return NextResponse.json(
      {
        message: timedOut
          ? `HR API at ${base} did not respond within ${upstreamTimeoutMs / 1000}s.`
          : `Cannot reach the HR API at ${base}. Check ${base}/health — on the server set IIS pool MBKH → Load User Profile = True, then recycle.`,
      },
      { status: 503 },
    );
  }
}
