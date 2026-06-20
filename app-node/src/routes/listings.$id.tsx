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
import { createFileRoute, defer } from "@tanstack/react-router"
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
    // Await ONLY the core listing (name/address/image/status — the above-the-fold
    // content). The shell + hero then flush to the browser immediately for a fast
    // FCP, instead of SSR blocking on every Salesforce call.
    const listing = await getListingDetail({
      data: { id: params.id, force: deps.force },
    })

    // Defer the heavier below-the-fold sections as streamed promises (TanStack
    // streams them in after the shell; the component renders them via <Await>).
    const unitsPromise = getListingUnits({ data: { id: params.id } })
    const preferencesPromise = getListingPreferences({ data: { id: params.id } })
    // AMI charts depend on units (each unit references a chart by type/year/
    // percent), so chain off units — still deferred, streams after units resolve.
    const pricingPromise = unitsPromise.then(async (units) => ({
      units,
      amiCharts: await getListingAmiCharts({
        data: { charts: getAmiChartMetaDataFromUnits(units) },
      }),
    }))

    // Tag with defer() so the router streams these (serializes as pending and
    // streams the resolution) instead of awaiting them before SSR. <Await>
    // consumes them with a Suspense fallback.
    return {
      listing,
      pricingPromise: defer(pricingPromise),
      preferencesPromise: defer(preferencesPromise),
    }
  },
  component: ListingDetailRoute,
  errorComponent: ListingDetailError,
  staticData: { nativeShell: true },
})

function ListingDetailRoute() {
  const { listing, pricingPromise, preferencesPromise } = Route.useLoaderData()
  return (
    <ListingDetail
      listing={listing}
      pricingPromise={pricingPromise}
      preferencesPromise={preferencesPromise}
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
