import { NextRequest, NextResponse } from "next/server";
import { backendBaseForRequest } from "@/lib/tenant-server";

/**
 * Proxies POST /api/auth/login → the tenant's IIS backend.
 * The backend is resolved from the request hostname via the tenant registry
 * (Frontend/config/tenants.ts), with a fallback to API_URL / localhost for dev.
 */
export async function POST(req: NextRequest) {
  let body: string;
  try {
    body = await req.text();
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const target = `${backendBaseForRequest(req)}/api/auth/login`;

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
          : "Cannot reach the HR API. Ensure the backend is running and the tenant is configured in Frontend/config/tenants.ts.",
      },
      { status: 503 },
    );
  }
}
