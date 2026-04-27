// Global mock for next/headers — no request scope in tests.
// Returns empty cookies/headers by default (unauthenticated).
// Individual test files can override with vi.mock("next/headers", ...) for specific behavior.

export async function cookies() {
  return {
    get: (_name: string) => undefined as { name: string; value: string } | undefined,
    set: (_name: string, _value: string, _options?: unknown) => {},
    delete: (_name: string) => {},
    has: (_name: string) => false,
    getAll: () => [] as { name: string; value: string }[],
  };
}

export async function headers() {
  return {
    get: (_name: string) => null as string | null,
    has: (_name: string) => false,
    getAll: () => [] as string[],
    entries: () => [][Symbol.iterator](),
    keys: () => [][Symbol.iterator](),
    values: () => [][Symbol.iterator](),
    forEach: (_cb: (value: string, key: string) => void) => {},
  };
}
