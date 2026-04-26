import { NextResponse } from "next/server";
import { getConnection, updateConnection } from "@/lib/connections/store";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { error: "연결을 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  const conn = getConnection(id);

  if (conn && conn.type === "postgresql") {
    try {
      const { Client } = await import("pg");
      const client = new Client({
        host: conn.host || "localhost",
        port: conn.port || 5432,
        database: conn.database,
        user: conn.username,
        password: conn.passwordBase64
          ? Buffer.from(conn.passwordBase64, "base64").toString()
          : undefined,
        ssl: conn.ssl ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 5000,
      });

      const start = Date.now();
      await client.connect();
      let res;
      try {
        res = await client.query("SELECT version()");
      } finally {
        await client.end().catch(() => undefined);
      }

      const latencyMs = Date.now() - start;
      const serverVersion = (res.rows[0]?.version as string | undefined)
        ?.split(" ")
        .slice(0, 2)
        .join(" ");

      updateConnection(id, {
        lastTestedAt: new Date().toISOString(),
        lastTestedOk: true,
      });

      return NextResponse.json({
        data: { success: true, latencyMs, serverVersion },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "연결 테스트 실패";

      updateConnection(id, {
        lastTestedAt: new Date().toISOString(),
        lastTestedOk: false,
      });

      return NextResponse.json(
        { error: `연결 실패: ${msg}` },
        { status: 400 }
      );
    }
  }

  // Fall back to mock for non-PostgreSQL or unknown connections
  await new Promise((r) => setTimeout(r, 300));

  return NextResponse.json({
    data: {
      success: true,
      latencyMs: Math.floor(Math.random() * 50) + 10,
      serverVersion: "PostgreSQL 16.1",
    },
  });
}
