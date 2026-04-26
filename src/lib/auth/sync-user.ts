/**
 * Upserts a User (and their default UserSettings) in the database.
 * Call this on first login or whenever you need to ensure the user row exists.
 */
export async function syncUser(params: {
  userId: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
}): Promise<void> {
  if (!process.env.DATABASE_URL) return;

  try {
    const { prisma } = await import("@/lib/db/prisma");

    await prisma.user.upsert({
      where: { id: params.userId },
      create: {
        id: params.userId,
        email: params.email ?? `${params.userId}@placeholder.local`,
        name: params.name ?? null,
        avatarUrl: params.avatarUrl ?? null,
      },
      update: {
        ...(params.email ? { email: params.email } : {}),
        ...(params.name !== undefined ? { name: params.name } : {}),
        ...(params.avatarUrl !== undefined ? { avatarUrl: params.avatarUrl } : {}),
      },
    });

    // Ensure UserSettings row exists (in case user was created before this field was added)
    await prisma.userSettings.upsert({
      where: { userId: params.userId },
      create: { userId: params.userId },
      update: {},
    });
  } catch {
    // Non-fatal — sync failures should not block the request
  }
}
