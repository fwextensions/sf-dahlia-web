import { describe, it, expect, vi, beforeEach } from "vitest"
import { evaluateRedirects } from "./redirects"

// Mock the constraints module
vi.mock("./constraints", () => ({
  dalpConstraint: vi.fn(),
  howToApplyConstraint: vi.fn(),
  accountLayoutConstraint: vi.fn(),
}))

import {
  dalpConstraint,
  howToApplyConstraint,
  accountLayoutConstraint,
} from "./constraints"

const mockedDalp = vi.mocked(dalpConstraint)
const mockedHowToApply = vi.mocked(howToApplyConstraint)
const mockedAccountLayout = vi.mocked(accountLayoutConstraint)

describe("evaluateRedirects", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("DALP constraint redirects", () => {
    it("redirects /listings/:id to / when DALP constraint fails", async () => {
      mockedDalp.mockResolvedValue(false)
      const result = await evaluateRedirects("/listings/abc123")
      expect(result).toEqual({
        redirect: true,
        destination: "/",
        statusCode: 301,
      })
    })

    it("redirects /:lang/listings/:id to /:lang when DALP constraint fails", async () => {
      mockedDalp.mockResolvedValue(false)
      const result = await evaluateRedirects("/es/listings/abc123")
      expect(result).toEqual({
        redirect: true,
        destination: "/es",
        statusCode: 301,
      })
    })

    it("does not redirect /listings/:id when DALP constraint passes", async () => {
      mockedDalp.mockResolvedValue(true)
      const result = await evaluateRedirects("/listings/abc123")
      expect(result).toEqual({ redirect: false })
    })
  })

  describe("HowToApply constraint redirects", () => {
    it("redirects /listings/:id/how-to-apply to /listings/:id when constraint fails", async () => {
      mockedHowToApply.mockResolvedValue(false)
      const result = await evaluateRedirects("/listings/abc123/how-to-apply")
      expect(result).toEqual({
        redirect: true,
        destination: "/listings/abc123",
        statusCode: 301,
      })
    })

    it("redirects /:lang/listings/:id/how-to-apply to /:lang/listings/:id when constraint fails", async () => {
      mockedHowToApply.mockResolvedValue(false)
      const result = await evaluateRedirects(
        "/zh/listings/abc123/how-to-apply"
      )
      expect(result).toEqual({
        redirect: true,
        destination: "/zh/listings/abc123",
        statusCode: 301,
      })
    })

    it("does not redirect when HowToApply constraint passes", async () => {
      mockedHowToApply.mockResolvedValue(true)
      const result = await evaluateRedirects("/listings/abc123/how-to-apply")
      expect(result).toEqual({ redirect: false })
    })
  })

  describe("AccountLayout constraint redirects", () => {
    it("redirects /account to /my-account when flag is off", async () => {
      mockedAccountLayout.mockResolvedValue(false)
      const result = await evaluateRedirects("/account")
      expect(result).toEqual({
        redirect: true,
        destination: "/my-account",
        statusCode: 301,
      })
    })

    it("redirects /:lang/account to /:lang/my-account when flag is off", async () => {
      mockedAccountLayout.mockResolvedValue(false)
      const result = await evaluateRedirects("/tl/account")
      expect(result).toEqual({
        redirect: true,
        destination: "/tl/my-account",
        statusCode: 301,
      })
    })

    it("redirects /account/applications to /my-applications when flag is off", async () => {
      mockedAccountLayout.mockResolvedValue(false)
      const result = await evaluateRedirects("/account/applications")
      expect(result).toEqual({
        redirect: true,
        destination: "/my-applications",
        statusCode: 301,
      })
    })

    it("redirects /account/settings to /account-settings when flag is off", async () => {
      mockedAccountLayout.mockResolvedValue(false)
      const result = await evaluateRedirects("/account/settings")
      expect(result).toEqual({
        redirect: true,
        destination: "/account-settings",
        statusCode: 301,
      })
    })

    it("redirects /:lang/account/settings to /:lang/account-settings when flag is off", async () => {
      mockedAccountLayout.mockResolvedValue(false)
      const result = await evaluateRedirects("/en/account/settings")
      expect(result).toEqual({
        redirect: true,
        destination: "/en/account-settings",
        statusCode: 301,
      })
    })

    it("does not redirect /account when flag is on", async () => {
      mockedAccountLayout.mockResolvedValue(true)
      const result = await evaluateRedirects("/account")
      expect(result).toEqual({ redirect: false })
    })
  })

  describe("non-redirect paths", () => {
    it("does not redirect the homepage", async () => {
      const result = await evaluateRedirects("/")
      expect(result).toEqual({ redirect: false })
    })

    it("does not redirect static pages", async () => {
      const result = await evaluateRedirects("/privacy")
      expect(result).toEqual({ redirect: false })
    })

    it("does not redirect lang-prefixed static pages", async () => {
      const result = await evaluateRedirects("/es/privacy")
      expect(result).toEqual({ redirect: false })
    })

    it("does not redirect /listings/for-rent", async () => {
      const result = await evaluateRedirects("/listings/for-rent")
      expect(result).toEqual({ redirect: false })
    })
  })

  describe("language prefix parsing", () => {
    it("recognizes en as a valid lang prefix", async () => {
      mockedDalp.mockResolvedValue(false)
      const result = await evaluateRedirects("/en/listings/abc")
      expect(result).toEqual({
        redirect: true,
        destination: "/en",
        statusCode: 301,
      })
    })

    it("does not treat invalid lang values as prefixes", async () => {
      // /fr/listings/abc should not have "fr" treated as a lang prefix
      // Instead the full path /fr/listings/abc is evaluated
      const result = await evaluateRedirects("/fr/listings/abc")
      // No pattern matches since restPath="/fr/listings/abc" doesn't match known patterns
      expect(result).toEqual({ redirect: false })
    })
  })
})
