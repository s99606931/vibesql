import { describe, it, expect, vi, beforeEach } from "vitest";

// We test the isPublicPath logic and redirect/pass-through behaviour
// without invoking the real Next.js runtime, so we mock NextResponse.

vi.mock("next/server", () => ({
  NextResponse: {
    next: vi.fn(() => ({ type: "next" })),
    redirect: vi.fn((url: URL) => ({ type: "redirect", url: url.toString() })),
    json: vi.fn((body: unknown, init?: ResponseInit) => ({
      type: "json",
      body,
      status: init?.status ?? 200,
    })),
  },
}));

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function makeRequest(pathname: string, cookies: Record<string, string> = {}, clerkKey = "") {
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = clerkKey;

  const url = new URL(`http://localhost${pathname}`);
  // Provide clone() so middleware's redirect branch works
  const urlWithClone = Object.assign(url, {
    clone: () => new URL(url.toString()),
  });
  return {
    nextUrl: urlWithClone,
    cookies: {
      get: (name: string) =>
        cookies[name] !== undefined ? { value: cookies[name] } : undefined,
    },
    headers: new Headers(),
  } as unknown as NextRequest;
}

describe("middleware — Clerk 미설정 (pass-through)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Clerk 키 없으면 모든 경로 통과", async () => {
    const { middleware } = await import("./middleware");
    await middleware(makeRequest("/workspace"));
    expect(NextResponse.next).toHaveBeenCalledTimes(1);
    expect(NextResponse.redirect).not.toHaveBeenCalled();
  });
});

describe("middleware — Clerk 설정", () => {
  const CLERK_KEY = "pk_test_dummy";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("공개 경로(/) 는 항상 통과", async () => {
    const { middleware } = await import("./middleware");
    await middleware(makeRequest("/", {}, CLERK_KEY));
    expect(NextResponse.next).toHaveBeenCalled();
  });

  it("/signin 은 공개 경로 — 통과", async () => {
    const { middleware } = await import("./middleware");
    await middleware(makeRequest("/signin", {}, CLERK_KEY));
    expect(NextResponse.next).toHaveBeenCalled();
  });

  it("세션 쿠키 없이 /api 경로 → 401", async () => {
    const { middleware } = await import("./middleware");
    const res = (await middleware(makeRequest("/api/queries/generate", {}, CLERK_KEY))) as {
      type: string;
      status: number;
    };
    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: "Unauthorized" },
      { status: 401 }
    );
  });

  it("세션 쿠키 없이 페이지 경로 → /signin 리다이렉트", async () => {
    const { middleware } = await import("./middleware");
    await middleware(makeRequest("/workspace", {}, CLERK_KEY));
    expect(NextResponse.redirect).toHaveBeenCalled();
    const callArg = vi.mocked(NextResponse.redirect).mock.calls[0][0] as URL;
    expect(callArg.pathname).toBe("/signin");
  });

  it("__session 쿠키 있으면 통과", async () => {
    const { middleware } = await import("./middleware");
    await middleware(makeRequest("/workspace", { __session: "tok123" }, CLERK_KEY));
    expect(NextResponse.next).toHaveBeenCalled();
    expect(NextResponse.redirect).not.toHaveBeenCalled();
  });

  it("__clerk_db_jwt 쿠키 있으면 통과", async () => {
    const { middleware } = await import("./middleware");
    await middleware(makeRequest("/workspace", { __clerk_db_jwt: "jwt456" }, CLERK_KEY));
    expect(NextResponse.next).toHaveBeenCalled();
  });
});
