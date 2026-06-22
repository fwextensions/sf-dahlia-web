/**
 * Language-prefixed home page: /:lang
 *
 * Native SSR — same HomePage component as the unprefixed route. Locale comes from
 * the root route's i18n store (built from getCurrentLanguage(pathname)).
 */
import { createFileRoute } from "@tanstack/react-router"
import { HomePage } from "~/pages/HomePage"

export const Route = createFileRoute("/$lang/")({
  component: HomePage,
  staticData: { nativeShell: true },
})
