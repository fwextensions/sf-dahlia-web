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

import { CACHE_TTL } from "../cache/cache-service"
import type { ListingsParams } from "../salesforce/types"
// Type-only imports — fully erased at compile time, so they do NOT pull
// ioredis/client/etc. into the client bundle (see getServerDeps below). They
// exist solely to give the dynamically-imported deps their real signatures.
import type { createCacheService } from "../cache/cache-service"
import type { createSalesforceProxyClient } from "../salesforce/client"
import type { withRetry as withRetryFn } from "../salesforce/retry"

// ============================================================
// Serializable Types (JSON-safe versions without index signatures)
// ============================================================

/**
 * Listing data returned from the server functions.
 *
 * This is the RAW Salesforce shape exactly as the Rails proxy returns it — the
 * same field keys the Rails FE components use (`Name`, `Building_Street_Address`,
 * `Application_Due_Date`, …). We deliberately do NOT remap to a camelCase shape:
 * keeping the Salesforce keys matches the convention engineers already know and
 * lets native pages reuse the existing Rails helpers/components. The server fns
 * pass the proxy response through unchanged. Only the most commonly read fields
 * are declared; the index signature covers the rest of the record.
 */
export interface SerializableListing {
  /** Salesforce record id; the API also exposes the same value as `listingID`. */
  Id: string
  listingID: string
  Name: string
  Building_Street_Address?: string | null
  Building_City?: string | null
  Building_State?: string | null
  Building_Zip_Code?: string | null
  Building_Name?: string | null
  Application_Due_Date: string | null
  Application_Start_Date_Time?: string | null
  Lottery_Results_Date: string | null
  Lottery_Status: string | null
  Tenure?: string | null
  Listing_Type?: string | null
  Custom_Listing_Type?: string | null
  Status: string
  Accepting_Online_Applications?: boolean | null
  reservedDescriptor?: string | null
  imageURL?: string | null
  // Non-primitive raw fields (Listing_Images[], RecordType{}, …) are reached via
  // the index signature; the index value type stays a JSON primitive union so the
  // type still satisfies TanStack's serializable server-fn return constraint.
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

type ServerDepsType = {
  cacheService: ReturnType<typeof createCacheService>
  proxyClient: ReturnType<typeof createSalesforceProxyClient>
  withRetry: typeof withRetryFn
}

/**
 * Lazily resolve server-only dependencies via dynamic imports, then cache the
 * result. Dynamic imports are required here — NOT static top-level imports —
 * because server-fns.ts is in the module graph traced by the client bundle.
 * Static imports of ioredis/client/etc. would pull those modules into the
 * browser bundle (Vite externalizes ioredis from the client build, which emits
 * an unresolvable bare `import "ioredis"` in the browser). Dynamic imports stay
 * in the server bundle via TanStack Start's server-fn code-splitting.
 *
 * The promise is memoized so the dynamic import + Redis connect overhead only
 * pays once per server process, not once per request.
 */
let _serverDeps: Promise<ServerDepsType> | null = null

/**
 * Resolved server-only dependencies. Exported so non-request server code (e.g.
 * the BullMQ cache-warm worker) can build the same cache/proxy/retry stack the
 * server fns use, and pass it into the extracted `fetch*` core functions below.
 */
export type ServerDeps = ServerDepsType

export async function getServerDeps(): Promise<ServerDepsType> {
  if (_serverDeps) return _serverDeps

  const p = (async () => {
    const { createCacheService } = await import("../cache/cache-service")
    const { createSalesforceProxyClient } = await import("../salesforce/client")
    const { withRetry } = await import("../salesforce/retry")
    const { getRedis } = await import("../cache/redis")

    // Shared singleton client. Await the connection settling so the FIRST cache
    // read hits a ready socket instead of throwing (see cache/redis.ts). After the
    // first call `ready` is already resolved, so this await is effectively free.
    const { client: redis, ready } = getRedis()
    await ready

    return {
      cacheService: createCacheService(redis),
      proxyClient: createSalesforceProxyClient(),
      withRetry,
    }
  })()

  // If init rejects (e.g. a dynamic import fails), clear the memo so the next
  // call retries instead of being permanently stuck on a rejected promise.
  p.catch(() => {
    if (_serverDeps === p) _serverDeps = null
  })

  _serverDeps = p
  return p
}

// ============================================================
// Server Function: getListings
// ============================================================

/**
 * Fetches listings for directory pages (RentDirectory, BuyDirectory).
 * Integrates caching and retry logic.
 */
export async function fetchListings(
  data: ListingsInput,
  deps?: ServerDeps
): Promise<ListingsLoaderData> {
  const { cacheService, proxyClient, withRetry } = deps ?? (await getServerDeps())

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
    }
}

