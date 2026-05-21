import { NextResponse } from "next/server";

/** Server-side only; not exposed to the browser */
function backendBase(): string {
  return (
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:5000"
  ).replace(/\/$/, "");
}

/**
 * Proxies GET /api/auth/branding → ASP.NET API.
 * Same-origin on Vercel/custom domains (avoids CORS when the API omits ACAO on errors).
 */
export async function GET() {
  const target = `${backendBase()}/api/auth/branding`;
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
          : "Cannot reach the HR API for branding.",
      },
      { status: 503 },
    );
  }
}
