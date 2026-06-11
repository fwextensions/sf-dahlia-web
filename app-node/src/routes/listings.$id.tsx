/**
 * ListingDetail route - Shows a single listing with units and preferences.
 * Server functions fetch data via Rails proxy with caching and retry.
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7
 */

import { createFileRoute } from "@tanstack/react-router"
import {
  getListingDetail,
  getListingUnits,
  getListingPreferences,
} from "../lib/listings/server-fns"
import { ErrorPage } from "../components/ErrorPage"
import { ListingDetail } from "../pages/listings/ListingDetail"

export const Route = createFileRoute("/listings/$id")({
  validateSearch: (search: Record<string, unknown>) => ({
    force: search.force === "true" || search.force === true,
  }),
  loaderDeps: ({ search }) => ({ force: search.force }),
  loader: async ({ params, deps }) => {
    const [listing, units, preferences] = await Promise.all([
      getListingDetail({ data: { id: params.id, force: deps.force } }),
      getListingUnits({ data: { id: params.id } }),
      getListingPreferences({ data: { id: params.id } }),
    ])

    return { listing, units, preferences }
  },
  component: ListingDetailRoute,
  errorComponent: ListingDetailError,
})

function ListingDetailRoute() {
  const { listing, units, preferences } = Route.useLoaderData()
  return <ListingDetail listing={listing} units={units} preferences={preferences} />
}

function ListingDetailError() {
  return (
    <ErrorPage
      title="Unable to Load Listing"
      message="We're having trouble loading this listing. Please try again in a moment."
    />
  )
}
