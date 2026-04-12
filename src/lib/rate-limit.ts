/**
 * Simple in-memory rate limiter — no external services, free.
 *
 * Trade-offs:
 * - Per-instance: on Vercel, each serverless instance has its own Map, so the
 *   effective limit can be higher than configured if many instances are warm.
 *   For low-traffic app this is fine; use Upstash if you need cross-instance.
 * - LRU cleanup on each call prevents unbounded memory growth.
 *
 * Returns { allowed, remaining, resetAt }.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 5000;

function cleanup(now: number) {
  if (buckets.size < MAX_KEYS) return;
  // Drop expired or oldest entries
  const toDelete: string[] = [];
  buckets.forEach((b, k) => {
    if (b.resetAt < now) toDelete.push(k);
  });
  toDelete.forEach((k) => buckets.delete(k));
  // If still too big, drop oldest by resetAt
  if (buckets.size >= MAX_KEYS) {
    const sorted = Array.from(buckets.entries()).sort(
      (a, b) => a[1].resetAt - b[1].resetAt
    );
    for (let i = 0; i < sorted.length - MAX_KEYS + 500; i++) {
      buckets.delete(sorted[i][0]);
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check a rate-limit bucket for `key`. Call once per request.
 * Increments the bucket if allowed.
 *
 * @param key    Unique bucket key (e.g. "signup:203.0.113.1")
 * @param limit  Max requests in the window
 * @param windowMs  Window duration in milliseconds
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  cleanup(now);
  const existing = buckets.get(key);
  if (!existing || existing.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }
  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }
  existing.count++;
  return { allowed: true, remaining: limit - existing.count, resetAt: existing.resetAt };
}

/** Extract client IP from request headers (Vercel-aware). */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

/** Build a 429 response with standard headers. */
export function rateLimitResponse(result: RateLimitResult): Response {
  const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
  return new Response(
    JSON.stringify({
      error: `Too many requests. Try again in ${retryAfter}s.`,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.floor(result.resetAt / 1000)),
      },
    }
  );
}
