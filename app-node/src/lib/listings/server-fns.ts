/**
 * Server functions for listing pages (Phase 2).
 *
 * These use createServerFn to ensure all data fetching happens on the server,
 * never from the browser. They integrate:
 * - SalesforceProxyClient for data fetching
 * - CacheService for Redis caching (check cache before proxy)
 * - withRetry for resilience (retry on 5xx/timeout, cache fallback)
 * - Force-refresh parameter to bypass cache
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7
 */

import { createServerFn } from "@tanstack/react-start"

import type { ListingsParams } from "../salesforce/types"

// ============================================================
// Serializable Types (JSON-safe versions without index signatures)
// ============================================================

/** Serializable listing data returned from server functions */
export interface SerializableListing {
  listingID: string
  name: string
  buildingAddress: string
  buildingCity: string
  buildingState: string
  buildingZip: string
  applicationDueDate: string | null
  lotteryDate: string | null
  lotteryStatus: string | null
  reservedDescriptor: string | null
  listingType: "rental" | "ownership"
  status: string
  [key: string]: string | number | boolean | null | undefined
}

/** Serializable unit data */
export interface SerializableUnit {
  unitType: string
  bmrRentMonthly: number | null
  bmrRentTrimester: number | null
  bmrParkingMonthly: number | null
  numBedrooms: number | null
  numBathrooms: number | null
  sqFt: number | null
  floor: number | null
  maxOccupancy: number | null
  minOccupancy: number | null
  listingID: string
  [key: string]: string | number | boolean | null | undefined
}

/** Serializable preference data */
export interface SerializablePreference {
  preferenceName: string
  preferenceOrder: number
  listingPreferenceID: string
  [key: string]: string | number | boolean | null | undefined
}

// ============================================================
// Input / Output Types
// ============================================================

export interface ListingsInput {
  type: "rental" | "ownership"
  params?: { ids?: string; subset?: string }
  force?: boolean
}

export interface ListingDetailInput {
  id: string
  force?: boolean
}

export interface ListingByIdInput {
  id: string
}

export interface LotteryRankingInput {
  id: string
  lotteryNumber: string
}

export interface AmiInput {
  chartType?: string
  chartYear?: string
  percent?: number
}

export interface EligibilityInput {
  householdsize?: number
  incomelevel?: number
  childrenUnder6?: number
}

/** Serializable lottery bucket data */
export interface SerializableLotteryBucket {
  preferenceName: string
  preferenceOrder: number
  lotteryResults: SerializableLotteryResult[]
  [key: string]: string | number | boolean | null | undefined | SerializableLotteryResult[]
}

export interface SerializableLotteryResult {
  lotteryNumber: string
  lotteryRank: number
  [key: string]: string | number | boolean | null | undefined
}

/** Serializable lottery ranking data */
export interface SerializableLotteryRanking {
  lotteryNumber: string
  lotteryRank: number | null
  preferenceName: string | null
  [key: string]: string | number | boolean | null | undefined
}

/** Serializable AMI level data */
export interface SerializableAmiLevel {
  chartType: string
  year: number
  amount: number
  numOfHousehold: number
  percent: number
  [key: string]: string | number | boolean | null | undefined
}

/** Serializable AMI chart: income amount per household size for one (type, year, percent). */
export interface SerializableAmiChart {
  percent: string | number
  chartType?: string
  year?: number | string
  derivedFrom?: string
  values: SerializableAmiLevel[]
}

/** Metadata identifying one AMI chart a listing's units reference. */
export interface AmiChartMetaInput {
  type: string
  year: number
  percent: number
  derivedFrom?: string
}

export interface ListingsLoaderData {
  listings: SerializableListing[]
  type: "rental" | "ownership"
}

export interface ListingDetailLoaderData {
  listing: SerializableListing
  units: SerializableUnit[]
  preferences: SerializablePreference[]
}

// ============================================================
// Helper: Create Redis + CacheService + ProxyClient on server
// ============================================================

