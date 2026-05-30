/**
 * Helper to create route loaders for static pages that need translations.
 * Resolves the locale from the route params and loads translation dictionaries.
 * Uses createServerFn to ensure Node.js-only code (file system access) stays server-side.
 */
import { createServerFn } from "@tanstack/react-start"
import type { SupportedLocale, TranslationDictionary } from "../../i18n/types"

export interface PageLoaderData {
  locale: SupportedLocale
  translations: TranslationDictionary | null
  fallbackTranslations: TranslationDictionary | null
}

/**
 * Server function that loads translations for a given lang param.
 * Uses dynamic imports to keep Node.js file system code server-only.
 */
const fetchPageTranslations = createServerFn({ method: "GET" })
  .inputValidator((data: { langParam?: string }) => data)
  .handler(async ({ data }): Promise<PageLoaderData> => {
    const { resolveLocaleFromParam } = await import("../../i18n")
    const { getTranslations } = await import("../../i18n/loader")
    const { DEFAULT_LOCALE } = await import("../../i18n/types")

    const locale = resolveLocaleFromParam(data.langParam)
    const translations = await getTranslations(locale)
    const fallbackTranslations = locale !== DEFAULT_LOCALE ? await getTranslations(DEFAULT_LOCALE) : null

    return {
      locale,
      translations,
      fallbackTranslations,
    }
  })

/**
 * Creates loader data for a static page with translations.
 * @param langParam - The lang param from the URL (undefined for root routes)
 */
export async function loadPageTranslations(langParam?: string): Promise<PageLoaderData> {
  return fetchPageTranslations({ data: { langParam } })
}
