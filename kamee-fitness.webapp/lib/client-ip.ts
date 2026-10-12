/**
 * Best-effort client IP for coarse rate limiting.
 *
 * kamee.fit is served by Netlify with no Cloudflare in front, so any
 * `cf-connecting-ip` header arrives straight from the client and can be set to
 * anything; trusting it let one client reset its rate-limit bucket per request
 * (security audit 2026-10-05, M1). Netlify sets `x-nf-client-connection-ip`
 * itself, from the TCP connection, so that is the only header trusted in
 * production. `x-forwarded-for` is a fallback for local development only,
 * where the Netlify header is absent and nothing depends on the limit.
 */
export function clientIp(headers: Headers): string {
  const netlify = headers.get("x-nf-client-connection-ip")?.trim();
  if (netlify) return netlify;
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "unknown";
}
