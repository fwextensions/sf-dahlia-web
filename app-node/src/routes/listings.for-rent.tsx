/**
 * SSR: the rental directory rendered server-side by the native RentDirectory
 * component (no RailsPage bridge).
 *
 * Loader is shared with the language-prefixed variant ($lang/listings.for-rent.tsx)
 * via lib/listings/route-config. Translations come from the root route's
 * serialized i18n store; ssr defaults to true.
 */
import { createFileRoute } from "@tanstack/react-router"
import { RentDirectory } from "~/pages/listings/RentDirectory"
import { loadDirectory } from "../lib/listings/route-config"

export const Route = createFileRoute("/listings/for-rent")({
  loader: () => loadDirectory("rental"),
  component: RentDirectoryRoute,
  staticData: { nativeShell: true },
})

function RentDirectoryRoute() {
  const { listings } = Route.useLoaderData()
  return <RentDirectory listings={listings} />
}
