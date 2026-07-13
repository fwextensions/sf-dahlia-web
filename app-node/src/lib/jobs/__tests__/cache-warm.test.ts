import { describe, it, expect, vi } from "vitest"

import { runCacheWarm } from "../processors/cache-warm"
import type { ServerDeps } from "../../listings/server-fns"

// Minimal fake deps object — runCacheWarm only forwards it to the injected
// fetchers, which ignore it here, so an empty cast is sufficient.
const fakeDeps = {} as ServerDeps

const listing = (id: string) => ({ Id: id, listingID: id }) as any

function makeOverrides(over: Record<string, unknown> = {}) {
  const fetchListings = vi.fn(async ({ type }: { type: string }) => ({
    type,
    listings:
      type === "rental"
        ? [listing("r1"), listing("r2")]
        : [listing("o1"), listing("r2")], // r2 duplicated across directories
  }))
  const fetchListingDetail = vi.fn(async () => listing("x"))
  const fetchListingUnits = vi.fn(async () => [{ unitType: "1BR" } as any])
  const fetchListingPreferences = vi.fn(async () => [])
  const resolveAmiCharts = vi.fn(async () => [])
  const getAmiChartMetaDataFromUnits = vi.fn(() => [
    { year: 2024, type: "MOHCD", percent: 50 },
  ])

  return {
    serverDeps: fakeDeps,
    concurrency: 2,
    fetchListings,
    fetchListingDetail,
    fetchListingUnits,
    fetchListingPreferences,
    resolveAmiCharts,
    getAmiChartMetaDataFromUnits,
    ...over,
  } as any
}

describe("runCacheWarm", () => {
  it("warms both directories and every deduped listing, then AMI", async () => {
    const o = makeOverrides()
    const summary = await runCacheWarm(o)

    // Both directories fetched with force.
    expect(o.fetchListings).toHaveBeenCalledTimes(2)
    expect(o.fetchListings).toHaveBeenCalledWith(
      { type: "rental", force: true },
      fakeDeps
    )
    expect(o.fetchListings).toHaveBeenCalledWith(
      { type: "ownership", force: true },
      fakeDeps
    )

    // r1, r2, o1 => 3 distinct ids (r2 appears in both directories).
    expect(summary.listings).toBe(3)
    expect(summary.warmed).toBe(3)
    expect(summary.failed).toBe(0)
    expect(o.fetchListingDetail).toHaveBeenCalledTimes(3)
    expect(o.fetchListingUnits).toHaveBeenCalledTimes(3)
    expect(o.fetchListingPreferences).toHaveBeenCalledTimes(3)
    // AMI resolved once per listing (charts present).
    expect(o.resolveAmiCharts).toHaveBeenCalledTimes(3)
    // Detail is force-refreshed.
    expect(o.fetchListingDetail).toHaveBeenCalledWith(
      { id: "r1", force: true },
      fakeDeps
    )
  })

  it("skips AMI when a listing has no chart metadata", async () => {
    const o = makeOverrides({
      getAmiChartMetaDataFromUnits: vi.fn(() => []),
    })
    await runCacheWarm(o)
    expect(o.resolveAmiCharts).not.toHaveBeenCalled()
  })

  it("continues past a single listing failure and counts it", async () => {
    const fetchListingUnits = vi.fn(async ({ id }: { id: string }) => {
      if (id === "r2") throw new Error("boom")
      return [{ unitType: "1BR" } as any]
    })
    const o = makeOverrides({ fetchListingUnits })

    const summary = await runCacheWarm(o)

    expect(summary.listings).toBe(3)
    expect(summary.warmed).toBe(2)
    expect(summary.failed).toBe(1)
  })
})
