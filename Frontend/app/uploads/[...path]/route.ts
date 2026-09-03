import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { proxyTenantRequest } from "@/lib/tenant-server";

export const dynamic = "force-dynamic";

type RouteContext = { params: { path: string[] } };

export async function GET(req: NextRequest, context: RouteContext): Promise<NextResponse> {
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
