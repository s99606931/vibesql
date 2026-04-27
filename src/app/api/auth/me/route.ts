import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";

export async function GET() {
  const result = await requireUser();
  if (result instanceof NextResponse) return result;
  return NextResponse.json({
    data: {
      id: result.userId,
      email: result.email,
      name: result.name,
      role: result.role,
    },
  });
}
