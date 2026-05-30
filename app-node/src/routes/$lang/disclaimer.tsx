/**
 * Language-prefixed Disclaimer page route: /:lang/disclaimer
 */
import { createFileRoute } from "@tanstack/react-router"
import { Disclaimer } from "../../pages/Disclaimer"
import { loadPageTranslations } from "../../lib/routing/createPageLoader"

export const Route = createFileRoute("/$lang/disclaimer")({
  loader: ({ params }) => loadPageTranslations(params.lang),
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
