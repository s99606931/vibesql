import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/signin", "/share"];
const PUBLIC_API_PREFIXES = ["/api/share/"];

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p));
}

// Clerk guard — only activated when NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is set.
// Falls back to pass-through when Clerk is not configured.
export async function middleware(request: NextRequest) {
  const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!clerkPublishableKey) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Check session cookie presence (lightweight guard — Clerk SDK does full validation)
  const sessionToken =
    request.cookies.get("__session")?.value ??
    request.cookies.get("__clerk_db_jwt")?.value;

  if (!sessionToken && pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!sessionToken && !pathname.startsWith("/api/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/signin";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
