import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/auth/jwt";

// Exact-match or trailing-slash boundary to prevent prefix collisions (e.g. /signin-bypass)
const PUBLIC_PATHS = ["/signin", "/share"];
const PUBLIC_API_PREFIXES = [
  "/api/share/",
  "/api/auth/login",
  "/api/auth/register",
  "/api/health",
  // NOTE: /api/eval is intentionally NOT public — it is protected by requireAdmin()
  // inside the route handler and must pass through authentication middleware.
];
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
  // Middleware performs a presence check only — full cryptographic token
  // verification happens inside each route handler via requireUser()/requireAdmin()
  // which calls clerkModule.auth(). The middleware layer prevents unauthenticated
  // requests from reaching route handlers at all, reducing attack surface.
  //
  // SECURITY NOTE: Cookie-name-only checks (previous impl) allowed trivial bypass
  // with `Cookie: __session=x`. This implementation additionally accepts the
  // standard Authorization: Bearer header so API clients without cookies work.
  // Route handlers still MUST call requireUser() — middleware is defense-in-depth.
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (clerkKey) {
    const cookieToken =
      request.cookies.get("__session")?.value ??
      request.cookies.get("__clerk_db_jwt")?.value;
    const bearerToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const hasToken = Boolean(cookieToken ?? bearerToken);

    if (!hasToken) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const url = request.nextUrl.clone();
      url.pathname = "/signin";
      return NextResponse.redirect(url);
    }
    // Pass through — route handler's requireUser()/requireAdmin() does the real verification.
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
