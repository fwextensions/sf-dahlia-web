import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

describe("Redis Connection Options", () => {
  const originalEnv = process.env.REDIS_URL

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.REDIS_URL = originalEnv
    } else {
      delete process.env.REDIS_URL
    }
    vi.resetModules()
  })

  it("parses REDIS_URL into connection options", async () => {
    process.env.REDIS_URL = "redis://myuser:mypass@redis.example.com:6380"
    const { getConnectionOptions } = await import("../connection")
    const opts = getConnectionOptions()

    expect(opts.host).toBe("redis.example.com")
    expect(opts.port).toBe(6380)
    expect(opts.password).toBe("mypass")
    expect(opts.username).toBe("myuser")
  })

  it("defaults to localhost:6379 when REDIS_URL is not set", async () => {
    delete process.env.REDIS_URL
    const { getConnectionOptions } = await import("../connection")
    const opts = getConnectionOptions()

    expect(opts.host).toBe("localhost")
    expect(opts.port).toBe(6379)
  })

  it("sets maxRetriesPerRequest to null (required by BullMQ)", async () => {
    const { getConnectionOptions } = await import("../connection")
    const opts = getConnectionOptions()

    expect(opts.maxRetriesPerRequest).toBeNull()
  })

  it("retryStrategy uses exponential backoff capped at 30s", async () => {
    const { getConnectionOptions } = await import("../connection")
    const opts = getConnectionOptions()
    const strategy = opts.retryStrategy as (times: number) => number

    // 2^1 * 1000 = 2000
    expect(strategy(1)).toBe(2000)
    // 2^2 * 1000 = 4000
    expect(strategy(2)).toBe(4000)
    // 2^3 * 1000 = 8000
    expect(strategy(3)).toBe(8000)
    // Capped at 30000
    expect(strategy(10)).toBe(30000)
  })
})
