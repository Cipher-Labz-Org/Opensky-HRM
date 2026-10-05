import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getBackendUrlForHostname, getTenantHostnameByCompanyId } from "@/config/tenants";
import { proxyTenantRequest } from "@/lib/tenant-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type RouteContext = { params: { companyId: string; path: string[] } };

/** Only the hidden vendor module-access calls may target another company. */
const ALLOWED_METHODS: Record<string, string> = {
  "vendor-licensing/login": "POST",
  "vendor-licensing/state": "GET",
  "vendor-licensing/entitlements": "PUT",
};

async function handle(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  const companyId = decodeURIComponent(context.params.companyId ?? "").trim();
  const backendPath = (context.params.path ?? []).join("/");
  const allowedMethod = ALLOWED_METHODS[backendPath];
  if (!allowedMethod || req.method.toUpperCase() !== allowedMethod) {
    return NextResponse.json({ message: "Not found." }, { status: 404 });
  }

  const hostname = getTenantHostnameByCompanyId(companyId);
  const backend = hostname ? getBackendUrlForHostname(hostname) : null;
  if (!backend) {
    return NextResponse.json({ message: "Unknown company." }, { status: 404 });
  }

  try {
    return await proxyTenantRequest(req, `/api/${backendPath}`, {
      timeoutMs: 45_000,
      backendBase: backend,
    });
  } catch (err) {
    console.error(`[vendor-companies/${companyId}/${backendPath}] upstream unreachable:`, err);
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    return NextResponse.json(
      {
        message: timedOut
          ? `HR API at ${backend} did not respond in time.`
          : `Cannot reach the HR API at ${backend}.`,
      },
      { status: 503 },
    );
  }
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
