import { describe, expect, it, vi, beforeEach } from "vitest"
import {
  withRetry,
  isRetryableError,
  RetryExhaustedError,
  DEFAULT_RETRY_CONFIG,
  type SleepFn,
} from "./retry"
import { ProxyClientError } from "./client"
import { CacheService } from "../cache/cache-service"

// No-op sleep for fast tests
const noopSleep: SleepFn = async () => {}

// Track delays for backoff verification
function createTrackingSleep(): { sleep: SleepFn; delays: number[] } {
  const delays: number[] = []
  const sleep: SleepFn = async (ms) => {
    delays.push(ms)
  }
  return { sleep, delays }
}

describe("isRetryableError", () => {
  it("returns true for 5xx ProxyClientError", () => {
    expect(isRetryableError(new ProxyClientError("fail", 500, ""))).toBe(true)
    expect(isRetryableError(new ProxyClientError("fail", 502, ""))).toBe(true)
    expect(isRetryableError(new ProxyClientError("fail", 503, ""))).toBe(true)
  })

  it("returns false for 4xx ProxyClientError", () => {
    expect(isRetryableError(new ProxyClientError("fail", 400, ""))).toBe(false)
    expect(isRetryableError(new ProxyClientError("fail", 404, ""))).toBe(false)
    expect(isRetryableError(new ProxyClientError("fail", 422, ""))).toBe(false)
  })

  it("returns true for TimeoutError", () => {
    const err = new Error("timeout")
    err.name = "TimeoutError"
    expect(isRetryableError(err)).toBe(true)
  })

  it("returns true for AbortError", () => {
    const err = new Error("aborted")
    err.name = "AbortError"
    expect(isRetryableError(err)).toBe(true)
  })

  it("returns true for TypeError (network error)", () => {
    const err = new TypeError("fetch failed")
    expect(isRetryableError(err)).toBe(true)
  })

  it("returns false for generic errors", () => {
    expect(isRetryableError(new Error("something"))).toBe(false)
    expect(isRetryableError(new RangeError("out of range"))).toBe(false)
  })
})

