/**
 * Language-prefixed BuyDirectory route: /:lang/listings/for-sale
 * Server function fetches data via Rails proxy with caching and retry.
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7
 */

import { createFileRoute } from "@tanstack/react-router"
import { getListings } from "../../lib/listings/server-fns"
import { ErrorPage } from "../../components/ErrorPage"
import { SaleDirectory } from "../../pages/listings/SaleDirectory"

export const Route = createFileRoute("/$lang/listings/for-sale")({
  validateSearch: (search: Record<string, unknown>) => ({
    force: search.force === "true" || search.force === true,
  }),
  loaderDeps: ({ search }) => ({ force: search.force }),
  loader: async ({ deps }) => {
    return getListings({
      data: { type: "ownership", force: deps.force },
    })
  },
  component: BuyDirectoryRoute,
  errorComponent: BuyDirectoryError,
})

function BuyDirectoryRoute() {
  const { listings } = Route.useLoaderData()
  return <SaleDirectory listings={listings} />
}

function BuyDirectoryError() {
  return (
    <ErrorPage
      title="Unable to Load Ownership Listings"
      message="We're having trouble loading the ownership listings. Please try again in a moment."
    />
  )
}
