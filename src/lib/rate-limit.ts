// In-memory sliding window rate limiter. Resets per serverless instance,
// which is enough to stop one IP from hammering an LLM endpoint and
// burning through the Anthropic spend cap. For cross-instance correctness
// in production this would move to Upstash Redis or Vercel KV.

type Bucket = number[];
const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

export function checkRateLimit(
  key: string,
  { windowMs, max }: { windowMs: number; max: number },
): RateLimitResult {
  const now = Date.now();
  const cutoff = now - windowMs;
  const existing = buckets.get(key) ?? [];
  const fresh = existing.filter((t) => t > cutoff);

  if (fresh.length >= max) {
    const oldest = Math.min(...fresh);
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(1000, oldest + windowMs - now),
    };
  }

  fresh.push(now);
  buckets.set(key, fresh);

  // Cheap periodic cleanup so the Map doesn't grow forever.
  if (buckets.size > 1000) {
    for (const [k, v] of buckets) {
      const f = v.filter((t) => t > cutoff);
      if (f.length === 0) buckets.delete(k);
      else buckets.set(k, f);
    }
  }

  return { allowed: true, remaining: max - fresh.length, retryAfterMs: 0 };
}

// Best-effort client key. Vercel sets x-forwarded-for to the real client IP.
// If no header is present (e.g., local dev), all requests share one bucket.
export function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "anon";
}

// Standard 429 Response with Retry-After header, ready to return from a
// route handler.
export function rateLimited(result: RateLimitResult): Response {
  return Response.json(
    {
      error: "Too many requests. Slow down and try again in a moment.",
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.ceil(result.retryAfterMs / 1000)),
      },
    },
  );
}
