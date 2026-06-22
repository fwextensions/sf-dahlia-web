/**
 * Listing detail — native TanStack Start route (no RailsPage bridge).
 *
 * The bridged client-only version injected its CSS at runtime (~77 <style> tags)
 * which scrambled the Tailwind v4 cascade-layer order; the native page uses the
 * single built stylesheet in correct layer order. Translations come from the root
 * route's serialized i18n store; data is fetched on the server by the listing
 * server fns. ssr defaults to true.
 *
 * Loader + search schema are shared with the language-prefixed variant
 * ($lang/listings.$id.tsx) via lib/listings/route-config.
 */
import { createFileRoute } from "@tanstack/react-router"
import { ListingDetail } from "~/pages/listings/ListingDetail"
import { ErrorPage } from "../components/ErrorPage"
import { listingDetailSearchSchema, loadListingDetail } from "../lib/listings/route-config"

export const Route = createFileRoute("/listings/$id")({
  validateSearch: listingDetailSearchSchema,
  loaderDeps: ({ search }) => ({ force: search.force }),
  loader: ({ params, deps }) => loadListingDetail(params.id, deps.force),
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
