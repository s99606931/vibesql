import { NextResponse } from "next/server";
import { z } from "zod";
import { generateSql } from "@/lib/claude/nl2sql";
import { guardSql } from "@/lib/sql-guard";

const BodySchema = z.object({
  nl: z.string().min(1).max(2000),
  dialect: z
    .enum(["postgresql", "mysql", "sqlite", "mssql", "oracle"])
    .default("postgresql"),
  connectionId: z.string().optional(),
  schemaContext: z
    .string()
    .default("No schema provided — generate generic SQL"),
  glossary: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const result = await generateSql(parsed.data);

    // Validate generated SQL is safe
    const guard = guardSql(result.sql);
    if (!guard.allowed) {
      return NextResponse.json(
        { error: `Unsafe SQL generated: ${guard.reason}` },
        { status: 422 }
      );
    }

    return NextResponse.json({ data: result });
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : "SQL generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
