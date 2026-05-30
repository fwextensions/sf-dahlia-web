import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  RateLimiter,
  applyRateLimit,
  authRateLimiter,
  getClientIp,
  isAuthEndpoint,
} from "./rate-limiter"

describe("RateLimiter", () => {
  let limiter: RateLimiter

  beforeEach(() => {
    limiter = new RateLimiter({ maxRequests: 3, windowSeconds: 60 })
  })

  it("allows requests under the limit", () => {
    expect(limiter.check("1.2.3.4").allowed).toBe(true)
    expect(limiter.check("1.2.3.4").allowed).toBe(true)
    expect(limiter.check("1.2.3.4").allowed).toBe(true)
  })

  it("blocks requests at the limit", () => {
    limiter.check("1.2.3.4")
    limiter.check("1.2.3.4")
    limiter.check("1.2.3.4")

    const result = limiter.check("1.2.3.4")
    expect(result.allowed).toBe(false)
    expect(result.retryAfterSeconds).toBeGreaterThan(0)
  })

  it("tracks IPs independently", () => {
    limiter.check("1.2.3.4")
    limiter.check("1.2.3.4")
    limiter.check("1.2.3.4")

    // Different IP should still be allowed
    expect(limiter.check("5.6.7.8").allowed).toBe(true)
  })

  it("allows requests after the window expires", () => {
    vi.useFakeTimers()

    limiter.check("1.2.3.4")
    limiter.check("1.2.3.4")
    limiter.check("1.2.3.4")

    expect(limiter.check("1.2.3.4").allowed).toBe(false)

    // Advance time past the window
    vi.advanceTimersByTime(61_000)

    expect(limiter.check("1.2.3.4").allowed).toBe(true)

    vi.useRealTimers()
  })

  it("uses sliding window — oldest request expiring opens a slot", () => {
    vi.useFakeTimers()

    limiter.check("1.2.3.4") // t=0
    vi.advanceTimersByTime(20_000)
    limiter.check("1.2.3.4") // t=20s
    vi.advanceTimersByTime(20_000)
    limiter.check("1.2.3.4") // t=40s

    // All 3 slots used, blocked
    expect(limiter.check("1.2.3.4").allowed).toBe(false)

    // Advance to t=61s — first request (t=0) drops out of 60s window
    vi.advanceTimersByTime(21_000)
    expect(limiter.check("1.2.3.4").allowed).toBe(true)

    vi.useRealTimers()
  })

  it("retryAfterSeconds reflects when the oldest request expires", () => {
    vi.useFakeTimers()

    limiter.check("1.2.3.4") // t=0
    vi.advanceTimersByTime(10_000)
    limiter.check("1.2.3.4") // t=10s
    vi.advanceTimersByTime(10_000)
    limiter.check("1.2.3.4") // t=20s

    const result = limiter.check("1.2.3.4")
    expect(result.allowed).toBe(false)
    // Oldest request at t=0 expires at t=60s; we're at t=20s → ~40s remaining
    expect(result.retryAfterSeconds).toBe(40)

    vi.useRealTimers()
  })

  it("cleanup removes expired entries", () => {
    vi.useFakeTimers()

    limiter.check("1.2.3.4")
    vi.advanceTimersByTime(61_000)

    limiter.cleanup()

    // After cleanup, should be allowed again (entry removed)
    expect(limiter.check("1.2.3.4").allowed).toBe(true)

    vi.useRealTimers()
  })

  it("reset clears all data", () => {
    limiter.check("1.2.3.4")
    limiter.check("1.2.3.4")
    limiter.check("1.2.3.4")

    limiter.reset()

    expect(limiter.check("1.2.3.4").allowed).toBe(true)
  })
})

