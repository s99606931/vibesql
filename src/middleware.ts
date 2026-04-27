import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/auth/jwt";

// Exact-match or trailing-slash boundary to prevent prefix collisions (e.g. /signin-bypass)
const PUBLIC_PATHS = ["/signin", "/share"];
const PUBLIC_API_PREFIXES = ["/api/share/", "/api/auth/login", "/api/auth/register", "/api/health"];
const ADMIN_PATHS = [
  "/admin",
  "/api/admin",
  "/ai-providers",
  "/ai-context",
  "/audit-logs",
  "/errors",
  "/api/ai-providers",
  "/api/ai-context",
  "/api/audit-logs",
];

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  // Use exact-match OR trailing-slash prefix only — bare startsWith(p) risks prefix collision
  // (e.g. /api/auth/login matching a hypothetical /api/auth/login-bypass route).
  if (PUBLIC_API_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) return true;
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function isAdminPath(pathname: string): boolean {
  return ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // ── Clerk guard (when configured) ─────────────────────────────────────────
  // NOTE: Role-based admin enforcement for Clerk mode requires Clerk's auth()
  // which performs a DB lookup not available in Edge middleware. Admin API routes
  // are protected by requireAdmin() in each route handler. For middleware-level
  // admin page protection with Clerk, migrate to clerkMiddleware() from @clerk/nextjs/server.
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (clerkKey) {
    const sessionToken =
      request.cookies.get("__session")?.value ??
      request.cookies.get("__clerk_db_jwt")?.value;

    if (!sessionToken) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const url = request.nextUrl.clone();
      url.pathname = "/signin";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // ── JWT cookie guard ───────────────────────────────────────────────────────
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (!token) {
    // Dev bypass: explicit opt-in only, never in production
    if (process.env.VIBESQL_DEV_AUTH_BYPASS === "1" && process.env.NODE_ENV !== "production") {
      // Still enforce admin path guard in dev bypass mode (requires VIBESQL_DEV_AS_ADMIN=1)
      if (isAdminPath(pathname) && process.env.VIBESQL_DEV_AS_ADMIN !== "1") {
        if (pathname.startsWith("/api/")) {
          return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
        }
        const url = request.nextUrl.clone();
        url.pathname = "/";
        return NextResponse.redirect(url);
      }
      return NextResponse.next();
    }
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/signin";
    return NextResponse.redirect(url);
  }

  const session = await verifySession(token);
  if (!session) {
    // Invalid/expired token
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/signin";
    return NextResponse.redirect(url);
  }

  // Admin path guard
  if (isAdminPath(pathname) && session.role !== "ADMIN") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Inject user info as headers for downstream consumption
  const res = NextResponse.next();
  res.headers.set("x-user-id", session.userId);
  res.headers.set("x-user-role", session.role);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
