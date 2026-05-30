/**
 * Privacy Policy page route: /privacy
 */
import { createFileRoute } from "@tanstack/react-router"
import { Privacy } from "../pages/Privacy"
import { loadPageTranslations } from "../lib/routing/createPageLoader"

export const Route = createFileRoute("/privacy")({
  loader: () => loadPageTranslations(),
  component: PrivacyRoute,
})

function PrivacyRoute() {
  const { translations, fallbackTranslations } = Route.useLoaderData()
  return (
    <Privacy
      translations={translations}
      fallbackTranslations={fallbackTranslations}
    />
  )
}
