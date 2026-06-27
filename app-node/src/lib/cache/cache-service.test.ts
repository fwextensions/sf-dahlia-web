import { describe, it, expect, beforeEach, vi } from "vitest"
import { CacheService, CACHE_TTL } from "./cache-service"

/**
 * Mock Redis client that simulates ioredis behavior in-memory.
 */
function createMockRedis() {
  const store = new Map<string, { value: string; expireAt?: number }>()

  const mock = {
    get: vi.fn(async (key: string): Promise<string | null> => {
      const entry = store.get(key)
      if (!entry) return null
      if (entry.expireAt && Date.now() > entry.expireAt) {
        store.delete(key)
        return null
      }
      return entry.value
    }),
    set: vi.fn(async (...args: unknown[]): Promise<"OK"> => {
      const key = args[0] as string
      const value = args[1] as string
      if (args[2] === "EX") {
        const ttl = args[3] as number
        store.set(key, { value, expireAt: Date.now() + ttl * 1000 })
      } else {
        store.set(key, { value })
      }
      return "OK"
    }),
    del: vi.fn(async (...keys: unknown[]): Promise<number> => {
      let count = 0
      for (const key of keys) {
        if (store.delete(key as string)) count++
      }
      return count
    }),
    scan: vi.fn(async (
      _cursor: string,
      _match: string,
      pattern: string,
      _count: string,
      _countValue: number
    ): Promise<[string, string[]]> => {
      const matchingKeys: string[] = []
      const regex = new RegExp(
        "^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$"
      )
      for (const key of store.keys()) {
        if (regex.test(key)) {
          matchingKeys.push(key)
        }
      }
      return ["0", matchingKeys]
    }),
    _store: store,
  }

  return mock
}

type MockRedis = ReturnType<typeof createMockRedis>

