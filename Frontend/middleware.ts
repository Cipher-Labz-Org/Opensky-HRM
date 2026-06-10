import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isKnownTenant } from "@/config/tenants";

const PUBLIC_PATHS = ["/login", "/forgot-password", "/", "/pricing", "/contact"];

/** True when the hostname is a *.openskyhrm.com subdomain (not the apex). */
function isProductionTenantDomain(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h.endsWith(".openskyhrm.com") && h !== "openskyhrm.com";
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Resolve the real hostname (Vercel sets x-forwarded-host).
  const rawHost =
    request.headers.get("x-forwarded-host")?.split(",")[0].trim() ??
    request.nextUrl.hostname;
  const hostname = rawHost.split(":")[0].toLowerCase();

  // On production tenant domains, reject requests from unregistered hostnames
  // so a typo-ed subdomain gets a clear 404 instead of a broken app shell.
  if (isProductionTenantDomain(hostname) && !isKnownTenant(hostname)) {
    return new NextResponse(
      JSON.stringify({ message: `Tenant "${hostname}" is not registered.` }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }

  // Skip middleware for static assets, Next.js internals, and Next.js API routes.
  if (
    PUBLIC_PATHS.some((p) => pathname === p) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Redirect unauthenticated users to login.
  const token = request.cookies.get("auth_token")?.value;
  if (!token && pathname.startsWith("/app")) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/((?!_next/static|_next/image|favicon.ico).*)"],
};
