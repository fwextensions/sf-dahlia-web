/**
 * Supported i18n language prefixes.
 * Only these values are treated as language prefixes in URL segments.
 * Any other value in the first path segment is treated as a regular path component.
 */
export const SUPPORTED_LANGS = ["en", "es", "zh", "tl"] as const

export type SupportedLang = (typeof SUPPORTED_LANGS)[number]

/**
 * Check if a string is a valid language prefix.
 */
export function isValidLang(value: string): value is SupportedLang {
  return SUPPORTED_LANGS.includes(value as SupportedLang)
}

/** Default language used when no prefix is present */
export const DEFAULT_LANG: SupportedLang = "en"