describe("getClientIp", () => {
  it("extracts IP from X-Forwarded-For header", () => {
    const request = new Request("http://localhost/sign-in", {
      headers: { "X-Forwarded-For": "203.0.113.50" },
    })
    expect(getClientIp(request)).toBe("203.0.113.50")
  })

  it("takes the first IP from a multi-value X-Forwarded-For", () => {
    const request = new Request("http://localhost/sign-in", {
      headers: { "X-Forwarded-For": "203.0.113.50, 70.41.3.18, 150.172.238.178" },
    })
    expect(getClientIp(request)).toBe("203.0.113.50")
  })

  it("returns 'unknown' when no forwarded header present", () => {
    const request = new Request("http://localhost/sign-in")
    expect(getClientIp(request)).toBe("unknown")
  })
})

describe("isAuthEndpoint", () => {
  it("matches auth paths directly", () => {
    expect(isAuthEndpoint("/sign-in")).toBe(true)
    expect(isAuthEndpoint("/create-account")).toBe(true)
    expect(isAuthEndpoint("/forgot-password")).toBe(true)
    expect(isAuthEndpoint("/reset-password")).toBe(true)
  })

  it("matches auth paths with language prefix", () => {
    expect(isAuthEndpoint("/en/sign-in")).toBe(true)
    expect(isAuthEndpoint("/es/create-account")).toBe(true)
    expect(isAuthEndpoint("/zh/forgot-password")).toBe(true)
    expect(isAuthEndpoint("/tl/reset-password")).toBe(true)
  })

  it("does not match non-auth paths", () => {
    expect(isAuthEndpoint("/")).toBe(false)
    expect(isAuthEndpoint("/listings")).toBe(false)
    expect(isAuthEndpoint("/account")).toBe(false)
  })

  it("does not match auth paths with invalid language prefix", () => {
    expect(isAuthEndpoint("/fr/sign-in")).toBe(false)
    expect(isAuthEndpoint("/de/create-account")).toBe(false)
  })
})

describe("applyRateLimit", () => {
  beforeEach(() => {
    authRateLimiter.reset()
  })

  it("returns null for non-auth endpoints", () => {
    const request = new Request("http://localhost/listings", {
      headers: { "X-Forwarded-For": "1.2.3.4" },
    })
    expect(applyRateLimit(request)).toBeNull()
  })

  it("returns null when under the limit", () => {
    const request = new Request("http://localhost/sign-in", {
      headers: { "X-Forwarded-For": "1.2.3.4" },
    })
    expect(applyRateLimit(request)).toBeNull()
  })

  it("returns 429 response when limit is exceeded", () => {
    // Exhaust the 10-request limit
    for (let i = 0; i < 10; i++) {
      const req = new Request("http://localhost/sign-in", {
        headers: { "X-Forwarded-For": "1.2.3.4" },
      })
      applyRateLimit(req)
    }

    const request = new Request("http://localhost/sign-in", {
      headers: { "X-Forwarded-For": "1.2.3.4" },
    })
    const response = applyRateLimit(request)

    expect(response).not.toBeNull()
    expect(response!.status).toBe(429)
    expect(response!.headers.get("Retry-After")).toBeTruthy()
    expect(Number(response!.headers.get("Retry-After"))).toBeGreaterThan(0)
  })

  it("includes Retry-After header with seconds value", () => {
    for (let i = 0; i < 10; i++) {
      applyRateLimit(
        new Request("http://localhost/sign-in", {
          headers: { "X-Forwarded-For": "10.0.0.1" },
        })
      )
    }

    const response = applyRateLimit(
      new Request("http://localhost/sign-in", {
        headers: { "X-Forwarded-For": "10.0.0.1" },
      })
    )

    const retryAfter = Number(response!.headers.get("Retry-After"))
    expect(retryAfter).toBeGreaterThanOrEqual(1)
    expect(retryAfter).toBeLessThanOrEqual(60)
  })

  it("rate limits auth paths with language prefix", () => {
    for (let i = 0; i < 10; i++) {
      applyRateLimit(
        new Request("http://localhost/es/sign-in", {
          headers: { "X-Forwarded-For": "2.2.2.2" },
        })
      )
    }

    const response = applyRateLimit(
      new Request("http://localhost/es/sign-in", {
        headers: { "X-Forwarded-For": "2.2.2.2" },
      })
    )

    expect(response).not.toBeNull()
    expect(response!.status).toBe(429)
  })
})
