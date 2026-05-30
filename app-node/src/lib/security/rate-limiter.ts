/**
 * Rate limiter using a sliding window algorithm.
 *
 * Tracks requests per IP address within a configurable time window.
 * Returns HTTP 429 with Retry-After header when threshold is exceeded.
 *
 * Uses an in-memory Map for storage. For production multi-instance
 * deployments, replace with a Redis-backed implementation.
 */

export interface RateLimiterConfig {
  /** Maximum number of requests allowed within the window */
  maxRequests: number
  /** Window size in seconds */
  windowSeconds: number
}

export interface RateLimitResult {
  allowed: boolean
  /** Seconds until the next request is permitted (only set when blocked) */
  retryAfterSeconds?: number
}

interface RequestLog {
  timestamps: number[]
}

/**
 * In-memory sliding window rate limiter.
 */
export class RateLimiter {
  private store = new Map<string, RequestLog>()
  private readonly maxRequests: number
  private readonly windowMs: number

  constructor(config: RateLimiterConfig) {
    this.maxRequests = config.maxRequests
    this.windowMs = config.windowSeconds * 1000
  }

  /**
   * Check if a request from the given IP is allowed.
   * If allowed, records the request timestamp.
   */
  check(ip: string): RateLimitResult {
    const now = Date.now()
    const windowStart = now - this.windowMs

    let log = this.store.get(ip)
    if (!log) {
      log = { timestamps: [] }
      this.store.set(ip, log)
    }

    // Remove timestamps outside the current window
    log.timestamps = log.timestamps.filter((ts) => ts > windowStart)

    if (log.timestamps.length >= this.maxRequests) {
      // Find the oldest timestamp in the window — that's when the first
      // request will expire, making room for a new one.
      const oldestInWindow = log.timestamps[0]
      const retryAfterMs = oldestInWindow + this.windowMs - now
      const retryAfterSeconds = Math.ceil(retryAfterMs / 1000)

      return {
        allowed: false,
        retryAfterSeconds: Math.max(retryAfterSeconds, 1),
      }
    }

    // Record this request
    log.timestamps.push(now)

    return { allowed: true }
  }

  /**
   * Clean up expired entries to prevent memory leaks.
   * Call periodically (e.g., every few minutes).
   */
  cleanup(): void {
    const now = Date.now()
    const windowStart = now - this.windowMs

    const keys = Array.from(this.store.keys())
    for (const ip of keys) {
      const log = this.store.get(ip)!
      log.timestamps = log.timestamps.filter((ts) => ts > windowStart)
      if (log.timestamps.length === 0) {
        this.store.delete(ip)
      }
    }
  }

  /** Reset all stored data (useful for testing) */
  reset(): void {
    this.store.clear()
  }
}

/** Auth endpoint rate limiter: 10 requests per 60-second sliding window */
export const authRateLimiter = new RateLimiter({
  maxRequests: 10,
  windowSeconds: 60,
})

/** Auth endpoint paths that should be rate-limited */
export const AUTH_RATE_LIMITED_PATHS = [
  "/sign-in",
  "/create-account",
  "/forgot-password",
  "/reset-password",
]

/**
 * Extracts the client IP from a request.
 * Checks X-Forwarded-For (for reverse proxies like Heroku) then falls back
 * to a default value.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    // X-Forwarded-For can contain multiple IPs; the first is the client
    return forwarded.split(",")[0].trim()
  }

  // Fallback — in production behind Heroku this shouldn't happen
  return "unknown"
}

/**
 * Checks if a request path is an auth endpoint that should be rate-limited.
 * Matches the path exactly or with a language prefix (e.g., /es/sign-in).
 */
export function isAuthEndpoint(pathname: string): boolean {
  for (const authPath of AUTH_RATE_LIMITED_PATHS) {
    if (pathname === authPath) return true
    // Match with language prefix: /en/sign-in, /es/sign-in, etc.
    if (/^\/(en|es|zh|tl)/.test(pathname)) {
      const withoutLang = pathname.replace(/^\/(en|es|zh|tl)/, "")
      if (withoutLang === authPath) return true
    }
  }
  return false
}

/**
 * Apply rate limiting to a request. Returns a 429 Response if the limit
 * is exceeded, or null if the request is allowed.
 */
export function applyRateLimit(request: Request): Response | null {
  const url = new URL(request.url)

  if (!isAuthEndpoint(url.pathname)) {
    return null
  }

  const ip = getClientIp(request)
  const result = authRateLimiter.check(ip)

  if (!result.allowed) {
    return new Response(
      JSON.stringify({
        error: "Too Many Requests",
        message: "Rate limit exceeded. Please try again later.",
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(result.retryAfterSeconds),
        },
      }
    )
  }

  return null
}
