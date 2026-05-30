import type { SupportedLocale } from "./types"
import { DEFAULT_LOCALE, isSupportedLocale } from "./types"

/**
 * Resolves the active locale from the URL language prefix parameter.
 *
 * The router provides `:lang` as an optional route param. This function:
 * - Returns the locale if it's a valid supported locale
 * - Falls back to the default locale (English) if the param is missing or invalid
 *
 * Per requirement 1.6, if the lang segment is not one of the supported values,
 * it's treated as a path component (not a language prefix). This function only
 * handles the resolution once the router has already matched the `:lang` param.
 */
export function resolveLocaleFromParam(langParam: string | undefined): SupportedLocale {
  if (langParam && isSupportedLocale(langParam)) {
    return langParam
  }
  return DEFAULT_LOCALE
}
