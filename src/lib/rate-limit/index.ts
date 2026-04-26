/**
 * In-memory sliding-window rate limiter.
 *
 * Uses a module-scoped Map so state persists across requests within the same
 * Node.js process (single Next.js server instance). No external dependencies.
 *
 * NOTE: This is intentionally process-local. In a multi-instance deployment
 * each instance tracks its own window independently. For shared limiting
 * replace the Map with a Redis-backed store without changing the call sites.
 */

interface RateLimitResult {
  /** Whether the request is permitted. */
  allowed: boolean;
  /** Requests remaining in the current window (0 when denied). */
  remaining: number;
  /** Milliseconds until the oldest request leaves the window. */
  resetMs: number;
}

// key → sorted array of request timestamps (ms since epoch)
const store = new Map<string, number[]>();

/**
 * Check and record a request for `key` against a sliding window.
 *
 * @param key      Identifier for the caller (e.g. IP address).
 * @param limit    Maximum requests allowed within `windowMs`.
 * @param windowMs Rolling window duration in milliseconds.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - windowMs;

  // Retrieve or initialise the timestamp list for this key.
  let timestamps = store.get(key) ?? [];

  // Drop timestamps that have fallen outside the current window.
  timestamps = timestamps.filter((t) => t > windowStart);

  // Evict the key entirely when its window is empty — prevents unbounded Map growth
  // from IPs that made requests once and then went quiet.
  if (timestamps.length === 0) {
    store.delete(key);
  }

  const count = timestamps.length;

  if (count >= limit) {
    // Oldest timestamp in window determines when a slot opens up.
    const oldestInWindow = timestamps[0] ?? now;
    const resetMs = oldestInWindow + windowMs - now;

    store.set(key, timestamps);
    return { allowed: false, remaining: 0, resetMs: Math.max(0, resetMs) };
  }

  // Record this request and persist.
  timestamps.push(now);
  store.set(key, timestamps);

  return {
    allowed: true,
    remaining: limit - timestamps.length,
    resetMs: 0,
  };
}

/**
 * Extract the client IP from proxy headers.
 *
 * Takes the RIGHTMOST entry from X-Forwarded-For — this is the IP injected
 * by the nearest trusted reverse proxy and cannot be spoofed by the client
 * (who only controls entries to the LEFT of the proxy's insertion point).
 *
 * If running without a reverse proxy, returns "anonymous" to avoid trusting
 * attacker-controlled headers.
 */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    // Rightmost entry is added by the nearest trusted proxy.
    const rightmost = forwarded.split(",").at(-1)?.trim();
    if (rightmost) return rightmost;
  }

  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "anonymous";
}