async function getServerDeps() {
  const { default: Redis } = await import("ioredis")
  const { env } = await import("../../config/env")
  const { createCacheService } = await import("../cache/cache-service")
  const { createSalesforceProxyClient } = await import("../salesforce/client")
  const { withRetry } = await import("../salesforce/retry")

  const redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    // Fail fast — 500ms connection timeout, no retries
    // so a missing Redis never blocks the request path
    connectTimeout: 500,
    retryStrategy: () => null,
    // Don't queue commands when disconnected — they reject immediately
    // and cache-service catches them as a cache miss
    enableOfflineQueue: false,
    lazyConnect: true,
  })
  // Attach error handler so connection failures don't become unhandled events
  redis.on("error", () => {
    // Redis unavailable — cache bypassed, data fetched directly from Salesforce
  })
  // Fire-and-forget: don't await so a missing Redis never blocks the request.
  redis.connect().catch(() => {
    // Redis unavailable — cache will be bypassed, data fetched directly
  })
  const cacheService = createCacheService(redis)
  const proxyClient = createSalesforceProxyClient()

  return { redis, cacheService, proxyClient, withRetry }
}

// ============================================================
// Server Function: getListings
// ============================================================

/**
 * Fetches listings for directory pages (RentDirectory, BuyDirectory).
 * Integrates caching and retry logic.
 */
export const getListings = createServerFn({ method: "GET" })
  .inputValidator((data: ListingsInput) => data)
  .handler(async ({ data }): Promise<ListingsLoaderData> => {
    const { redis, cacheService, proxyClient, withRetry } =
      await getServerDeps()

    try {
      const fetchParams: ListingsParams = {
        ...data.params,
        type: data.type,
      }

      // Build params record for cache key generation
      const cacheParams: Record<string, string> = { type: data.type }
      if (data.params?.ids) cacheParams.ids = data.params.ids
      if (data.params?.subset) cacheParams.subset = data.params.subset

      const endpoint = "/api/v1/listings"
      const cacheKey = cacheService.generateCacheKey(endpoint, cacheParams)

      const listings = await cacheService.cachedGet<SerializableListing[]>(
        endpoint,
        cacheParams,
        data.force ?? false,
        async () => {
          const result = await withRetry(
            () => proxyClient.listings.getAll(fetchParams),
            { cacheService, cacheKey }
          )
          return { data: result as unknown as SerializableListing[], status: 200 }
        }
      )

      return { listings, type: data.type }
    } catch (err) {
      console.error("[getListings] Failed to fetch listings:", err)
      throw err
    } finally {
      try {
        await redis.quit()
      } catch {
        // Redis wasn't connected — nothing to quit
      }
    }
  })

// ============================================================
// Server Function: getListingDetail
// ============================================================

/**
 * Fetches a single listing by ID.
 * Used by the ListingDetail page.
 */
export const getListingDetail = createServerFn({ method: "GET" })
  .inputValidator((data: ListingDetailInput) => data)
  .handler(async ({ data }): Promise<SerializableListing> => {
    const { redis, cacheService, proxyClient, withRetry } =
      await getServerDeps()

    try {
      const endpoint = `/api/v1/listings/${data.id}`
      const cacheKey = cacheService.generateCacheKey(endpoint, undefined)

      const listing = await cacheService.cachedGet<SerializableListing>(
        endpoint,
        undefined,
        data.force ?? false,
        async () => {
          const result = await withRetry(
            () => proxyClient.listings.getById(data.id, data.force),
            { cacheService, cacheKey }
          )
          return { data: result as unknown as SerializableListing, status: 200 }
        }
      )

      return listing
    } finally {
      try { await redis.quit() } catch { /* Redis was not connected */ }
    }
  })

// ============================================================
// Server Function: getListingUnits
// ============================================================

/**
 * Fetches units for a specific listing.
 */
export const getListingUnits = createServerFn({ method: "GET" })
  .inputValidator((data: ListingByIdInput) => data)
  .handler(async ({ data }): Promise<SerializableUnit[]> => {
    const { redis, cacheService, proxyClient, withRetry } =
      await getServerDeps()

    try {
      const endpoint = `/api/v1/listings/${data.id}/units`
      const cacheKey = cacheService.generateCacheKey(endpoint, undefined)

      const units = await cacheService.cachedGet<SerializableUnit[]>(
        endpoint,
        undefined,
        false,
        async () => {
          const result = await withRetry(
            () => proxyClient.listings.getUnits(data.id),
            { cacheService, cacheKey }
          )
          return { data: result as unknown as SerializableUnit[], status: 200 }
        }
      )

      return units
    } finally {
      try { await redis.quit() } catch { /* Redis was not connected */ }
    }
  })

