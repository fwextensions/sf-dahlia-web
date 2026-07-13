/**
 * Redis cache pre-warm processor.
 *
 * Walks the full listing catalog on a schedule and populates the same Redis
 * keys the listing routes read, so the first real user request finds warm data
 * instead of paying the ~4s Salesforce round-trip through the Rails proxy.
 *
 * Key parity is guaranteed by reusing the extracted `fetch*` core functions from
 * lib/listings/server-fns (the plain, deps-injectable functions the TanStack
 * server fns delegate to) — the warm job and the route loaders therefore compute
 * identical cache keys and TTLs and can never drift.
 *
 * AMI charts dedupe globally: they are cached per (year, type, percent) shared
 * across listings, so the first listing that references a chart warms it for the
 * whole catalog and the rest pay nothing for it.
 *
 * See docs/cache-prewarm-plan.md.
 */
import type { Job } from "bullmq"

import { env } from "../../../config/env"
import { getAmiChartMetaDataFromUnits } from "../../listings/ami"
import {
  fetchListingDetail,
  fetchListingPreferences,
  fetchListingUnits,
  fetchListings,
  getServerDeps,
  resolveAmiChartsCached,
  type ServerDeps,
} from "../../listings/server-fns"
import type { CacheWarmJob } from "../types"

export interface CacheWarmSummary {
  /** Distinct listing ids walked. */
  listings: number
  /** Listings whose detail/units/preferences/AMI all warmed without error. */
  warmed: number
  /** Listings that hit an error (logged and skipped). */
  failed: number
  durationMs: number
}

/**
 * Injectable seams for unit testing. Every field defaults to the real
 * implementation; tests pass fakes (a fake CacheService + stub fetchers) the
 * same way resolveAmiChartsCached accepts injected deps.
 */
export interface CacheWarmOverrides {
  serverDeps?: ServerDeps
  concurrency?: number
  fetchListings?: typeof fetchListings
  fetchListingDetail?: typeof fetchListingDetail
  fetchListingUnits?: typeof fetchListingUnits
  fetchListingPreferences?: typeof fetchListingPreferences
  resolveAmiCharts?: typeof resolveAmiChartsCached
  getAmiChartMetaDataFromUnits?: typeof getAmiChartMetaDataFromUnits
}

/**
 * Run one warm pass over both directories and every listing.
 *
 * - Directories and detail are fetched with `force: true` so warm keys are
 *   refreshed even when still live — the point is to keep them from ever
 *   lapsing between passes (cadence stays below the 1-day TTL).
 * - Units / preferences / AMI go through the normal cache read (`force: false`):
 *   because passes run more often than the TTL they stay warm, so after the
 *   first pass these are cheap cache hits and only genuine misses fetch.
 * - Per-listing work is bounded by `concurrency` so a pass can't starve live
 *   traffic on the shared Rails/Salesforce path.
 * - A single listing's failure is logged and skipped, never fatal to the pass.
 */
export async function runCacheWarm(
  overrides: CacheWarmOverrides = {}
): Promise<CacheWarmSummary> {
  const start = Date.now()

  const deps = overrides.serverDeps ?? (await getServerDeps())
  const concurrency = overrides.concurrency ?? env.CACHE_WARM_CONCURRENCY
  const _fetchListings = overrides.fetchListings ?? fetchListings
  const _fetchDetail = overrides.fetchListingDetail ?? fetchListingDetail
  const _fetchUnits = overrides.fetchListingUnits ?? fetchListingUnits
  const _fetchPreferences =
    overrides.fetchListingPreferences ?? fetchListingPreferences
  const _resolveAmi = overrides.resolveAmiCharts ?? resolveAmiChartsCached
  const _metaFromUnits =
    overrides.getAmiChartMetaDataFromUnits ?? getAmiChartMetaDataFromUnits

  // 1. Warm both directories (also how we enumerate the catalog).
  const [rentals, ownership] = await Promise.all([
    _fetchListings({ type: "rental", force: true }, deps),
    _fetchListings({ type: "ownership", force: true }, deps),
  ])

  // Dedupe listing ids across both directories.
  const ids = new Set<string>()
  for (const listing of [...rentals.listings, ...ownership.listings]) {
    const id = (listing.listingID || listing.Id) as string | undefined
    if (id) ids.add(id)
  }

  // 2. Warm each listing's detail + units + preferences, then its AMI charts.
  const total = ids.size
  // Log progress roughly every 10% of the catalog (at least every listing for
  // tiny catalogs), so a long pass shows movement without a line per listing.
  const progressStep = Math.max(1, Math.ceil(total / 10))
  let warmed = 0
  let failed = 0
  let done = 0
  await mapWithConcurrency([...ids], concurrency, async (id) => {
    try {
      const [, units] = await Promise.all([
        _fetchDetail({ id, force: true }, deps),
        _fetchUnits({ id }, deps),
        _fetchPreferences({ id }, deps),
      ])
      const charts = _metaFromUnits(units)
      if (charts.length) await _resolveAmi(charts, deps)
      warmed += 1
    } catch (err) {
      failed += 1
      console.error(`[cache-warm] listing ${id} failed:`, err)
    } finally {
      done += 1
      if (done % progressStep === 0 || done === total) {
        const pct = Math.round((done / total) * 100)
        console.log(
          `[cache-warm] progress ${done}/${total} (${pct}%) — warmed=${warmed} failed=${failed}`
        )
      }
    }
  })

  const summary: CacheWarmSummary = {
    listings: ids.size,
    warmed,
    failed,
    durationMs: Date.now() - start,
  }
  console.log("[cache-warm] pass complete", summary)
  return summary
}

/**
 * BullMQ processor entry point for the cacheWarm queue.
 */
export async function processCacheWarm(
  job: Job<CacheWarmJob>
): Promise<CacheWarmSummary> {
  console.log(`[cache-warm] starting pass (scope=${job.data.scope})`)
  return runCacheWarm()
}

/**
 * Run `fn` over `items` with at most `limit` in flight at once. Small local
 * helper to avoid pulling in a p-limit dependency.
 */
async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  let cursor = 0
  const runners = Array.from(
    { length: Math.max(1, Math.min(limit, items.length)) },
    async () => {
      while (cursor < items.length) {
        const index = cursor
        cursor += 1
        await fn(items[index])
      }
    }
  )
  await Promise.all(runners)
}
