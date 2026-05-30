/**
 * Language-prefixed home page route: /:lang/
 * e.g., /en, /es, /zh, /tl
 */
import { createFileRoute } from "@tanstack/react-router"
import { HomePage } from "../../pages/HomePage"
import { loadPageTranslations } from "../../lib/routing/createPageLoader"

export const Route = createFileRoute("/$lang/")({
  loader: ({ params }) => loadPageTranslations(params.lang),
  component: HomePageRoute,
})

function HomePageRoute() {
  const { translations, fallbackTranslations, locale } = Route.useLoaderData()
  return (
    <HomePage
      translations={translations}
      fallbackTranslations={fallbackTranslations}
      locale={locale}
    />
  )
}