// ============================================================
// Server Function: getListingPreferences
// ============================================================

/**
 * Fetches preferences for a specific listing.
 */
export const getListingPreferences = createServerFn({ method: "GET" })
  .inputValidator((data: ListingByIdInput) => data)
  .handler(async ({ data }): Promise<SerializablePreference[]> => {
    const { redis, cacheService, proxyClient, withRetry } =
      await getServerDeps()

    try {
      const endpoint = `/api/v1/listings/${data.id}/preferences`
      const cacheKey = cacheService.generateCacheKey(endpoint, undefined)

      const preferences = await cacheService.cachedGet<SerializablePreference[]>(
        endpoint,
        undefined,
        false,
        async () => {
          const result = await withRetry(
            () => proxyClient.listings.getPreferences(data.id),
            { cacheService, cacheKey }
          )
          return { data: result as unknown as SerializablePreference[], status: 200 }
        }
      )

      return preferences
    } finally {
      try { await redis.quit() } catch { /* Redis was not connected */ }
    }
  })

// ============================================================
// Server Function: getListingLotteryBuckets
// ============================================================

/**
 * Fetches lottery buckets for a specific listing.
 * Used on listing detail pages to show lottery preference buckets.
 */
export const getListingLotteryBuckets = createServerFn({ method: "GET" })
  .inputValidator((data: ListingByIdInput) => data)
  .handler(async ({ data }): Promise<SerializableLotteryBucket[]> => {
    const { redis, cacheService, proxyClient, withRetry } =
      await getServerDeps()

    try {
      const endpoint = `/api/v1/listings/${data.id}/lottery_buckets`
      const cacheKey = cacheService.generateCacheKey(endpoint, undefined)

      const buckets = await cacheService.cachedGet<SerializableLotteryBucket[]>(
        endpoint,
        undefined,
        false,
        async () => {
          const result = await withRetry(
            () => proxyClient.listings.getLotteryBuckets(data.id),
            { cacheService, cacheKey }
          )
          return { data: result as unknown as SerializableLotteryBucket[], status: 200 }
        }
      )

      return buckets
    } finally {
      try { await redis.quit() } catch { /* Redis was not connected */ }
    }
  })

// ============================================================
// Server Function: getListingLotteryRanking
// ============================================================

/**
 * Fetches lottery ranking for a specific lottery number on a listing.
 * Used on listing detail pages for individual lottery result lookup.
 */
export const getListingLotteryRanking = createServerFn({ method: "GET" })
  .inputValidator((data: LotteryRankingInput) => data)
  .handler(async ({ data }): Promise<SerializableLotteryRanking> => {
    const { redis, cacheService, proxyClient, withRetry } =
      await getServerDeps()

    try {
      const params: Record<string, string> = { lottery_number: data.lotteryNumber }
      const endpoint = `/api/v1/listings/${data.id}/lottery_ranking`
      const cacheKey = cacheService.generateCacheKey(endpoint, params)

      const ranking = await cacheService.cachedGet<SerializableLotteryRanking>(
        endpoint,
        params,
        false,
        async () => {
          const result = await withRetry(
            () => proxyClient.listings.getLotteryRanking(data.id, data.lotteryNumber),
            { cacheService, cacheKey }
          )
          return { data: result as unknown as SerializableLotteryRanking, status: 200 }
        }
      )

      return ranking
    } finally {
      try { await redis.quit() } catch { /* Redis was not connected */ }
    }
  })

// ============================================================
// Server Function: getAmiData
// ============================================================

/**
 * Fetches AMI (Area Median Income) data.
 * Used on listing pages for income eligibility calculations.
 */
