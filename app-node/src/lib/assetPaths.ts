/**
 * Mirror of Rails' static_asset_paths helper: map asset filename -> served URL.
 *
 * The Rails pages (via the RailsPage bridge) and the native AppShell both look
 * up images/json by bare filename (e.g. "DAHLIA-logo.svg", "logo-city.png"),
 * the way ConfigContext's getAssetPath does in the Rails app. Vite resolves each
 * asset to its hashed served URL at build time via import.meta.glob.
 */
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

export const assetPaths: Record<string, string> = {}
for (const [path, url] of Object.entries(assetModules)) {
  const basename = path.split("/").pop()
  if (basename) assetPaths[basename] = url
}

/** Look up a served asset URL by bare filename, mirroring ConfigContext.getAssetPath. */
export const getAssetPath = (filename: string): string => assetPaths[filename] ?? `/${filename}`
