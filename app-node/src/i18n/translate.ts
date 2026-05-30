import type { SupportedLocale, TranslationDictionary } from "./types"
import { DEFAULT_LOCALE } from "./types"

/**
 * Looks up a nested key in a translation dictionary using dot notation.
 * Example: lookupKey(dict, "a1_intro.title") navigates dict.a1_intro.title
 */
function lookupKey(dict: TranslationDictionary, key: string): string | undefined {
  const parts = key.split(".")
  let current: TranslationDictionary | string | undefined = dict

  for (const part of parts) {
    if (current === undefined || current === null || typeof current === "string") {
      return undefined
    }
    current = current[part]
  }

  if (typeof current === "string") {
    return current
  }

  return undefined
}

/**
 * Creates a translation function for a given locale.
 *
 * Fallback chain (per requirement 9.6):
 * 1. Look up key in the requested locale
 * 2. If not found (or locale failed to load), fall back to English
 * 3. If English also fails, return the raw translation key
 *
 * Supports interpolation of template variables: {{variableName}}
 */
export async function createTranslator(
  locale: SupportedLocale,
  loadFn: (locale: SupportedLocale) => Promise<TranslationDictionary | null>
) {
  const requestedTranslations = await loadFn(locale)
  const fallbackTranslations = locale !== DEFAULT_LOCALE ? await loadFn(DEFAULT_LOCALE) : null

  /**
   * Translates a key with optional interpolation values.
   *
   * @param key - Dot-notation key, e.g. "a1_intro.title"
   * @param interpolations - Optional object of values to replace {{placeholders}}
   * @returns The translated string, or the raw key if no translation found
   */
  function t(key: string, interpolations?: Record<string, string>): string {
    let result: string | undefined

    // Step 1: Try the requested locale
    if (requestedTranslations) {
      result = lookupKey(requestedTranslations, key)
    }

    // Step 2: Fall back to English
    if (result === undefined && fallbackTranslations) {
      result = lookupKey(fallbackTranslations, key)
    }

    // Step 3: Return the raw key if all else fails
    if (result === undefined) {
      return key
    }

    // Apply interpolations if provided
    if (interpolations) {
      return result.replace(/\{\{(\w+)\}\}/g, (_, varName) => {
        return interpolations[varName] ?? `{{${varName}}}`
      })
    }

    return result
  }

  return t
}

/**
 * Synchronous translation function factory.
 * Use when translations have already been loaded (e.g., after preloadTranslations).
 * Falls back to the raw key if translations aren't cached.
 */
export function createTranslatorSync(
  requestedTranslations: TranslationDictionary | null,
  fallbackTranslations: TranslationDictionary | null
) {
  function t(key: string, interpolations?: Record<string, string>): string {
    let result: string | undefined

    if (requestedTranslations) {
      result = lookupKey(requestedTranslations, key)
    }

    if (result === undefined && fallbackTranslations) {
      result = lookupKey(fallbackTranslations, key)
    }

    if (result === undefined) {
      return key
    }

    if (interpolations) {
      return result.replace(/\{\{(\w+)\}\}/g, (_, varName) => {
        return interpolations[varName] ?? `{{${varName}}}`
      })
    }

    return result
  }

  return t
}
