/**
 * Language-prefixed Privacy Policy page route: /:lang/privacy
 */
import { createFileRoute } from "@tanstack/react-router"
import { Privacy } from "../../pages/Privacy"
import { loadPageTranslations } from "../../lib/routing/createPageLoader"

export const Route = createFileRoute("/$lang/privacy")({
  loader: ({ params }) => loadPageTranslations(params.lang),
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
