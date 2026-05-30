/**
 * Get Assistance page route: /get-assistance
 */
import { createFileRoute } from "@tanstack/react-router"
import { GetAssistance } from "../pages/GetAssistance"
import { loadPageTranslations } from "../lib/routing/createPageLoader"

export const Route = createFileRoute("/get-assistance")({
  loader: () => loadPageTranslations(),
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
