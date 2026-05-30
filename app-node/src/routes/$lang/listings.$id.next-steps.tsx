/**
 * Language-prefixed InviteToPage (Next Steps) route: /:lang/listings/:id/next-steps
 * Server function fetches listing data via Rails proxy with caching and retry.
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7
 */

import { createFileRoute } from "@tanstack/react-router"
import { getListingDetail } from "../../lib/listings/server-fns"
import { ErrorPage } from "../../components/ErrorPage"

export const Route = createFileRoute("/$lang/listings/$id/next-steps")({
  validateSearch: (search: Record<string, unknown>) => ({
    force: search.force === "true" || search.force === true,
  }),
  loaderDeps: ({ search }) => ({ force: search.force }),
  loader: async ({ params, deps }) => {
    const listing = await getListingDetail({
      data: { id: params.id, force: deps.force },
    })
    return { listing }
  },
  component: InviteToPage,
  errorComponent: InviteToPageError,
})

function InviteToPage() {
  const { listing } = Route.useLoaderData()
  const { id } = Route.useParams()

  return (
    <main role="main" aria-labelledby="next-steps-title">
      <h1 id="next-steps-title">Next Steps: {listing.name}</h1>

      <section aria-labelledby="listing-info-heading">
        <h2 id="listing-info-heading">Listing Information</h2>
        <address>
          {listing.buildingAddress}
          <br />
          {listing.buildingCity}, {listing.buildingState} {listing.buildingZip}
        </address>
      </section>

      {listing.lotteryStatus && (
        <p>
          <strong>Lottery Status:</strong> {listing.lotteryStatus}
        </p>
      )}

      <nav aria-label="Next steps navigation">
        <a href={`/listings/${id}/next-steps/documents`}>
          View Required Documents
        </a>
      </nav>
    </main>
  )
}

function InviteToPageError() {
  return (
    <ErrorPage
      title="Unable to Load Next Steps"
      message="We're having trouble loading the next steps for this listing. Please try again in a moment."
    />
  )
}