describe("withRetry", () => {
  describe("successful calls", () => {
    it("returns result on first attempt success", async () => {
      const fn = vi.fn().mockResolvedValue("success")

      const result = await withRetry(fn, { sleep: noopSleep })

      expect(result).toBe("success")
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it("returns result after retries succeed", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new ProxyClientError("fail", 500, ""))
        .mockRejectedValueOnce(new ProxyClientError("fail", 502, ""))
        .mockResolvedValue("recovered")

      const result = await withRetry(fn, { sleep: noopSleep })

      expect(result).toBe("recovered")
      expect(fn).toHaveBeenCalledTimes(3)
    })
  })

  describe("4xx errors - never retried", () => {
    it("propagates 4xx error immediately without retrying", async () => {
      const fn = vi
        .fn()
        .mockRejectedValue(new ProxyClientError("Not Found", 404, ""))

      await expect(withRetry(fn, { sleep: noopSleep })).rejects.toThrow(
        ProxyClientError
      )
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it("propagates 422 error immediately", async () => {
      const fn = vi
        .fn()
        .mockRejectedValue(
          new ProxyClientError("Unprocessable", 422, "validation error")
        )

      await expect(withRetry(fn, { sleep: noopSleep })).rejects.toThrow(
        ProxyClientError
      )
      expect(fn).toHaveBeenCalledTimes(1)
    })
  })

  describe("exponential backoff", () => {
    it("uses delays of 1s, 2s, 4s for 3 retries", async () => {
      const { sleep, delays } = createTrackingSleep()
      const fn = vi
        .fn()
        .mockRejectedValue(new ProxyClientError("fail", 500, ""))

      await expect(
        withRetry(fn, { sleep, config: { maxRetries: 3, baseDelayMs: 1000 } })
      ).rejects.toThrow(RetryExhaustedError)

      // 3 delays: before retry 1, 2, and 3
      expect(delays).toEqual([1000, 2000, 4000])
    })

    it("respects custom base delay", async () => {
      const { sleep, delays } = createTrackingSleep()
      const fn = vi
        .fn()
        .mockRejectedValue(new ProxyClientError("fail", 500, ""))

      await expect(
        withRetry(fn, { sleep, config: { maxRetries: 2, baseDelayMs: 500 } })
      ).rejects.toThrow(RetryExhaustedError)

      expect(delays).toEqual([500, 1000])
    })
  })

  describe("retry exhaustion", () => {
    it("throws RetryExhaustedError after all attempts fail", async () => {
      const fn = vi
        .fn()
        .mockRejectedValue(new ProxyClientError("Server Error", 500, ""))

      try {
        await withRetry(fn, { sleep: noopSleep })
        expect.fail("should have thrown")
      } catch (e) {
        expect(e).toBeInstanceOf(RetryExhaustedError)
        expect((e as RetryExhaustedError).lastError).toBeInstanceOf(
          ProxyClientError
        )
      }

      // 1 initial + 3 retries = 4 total attempts
      expect(fn).toHaveBeenCalledTimes(4)
    })

    it("throws RetryExhaustedError for timeout errors", async () => {
      const timeoutErr = new Error("timeout")
      timeoutErr.name = "TimeoutError"
      const fn = vi.fn().mockRejectedValue(timeoutErr)

      await expect(withRetry(fn, { sleep: noopSleep })).rejects.toThrow(
        RetryExhaustedError
      )
      expect(fn).toHaveBeenCalledTimes(4)
    })
  })

  describe("cache fallback", () => {
    let mockRedis: {
      get: ReturnType<typeof vi.fn>
      set: ReturnType<typeof vi.fn>
      scan: ReturnType<typeof vi.fn>
      del: ReturnType<typeof vi.fn>
    }
    let cacheService: CacheService

    beforeEach(() => {
      mockRedis = {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue("OK"),
        scan: vi.fn().mockResolvedValue(["0", []]),
        del: vi.fn().mockResolvedValue(0),
      }
      cacheService = new CacheService({ redis: mockRedis as any })
    })

    it("returns cached data when all retries fail and cache exists", async () => {
      const cachedData = { listingID: "123", name: "Cached Listing" }
      mockRedis.get.mockImplementation(async (key: string) => {
        if (key === "listings/123") {
          return JSON.stringify(cachedData)
        }
        return null
      })

      const fn = vi
        .fn()
        .mockRejectedValue(new ProxyClientError("fail", 500, ""))

      const result = await withRetry(fn, {
        sleep: noopSleep,
        cacheService,
        cacheKey: "listings/123",
      })

      expect(result).toEqual(cachedData)
    })

    it("returns stale cached data when primary cache is empty", async () => {
      const staleData = { listingID: "123", name: "Stale Listing" }
      mockRedis.get.mockImplementation(async (key: string) => {
        if (key === "stale:listings/123") {
          return JSON.stringify(staleData)
        }
        return null
      })

      const fn = vi
        .fn()
        .mockRejectedValue(new ProxyClientError("fail", 500, ""))

      const result = await withRetry(fn, {
        sleep: noopSleep,
        cacheService,
        cacheKey: "listings/123",
      })

      expect(result).toEqual(staleData)
    })

    it("throws RetryExhaustedError when no cache data exists", async () => {
      mockRedis.get.mockResolvedValue(null)

      const fn = vi
        .fn()
        .mockRejectedValue(new ProxyClientError("fail", 500, ""))

      await expect(
        withRetry(fn, {
          sleep: noopSleep,
          cacheService,
          cacheKey: "listings/123",
        })
      ).rejects.toThrow(RetryExhaustedError)
    })

    it("does not attempt cache fallback when no cacheService is provided", async () => {
      const fn = vi
        .fn()
        .mockRejectedValue(new ProxyClientError("fail", 500, ""))

      await expect(withRetry(fn, { sleep: noopSleep })).rejects.toThrow(
        RetryExhaustedError
      )
    })
  })

  describe("mixed error scenarios", () => {
    it("retries 5xx then succeeds", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new ProxyClientError("fail", 503, ""))
        .mockResolvedValueOnce("ok")

      const result = await withRetry(fn, { sleep: noopSleep })

      expect(result).toBe("ok")
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it("retries timeout then succeeds", async () => {
      const timeoutErr = new Error("timeout")
      timeoutErr.name = "TimeoutError"

      const fn = vi
        .fn()
        .mockRejectedValueOnce(timeoutErr)
        .mockResolvedValueOnce("recovered")

      const result = await withRetry(fn, { sleep: noopSleep })

      expect(result).toBe("recovered")
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it("does not retry after 4xx even if preceded by retryable errors", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new ProxyClientError("fail", 500, ""))
        .mockRejectedValueOnce(new ProxyClientError("bad request", 400, ""))

      await expect(withRetry(fn, { sleep: noopSleep })).rejects.toThrow(
        ProxyClientError
      )
      // 1 initial (5xx) + 1 retry (4xx, stops) = 2 calls
      expect(fn).toHaveBeenCalledTimes(2)
    })
  })
})
