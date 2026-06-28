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

/** Sentinel that races a promise against a timeout. Resolves to the promise
 *  value if it wins, or `null` if the timeout fires first. */
function tryResolveWithin<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([promise, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))])
}

export interface PricingData {
  units: SerializableUnit[]
  amiCharts: SerializableAmiChart[]
}

/**
 * Listing-detail loader.
 *
 * Streams the HTML shell as soon as the core listing is fetched, then:
 *
 * - **Cache hit** (units + AMI + preferences resolve within FAST_MS): all data
 *   is available before the shell flushes, so TanStack includes it in the first
 *   chunk. No spinners shown, no flash.
 *
 * - **Cache miss** (slow Salesforce round-trip): shell streams immediately with
 *   spinners; the deferred sections stream in as each resolves, exactly like the
 *   original defer() behaviour.
 *
 * The trick: race each promise group against FAST_MS. If it wins we return the
 * resolved data directly (no defer needed — TanStack renders it synchronously).
 * If it loses we defer the original promise so the shell can flush first.
 */
const FAST_MS = 150 // Redis round-trip is typically <20ms; 150ms is safe headroom

export async function loadListingDetail(id: string, force?: boolean) {
  const listing = await getListingDetail({ data: { id, force } })

  // Fire units and preferences in parallel — independent of each other.
  const unitsPromise = getListingUnits({ data: { id } })
  const preferencesPromise = getListingPreferences({ data: { id } })

  // AMI charts depend on units, so chain off units.
  const pricingPromise = unitsPromise.then(async (units) => ({
    units,
    amiCharts: await getListingAmiCharts({
      data: { charts: getAmiChartMetaDataFromUnits(units) },
    }),
  }))

  // Race each group against the fast threshold.
  const [pricingEarly, preferencesEarly] = await Promise.all([
    tryResolveWithin(pricingPromise, FAST_MS),
    tryResolveWithin(preferencesPromise, FAST_MS),
  ])

  return {
    listing,
    // If the data is already here, return it directly so the shell renders
    // fully with no Suspense boundary. Otherwise defer so the shell flushes
    // first and the spinners stream in.
    pricingData: pricingEarly ?? defer(pricingPromise),
    preferencesData: preferencesEarly ?? defer(preferencesPromise),
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
