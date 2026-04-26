// Shared NextResponse mock — use this in all API integration tests
// so that `instanceof NextResponse` checks work correctly in route handlers.
// Exported as both `NextResponse` (for routes) and `MockNextResponse` (for tests).

export class MockNextResponse {
  _body: unknown;
  status: number;

  constructor(body: unknown, init?: ResponseInit) {
    this._body = body;
    this.status = (init?.status as number | undefined) ?? 200;
  }

  async json() { return this._body; }

  static json(body: unknown, init?: ResponseInit) {
    return new MockNextResponse(body, init);
  }

  static next() { return new MockNextResponse(null, { status: 200 }); }

  static redirect(url: URL) {
    return new MockNextResponse({ url: url.toString() }, { status: 307 });
  }
}

// Routes import `NextResponse` from "next/server" — this alias satisfies that
export const NextResponse = MockNextResponse;
