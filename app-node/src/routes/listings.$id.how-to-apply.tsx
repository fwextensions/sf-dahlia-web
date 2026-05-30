/**
 * Listing-specific How to Apply page: /listings/:id/how-to-apply
 *
 * Phase 2: Fetches listing data via server function (no client-side Rails API calls).
 * The listing data provides dates, submission URLs, and other listing-specific info.
 * Requirements: 10.4
 */
import { createFileRoute } from "@tanstack/react-router"
import { getListingDetail } from "../lib/listings/server-fns"
import { HowToApply } from "../pages/HowToApply"
import { loadPageTranslations } from "../lib/routing/createPageLoader"
import { ErrorPage } from "../components/ErrorPage"

export const Route = createFileRoute("/listings/$id/how-to-apply")({
  loader: async ({ params }) => {
    const [listing, { translations, fallbackTranslations }] = await Promise.all(
      [
        getListingDetail({ data: { id: params.id } }),
        loadPageTranslations(),
      ]
    )
    return { listing, translations, fallbackTranslations }
  },
  component: HowToApplyRoute,
  errorComponent: HowToApplyError,
})

function HowToApplyRoute() {
  const { listing, translations, fallbackTranslations } = Route.useLoaderData()
  return (
    <HowToApply
      translations={translations}
      fallbackTranslations={fallbackTranslations}
      listing={listing}
    />
  )
}

function HowToApplyError() {
  return (
    <ErrorPage
      title="Unable to Load How to Apply"
      message="We're having trouble loading the application instructions for this listing. Please try again in a moment."
    />
  )
}
