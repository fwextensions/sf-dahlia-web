/**
 * Home page route: /
 * Renders the DAHLIA homepage with English locale (default).
 */
import { createFileRoute } from "@tanstack/react-router"
import { HomePage } from "../pages/HomePage"
import { loadPageTranslations } from "../lib/routing/createPageLoader"

export const Route = createFileRoute("/")({
  loader: () => loadPageTranslations(),
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
