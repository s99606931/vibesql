import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/jwt";

export async function POST() {
  const res = NextResponse.json({ data: { ok: true } });
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return res;
}
