/**
 * Language-prefixed RentDirectory route: /:lang/listings/for-rent
 * Server function fetches data via Rails proxy with caching and retry.
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7
 */

import { createFileRoute } from "@tanstack/react-router"
import { getListings } from "../../lib/listings/server-fns"
import { ErrorPage } from "../../components/ErrorPage"
import type { SerializableListing } from "../../lib/listings/server-fns"

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
  component: RentDirectory,
  errorComponent: RentDirectoryError,
})

function RentDirectory() {
  const { listings } = Route.useLoaderData()

  return (
    <main role="main" aria-labelledby="rent-directory-title">
      <h1 id="rent-directory-title">Listings for Rent</h1>
      <p aria-live="polite">
        {listings.length} listing{listings.length !== 1 ? "s" : ""} available
      </p>
      <ul aria-label="Rental listings">
        {listings.map((listing: SerializableListing) => (
          <li key={listing.listingID}>
            <a href={`/listings/${listing.listingID}`}>
              <h2>{listing.name}</h2>
              <p>
                {listing.buildingAddress}, {listing.buildingCity},{" "}
                {listing.buildingState} {listing.buildingZip}
              </p>
              {listing.applicationDueDate && (
                <p>Apply by: {listing.applicationDueDate}</p>
              )}
            </a>
          </li>
        ))}
      </ul>
    </main>
  )
}

function RentDirectoryError() {
  return (
    <ErrorPage
      title="Unable to Load Rental Listings"
      message="We're having trouble loading the rental listings. Please try again in a moment."
    />
  )
}