describe("CacheService", () => {
  let cacheService: CacheService
  let mockRedis: MockRedis

  beforeEach(() => {
    mockRedis = createMockRedis()
    cacheService = new CacheService({ redis: mockRedis as any })
  })

  describe("get", () => {
    it("returns null for non-existent key", async () => {
      const result = await cacheService.get("nonexistent")
      expect(result).toBeNull()
    })

    it("returns parsed JSON value for existing key", async () => {
      mockRedis._store.set("mykey", { value: JSON.stringify({ name: "test" }) })
      const result = await cacheService.get<{ name: string }>("mykey")
      expect(result).toEqual({ name: "test" })
    })

    it("returns null for unparseable values", async () => {
      mockRedis._store.set("badkey", { value: "not-json{{{" })
      const result = await cacheService.get("badkey")
      expect(result).toBeNull()
    })
  })

  describe("set", () => {
    it("stores value without TTL when ttl not provided", async () => {
      await cacheService.set("key1", { data: "hello" })
      expect(mockRedis.set).toHaveBeenCalledWith("key1", '{"data":"hello"}')
      // Also stores stale copy
      expect(mockRedis.set).toHaveBeenCalledWith("stale:key1", '{"data":"hello"}')
    })

    it("stores value with TTL in seconds", async () => {
      await cacheService.set("key2", { data: "world" }, 600)
      expect(mockRedis.set).toHaveBeenCalledWith("key2", '{"data":"world"}', "EX", 600)
      expect(mockRedis.set).toHaveBeenCalledWith("stale:key2", '{"data":"world"}')
    })
  })

  describe("invalidate", () => {
    it("deletes keys matching the pattern", async () => {
      mockRedis._store.set("listings:1", { value: '"data1"' })
      mockRedis._store.set("listings:2", { value: '"data2"' })
      mockRedis._store.set("other:1", { value: '"other"' })

      await cacheService.invalidate("listings:*")

      expect(mockRedis.del).toHaveBeenCalledWith("listings:1", "listings:2")
    })

    it("does nothing when no keys match", async () => {
      mockRedis._store.set("other:1", { value: '"other"' })
      await cacheService.invalidate("listings:*")
      expect(mockRedis.del).not.toHaveBeenCalled()
    })
  })

  describe("generateCacheKey", () => {
    it("returns endpoint path when no params", () => {
      const key = cacheService.generateCacheKey("/api/v1/listings")
      expect(key).toBe("api/v1/listings")
    })

    it("strips leading/trailing slashes from endpoint", () => {
      const key = cacheService.generateCacheKey("/api/v1/listings/")
      expect(key).toBe("api/v1/listings")
    })

    it("appends sorted query params", () => {
      const key = cacheService.generateCacheKey("/api/v1/listings", {
        type: "rental",
        ids: "abc",
      })
      expect(key).toBe("api/v1/listings?ids=abc&type=rental")
    })

    it("sorts params alphabetically by key", () => {
      const key = cacheService.generateCacheKey("/listings", {
        z: "last",
        a: "first",
        m: "middle",
      })
      expect(key).toBe("listings?a=first&m=middle&z=last")
    })

    it("treats empty params object same as no params", () => {
      const key = cacheService.generateCacheKey("/listings", {})
      expect(key).toBe("listings")
    })
  })

  describe("cachedGet", () => {
    it("returns cached value without calling fetchFn when cache hit and not force", async () => {
      mockRedis._store.set("api/v1/listings", {
        value: JSON.stringify([{ id: "1" }]),
      })

      const fetchFn = vi.fn()
      const result = await cacheService.cachedGet(
        "/api/v1/listings",
        undefined,
        false,
        fetchFn
      )

      expect(result).toEqual([{ id: "1" }])
      expect(fetchFn).not.toHaveBeenCalled()
    })

    it("uses the ttl override instead of the param-derived default", async () => {
      const fetchFn = vi.fn().mockResolvedValue({
        data: [{ id: "ami" }],
        status: 200,
      })

      // With params this would normally resolve to CACHE_TTL.withParams (600s);
      // the override must win so annual AMI data isn't evicted every 10 minutes.
      await cacheService.cachedGet(
        "/api/v1/listings/ami",
        { charts: "MOHCD:2024:50" },
        false,
        fetchFn,
        CACHE_TTL.amiData
      )

      expect(mockRedis.set).toHaveBeenCalledWith(
        "api/v1/listings/ami?charts=MOHCD:2024:50",
        JSON.stringify([{ id: "ami" }]),
        "EX",
        CACHE_TTL.amiData
      )
    })

    it("falls back to the param-derived ttl when no override is given", async () => {
      const fetchFn = vi.fn().mockResolvedValue({
        data: [{ id: "x" }],
        status: 200,
      })

      await cacheService.cachedGet(
        "/api/v1/listings/ami",
        { charts: "MOHCD:2024:50" },
        false,
        fetchFn
      )

      expect(mockRedis.set).toHaveBeenCalledWith(
        "api/v1/listings/ami?charts=MOHCD:2024:50",
        JSON.stringify([{ id: "x" }]),
        "EX",
        CACHE_TTL.withParams
      )
    })

    it("calls fetchFn on cache miss", async () => {
      const fetchFn = vi.fn().mockResolvedValue({
        data: [{ id: "2" }],
        status: 200,
      })

      const result = await cacheService.cachedGet(
        "/api/v1/listings",
        undefined,
        false,
        fetchFn
      )

      expect(result).toEqual([{ id: "2" }])
      expect(fetchFn).toHaveBeenCalledOnce()
    })

    it("bypasses cache when force=true", async () => {
      mockRedis._store.set("api/v1/listings", {
        value: JSON.stringify([{ id: "old" }]),
      })

      const fetchFn = vi.fn().mockResolvedValue({
        data: [{ id: "fresh" }],
        status: 200,
      })

      const result = await cacheService.cachedGet(
        "/api/v1/listings",
        undefined,
        true,
        fetchFn
      )

      expect(result).toEqual([{ id: "fresh" }])
      expect(fetchFn).toHaveBeenCalledOnce()
    })

    it("stores response in cache only on 2xx status", async () => {
      const fetchFn = vi.fn().mockResolvedValue({
        data: [{ id: "new" }],
        status: 200,
      })

      await cacheService.cachedGet("/api/v1/listings", undefined, false, fetchFn)

      // Verify the value was stored
      const stored = await cacheService.get("api/v1/listings")
      expect(stored).toEqual([{ id: "new" }])
    })

    it("does NOT store response on non-2xx status", async () => {
      const fetchFn = vi.fn().mockResolvedValue({
        data: { error: "not found" },
        status: 404,
      })

      const result = await cacheService.cachedGet(
        "/api/v1/listings",
        undefined,
        false,
        fetchFn
      )

      expect(result).toEqual({ error: "not found" })
      // Verify nothing was stored
      const stored = await cacheService.get("api/v1/listings")
      expect(stored).toBeNull()
    })

    it("does NOT store on force-refresh when response is non-2xx", async () => {
      // Pre-populate cache with old data
      await cacheService.set("api/v1/listings", [{ id: "old" }], 86400)

      const fetchFn = vi.fn().mockResolvedValue({
        data: { error: "server error" },
        status: 500,
      })

      // Force refresh but server returns 500 — the fetch doesn't throw so it returns the data
      // But since it's not 2xx, it should NOT update cache
      const result = await cacheService.cachedGet(
        "/api/v1/listings",
        undefined,
        true,
        fetchFn
      )

      expect(result).toEqual({ error: "server error" })
    })

    it("returns stale cached value on fetchFn error", async () => {
      // Store a stale value
      await cacheService.set("api/v1/listings", [{ id: "stale" }], 600)

      const fetchFn = vi.fn().mockRejectedValue(new Error("Connection timeout"))

      const result = await cacheService.cachedGet(
        "/api/v1/listings",
        undefined,
        true,
        fetchFn
      )

      expect(result).toEqual([{ id: "stale" }])
    })

    it("propagates error when fetchFn fails and no stale cache exists", async () => {
      const fetchFn = vi.fn().mockRejectedValue(new Error("Connection timeout"))

      await expect(
        cacheService.cachedGet("/api/v1/listings", undefined, false, fetchFn)
      ).rejects.toThrow("Connection timeout")
    })

    it("applies withParams TTL (600s) when params are present", async () => {
      const fetchFn = vi.fn().mockResolvedValue({
        data: { items: [] },
        status: 200,
      })

      await cacheService.cachedGet(
        "/api/v1/listings",
        { type: "rental" },
        false,
        fetchFn
      )

      // Check that set was called with TTL 600
      expect(mockRedis.set).toHaveBeenCalledWith(
        "api/v1/listings?type=rental",
        expect.any(String),
        "EX",
        600
      )
    })

    it("applies withoutParams TTL (86400s) when no params", async () => {
      const fetchFn = vi.fn().mockResolvedValue({
        data: { items: [] },
        status: 200,
      })

      await cacheService.cachedGet("/api/v1/listings", undefined, false, fetchFn)

      expect(mockRedis.set).toHaveBeenCalledWith(
        "api/v1/listings",
        expect.any(String),
        "EX",
        86400
      )
    })

    it("applies oauthToken TTL (7200s) for OAuth endpoints", async () => {
      const fetchFn = vi.fn().mockResolvedValue({
        data: { access_token: "abc" },
        status: 200,
      })

      await cacheService.cachedGet("/oauth/token", undefined, false, fetchFn)

      expect(mockRedis.set).toHaveBeenCalledWith(
        "oauth/token",
        expect.any(String),
        "EX",
        7200
      )
    })
  })

  describe("CACHE_TTL constants", () => {
    it("has correct TTL values", () => {
      expect(CACHE_TTL.withParams).toBe(600)
      expect(CACHE_TTL.withoutParams).toBe(86400)
      expect(CACHE_TTL.oauthToken).toBe(7200)
    })
  })
})
