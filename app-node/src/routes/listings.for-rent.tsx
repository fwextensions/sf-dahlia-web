/**
 * SSR: the rental directory rendered server-side by the native RentDirectory
 * component (no RailsPage bridge).
 *
 *  - Translations are loaded + serialized by the root route (see __root.tsx +
 *    docs/tanstack-ssr-plan.md prereq 2), so t() resolves during the SSR render
 *    and the client hydrates synchronously from the serialized store.
 *  - loader fetches listings on the server via the getListings server fn.
 *  - ssr defaults to true (no `ssr: false`), so the page is server-rendered.
 */
import { createFileRoute } from "@tanstack/react-router"
import { RentDirectory } from "~/pages/listings/RentDirectory"
import { getListings, type SerializableListing } from "../lib/listings/server-fns"

export const Route = createFileRoute("/listings/for-rent")({
  loader: async () => {
    let listings: SerializableListing[] = []
    try {
      listings = (await getListings({ data: { type: "rental" } })).listings
    } catch (err) {
      // Spike-only: the Salesforce proxy (Rails on :3000) isn't running locally,
      // so render the empty state instead of failing. This still exercises the
      // full SSR path (data fetch → native page → @uic → translations).
      console.error("[for-rent] getListings failed (backend down?):", err)
    }
    return { listings }
  },
  component: RentDirectoryRoute,
})

function RentDirectoryRoute() {
  const { listings } = Route.useLoaderData()
  return <RentDirectory listings={listings} />
}
