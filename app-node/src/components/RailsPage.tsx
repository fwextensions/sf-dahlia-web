/**
 * RailsPage — bridge that mounts the original react-on-rails page components
 * (from ../../app/javascript) inside a TanStack Start route.
 *
 * The Rails pages are client-rendered (react-on-rails registers them and
 * mounts after translations load), so this bridge does the same:
 *  - renders nothing during SSR,
 *  - on the client, loads the Bloom translations for the current language
 *    and the page module in parallel, then mounts the page.
 *
 * Everything is imported dynamically so none of the window-dependent Rails
 * code is evaluated during SSR.
 */
import React, { useEffect, useState } from "react"
import { assetPaths } from "../lib/assetPaths"

type RailsPageComponent = React.ComponentType<{ assetPaths: unknown }>
type PageModule = { default: RailsPageComponent }
export type PageLoader = () => Promise<PageModule>

interface RailsPageProps {
  load: PageLoader
}

export function RailsPage({ load }: RailsPageProps) {
  const [Page, setPage] = useState<RailsPageComponent | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [languageUtil, pageModule] = await Promise.all([
        import("../../../app/javascript/util/languageUtil"),
        load(),
      ])
      await languageUtil.loadTranslations(
        languageUtil.getCurrentLanguage(window.location.pathname)
      )
      if (!cancelled) {
        // setState stores functions by calling them, so wrap in a thunk
        setPage(() => pageModule.default)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [load])

  if (!Page) return null
  return <Page assetPaths={assetPaths} />
}
