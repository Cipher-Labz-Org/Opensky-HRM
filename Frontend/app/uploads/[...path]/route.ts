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

export async function GET(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  const hostname = requestHostname(req);
  if (!tenantBackendRequiresBrowserProxy(hostname)) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const segments = context.params.path ?? [];
  const backendPath = `/uploads/${segments.join("/")}`;
  const query = req.nextUrl.search;

  try {
    return await proxyTenantRequest(req, `${backendPath}${query}`, { timeoutMs: 60_000 });
  } catch (err) {
    console.error(`[uploads/${segments.join("/")}] upstream unreachable:`, err);
    return new NextResponse(null, { status: 502 });
  }
}
