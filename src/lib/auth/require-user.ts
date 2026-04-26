import { NextResponse } from "next/server";

/**
 * Returns the current userId from the auth context.
 *
 * - If Clerk is fully configured (NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is set),
 *   uses Clerk's auth() to extract the userId.
 * - Otherwise falls back to "dev-user" for local development without Clerk.
 *
 * Usage in a route handler:
 *   const result = await requireUserId();
 *   if (result instanceof NextResponse) return result; // 401
 *   const userId = result;
 */
export async function requireUserId(): Promise<string | NextResponse> {
  const hasClerk = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  if (hasClerk) {
    // Dynamic import so the build doesn't fail when @clerk/nextjs is not installed
    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error @clerk/nextjs is optional — not installed in dev without Clerk
      const clerkModule = await import("@clerk/nextjs/server");
      const { userId } = await clerkModule.auth();
      if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return userId as string;
    } catch {
      // Clerk is configured but failed to load — deny access rather than silently grant dev-user.
      // This prevents a misconfigured/unavailable Clerk from creating an auth bypass.
      return NextResponse.json(
        { error: "Authentication service unavailable" },
        { status: 503 }
      );
    }
  }

  // Development fallback: no auth environment configured at all
  return "dev-user";
}