export const getAmiData = createServerFn({ method: "GET" })
  .inputValidator((data: AmiInput) => data)
  .handler(async ({ data }): Promise<SerializableAmiLevel[]> => {
    const { redis, cacheService, proxyClient, withRetry } =
      await getServerDeps()

    try {
      const params: Record<string, string> = {}
      if (data.chartType) params.chartType = data.chartType
      if (data.chartYear) params.chartYear = data.chartYear
      if (data.percent !== undefined) params.percent = String(data.percent)

      const endpoint = "/api/v1/listings/ami"
      const cacheKey = cacheService.generateCacheKey(endpoint, Object.keys(params).length > 0 ? params : undefined)

      const amiLevels = await cacheService.cachedGet<SerializableAmiLevel[]>(
        endpoint,
        Object.keys(params).length > 0 ? params : undefined,
        false,
        async () => {
          const result = await withRetry(
            () => proxyClient.listings.getAmi(data),
            { cacheService, cacheKey }
          )
          return { data: result as unknown as SerializableAmiLevel[], status: 200 }
        }
      )

      return amiLevels
    } finally {
      try { await redis.quit() } catch { /* Redis was not connected */ }
    }
  })

// ============================================================
// Server Function: getListingAmiCharts
// ============================================================

/**
 * Fetches the full AMI charts a listing's units reference, in ONE call.
 *
 * The Rails `ami` endpoint takes array params (year[]/percent[]/chartType[])
 * and returns one chart per entry. We then enrich each chart the way the Rails
 * listingDetailsReducer does: pull chartType/year off the first value and attach
 * `derivedFrom` (MinAmi/MaxAmi) by matching percent back to the requested
 * metadata. The caller derives that metadata from units via
 * getAmiChartMetaDataFromUnits (see lib/listings/ami.ts).
 */
export const getListingAmiCharts = createServerFn({ method: "GET" })
  .inputValidator((data: { charts: AmiChartMetaInput[] }) => data)
  .handler(async ({ data }): Promise<SerializableAmiChart[]> => {
    if (!data.charts.length) return []

    const { redis, cacheService, proxyClient, withRetry } =
      await getServerDeps()

    try {
      // Cache key is order-stable on the requested chart tuples.
      const params: Record<string, string> = {
        charts: data.charts
          .map((c) => `${c.type}:${c.year}:${c.percent}`)
          .join(","),
      }
      const endpoint = "/api/v1/listings/ami"
      const cacheKey = cacheService.generateCacheKey(endpoint, params)

      const charts = await cacheService.cachedGet<SerializableAmiChart[]>(
        endpoint,
        params,
        false,
        async () => {
          const result = await withRetry(
            () => proxyClient.listings.getAmiCharts(data.charts),
            { cacheService, cacheKey }
          )
          // Enrich chartType/year/derivedFrom (mirrors listingDetailsReducer).
          const enriched = (result as unknown as SerializableAmiChart[]).map((chart) => ({
            ...chart,
            chartType: chart.values[0]?.chartType,
            year: chart.values[0]?.year,
            derivedFrom: data.charts.find((c) => c.percent === Number(chart.percent))
              ?.derivedFrom,
          }))
          return { data: enriched, status: 200 }
        }
      )

      return charts
    } finally {
      try { await redis.quit() } catch { /* Redis was not connected */ }
    }
  })

// ============================================================
// Server Function: getEligibleListings
// ============================================================

/**
 * Fetches listings filtered by eligibility criteria.
 * Used on listing directory pages for eligibility filtering.
 */
export const getEligibleListings = createServerFn({ method: "GET" })
  .inputValidator((data: EligibilityInput) => data)
  .handler(async ({ data }): Promise<SerializableListing[]> => {
    const { redis, cacheService, proxyClient, withRetry } =
      await getServerDeps()

    try {
      const params: Record<string, string> = {}
      if (data.householdsize !== undefined) params.householdsize = String(data.householdsize)
      if (data.incomelevel !== undefined) params.incomelevel = String(data.incomelevel)
      if (data.childrenUnder6 !== undefined) params.childrenUnder6 = String(data.childrenUnder6)

      const endpoint = "/api/v1/listings/eligibility"
      const cacheKey = cacheService.generateCacheKey(endpoint, params)

      const listings = await cacheService.cachedGet<SerializableListing[]>(
        endpoint,
        params,
        false,
        async () => {
          const result = await withRetry(
            () => proxyClient.listings.getEligible(data),
            { cacheService, cacheKey }
          )
          return { data: result as unknown as SerializableListing[], status: 200 }
        }
      )

      return listings
    } finally {
      try { await redis.quit() } catch { /* Redis was not connected */ }
    }
  })
