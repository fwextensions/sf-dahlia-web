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
 *
 * IMPORTANT — never `await` a `defer()` result. `await` recursively unwraps
 * thenables, so `await defer(p)` blocks the loader until `p` settles and
 * silently defeats streaming (the shell waits for everything, no spinner). A
 * deferred promise must be assigned straight to the returned property; the only
 * things we `await` here are the peeks, which return plain data or `null`.
 */
export async function loadListingDetail(id: string, force?: boolean) {
  const listing = await getListingDetail({ data: { id, force } })

  // Fast cache-only peeks, in parallel — never hit Salesforce.
  const [unitsCached, preferencesCached] = await Promise.all([
    peekListingUnits({ data: { id } }),
    peekListingPreferences({ data: { id } }),
  ])

  // Decide the pricing block (units + AMI charts).
  let pricingData: PricingData | Promise<PricingData>
  if (!unitsCached) {
    // Units cold — defer the full units→AMI fetch. Streams in behind a spinner.
    pricingData = defer(
      getListingUnits({ data: { id } }).then(async (units) => ({
        units,
        amiCharts: await getListingAmiCharts({
          data: { charts: getAmiChartMetaDataFromUnits(units) },
        }),
      }))
    )
  } else {
    const charts = getAmiChartMetaDataFromUnits(unitsCached)
    const amiCached = await peekListingAmiCharts({ data: { charts } })
    pricingData = amiCached
      ? // Full hit — inline, no Suspense boundary, no spinner.
        { units: unitsCached, amiCharts: amiCached }
      : // Units cached but some AMI chart cold — defer just the AMI fetch.
        defer(
          getListingAmiCharts({ data: { charts } }).then((amiCharts) => ({
            units: unitsCached,
            amiCharts,
          }))
        )
  }

  return {
    listing,
    pricingData,
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
