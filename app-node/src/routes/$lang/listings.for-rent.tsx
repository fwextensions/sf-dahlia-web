/**
 * Language-prefixed RentDirectory route: /:lang/listings/for-rent
 * Server function fetches data via Rails proxy with caching and retry.
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7
 */

import { createFileRoute } from "@tanstack/react-router"
import { getListings } from "../../lib/listings/server-fns"
import { ErrorPage } from "../../components/ErrorPage"
import { RentDirectory } from "../../pages/listings/RentDirectory"

export const Route = createFileRoute("/$lang/listings/for-rent")({
  validateSearch: (search: Record<string, unknown>) => ({
    force: search.force === "true" || search.force === true,
  }),
  loaderDeps: ({ search }) => ({ force: search.force }),
  loader: async ({ deps }) => {
    return getListings({
      data: { type: "rental", force: deps.force },
    })
  },
  component: RentDirectoryRoute,
  errorComponent: RentDirectoryError,
})

function RentDirectoryRoute() {
  const { listings } = Route.useLoaderData()
  return <RentDirectory listings={listings} />
}

function RentDirectoryError() {
  return (
    <ErrorPage
      title="Unable to Load Rental Listings"
      message="We're having trouble loading the rental listings. Please try again in a moment."
    />
  )
}
