/**
 * Language-prefixed for-rent directory: /:lang/listings/for-rent
 *
 * Native SSR (no RailsPage bridge) — same RentDirectory component + loader as the
 * unprefixed route, via lib/listings/route-config. Locale comes from the root
 * route's i18n store.
 */
import { createFileRoute } from "@tanstack/react-router"
import { RentDirectory } from "~/pages/listings/RentDirectory"
import { loadDirectory } from "../../lib/listings/route-config"

export const Route = createFileRoute("/$lang/listings/for-rent")({
  loader: () => loadDirectory("rental"),
  component: RentDirectoryRoute,
  staticData: { nativeShell: true },
})

function RentDirectoryRoute() {
  const { listings } = Route.useLoaderData()
  return <RentDirectory listings={listings} />
}
