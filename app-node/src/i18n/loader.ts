import { readFile } from "node:fs/promises"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import type { SupportedLocale, TranslationDictionary } from "./types"
import { SUPPORTED_LOCALES } from "./types"

/**
 * In-memory cache of loaded translation dictionaries, keyed by locale.
 * Populated lazily on first request per locale, then cached for the process lifetime.
 */
const translationCache = new Map<SupportedLocale, TranslationDictionary>()

/**
 * Base directory for resolving translation file paths.
 * Can be overridden for testing via setTranslationBasePath().
 */
let translationBasePath: string | null = null

/**
 * Default path resolution: translation files in the parent Rails project at
 *   {project-root}/app/assets/json/translations/locale-{lang}.json
 *
 * This uses import.meta.url to locate the current file, then navigates up
 * from app-node/src/i18n/ to the project root.
 */
function getDefaultBasePath(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url))
  // From src/i18n/ → src/ → app-node/ → project root
  return resolve(currentDir, "..", "..", "..", "app", "assets", "json", "translations")
}

/**
 * Resolves the file path for a given locale's translation JSON file.
 */
function getTranslationFilePath(locale: SupportedLocale): string {
  const basePath = translationBasePath ?? getDefaultBasePath()
  return resolve(basePath, `locale-${locale}.json`)
}

/**
 * Sets a custom base path for translation files. Useful for testing or
 * when translation files are copied to a different location in production.
 */
export function setTranslationBasePath(path: string): void {
  translationBasePath = path
}

/**
 * Loads and parses a translation file for the given locale.
 * The JSON files have a top-level key matching the locale code, e.g. { "en": { ... } }.
 * Returns the inner dictionary, or null if loading/parsing fails.
 */
async function loadTranslationFile(locale: SupportedLocale): Promise<TranslationDictionary | null> {
  try {
    const filePath = getTranslationFilePath(locale)
    const content = await readFile(filePath, "utf-8")
    const parsed = JSON.parse(content)

    // The JSON structure wraps translations under the locale key
    if (parsed && typeof parsed === "object" && parsed[locale]) {
      return parsed[locale] as TranslationDictionary
    }

    // If the file doesn't have the expected wrapper, use the whole object
    return parsed as TranslationDictionary
  } catch {
    console.warn(`[i18n] Failed to load translation file for locale "${locale}"`)
    return null
  }
}

/**
 * Gets the translation dictionary for a locale, loading from disk on first access.
 * Returns null if the file cannot be loaded.
 */
export async function getTranslations(locale: SupportedLocale): Promise<TranslationDictionary | null> {
  if (translationCache.has(locale)) {
    return translationCache.get(locale)!
  }

  const translations = await loadTranslationFile(locale)
  if (translations) {
    translationCache.set(locale, translations)
  }
  return translations
}

/**
 * Preloads all supported locale translation files into the cache.
 * Call at server startup for faster first-request performance.
 */
export async function preloadTranslations(): Promise<void> {
  await Promise.all(SUPPORTED_LOCALES.map((locale) => getTranslations(locale)))
}

/**
 * Clears the translation cache. Primarily useful for testing.
 */
export function clearTranslationCache(): void {
  translationCache.clear()
}


