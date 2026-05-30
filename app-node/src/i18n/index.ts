/**
 * i18n module for DAHLIA Node/TS server.
 *
 * Provides translation loading, locale resolution, and a translation function
 * compatible with SSR (translations resolved on the server for initial render).
 *
 * Usage in route loaders / server functions:
 *
 *   import { resolveLocaleFromParam, createTranslator } from "~/i18n"
 *
 *   // In a route loader:
 *   const locale = resolveLocaleFromParam(params.lang)
 *   const t = await createTranslator(locale)
 *   const title = t("page.title")
 */

export { SUPPORTED_LOCALES, DEFAULT_LOCALE, isSupportedLocale } from "./types"
export type { SupportedLocale, TranslationDictionary } from "./types"

// Server-only exports: import directly from "./loader" in server functions/tests
// export { getTranslations, preloadTranslations, clearTranslationCache, setTranslationBasePath } from "./loader"
export { createTranslatorSync } from "./translate"
export { resolveLocaleFromParam } from "./resolveLocale"
