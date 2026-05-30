/**
 * Supported locale codes for the DAHLIA housing portal.
 */
export const SUPPORTED_LOCALES = ["en", "es", "zh", "tl"] as const

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: SupportedLocale = "en"

/**
 * A nested translation dictionary. Values are either strings or nested objects.
 */
export type TranslationDictionary = {
  [key: string]: string | TranslationDictionary
}

/**
 * Check if a string is a supported locale code.
 */
export function isSupportedLocale(value: string): value is SupportedLocale {
  return SUPPORTED_LOCALES.includes(value as SupportedLocale)
}
