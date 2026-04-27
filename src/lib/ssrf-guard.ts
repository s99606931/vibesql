// SSRF protection — validates that a user-supplied URL cannot reach internal infrastructure.

const BLOCKED_HOSTS = [
  "localhost",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
];

// 169.254.x.x, 10.x.x.x, 172.16-31.x.x, 127.x.x.x
function isBlockedIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return false;
  const [a, b] = parts;
  return (
    a === 127 ||
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 169 && b === 254)
  );
}

export function validateExternalUrl(raw: string): { ok: true } | { ok: false; reason: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "URL 형식이 올바르지 않습니다." };
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    return { ok: false, reason: "http 또는 https 프로토콜만 허용됩니다." };
  }

  const hostname = url.hostname.toLowerCase();

  if (BLOCKED_HOSTS.includes(hostname)) {
    return { ok: false, reason: "내부 호스트는 허용되지 않습니다." };
  }

  if (isBlockedIpv4(hostname)) {
    return { ok: false, reason: "내부 IP 대역은 허용되지 않습니다." };
  }

  return { ok: true };
}
