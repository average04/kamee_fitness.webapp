import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * App-layer rate limiting for unauthenticated/cheap-to-spam endpoints.
 *
 * Backed by Upstash Redis so limits survive serverless cold starts (an
 * in-memory limiter does NOT, which is why we don't fall back to one). When
 * `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` are unset, this no-ops
 * (allows) and logs once — provision Upstash to turn it on, no code change.
 */
const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

let warned = false;
const limiters = new Map<string, Ratelimit>();

function getLimiter(name: string, max: number, windowSec: number): Ratelimit | null {
  if (!redis) {
    if (!warned) {
      warned = true;
      console.warn(
        "[rate-limit] UPSTASH_REDIS_REST_URL/TOKEN unset — rate limiting is OFF.",
      );
    }
    return null;
  }
  const cacheKey = `${name}:${max}:${windowSec}`;
  let limiter = limiters.get(cacheKey);
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(max, `${windowSec} s`),
      prefix: `rl:${name}`,
      analytics: false,
    });
    limiters.set(cacheKey, limiter);
  }
  return limiter;
}

/** Best-effort client IP from edge/proxy headers (use only for coarse limiting). */
export function clientIp(headers: Headers): string {
  return (
    headers.get("cf-connecting-ip") ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Returns `{ ok }` — `false` means the caller exceeded the limit (respond 429).
 * Allows (fails open) when Upstash isn't configured or errors, so a limiter
 * outage never takes down the endpoint.
 */
export async function rateLimit(opts: {
  name: string;
  key: string;
  max: number;
  windowSec: number;
}): Promise<{ ok: boolean; remaining: number }> {
  const limiter = getLimiter(opts.name, opts.max, opts.windowSec);
  if (!limiter) return { ok: true, remaining: opts.max };
  try {
    const { success, remaining } = await limiter.limit(opts.key);
    return { ok: success, remaining };
  } catch (err) {
    console.error("[rate-limit] limiter error, allowing:", err);
    return { ok: true, remaining: opts.max };
  }
}
