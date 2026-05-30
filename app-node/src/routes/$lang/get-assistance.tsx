/**
 * Language-prefixed Get Assistance page route: /:lang/get-assistance
 */
import { createFileRoute } from "@tanstack/react-router"
import { GetAssistance } from "../../pages/GetAssistance"
import { loadPageTranslations } from "../../lib/routing/createPageLoader"

export const Route = createFileRoute("/$lang/get-assistance")({
  loader: ({ params }) => loadPageTranslations(params.lang),
  component: GetAssistanceRoute,
})

function GetAssistanceRoute() {
  const { translations, fallbackTranslations, locale } = Route.useLoaderData()
  return (
    <GetAssistance
      translations={translations}
      fallbackTranslations={fallbackTranslations}
      locale={locale}
    />
  )
}
