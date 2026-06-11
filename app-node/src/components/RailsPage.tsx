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

type RailsPageComponent = React.ComponentType<{ assetPaths: unknown }>
type PageModule = { default: RailsPageComponent }
export type PageLoader = () => Promise<PageModule>

// Mirror of Rails' static_asset_paths helper: map asset filename -> served URL.
// The Rails pages look up images/json by bare filename via ConfigContext's
// getAssetPath (e.g. getAssetPath("bg@1200.jpg")).
const assetModules = {
  ...import.meta.glob("../../../app/assets/images/*", {
    eager: true,
    query: "?url",
    import: "default",
  }),
  ...import.meta.glob("../../../app/assets/json/*.json", {
    eager: true,
    query: "?url",
    import: "default",
  }),
} as Record<string, string>

const assetPaths: Record<string, string> = {}
for (const [path, url] of Object.entries(assetModules)) {
  const basename = path.split("/").pop()
  if (basename) assetPaths[basename] = url
}

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
