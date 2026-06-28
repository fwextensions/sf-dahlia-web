/**
 * Shared route configuration for the native listing pages.
 *
 * The listing detail and the two directories are each served at two paths: the
 * unprefixed default-language route (e.g. /listings/$id) and the language-prefixed
 * route (/$lang/listings/$id). Both render the same native component with the same
 * loader — only the path string differs — so the loader bodies and search schema
 * live here to keep the two route files from drifting.
 *
 * Locale is handled upstream: __root.tsx's beforeLoad builds the i18n store from
 * getCurrentLanguage(pathname), so t() resolves the right language for whichever
 * path matched. These loaders are locale-agnostic.
 */
import { defer } from "@tanstack/react-router"
import {
  getListingDetail,
  getListingUnits,
  getListingPreferences,
  getListingAmiCharts,
  getListings,
  peekListingUnits,
  peekListingPreferences,
  peekListingAmiCharts,
  type SerializableListing,
  type SerializableUnit,
  type SerializablePreference,
  type SerializableAmiChart,
} from "./server-fns"
import { getAmiChartMetaDataFromUnits } from "./ami"

/**
 * `force` is an optional cache-bust flag; only surface it when explicitly set so
 * normal URLs don't redirect to a canonical `?force=false`.
 */
export const listingDetailSearchSchema = (
  search: Record<string, unknown>
): { force?: true } =>
  search.force === "true" || search.force === true ? { force: true } : {}

export interface PricingData {
  units: SerializableUnit[]
  amiCharts: SerializableAmiChart[]
}

/**
 * Resolve the pricing block (units + AMI charts) for the loader.
 *
 * Uses a cache-only peek to decide hit-vs-miss deterministically:
 * - Units + every referenced AMI chart cached → return data inline (no spinner).
 * - Units cached but some AMI chart isn't → defer just the AMI fetch (units are
 *   already in hand, so don't re-fetch them).
 * - Units not cached → defer the full units→AMI fetch.
 */
async function resolvePricing(
  id: string,
  unitsCached: SerializableUnit[] | null
): Promise<PricingData | Promise<PricingData>> {
  if (!unitsCached) {
    // Units not cached — defer the full fetch (units, then the AMI charts they
    // reference). Shell flushes now; this streams in behind a spinner.
    return defer(
      getListingUnits({ data: { id } }).then(async (units) => ({
        units,
        amiCharts: await getListingAmiCharts({
          data: { charts: getAmiChartMetaDataFromUnits(units) },
        }),
      }))
    )
  }

  const charts = getAmiChartMetaDataFromUnits(unitsCached)
  const amiCached = await peekListingAmiCharts({ data: { charts } })
  if (amiCached) {
    // Full hit — render inline, no Suspense boundary, no spinner.
    return { units: unitsCached, amiCharts: amiCached }
  }

  // Units cached but some AMI chart is cold — defer only the AMI fetch.
  return defer(
    getListingAmiCharts({ data: { charts } }).then((amiCharts) => ({
      units: unitsCached,
      amiCharts,
    }))
  )
}

/**
 * Listing-detail loader.
 *
 * Awaits only the core listing, then for each below-the-fold section does a
 * deterministic cache **peek** (a fast Redis GET that never triggers the slow
 * upstream fetch) to decide:
 *
 * - **Cache hit:** return the data inline so TanStack renders it in the first
 *   chunk — no Suspense boundary, no spinner flash.
 *
 * - **Cache miss:** `defer()` the real fetch so the shell flushes immediately
 *   and the section streams in behind a spinner once it resolves.
 *
 * The peek replaces the earlier wall-clock race: a miss is detected in one
 * Redis round-trip (~20ms) instead of waiting out a fixed threshold, so cold
 * pages flush their shell sooner with no arbitrary constant to tune.
 */
export async function loadListingDetail(id: string, force?: boolean) {
  const listing = await getListingDetail({ data: { id, force } })

  // Fast cache-only peeks, in parallel — never hit Salesforce.
  const [unitsCached, preferencesCached] = await Promise.all([
    peekListingUnits({ data: { id } }),
    peekListingPreferences({ data: { id } }),
  ])

  return {
    listing,
    pricingData: await resolvePricing(id, unitsCached),
    preferencesData:
      preferencesCached ?? defer(getListingPreferences({ data: { id } })),
  }
}

/**
 * Directory loader (rental or ownership). Tolerates the Salesforce proxy (Rails
 * on :3000) being down locally — renders the empty state instead of failing the
 * whole route.
 */
export async function loadDirectory(
  type: "rental" | "ownership"
): Promise<{ listings: SerializableListing[] }> {
  let listings: SerializableListing[] = []
  try {
    listings = (await getListings({ data: { type } })).listings
  } catch (err) {
    console.error(`[${type}] getListings failed (backend down?):`, err)
  }
  return { listings }
}
