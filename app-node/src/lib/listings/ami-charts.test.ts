import { describe, it, expect, vi, beforeEach } from "vitest"
import { resolveAmiChartsCached } from "./server-fns"
import { CacheService, CACHE_TTL } from "../cache/cache-service"
import type { AmiChartMetaInput } from "./server-fns"

/** Minimal in-memory ioredis stand-in (mirrors cache-service.test.ts). */
function createMockRedis() {
  const store = new Map<string, { value: string; expireAt?: number }>()
  return {
    get: vi.fn(async (key: string) => {
      const e = store.get(key)
      if (!e) return null
      if (e.expireAt && Date.now() > e.expireAt) {
        store.delete(key)
        return null
      }
      return e.value
    }),
    set: vi.fn(async (...args: unknown[]) => {
      const [key, value, ex, ttl] = args as [string, string, string?, number?]
      store.set(key, ex === "EX" ? { value, expireAt: Date.now() + ttl! * 1000 } : { value })
      return "OK" as const
    }),
    _store: store,
  }
}

const meta = (
  percent: number,
  derivedFrom: string,
  year = 2024,
  type = "MOHCD"
): AmiChartMetaInput => ({ year, type, percent, derivedFrom })

/** Fake Rails chart for a meta: chartType/year live on the values (as Rails returns). */
const railsChart = (m: AmiChartMetaInput) => ({
  percent: m.percent,
  values: [
    { numOfHousehold: 1, amount: m.percent * 1000, chartType: m.type, year: m.year, percent: m.percent },
  ],
})

function makeDeps(getAmiCharts: ReturnType<typeof vi.fn>) {
  const redis = createMockRedis()
  const cacheService = new CacheService({ redis: redis as never })
  return {
    redis,
    deps: {
      cacheService,
      proxyClient: { listings: { getAmiCharts } } as never,
      // Passthrough retry so we can assert the underlying fetch directly.
      withRetry: ((fn: () => unknown) => fn()) as never,
    },
  }
}

describe("resolveAmiChartsCached", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns [] for no charts without touching the backend", async () => {
    const getAmiCharts = vi.fn()
    const { deps } = makeDeps(getAmiCharts)
    expect(await resolveAmiChartsCached([], deps)).toEqual([])
    expect(getAmiCharts).not.toHaveBeenCalled()
  })

  it("fetches all misses in ONE batched call and attaches derivedFrom in order", async () => {
    const getAmiCharts = vi.fn(async (charts: AmiChartMetaInput[]) => charts.map(railsChart))
    const { deps } = makeDeps(getAmiCharts)

    const req = [meta(50, "MaxAmi"), meta(60, "MinAmi")]
    const result = await resolveAmiChartsCached(req, deps)

    expect(getAmiCharts).toHaveBeenCalledTimes(1)
    expect(getAmiCharts).toHaveBeenCalledWith(req)
    expect(result.map((c) => [c.percent, c.derivedFrom])).toEqual([
      [50, "MaxAmi"],
      [60, "MinAmi"],
    ])
  })

  it("caches each chart WITHOUT derivedFrom and with the long AMI TTL", async () => {
    const getAmiCharts = vi.fn(async (charts: AmiChartMetaInput[]) => charts.map(railsChart))
    const { redis, deps } = makeDeps(getAmiCharts)

    await resolveAmiChartsCached([meta(50, "MaxAmi")], deps)

    const key = "api/v1/listings/ami?chartType=MOHCD&percent=50&year=2024"
    expect(redis.set).toHaveBeenCalledWith(key, expect.any(String), "EX", CACHE_TTL.amiData)
    const stored = JSON.parse(redis._store.get(key)!.value)
    expect(stored.derivedFrom).toBeUndefined() // shareable across listings
    expect(stored.percent).toBe(50)
  })

  it("only fetches the misses when some charts are already cached", async () => {
    const getAmiCharts = vi.fn(async (charts: AmiChartMetaInput[]) => charts.map(railsChart))
    const { deps } = makeDeps(getAmiCharts)

    // Warm 50% (e.g. from another listing), then request 50% + 80%.
    await resolveAmiChartsCached([meta(50, "MaxAmi")], deps)
    getAmiCharts.mockClear()

    const result = await resolveAmiChartsCached([meta(50, "MinAmi"), meta(80, "MaxAmi")], deps)

    // 50% served from cache; only 80% fetched.
    expect(getAmiCharts).toHaveBeenCalledTimes(1)
    expect(getAmiCharts).toHaveBeenCalledWith([meta(80, "MaxAmi")])
    // Cached 50% still gets the new request's derivedFrom applied.
    expect(result.map((c) => [c.percent, c.derivedFrom])).toEqual([
      [50, "MinAmi"],
      [80, "MaxAmi"],
    ])
  })

  it("does not call the backend when every chart is cached", async () => {
    const getAmiCharts = vi.fn(async (charts: AmiChartMetaInput[]) => charts.map(railsChart))
    const { deps } = makeDeps(getAmiCharts)

    await resolveAmiChartsCached([meta(50, "MaxAmi"), meta(80, "MaxAmi")], deps)
    getAmiCharts.mockClear()

    await resolveAmiChartsCached([meta(80, "MinAmi"), meta(50, "MinAmi")], deps)
    expect(getAmiCharts).not.toHaveBeenCalled()
  })

  it("falls back to a stale copy when the fetch fails, else rethrows", async () => {
    // First, warm the cache so a stale: copy exists.
    const okFetch = vi.fn(async (charts: AmiChartMetaInput[]) => charts.map(railsChart))
    const { redis, deps } = makeDeps(okFetch)
    await resolveAmiChartsCached([meta(50, "MaxAmi")], deps)

    // Expire the live key but keep the never-expiring stale copy.
    redis._store.delete("api/v1/listings/ami?chartType=MOHCD&percent=50&year=2024")

    // New deps that fail the fetch but share the same redis store.
    const failFetch = vi.fn(async () => {
      throw new Error("backend down")
    })
    const cacheService = new CacheService({ redis: redis as never })
    const failingDeps = {
      cacheService,
      proxyClient: { listings: { getAmiCharts: failFetch } } as never,
      withRetry: ((fn: () => unknown) => fn()) as never,
    }

    const result = await resolveAmiChartsCached([meta(50, "MinAmi")], failingDeps)
    expect(result.map((c) => [c.percent, c.derivedFrom])).toEqual([[50, "MinAmi"]])

    // A chart with no stale copy must rethrow.
    await expect(
      resolveAmiChartsCached([meta(999, "MaxAmi")], failingDeps)
    ).rejects.toThrow("backend down")
  })
})
