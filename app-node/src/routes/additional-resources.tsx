/**
 * Additional Resources page route: /additional-resources
 */
import { createFileRoute } from "@tanstack/react-router"
import { AdditionalResources } from "../pages/AdditionalResources"
import { loadPageTranslations } from "../lib/routing/createPageLoader"

export const Route = createFileRoute("/additional-resources")({
  loader: () => loadPageTranslations(),
  component: AdditionalResourcesRoute,
})

function AdditionalResourcesRoute() {
  const { translations, fallbackTranslations } = Route.useLoaderData()
  return (
    <AdditionalResources
      translations={translations}
      fallbackTranslations={fallbackTranslations}
    />
  )
}
