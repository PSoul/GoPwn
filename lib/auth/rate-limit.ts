/**
 * In-memory sliding-window rate limiter.
 *
 * Each limiter tracks request timestamps per key (typically IP address).
 * Old entries are pruned on every check to prevent memory leaks.
 */

type RateLimitEntry = {
  timestamps: number[]
}

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  retryAfterMs: number
}

export function createRateLimiter(opts: {
  windowMs: number
  maxRequests: number
}) {
  const store = new Map<string, RateLimitEntry>()

  // Periodic cleanup of expired entries (every 60s)
  const CLEANUP_INTERVAL = 60_000
  let lastCleanup = Date.now()

  function cleanup(now: number) {
    if (now - lastCleanup < CLEANUP_INTERVAL) return
    lastCleanup = now
    const cutoff = now - opts.windowMs
    for (const [key, entry] of store) {
      entry.timestamps = entry.timestamps.filter((t) => t > cutoff)
      if (entry.timestamps.length === 0) {
        store.delete(key)
      }
    }
  }

  return function check(key: string): RateLimitResult {
    const now = Date.now()
    cleanup(now)

    const cutoff = now - opts.windowMs
    let entry = store.get(key)

    if (!entry) {
      entry = { timestamps: [] }
      store.set(key, entry)
    }

    // Remove timestamps outside the window
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff)

    if (entry.timestamps.length >= opts.maxRequests) {
      const oldestInWindow = entry.timestamps[0]
      const retryAfterMs = oldestInWindow + opts.windowMs - now
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.max(retryAfterMs, 0),
      }
    }

    entry.timestamps.push(now)
    return {
      allowed: true,
      remaining: opts.maxRequests - entry.timestamps.length,
      retryAfterMs: 0,
    }
  }
}

// ── Shared limiters ──────────────────────────────────────────

/** Login: 5 attempts per 60 seconds per IP (relaxed in development) */
export const loginLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: process.env.NODE_ENV === "production" ? 5 : 50,
})

/** General API: 60 requests per 60 seconds per IP (relaxed in development) */
export const apiLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: process.env.NODE_ENV === "production" ? 60 : 500,
})