/**
 * Fetches listings for directory pages (RentDirectory, BuyDirectory).
 * Integrates caching and retry logic.
 */
export const getListings = createServerFn({ method: "GET" })
  .validator((data: ListingsInput) => data)
  .handler(({ data }): Promise<ListingsLoaderData> => fetchListings(data))

// ============================================================
// Server Function: getListingDetail
// ============================================================

/**
 * Fetches a single listing by ID.
 * Used by the ListingDetail page.
 */
export async function fetchListingDetail(
  data: ListingDetailInput,
  deps?: ServerDeps
): Promise<SerializableListing> {
  const { cacheService, proxyClient, withRetry } = deps ?? (await getServerDeps())

  const endpoint = `/api/v1/listings/${data.id}`
  const cacheKey = cacheService.generateCacheKey(endpoint, undefined)

  return cacheService.cachedGet<SerializableListing>(
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
}

/**
 * Fetches a single listing by ID.
 * Used by the ListingDetail page.
 */
export const getListingDetail = createServerFn({ method: "GET" })
  .validator((data: ListingDetailInput) => data)
  .handler(({ data }): Promise<SerializableListing> => fetchListingDetail(data))

// ============================================================
// Server Function: getListingUnits
// ============================================================

/**
 * Fetches units for a specific listing.
 */
export async function fetchListingUnits(
  data: ListingByIdInput,
  deps?: ServerDeps
): Promise<SerializableUnit[]> {
  const { cacheService, proxyClient, withRetry } = deps ?? (await getServerDeps())

  const endpoint = `/api/v1/listings/${data.id}/units`
  const cacheKey = cacheService.generateCacheKey(endpoint, undefined)

  return cacheService.cachedGet<SerializableUnit[]>(
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
}

/**
 * Fetches units for a specific listing.
 */
export const getListingUnits = createServerFn({ method: "GET" })
  .validator((data: ListingByIdInput) => data)
  .handler(({ data }): Promise<SerializableUnit[]> => fetchListingUnits(data))

/**
 * Cache-only peek for a listing's units: a single Redis GET that never triggers
 * the upstream Salesforce fetch. Returns the cached units, or `null` on a miss.
 * The loader uses this to decide hit-vs-miss deterministically (instead of
 * racing a wall-clock timer) so a cold load can defer immediately.
 */
export const peekListingUnits = createServerFn({ method: "GET" })
  .validator((data: ListingByIdInput) => data)
  .handler(async ({ data }): Promise<SerializableUnit[] | null> => {
    const { cacheService } = await getServerDeps()
    const endpoint = `/api/v1/listings/${data.id}/units`
    return cacheService.get<SerializableUnit[]>(
      cacheService.generateCacheKey(endpoint, undefined)
    )
  })

// ============================================================
// Server Function: getListingPreferences
// ============================================================

/**
 * Fetches preferences for a specific listing.
 */
export async function fetchListingPreferences(
  data: ListingByIdInput,
  deps?: ServerDeps
): Promise<SerializablePreference[]> {
  const { cacheService, proxyClient, withRetry } = deps ?? (await getServerDeps())

  const endpoint = `/api/v1/listings/${data.id}/preferences`
  const cacheKey = cacheService.generateCacheKey(endpoint, undefined)

  return cacheService.cachedGet<SerializablePreference[]>(
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
}

/**
 * Fetches preferences for a specific listing.
 */
export const getListingPreferences = createServerFn({ method: "GET" })
  .validator((data: ListingByIdInput) => data)
  .handler(({ data }): Promise<SerializablePreference[]> =>
    fetchListingPreferences(data)
  )

/**
 * Cache-only peek for a listing's preferences (see peekListingUnits). Returns
 * cached preferences or `null` on a miss, without hitting Salesforce.
 */
export const peekListingPreferences = createServerFn({ method: "GET" })
  .validator((data: ListingByIdInput) => data)
  .handler(async ({ data }): Promise<SerializablePreference[] | null> => {
    const { cacheService } = await getServerDeps()
    const endpoint = `/api/v1/listings/${data.id}/preferences`
    return cacheService.get<SerializablePreference[]>(
      cacheService.generateCacheKey(endpoint, undefined)
    )
  })

// ============================================================
// Server Function: getListingLotteryBuckets
// ============================================================

/**
 * Fetches lottery buckets for a specific listing.
 * Used on listing detail pages to show lottery preference buckets.
 */
export const getListingLotteryBuckets = createServerFn({ method: "GET" })
  .validator((data: ListingByIdInput) => data)
  .handler(async ({ data }): Promise<SerializableLotteryBucket[]> => {
    const { cacheService, proxyClient, withRetry } = await getServerDeps()

    const endpoint = `/api/v1/listings/${data.id}/lottery_buckets`
    const cacheKey = cacheService.generateCacheKey(endpoint, undefined)

    return cacheService.cachedGet<SerializableLotteryBucket[]>(
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
  })

// ============================================================
// Server Function: getListingLotteryRanking
// ============================================================

/**
 * Fetches lottery ranking for a specific lottery number on a listing.
 * Used on listing detail pages for individual lottery result lookup.
 */
export const getListingLotteryRanking = createServerFn({ method: "GET" })
  .validator((data: LotteryRankingInput) => data)
  .handler(async ({ data }): Promise<SerializableLotteryRanking> => {
    const { cacheService, proxyClient, withRetry } = await getServerDeps()

    const params: Record<string, string> = { lottery_number: data.lotteryNumber }
    const endpoint = `/api/v1/listings/${data.id}/lottery_ranking`
    const cacheKey = cacheService.generateCacheKey(endpoint, params)

    return cacheService.cachedGet<SerializableLotteryRanking>(
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
  })

// ============================================================
// Server Function: getAmiData
// ============================================================

/**
 * Fetches AMI (Area Median Income) data.
 * Used on listing pages for income eligibility calculations.
 */
export const getAmiData = createServerFn({ method: "GET" })
  .validator((data: AmiInput) => data)
  .handler(async ({ data }): Promise<SerializableAmiLevel[]> => {
    const { cacheService, proxyClient, withRetry } = await getServerDeps()

    const params: Record<string, string> = {}
    if (data.chartType) params.chartType = data.chartType
    if (data.chartYear) params.chartYear = data.chartYear
    if (data.percent !== undefined) params.percent = String(data.percent)

    const endpoint = "/api/v1/listings/ami"
    const cacheParams = Object.keys(params).length > 0 ? params : undefined
    const cacheKey = cacheService.generateCacheKey(endpoint, cacheParams)

    return cacheService.cachedGet<SerializableAmiLevel[]>(
      endpoint,
      cacheParams,
      false,
      async () => {
        const result = await withRetry(
          () => proxyClient.listings.getAmi(data),
          { cacheService, cacheKey }
        )
        return { data: result as unknown as SerializableAmiLevel[], status: 200 }
      },
      // Annual data — outlast the param-based 600s default (see CACHE_TTL.amiData).
      CACHE_TTL.amiData
    )
  })

// ============================================================
// Server Function: getListingAmiCharts
// ============================================================

/**
 * Fetches the full AMI charts a listing's units reference.
 *
 * An AMI chart is identified by (year, type, percent) and is listing-independent:
 * the 2024/MOHCD/50% income table is identical for every listing that references
 * it. So we cache each chart under its own canonical key rather than caching the
 * whole per-listing set — the first listing to need a chart warms it for the
 * entire catalog, and most listings then never pay the ~4s Rails recompute.
 *
 * Flow: read every requested chart from cache individually; batch ONLY the misses
 * into a single Rails call (the `ami` endpoint takes year[]/percent[]/chartType[]
 * arrays and returns one chart per entry, in order); cache each fetched chart;
 * then reassemble in the requested order, attaching the per-request `derivedFrom`
 * (MinAmi/MaxAmi) — which is a property of the unit, not the chart, so it is NOT
 * cached. `derivedFrom` metadata comes from getAmiChartMetaDataFromUnits.
 */
export const getListingAmiCharts = createServerFn({ method: "GET" })
  .validator((data: { charts: AmiChartMetaInput[] }) => data)
  .handler(({ data }): Promise<SerializableAmiChart[]> =>
    resolveAmiChartsCached(data.charts)
  )

/**
 * Per-chart-cached resolution for getListingAmiCharts (see that fn's docs).
 * Exported for unit testing; the server fn just supplies real deps.
 */
export async function resolveAmiChartsCached(
  charts: AmiChartMetaInput[],
  deps?: ServerDeps
): Promise<SerializableAmiChart[]> {
  if (!charts.length) return []

  const { cacheService, proxyClient, withRetry } = deps ?? (await getServerDeps())

  const endpoint = "/api/v1/listings/ami"
  // Canonical per-chart key, shared across listings (sorted params → stable).
  const keyFor = (c: AmiChartMetaInput) =>
    cacheService.generateCacheKey(endpoint, {
      chartType: c.type,
      percent: String(c.percent),
      year: String(c.year),
    })

  // 1. Read each requested chart from cache individually.
  const cached = await Promise.all(
    charts.map((c) => cacheService.get<SerializableAmiChart>(keyFor(c)))
  )

  // 2. Batch-fetch only the misses in a single Rails call.
  const misses = charts.filter((_, i) => cached[i] === null)
  const resolvedMisses = new Map<string, SerializableAmiChart>()
  if (misses.length) {
    let fetched: SerializableAmiChart[] | null = null
    try {
      fetched = (await withRetry(() =>
        proxyClient.listings.getAmiCharts(misses)
      )) as unknown as SerializableAmiChart[]
    } catch (err) {
      // On fetch failure, fall back to each chart's never-expiring stale copy;
      // if any missing chart has none, the data is incomplete — rethrow.
      for (const meta of misses) {
        const stale = await cacheService.get<SerializableAmiChart>(
          `stale:${keyFor(meta)}`
        )
        if (!stale) throw err
        resolvedMisses.set(keyFor(meta), stale)
      }
    }

    if (fetched) {
      await Promise.all(
        misses.map(async (meta, i) => {
          const chart = fetched![i]
          if (!chart) return
          // Strip per-request derivedFrom; cache only the shareable chart.
          const shareable: SerializableAmiChart = {
            percent: chart.percent,
            values: chart.values,
            chartType: chart.values[0]?.chartType as string | undefined,
            year: chart.values[0]?.year as number | undefined,
          }
          resolvedMisses.set(keyFor(meta), shareable)
          await cacheService.set(keyFor(meta), shareable, CACHE_TTL.amiData)
        })
      )
    }
  }

  // 3. Reassemble in requested order, attaching the per-request derivedFrom.
  const result: SerializableAmiChart[] = []
  charts.forEach((meta, i) => {
    const chart = cached[i] ?? resolvedMisses.get(keyFor(meta))
    if (!chart) return // unresolved (Rails returned fewer charts) — omit column
    result.push({ ...chart, derivedFrom: meta.derivedFrom })
  })
  return result
}

/**
 * Cache-only peek for a listing's AMI charts. Returns the fully-assembled charts
 * ONLY if every requested chart is already cached; returns `null` if any one is
 * a miss (so the loader defers the whole pricing block rather than rendering a
 * partial table). Never triggers the upstream Rails fetch. Exported for testing.
 */
export async function peekAmiChartsCached(
  charts: AmiChartMetaInput[],
  deps?: ServerDeps
): Promise<SerializableAmiChart[] | null> {
  if (!charts.length) return []

  const { cacheService } = deps ?? (await getServerDeps())
  const endpoint = "/api/v1/listings/ami"
  const keyFor = (c: AmiChartMetaInput) =>
    cacheService.generateCacheKey(endpoint, {
      chartType: c.type,
      percent: String(c.percent),
      year: String(c.year),
    })

  const cached = await Promise.all(
    charts.map((c) => cacheService.get<SerializableAmiChart>(keyFor(c)))
  )
  if (cached.some((c) => c === null)) return null

  // Attach the per-request derivedFrom (a unit property, not cached on the chart).
  return charts.map((meta, i) => ({
    ...(cached[i] as SerializableAmiChart),
    derivedFrom: meta.derivedFrom,
  }))
}

/** Cache-only peek server fn for AMI charts (see peekAmiChartsCached). */
export const peekListingAmiCharts = createServerFn({ method: "GET" })
  .validator((data: { charts: AmiChartMetaInput[] }) => data)
  .handler(({ data }): Promise<SerializableAmiChart[] | null> =>
    peekAmiChartsCached(data.charts)
  )

// ============================================================
// Server Function: getEligibleListings
// ============================================================

/**
 * Fetches listings filtered by eligibility criteria.
 * Used on listing directory pages for eligibility filtering.
 */
export const getEligibleListings = createServerFn({ method: "GET" })
  .validator((data: EligibilityInput) => data)
  .handler(async ({ data }): Promise<SerializableListing[]> => {
    const { cacheService, proxyClient, withRetry } = await getServerDeps()

    const params: Record<string, string> = {}
    if (data.householdsize !== undefined) params.householdsize = String(data.householdsize)
    if (data.incomelevel !== undefined) params.incomelevel = String(data.incomelevel)
    if (data.childrenUnder6 !== undefined) params.childrenUnder6 = String(data.childrenUnder6)

    const endpoint = "/api/v1/listings/eligibility"
    const cacheKey = cacheService.generateCacheKey(endpoint, params)

    return cacheService.cachedGet<SerializableListing[]>(
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
  })
