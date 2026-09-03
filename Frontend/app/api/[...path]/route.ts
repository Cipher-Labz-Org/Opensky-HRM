import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { backendBaseForRequest, proxyTenantRequest } from "@/lib/tenant-server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type RouteContext = { params: { path: string[] } };

async function handle(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  const segments = context.params.path ?? [];
  const backendPath = `/api/${segments.join("/")}`;
  const query = req.nextUrl.search;
  const isBulkUpload = (segments[0] ?? "").toLowerCase() === "bulkupload";

  try {
    return await proxyTenantRequest(req, `${backendPath}${query}`, {
      timeoutMs: isBulkUpload ? 300_000 : 45_000,
    });
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
