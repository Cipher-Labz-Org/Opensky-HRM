import { NextRequest, NextResponse } from "next/server";

/** Server-side only; not exposed to the browser */
function backendBase(): string {
  return (
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://127.0.0.1:5000"
  ).replace(/\/$/, "");
}

/**
 * Proxies POST /api/auth/login → ASP.NET API.
 * Avoids next.config rewrites (they surface as opaque 500s when the API is down).
 */
export async function POST(req: NextRequest) {
  let body: string;
  try {
    body = await req.text();
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const target = `${backendBase()}/api/auth/login`;

  const upstreamTimeoutMs = 25_000;
  try {
    const res = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body || "{}",
      cache: "no-store",
      signal: AbortSignal.timeout(upstreamTimeoutMs),
    });

    const text = await res.text();
    const ct = res.headers.get("content-type") || "application/json";

    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": ct },
    });
  } catch (err) {
    console.error("[api/auth/login] upstream unreachable:", target, err);
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    return NextResponse.json(
      {
        message: timedOut
          ? `HR API did not respond within ${upstreamTimeoutMs / 1000}s (${target}). Check that the API is running and reachable from the frontend host.`
          : "Cannot reach the HR API. Set API_URL and NEXT_PUBLIC_API_URL on the frontend host, then ensure the API is running.",
      },
      { status: 503 },
    );
  }
}
