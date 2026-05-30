import { describe, it, expect, beforeEach } from "vitest"
import { resolve } from "node:path"
import {
  resolveLocaleFromParam,
  isSupportedLocale,
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
} from "../index"
import { createTranslator } from "../translate"
import {
  getTranslations,
  clearTranslationCache,
  setTranslationBasePath,
} from "../loader"

const FIXTURES_PATH = resolve(__dirname, "fixtures")

describe("i18n", () => {
  beforeEach(() => {
    clearTranslationCache()
    setTranslationBasePath(FIXTURES_PATH)
  })

  describe("types", () => {
    it("defines supported locales", () => {
      expect(SUPPORTED_LOCALES).toEqual(["en", "es", "zh", "tl"])
    })

    it("defaults to English", () => {
      expect(DEFAULT_LOCALE).toBe("en")
    })

    it("validates supported locale codes", () => {
      expect(isSupportedLocale("en")).toBe(true)
      expect(isSupportedLocale("es")).toBe(true)
      expect(isSupportedLocale("zh")).toBe(true)
      expect(isSupportedLocale("tl")).toBe(true)
      expect(isSupportedLocale("fr")).toBe(false)
      expect(isSupportedLocale("")).toBe(false)
    })
  })

  describe("resolveLocaleFromParam", () => {
    it("returns the locale for valid supported locales", () => {
      expect(resolveLocaleFromParam("en")).toBe("en")
      expect(resolveLocaleFromParam("es")).toBe("es")
      expect(resolveLocaleFromParam("zh")).toBe("zh")
      expect(resolveLocaleFromParam("tl")).toBe("tl")
    })

    it("falls back to default locale for undefined param", () => {
      expect(resolveLocaleFromParam(undefined)).toBe("en")
    })

    it("falls back to default locale for unsupported values", () => {
      expect(resolveLocaleFromParam("fr")).toBe("en")
      expect(resolveLocaleFromParam("de")).toBe("en")
      expect(resolveLocaleFromParam("")).toBe("en")
    })
  })

  describe("getTranslations (loader)", () => {
    it("loads English translations from fixture", async () => {
      const translations = await getTranslations("en")
      expect(translations).not.toBeNull()
      expect(translations!.page).toBeDefined()
      expect((translations!.page as Record<string, string>).title).toBe("Welcome")
    })

    it("loads Spanish translations from fixture", async () => {
      const translations = await getTranslations("es")
      expect(translations).not.toBeNull()
      expect((translations!.page as Record<string, string>).title).toBe("Bienvenido")
    })

    it("caches translations after first load", async () => {
      const first = await getTranslations("en")
      const second = await getTranslations("en")
      expect(first).toBe(second) // Same reference (cached)
    })

    it("returns null for non-existent translation file", async () => {
      // Point to a path that doesn't have the file
      setTranslationBasePath(resolve(__dirname, "nonexistent"))
      const translations = await getTranslations("en")
      expect(translations).toBeNull()
    })
  })

  describe("createTranslator", () => {
    it("translates a simple key", async () => {
      const t = await createTranslator("en", getTranslations)
      expect(t("page.title")).toBe("Welcome")
    })

    it("translates a nested key", async () => {
      const t = await createTranslator("en", getTranslations)
      expect(t("nested.deep.key")).toBe("Deep value")
    })

    it("translates in the requested locale", async () => {
      const t = await createTranslator("es", getTranslations)
      expect(t("page.title")).toBe("Bienvenido")
    })

    it("falls back to English when key is missing in requested locale", async () => {
      const t = await createTranslator("es", getTranslations)
      // "nav.about" exists in English but not in Spanish fixture
      expect(t("nav.about")).toBe("About")
    })

    it("returns raw key when not found in any locale", async () => {
      const t = await createTranslator("en", getTranslations)
      expect(t("nonexistent.key")).toBe("nonexistent.key")
    })

    it("returns raw key when locale file fails to load and English also fails", async () => {
      setTranslationBasePath(resolve(__dirname, "nonexistent"))
      const t = await createTranslator("es", getTranslations)
      expect(t("page.title")).toBe("page.title")
    })

    it("handles interpolation with {{placeholders}}", async () => {
      const t = await createTranslator("en", getTranslations)
      expect(t("greeting", { name: "World" })).toBe("Hello, World!")
    })

    it("handles interpolation in non-English locale", async () => {
      const t = await createTranslator("es", getTranslations)
      expect(t("greeting", { name: "Mundo" })).toBe("¡Hola, Mundo!")
    })

    it("preserves unresolved interpolation placeholders", async () => {
      const t = await createTranslator("en", getTranslations)
      expect(t("greeting", {})).toBe("Hello, {{name}}!")
    })

    it("falls back to English when requested locale file fails", async () => {
      // Chinese fixture only has page.title, but nav.home exists in English
      const t = await createTranslator("zh", getTranslations)
      expect(t("nav.home")).toBe("Home")
    })

    it("uses requested locale when English is the requested locale", async () => {
      const t = await createTranslator("en", getTranslations)
      expect(t("page.title")).toBe("Welcome")
    })
  })
})
