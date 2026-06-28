/**
 * Language-prefixed listing detail: /:lang/listings/:id
 *
 * Native SSR (no RailsPage bridge) — renders the same ListingDetail component as
 * the unprefixed /listings/$id route, sharing its loader + search schema via
 * lib/listings/route-config. Locale (es/zh/tl) comes from the root route's i18n
 * store, which is built from getCurrentLanguage(pathname) in beforeLoad.
 */
import { createFileRoute } from "@tanstack/react-router"
import { ListingDetail } from "~/pages/listings/ListingDetail"
import { ErrorPage } from "../../components/ErrorPage"
import { listingDetailSearchSchema, loadListingDetail } from "../../lib/listings/route-config"

export const Route = createFileRoute("/$lang/listings/$id")({
  validateSearch: listingDetailSearchSchema,
  loaderDeps: ({ search }) => ({ force: search.force }),
  loader: ({ params, deps }) => loadListingDetail(params.id, deps.force),
  component: ListingDetailRoute,
  errorComponent: ListingDetailError,
  staticData: { nativeShell: true },
})

function ListingDetailRoute() {
  const { listing, pricingData, preferencesData } = Route.useLoaderData()
  return (
    <ListingDetail
      listing={listing}
      pricingData={pricingData}
      preferencesData={preferencesData}
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
