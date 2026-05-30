import { describe, it, expect } from "vitest"
import { isValidLang, SUPPORTED_LANGS, DEFAULT_LANG } from "./supported-langs"

describe("supported-langs", () => {
  describe("isValidLang", () => {
    it("returns true for all supported language codes", () => {
      expect(isValidLang("en")).toBe(true)
      expect(isValidLang("es")).toBe(true)
      expect(isValidLang("zh")).toBe(true)
      expect(isValidLang("tl")).toBe(true)
    })

    it("returns false for invalid language codes", () => {
      expect(isValidLang("fr")).toBe(false)
      expect(isValidLang("de")).toBe(false)
      expect(isValidLang("EN")).toBe(false)
      expect(isValidLang("")).toBe(false)
      expect(isValidLang("english")).toBe(false)
      expect(isValidLang("listings")).toBe(false)
    })

    it("treats values that look like path components as invalid", () => {
      expect(isValidLang("sign-in")).toBe(false)
      expect(isValidLang("account")).toBe(false)
      expect(isValidLang("privacy")).toBe(false)
    })
  })

  describe("SUPPORTED_LANGS", () => {
    it("contains exactly 4 languages", () => {
      expect(SUPPORTED_LANGS).toHaveLength(4)
    })

    it("contains en, es, zh, tl", () => {
      expect(SUPPORTED_LANGS).toContain("en")
      expect(SUPPORTED_LANGS).toContain("es")
      expect(SUPPORTED_LANGS).toContain("zh")
      expect(SUPPORTED_LANGS).toContain("tl")
    })
  })

  describe("DEFAULT_LANG", () => {
    it("defaults to en", () => {
      expect(DEFAULT_LANG).toBe("en")
    })
  })
})
