import { createRouter } from "@tanstack/react-router"
import { routeTree } from "./routeTree.gen"

export function getRouter() {
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
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
