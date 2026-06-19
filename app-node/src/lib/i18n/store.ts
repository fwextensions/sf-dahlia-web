/**
 * Server-serializable translation store (SSR prereq 2).
 *
 * The server renders with translations loaded; to hydrate the client *without*
 * re-fetching the (large) phrase bundles, the server serializes the store into
 * the SSR HTML and the client initializes its i18next instance synchronously
 * from it (see docs/tanstack-ssr-plan.md prereq 2).
 *
 * Size note: phrase bundles are ~200-240KB each. To avoid inlining both the
 * English fallback *and* the target language, we merge them into a single bundle
 * (en overlaid by the target) — the rendered output is identical to the
 * en+target+fallback instance the Rails app uses, at roughly half the payload.
 * A future optimization is to serialize only the keys actually used during the
 * SSR render (used-key capture); see the plan doc.
 */
import { createTranslationInstance, setActiveTranslationInstance } from "@uic"
import {
  loadTranslationResources,
  loadDayjsLocale,
  LanguagePrefix,
} from "../../../../app/javascript/util/languageUtil"

export interface I18nStore {
  lng: string
  /** en overlaid with the target language — a single self-contained bundle. */
  bundle: Record<string, unknown>
}

declare global {
  interface Window {
    __DAHLIA_I18N__?: I18nStore
  }
}

/** Build a serializable, merged translation store for a language. */
export async function buildI18nStore(prefix: LanguagePrefix): Promise<I18nStore> {
  const { lng, resources } = await loadTranslationResources(prefix)
  const bundle = { ...(resources.en ?? {}), ...(resources[lng] ?? {}) }
  return { lng, bundle }
}

/**
 * Register the store's bundle as the active translation instance. Used on the
 * server (for the SSR render) and on the client (at hydrate) so both resolve
 * t() identically. The merged bundle is registered under both `en` and the
 * active language so i18next's fallbackLng="en" always resolves.
 */
export function initI18nFromStore(store: I18nStore): void {
  setActiveTranslationInstance(
    createTranslationInstance(store.lng, { en: store.bundle, [store.lng]: store.bundle })
  )
  // Date formatting locale — not needed for first paint, so don't block on it.
  void loadDayjsLocale(store.lng as LanguagePrefix)
}

/**
 * Inline script that exposes the store on `window` before hydration. `<` is
 * escaped because phrase values contain HTML (e.g. <span>, <a>) which would
 * otherwise let a `</script>` sequence break out of the tag.
 */
export function serializeI18nStore(store: I18nStore): string {
  return `window.__DAHLIA_I18N__=${JSON.stringify(store).replace(/</g, "\\u003c")};`
}
