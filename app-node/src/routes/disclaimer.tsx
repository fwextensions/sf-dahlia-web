/**
 * Disclaimer page route: /disclaimer
 */
import { createFileRoute } from "@tanstack/react-router"
import { Disclaimer } from "../pages/Disclaimer"
import { loadPageTranslations } from "../lib/routing/createPageLoader"

export const Route = createFileRoute("/disclaimer")({
  loader: () => loadPageTranslations(),
  component: DisclaimerRoute,
})

function DisclaimerRoute() {
  const { translations, fallbackTranslations } = Route.useLoaderData()
  return (
    <Disclaimer
      translations={translations}
      fallbackTranslations={fallbackTranslations}
    />
  )
}
