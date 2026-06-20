/**
 * SSR: the for-sale (ownership) directory rendered server-side by the native
 * SaleDirectory component (no RailsPage bridge).
 *
 * Mirrors listings.for-rent.tsx: translations come from the root route's
 * serialized i18n store, the loader fetches listings on the server via the
 * getListings server fn (type "ownership"), and ssr defaults to true so the
 * page is server-rendered (no client-only spinner).
 */
import { createFileRoute } from "@tanstack/react-router"
import { SaleDirectory } from "~/pages/listings/SaleDirectory"
import { getListings, type SerializableListing } from "../lib/listings/server-fns"

export const Route = createFileRoute("/listings/for-sale")({
  loader: async () => {
    let listings: SerializableListing[] = []
    try {
      listings = (await getListings({ data: { type: "ownership" } })).listings
    } catch (err) {
      // Tolerate the Salesforce proxy (Rails on :3000) being down locally —
      // render the empty state instead of failing the whole route.
      console.error("[for-sale] getListings failed (backend down?):", err)
    }
    return { listings }
  },
  component: SaleDirectoryRoute,
  staticData: { nativeShell: true },
})

function SaleDirectoryRoute() {
  const { listings } = Route.useLoaderData()
  return <SaleDirectory listings={listings} />
}
