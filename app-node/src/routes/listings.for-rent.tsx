/**
 * SSR spike: the rental directory rendered server-side by the native
 * RentDirectory component (no RailsPage bridge).
 *
 *  - beforeLoad loads translations for the request's language so the SSR render
 *    pass resolves t() correctly (module-scoped active instance — see
 *    docs/tanstack-ssr-plan.md prereq 1).
 *  - loader fetches listings on the server via the getListings server fn.
 *  - ssr defaults to true (no `ssr: false`), so the page is server-rendered.
 *
 * See docs/tanstack-ssr-plan.md for the rollout + the hydration-parity follow-up.
 */
import { createFileRoute } from "@tanstack/react-router"
import { RentDirectory } from "~/pages/listings/RentDirectory"
import { getListings, type SerializableListing } from "../lib/listings/server-fns"
import { getCurrentLanguage, loadTranslations } from "../../../app/javascript/util/languageUtil"

export const Route = createFileRoute("/listings/for-rent")({
  beforeLoad: async ({ location }) => {
    await loadTranslations(getCurrentLanguage(location.pathname))
  },
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
