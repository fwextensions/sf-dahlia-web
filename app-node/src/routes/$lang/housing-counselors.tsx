/**
 * Language-prefixed Housing Counselors page route: /:lang/housing-counselors
 */
import { createFileRoute } from "@tanstack/react-router"
import { HousingCounselors } from "../../pages/HousingCounselors"
import { loadPageTranslations } from "../../lib/routing/createPageLoader"

export const Route = createFileRoute("/$lang/housing-counselors")({
  loader: ({ params }) => loadPageTranslations(params.lang),
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
