import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/auth/jwt";

const PUBLIC_PATHS = ["/signin", "/share"];
const PUBLIC_API_PREFIXES = ["/api/share/", "/api/auth/login", "/api/auth/register"];
const ADMIN_PATHS = ["/admin", "/api/admin"];

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p));
}

function isAdminPath(pathname: string): boolean {
  return ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/") || pathname === p);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // ── Clerk guard (when configured) ─────────────────────────────────────────
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

  // Dev mode (no production, no token yet): allow through for API, redirect UI to signin
  if (!token) {
    if (process.env.NODE_ENV !== "production") {
      // Allow API through in dev — requireUser() will return dev-user fallback
      if (pathname.startsWith("/api/")) return NextResponse.next();
      // UI pages: only redirect to signin if not already going there
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
