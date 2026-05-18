import { NextRequest, NextResponse } from "next/server";

/** Server-side only; not exposed to the browser */
function backendBase(): string {
  return (
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:5000"
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

  try {
    const res = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body || "{}",
      cache: "no-store",
    });

    const text = await res.text();
    const ct = res.headers.get("content-type") || "application/json";

    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": ct },
    });
  } catch (err) {
    console.error("[api/auth/login] upstream unreachable:", target, err);
    return NextResponse.json(
      {
        message:
          "Cannot reach the HR API. Start the backend (dotnet run on port 5000) and set API_URL or NEXT_PUBLIC_API_URL if the API uses another URL.",
      },
      { status: 503 },
    );
  }
}
