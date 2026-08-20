import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { backendBaseForRequest, proxyTenantRequest } from "@/lib/tenant-server";
import { tenantBackendRequiresBrowserProxy } from "@/config/tenants";

export const dynamic = "force-dynamic";

type RouteContext = { params: { path: string[] } };

function requestHostname(req: NextRequest): string {
  const raw =
    req.headers.get("x-forwarded-host")?.split(",")[0].trim() ??
    req.headers.get("host") ??
    "";
  return raw.split(":")[0];
}

async function handle(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  const hostname = requestHostname(req);
  if (!tenantBackendRequiresBrowserProxy(hostname)) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const segments = context.params.path ?? [];
  const backendPath = `/api/${segments.join("/")}`;
  const query = req.nextUrl.search;

  try {
    return await proxyTenantRequest(req, `${backendPath}${query}`);
  } catch (err) {
    console.error(`[api/${segments.join("/")}] upstream unreachable:`, err);
    const base = backendBaseForRequest(req);
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    return NextResponse.json(
      {
        message: timedOut
          ? `HR API at ${base} did not respond in time.`
          : `Cannot reach the HR API at ${base}.`,
      },
      { status: 503 },
    );
  }
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
