/**
 * Resolve a safe, same-origin redirect target from a user-controlled `next`
 * value (a query param on /login, /admin/login-style callbacks, etc).
 *
 * Rejects absolute URLs and origin-confusion tricks — `//evil.com`,
 * `/\evil.com`, `javascript:alert(1)` — that a naive `startsWith("/") &&
 * !startsWith("//")` check lets through: the WHATWG URL parser normalizes
 * backslashes to forward slashes for http(s) (and strips tabs/newlines)
 * before resolving, so `/\evil.com` becomes the network-path reference
 * `//evil.com` and resolves to a different host. Parsing with `new URL` and
 * comparing the resulting origin catches all of these; string prefix checks
 * do not.
 */
export function safeNextPath(
  next: string | null | undefined,
  origin: string,
  fallback = "/me",
): string {
  if (!next) return fallback;
  try {
    const url = new URL(next, origin);
    if (url.origin !== origin) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
