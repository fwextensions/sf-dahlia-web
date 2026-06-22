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

/**
 * Listing-detail loader. Awaits ONLY the core listing (above-the-fold) so the
 * shell flushes immediately for a fast FCP, then defers the heavier
 * below-the-fold sections as streamed promises (TanStack streams them in after
 * the shell; ListingDetail consumes them via <Await>).
 */
export async function loadListingDetail(id: string, force?: boolean) {
  const listing = await getListingDetail({ data: { id, force } })

  const unitsPromise = getListingUnits({ data: { id } })
  const preferencesPromise = getListingPreferences({ data: { id } })
  // AMI charts depend on units (each unit references a chart by type/year/
  // percent), so chain off units — still deferred, streams after units resolve.
  const pricingPromise = unitsPromise.then(async (units) => ({
    units,
    amiCharts: await getListingAmiCharts({
      data: { charts: getAmiChartMetaDataFromUnits(units) },
    }),
  }))

  return {
    listing,
    pricingPromise: defer(pricingPromise),
    preferencesPromise: defer(preferencesPromise),
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
