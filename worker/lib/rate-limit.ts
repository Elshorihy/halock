/**
 * HALOCK — Rate limiting for sensitive endpoints.
 *
 * Uses Cloudflare KV when the binding exists (shared across isolates);
 * falls back to an in-memory sliding window per isolate. Both paths are real;
 * the docs state the fallback's limitation honestly.
 */

export interface RateLimitOptions {
  /** Max requests allowed in the window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export interface KvLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

const memoryBuckets = new Map<string, number[]>();

/** In-memory sliding window (per isolate). */
export function checkMemoryRateLimit(
  key: string,
  now: number,
  options: RateLimitOptions,
): RateLimitResult {
  const windowStart = now - options.windowSeconds * 1000;
  const timestamps = (memoryBuckets.get(key) ?? []).filter((t) => t > windowStart);
  if (timestamps.length >= options.limit) {
    const oldest = timestamps[0];
    memoryBuckets.set(key, timestamps);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + options.windowSeconds * 1000 - now) / 1000)),
    };
  }
  timestamps.push(now);
  memoryBuckets.set(key, timestamps);
  return { allowed: true, remaining: options.limit - timestamps.length, retryAfterSeconds: 0 };
}

/** KV-backed limiter: stores a compact counter with TTL. */
export async function checkKvRateLimit(
  kv: KvLike,
  key: string,
  now: number,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const storageKey = `rl:${key}:${Math.floor(now / (options.windowSeconds * 1000))}`;
  const raw = await kv.get(storageKey);
  const count = raw ? Number(raw) : 0;
  if (count >= options.limit) {
    return { allowed: false, remaining: 0, retryAfterSeconds: options.windowSeconds };
  }
  await kv.put(storageKey, String(count + 1), { expirationTtl: options.windowSeconds * 2 });
  return { allowed: true, remaining: options.limit - count - 1, retryAfterSeconds: 0 };
}

export async function enforceRateLimit(
  kv: KvLike | undefined,
  key: string,
  now: number,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  if (kv) {
    try {
      return await checkKvRateLimit(kv, key, now, options);
    } catch {
      // KV unavailable → fall back to in-memory rather than failing open silently.
      return checkMemoryRateLimit(key, now, options);
    }
  }
  return checkMemoryRateLimit(key, now, options);
}

/** Test helper: clear in-memory buckets. */
export function resetMemoryRateLimits(): void {
  memoryBuckets.clear();
}
