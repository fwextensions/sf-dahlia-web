/**
 * Housing Counselors page route: /housing-counselors
 */
import { createFileRoute } from "@tanstack/react-router"
import { HousingCounselors } from "../pages/HousingCounselors"
import { loadPageTranslations } from "../lib/routing/createPageLoader"

export const Route = createFileRoute("/housing-counselors")({
  loader: () => loadPageTranslations(),
  component: HousingCounselorsRoute,
})

function HousingCounselorsRoute() {
  const { translations, fallbackTranslations } = Route.useLoaderData()
  return (
    <HousingCounselors
      translations={translations}
      fallbackTranslations={fallbackTranslations}
    />
  )
}
