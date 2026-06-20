/**
 * Listing detail — native TanStack Start route (no RailsPage bridge).
 *
 * Replaces the client-only `ssr: false` bridge that mounted the original
 * react-on-rails page. The bridge injected its CSS at runtime (~77 <style>
 * tags) which scrambled the Tailwind v4 cascade-layer order and pulled in
 * stale ui-components typography (serif headings, missing card chrome). The
 * native page uses the single built stylesheet in correct layer order.
 *
 * Translations come from the root route's serialized i18n store; data is
 * fetched on the server by the listing server fns. ssr defaults to true.
 */
import { createFileRoute } from "@tanstack/react-router"
import { ListingDetail } from "~/pages/listings/ListingDetail"
import { ErrorPage } from "../components/ErrorPage"
import {
  getListingDetail,
  getListingUnits,
  getListingPreferences,
  getListingAmiCharts,
} from "../lib/listings/server-fns"
import { getAmiChartMetaDataFromUnits } from "../lib/listings/ami"

export const Route = createFileRoute("/listings/$id")({
  // `force` is an optional cache-bust flag; only surface it when explicitly
  // set so normal URLs don't redirect to a canonical `?force=false`.
  validateSearch: (search: Record<string, unknown>): { force?: true } =>
    search.force === "true" || search.force === true ? { force: true } : {},
  loaderDeps: ({ search }) => ({ force: search.force }),
  loader: async ({ params, deps }) => {
    const [listing, units, preferences] = await Promise.all([
      getListingDetail({ data: { id: params.id, force: deps.force } }),
      getListingUnits({ data: { id: params.id } }),
      getListingPreferences({ data: { id: params.id } }),
    ])
    // AMI charts are a secondary fetch derived from the units: each unit
    // references a chart by (type, year, percent), so we can only request them
    // once units are in hand. Fetching here (vs client-side post-load like the
    // Rails page) keeps the pricing/income table fully server-rendered.
    const amiCharts = await getListingAmiCharts({
      data: { charts: getAmiChartMetaDataFromUnits(units) },
    })
    return { listing, units, preferences, amiCharts }
  },
  component: ListingDetailRoute,
  errorComponent: ListingDetailError,
  staticData: { nativeShell: true },
})

function ListingDetailRoute() {
  const { listing, units, preferences, amiCharts } = Route.useLoaderData()
  return (
    <ListingDetail
      listing={listing}
      units={units}
      preferences={preferences}
      amiCharts={amiCharts}
    />
  )
}

function ListingDetailError() {
  return (
    <ErrorPage
      title="Unable to Load Listing"
      message="We're having trouble loading this listing. Please try again in a moment."
    />
  )
}
