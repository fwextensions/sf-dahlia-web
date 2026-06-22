/**
 * Language-prefixed for-sale directory: /:lang/listings/for-sale
 *
 * Native SSR (no RailsPage bridge) — same SaleDirectory component + loader as the
 * unprefixed route, via lib/listings/route-config. Locale comes from the root
 * route's i18n store.
 */
import { createFileRoute } from "@tanstack/react-router"
import { SaleDirectory } from "~/pages/listings/SaleDirectory"
import { loadDirectory } from "../../lib/listings/route-config"

export const Route = createFileRoute("/$lang/listings/for-sale")({
  loader: () => loadDirectory("ownership"),
  component: SaleDirectoryRoute,
  staticData: { nativeShell: true },
})

function SaleDirectoryRoute() {
  const { listings } = Route.useLoaderData()
  return <SaleDirectory listings={listings} />
}
