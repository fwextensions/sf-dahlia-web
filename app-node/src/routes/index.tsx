/**
 * Home page — native TanStack Start route (no RailsPage bridge).
 *
 * Static content (hero + mailing-list signup); no loader. Translations come from
 * the root route's serialized i18n store. Shares the HomePage component with the
 * language-prefixed variant ($lang/index.tsx).
 */
import { createFileRoute } from "@tanstack/react-router"
import { HomePage } from "~/pages/HomePage"

export const Route = createFileRoute("/")({
  component: HomePage,
  staticData: { nativeShell: true },
})
