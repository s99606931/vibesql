import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession, SESSION_COOKIE } from "@/lib/auth/jwt";
import type { UserRole } from "@/lib/auth/jwt";

export interface AuthUser {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
}

/**
 * Returns the current userId from the auth context.
 *
 * Priority: Clerk → JWT cookie → dev-user fallback.
 */
export async function requireUserId(): Promise<string | NextResponse> {
  const result = await requireUser();
  if (result instanceof NextResponse) return result;
  return result.userId;
}

/**
 * Returns full session info (userId, email, name, role).
 *
 * Priority:
 *  1. Clerk (when NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is set)
 *  2. JWT cookie (vs-session) for custom auth
 *  3. Dev fallback (ADMIN for local dev convenience)
 */
export async function requireUser(): Promise<AuthUser | NextResponse> {
  const hasClerk = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  if (hasClerk) {
    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error @clerk/nextjs is optional
      const clerkModule = await import("@clerk/nextjs/server");
      const { userId } = await clerkModule.auth();
      if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      // Look up role from DB or in-memory
      const role = await resolveRole(userId);
      return { userId, email: "", name: "", role };
    } catch {
      return NextResponse.json(
        { error: "Authentication service unavailable" },
        { status: 503 }
      );
    }
  }

  // JWT cookie auth
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    const session = await verifySession(token);
    if (session) {
      return {
        userId: session.userId,
        email: session.email,
        name: session.name,
        role: session.role,
      };
    }
    // Invalid/expired token → 401
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Local dev fallback: admin access
  return { userId: "dev-user", email: "dev@vibesql.dev", name: "Dev User", role: "ADMIN" };
}

async function resolveRole(userId: string): Promise<UserRole> {
  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const user = await prisma.user.findUnique({ where: { clerkId: userId }, select: { role: true } });
      if (user) return user.role as UserRole;
    } catch { /* fall through */ }
  }
  return "USER";
}
