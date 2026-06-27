import type Redis from "ioredis"

/**
 * Cache TTL rules matching Rails.cache behavior.
 * - withParams: 600s (10 minutes) for endpoints called with query parameters
 * - withoutParams: 86400s (1 day) for endpoints called without query parameters
 * - oauthToken: 7200s (2 hours) for OAuth tokens
 * - amiData: 86400s (1 day). AMI charts are annual data keyed by year, so the
 *   param-based 600s rule is needlessly short — it forces a ~4s Rails recompute
 *   every 10 minutes. AMI callers pass this explicitly via cachedGet's ttl override.
 */
export const CACHE_TTL = {
  withParams: 600,
  withoutParams: 86400,
  oauthToken: 7200,
  amiData: 86400,
} as const

/**
 * Function signature for fetching data from the upstream service.
 * Returns an object with the response data and HTTP status code.
 */
export type FetchFn<T> = () => Promise<{ data: T; status: number }>

export interface CacheServiceOptions {
  redis: Redis
}

export class CacheService {
  private redis: Redis

  constructor(options: CacheServiceOptions) {
    this.redis = options.redis
  }

  /**
   * Retrieve a cached value by key.
   * Returns null if the key does not exist or if Redis is unavailable.
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(key)
      if (raw === null) return null
      try {
        return JSON.parse(raw) as T
      } catch {
        return null
      }
    } catch {
      // Redis unavailable — treat as cache miss
      return null
    }
  }

  /**
   * Store a value in the cache with an optional TTL (in seconds).
   * If no TTL is provided, the key does not expire.
   * Also stores a stale copy (prefixed with "stale:") without TTL
   * so it can be used as fallback on 5xx/timeout errors.
   * Silently no-ops if Redis is unavailable.
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value)
      if (ttl !== undefined && ttl > 0) {
        await this.redis.set(key, serialized, "EX", ttl)
      } else {
        await this.redis.set(key, serialized)
      }
      // Store stale copy without TTL for fallback on errors
      await this.redis.set(`stale:${key}`, serialized)
    } catch {
      // Redis unavailable — skip caching, data will still be returned to caller
    }
  }

  /**
   * Invalidate cache entries matching a glob pattern.
   * Uses Redis SCAN to find matching keys, then deletes them.
   * Silently no-ops if Redis is unavailable.
   */
  async invalidate(pattern: string): Promise<void> {
    try {
      let cursor = "0"
      do {
        const [nextCursor, keys] = await this.redis.scan(
          cursor,
          "MATCH",
          pattern,
          "COUNT",
          100
        )
        cursor = nextCursor
        if (keys.length > 0) {
          await this.redis.del(...keys)
        }
      } while (cursor !== "0")
    } catch {
      // Redis unavailable — nothing to invalidate
    }
  }

  /**
   * Salesforce-specific caching that matches Rails behavior.
   *
   * - Generates a cache key from endpoint + sorted query params
   * - If force=false and a valid cache entry exists, returns it immediately
   * - If force=true, bypasses cache read and fetches fresh data
   * - Stores responses ONLY on 2xx status
   * - On 5xx/timeout errors: returns cached value if available, propagates error if not
   *
   * @param endpoint - The API endpoint path
   * @param params - Optional query parameters
   * @param force - If true, bypass cache and fetch fresh data
   * @param fetchFn - Function that performs the actual data fetch
   * @param ttlOverride - Optional TTL (seconds) to use instead of the
   *   endpoint/param-derived default. Use for data whose freshness needs differ
   *   from the param-based rule (e.g. annual AMI charts called with params).
   */
  async cachedGet<T>(
    endpoint: string,
    params: Record<string, string> | undefined,
    force: boolean,
    fetchFn: FetchFn<T>,
    ttlOverride?: number
  ): Promise<T> {
    const key = this.generateCacheKey(endpoint, params)
    const ttl = ttlOverride ?? this.resolveTtl(endpoint, params)

    // If not force-refreshing, check cache first
    if (!force) {
      const cached = await this.get<T>(key)
      if (cached !== null) {
        return cached
      }
    }

    // Fetch fresh data
    try {
      const { data, status } = await fetchFn()

      // Store only on 2xx
      if (status >= 200 && status < 300) {
        await this.set(key, data, ttl)
      }

      return data
    } catch (error) {
      // On 5xx/timeout: return stale cached value if available
      const stale = await this.getStale<T>(key)
      if (stale !== null) {
        return stale
      }
      // No cached value exists — propagate the error
      throw error
    }
  }

  /**
   * Generate a cache key from endpoint path and sorted query parameters.
   * Example: "listings?ids=1&type=rental" for endpoint "listings" with params {type: "rental", ids: "1"}
   */
  generateCacheKey(
    endpoint: string,
    params?: Record<string, string>
  ): string {
    const normalizedEndpoint = endpoint.replace(/^\/+|\/+$/g, "")

    if (!params || Object.keys(params).length === 0) {
      return normalizedEndpoint
    }

    const sortedEntries = Object.entries(params).sort(([a], [b]) =>
      a.localeCompare(b)
    )
    const queryString = sortedEntries
      .map(([k, v]) => `${k}=${v}`)
      .join("&")

    return `${normalizedEndpoint}?${queryString}`
  }

  /**
   * Determine the TTL based on endpoint and params.
   * - OAuth token endpoints get 7200s
   * - Endpoints with params get 600s
   * - Endpoints without params get 86400s
   */
  private resolveTtl(
    endpoint: string,
    params?: Record<string, string>
  ): number {
    if (this.isOAuthEndpoint(endpoint)) {
      return CACHE_TTL.oauthToken
    }
    if (params && Object.keys(params).length > 0) {
      return CACHE_TTL.withParams
    }
    return CACHE_TTL.withoutParams
  }

  /**
   * Check if an endpoint is an OAuth token endpoint.
   */
  private isOAuthEndpoint(endpoint: string): boolean {
    return endpoint.includes("oauth") || endpoint.includes("token")
  }

  /**
   * Retrieve the stale copy of a cached value regardless of TTL expiration.
   * Uses the "stale:" prefixed key that is stored without TTL.
   * Returns null if Redis is unavailable.
   */
  private async getStale<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(`stale:${key}`)
      if (raw === null) return null
      try {
        return JSON.parse(raw) as T
      } catch {
        return null
      }
    } catch {
      // Redis unavailable — no stale data accessible
      return null
    }
  }
}

/**
 * Factory function to create a CacheService instance.
 */
export function createCacheService(redis: Redis): CacheService {
  return new CacheService({ redis })
}
