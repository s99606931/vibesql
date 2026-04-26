import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaPool?: pg.Pool;
};

function createPrismaClient(): PrismaClient {
  if (!process.env.DATABASE_URL) {
    // Return a placeholder that throws meaningful errors when accessed
    return new Proxy({} as PrismaClient, {
      get() {
        throw new Error("DATABASE_URL is not configured. Set it in .env.local");
      },
    });
  }
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  // Keep a reference so the pool can be drained on process exit
  globalForPrisma.prismaPool = pool;
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Drain the connection pool gracefully when the Node.js process exits.
// This prevents "too many connections" errors during development hot-reloads
// and ensures clean shutdown in production.
function cleanup(): void {
  const pool = globalForPrisma.prismaPool;
  if (pool) {
    pool.end().catch(() => {
      // Best-effort; process is already exiting
    });
  }
}

process.once("exit", cleanup);
process.once("SIGINT", () => {
  cleanup();
  process.exit(0);
});
process.once("SIGTERM", () => {
  cleanup();
  process.exit(0);
});
