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
import type { SerializableUnit, SerializablePreference } from "../lib/listings/server-fns"

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
  component: ListingDetail,
  errorComponent: ListingDetailError,
})

function ListingDetail() {
  const { listing, units, preferences } = Route.useLoaderData()

  return (
    <main role="main" aria-labelledby="listing-detail-title">
      <h1 id="listing-detail-title">{listing.name}</h1>

      <section aria-labelledby="listing-address-heading">
        <h2 id="listing-address-heading">Address</h2>
        <address>
          {listing.buildingAddress}
          <br />
          {listing.buildingCity}, {listing.buildingState} {listing.buildingZip}
        </address>
      </section>

      {listing.applicationDueDate && (
        <p>
          <strong>Application Due:</strong> {listing.applicationDueDate}
        </p>
      )}

      {listing.lotteryDate && (
        <p>
          <strong>Lottery Date:</strong> {listing.lotteryDate}
        </p>
      )}

      {units.length > 0 && (
        <section aria-labelledby="units-heading">
          <h2 id="units-heading">Available Units</h2>
          <ul aria-label="Unit list">
            {units.map((unit: SerializableUnit, index: number) => (
              <li key={index}>
                {unit.unitType}
                {unit.numBedrooms != null && ` — ${unit.numBedrooms} BR`}
                {unit.numBathrooms != null && ` / ${unit.numBathrooms} BA`}
                {unit.sqFt != null && ` / ${unit.sqFt} sq ft`}
              </li>
            ))}
          </ul>
        </section>
      )}

      {preferences.length > 0 && (
        <section aria-labelledby="preferences-heading">
          <h2 id="preferences-heading">Listing Preferences</h2>
          <ol aria-label="Preferences">
            {preferences.map((pref: SerializablePreference) => (
              <li key={pref.listingPreferenceID}>{pref.preferenceName}</li>
            ))}
          </ol>
        </section>
      )}
    </main>
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
