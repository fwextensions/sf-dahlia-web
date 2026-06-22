/**
 * SSR-safe localized-path builder for native pages.
 *
 * Prefixes an app path with the current language (e.g. "/listings/for-rent" →
 * "/es/listings/for-rent" in Spanish; unchanged for the default language). Use
 * this for internal links in native components so clicking from a localized page
 * keeps the language.
 *
 * Why not routeUtil.getLocalizedPath: routeUtil's module top-level builds
 * SignInRedirectUrls by calling a getter whose default arg reads
 * window.location.pathname, which throws during SSR module eval. This helper only
 * pulls SSR-safe pieces from languageUtil/urlUtil. `getCurrentLanguage()` with no
 * arg is SSR-safe — on the server it reads the request-scoped active translation
 * instance's language; on the client it reads window.location.
 */
import {
  getCurrentLanguage,
  getPathWithoutLanguagePrefix,
  LANGUAGE_CONFIGS,
  type LanguagePrefix,
} from "../../../../app/javascript/util/languageUtil"
import { cleanPath } from "../../../../app/javascript/util/urlUtil"

export const getLocalizedPath = (
  path: string,
  language: LanguagePrefix = getCurrentLanguage(),
  queryString = ""
): string => {
  const pathWithoutLang = getPathWithoutLanguagePrefix(path)
  const config = LANGUAGE_CONFIGS[language]
  const cleaned = cleanPath(
    config.isDefault ? pathWithoutLang : `${config.prefix}${pathWithoutLang}`
  )
  return `${cleaned}${queryString}`
}
