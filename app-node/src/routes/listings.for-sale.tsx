/**
 * SSR: the for-sale (ownership) directory rendered server-side by the native
 * SaleDirectory component (no RailsPage bridge).
 *
 * Loader is shared with the language-prefixed variant ($lang/listings.for-sale.tsx)
 * via lib/listings/route-config. Translations come from the root route's
 * serialized i18n store; ssr defaults to true.
 */
import { createFileRoute } from "@tanstack/react-router"
import { SaleDirectory } from "~/pages/listings/SaleDirectory"
import { loadDirectory } from "../lib/listings/route-config"

export const Route = createFileRoute("/listings/for-sale")({
  loader: () => loadDirectory("ownership"),
  component: SaleDirectoryRoute,
  staticData: { nativeShell: true },
})

function SaleDirectoryRoute() {
  const { listings } = Route.useLoaderData()
  return <SaleDirectory listings={listings} />
}
