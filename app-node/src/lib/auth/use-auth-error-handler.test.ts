/**
 * Unit tests for the client-side auth error handler.
 *
 * Validates: Requirements 5.8
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

import {
  AuthenticationError,
  isAuthError,
  redirectToSignIn,
  handleAuthError,
} from "./use-auth-error-handler"

describe("AuthenticationError", () => {
  it("creates an error with default message", () => {
    const error = new AuthenticationError()
    expect(error.message).toBe("Authentication session expired")
    expect(error.name).toBe("AuthenticationError")
    expect(error.statusCode).toBe(401)
  })

  it("creates an error with custom message", () => {
    const error = new AuthenticationError("Token expired")
    expect(error.message).toBe("Token expired")
    expect(error.statusCode).toBe(401)
  })
})

describe("isAuthError", () => {
  it("returns true for AuthenticationError instances", () => {
    expect(isAuthError(new AuthenticationError())).toBe(true)
  })

  it("returns true for objects with statusCode 401", () => {
    expect(isAuthError({ statusCode: 401, message: "Unauthorized" })).toBe(true)
  })

  it("returns true for objects with status 401", () => {
    expect(isAuthError({ status: 401 })).toBe(true)
  })

  it("returns false for non-401 errors", () => {
    expect(isAuthError(new Error("Something else"))).toBe(false)
    expect(isAuthError({ statusCode: 403 })).toBe(false)
    expect(isAuthError({ status: 500 })).toBe(false)
  })

  it("returns false for null/undefined", () => {
    expect(isAuthError(null)).toBe(false)
    expect(isAuthError(undefined)).toBe(false)
  })

  it("returns false for non-object values", () => {
    expect(isAuthError("error")).toBe(false)
    expect(isAuthError(401)).toBe(false)
  })
})

describe("redirectToSignIn", () => {
  let originalWindow: typeof globalThis.window

  beforeEach(() => {
    originalWindow = globalThis.window
    globalThis.window = {
      location: {
        pathname: "/account/settings",
        search: "?tab=profile",
        href: "",
      },
    } as unknown as Window & typeof globalThis
  })

  afterEach(() => {
    globalThis.window = originalWindow
  })

  it("redirects to /sign-in with current path as redirect_url", () => {
    redirectToSignIn()

    expect(window.location.href).toBe(
      "/sign-in?redirect_url=%2Faccount%2Fsettings%3Ftab%3Dprofile"
    )
  })

  it("handles paths without search params", () => {
    globalThis.window = {
      location: {
        pathname: "/my-account",
        search: "",
        href: "",
      },
    } as unknown as Window & typeof globalThis

    redirectToSignIn()

    expect(window.location.href).toBe(
      "/sign-in?redirect_url=%2Fmy-account"
    )
  })

  it("does nothing on the server (no window)", () => {
    // @ts-expect-error -- simulating server environment where window is undefined
    globalThis.window = undefined

    // Should not throw
    expect(() => redirectToSignIn()).not.toThrow()
  })
})

describe("handleAuthError", () => {
  beforeEach(() => {
    globalThis.window = {
      location: {
        pathname: "/account",
        search: "",
        href: "",
      },
    } as unknown as Window & typeof globalThis
  })

  afterEach(() => {
    // @ts-expect-error -- cleanup
    delete globalThis.window
  })

  it("redirects and throws when error is a 401", () => {
    const authError = new AuthenticationError()

    expect(() => handleAuthError(authError)).toThrow(
      "Redirecting to sign-in due to expired session"
    )
    expect(window.location.href).toBe("/sign-in?redirect_url=%2Faccount")
  })

  it("re-throws non-auth errors", () => {
    const otherError = new Error("Network failure")

    expect(() => handleAuthError(otherError)).toThrow("Network failure")
  })

  it("handles object errors with statusCode 401", () => {
    const error = { statusCode: 401, message: "Unauthorized" }

    expect(() => handleAuthError(error)).toThrow(
      "Redirecting to sign-in due to expired session"
    )
    expect(window.location.href).toBe("/sign-in?redirect_url=%2Faccount")
  })
})
