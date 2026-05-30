/**
 * Language-prefixed Additional Resources page route: /:lang/additional-resources
 */
import { createFileRoute } from "@tanstack/react-router"
import { AdditionalResources } from "../../pages/AdditionalResources"
import { loadPageTranslations } from "../../lib/routing/createPageLoader"

export const Route = createFileRoute("/$lang/additional-resources")({
  loader: ({ params }) => loadPageTranslations(params.lang),
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
