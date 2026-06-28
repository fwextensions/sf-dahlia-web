import { createRouter } from "@tanstack/react-router"
import { routeTree } from "./routeTree.gen"

export function getRouter() {
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    // Restore scroll position immediately on navigation. The default ('auto')
    // resolves to the element's CSS scroll-behavior, and the directory nav bar
    // sets a global `html { scroll-behavior: smooth }` (DirectoryPageNavigationBar.css)
    // for its in-page section jumps — which would otherwise make every restored
    // navigation animate-scroll into place. 'instant' overrides that for
    // restoration only; the nav's native anchor jumps stay smooth.
    scrollRestorationBehavior: "instant",
    // Preload a route's loader data on hover/touch ("intent"), so by the time
    // the user clicks a listing the Salesforce fetch is often already done —
    // the main lever for responsive nav. Preloaded data is reused for 30s by
    // default (defaultPreloadStaleTime), avoiding an immediate refetch on click.
    defaultPreload: "intent",
    defaultNotFoundComponent: () => {
      // The NotFound component is rendered from __root.tsx notFoundComponent
      return null
    },
  })

  return router
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
