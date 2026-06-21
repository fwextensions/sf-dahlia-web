/**
 * Unit tests for the protected route middleware (beforeLoad guard).
 *
 * Validates: Requirements 5.2, 5.3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"

import { protectedRouteGuard } from "./protected-route"

// Mock Clerk and TanStack Start server utilities
vi.mock("@clerk/tanstack-react-start/server", () => ({
  getAuth: vi.fn(),
}))

vi.mock("@tanstack/react-router", () => ({
  redirect: vi.fn((opts) => {
    const err = new Error("REDIRECT") as any
    err.__isRedirect = true
    err.to = opts.to
    err.search = opts.search
    err.statusCode = opts.statusCode
    throw err
  }),
}))

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: vi.fn(),
}))

// Clerk auth is gated on the auth.clerk flag; mock it on so the dual-auth
// resolver exercises the Clerk branch in these tests.
vi.mock("../flags/unleash", () => ({
  isClerkAuthEnabled: vi.fn(),
}))

import { getAuth } from "@clerk/tanstack-react-start/server"
import { getRequest } from "@tanstack/react-start/server"
import { isClerkAuthEnabled } from "../flags/unleash"

const RAILS_API_BASE_URL = "http://rails-proxy.internal"

const mswServer = setupServer()

beforeEach(() => {
  vi.stubEnv("RAILS_API_BASE_URL", RAILS_API_BASE_URL)
  vi.mocked(isClerkAuthEnabled).mockResolvedValue(true)
  mswServer.listen({ onUnhandledRequest: "error" })
})

afterEach(() => {
  mswServer.resetHandlers()
  mswServer.close()
  vi.unstubAllEnvs()
  vi.resetAllMocks()
})

describe("protectedRouteGuard", () => {
  it("returns authenticated user when Clerk session is valid", async () => {
    const mockRequest = new Request("http://localhost/account")
    vi.mocked(getRequest).mockReturnValue(mockRequest as any)
    vi.mocked(getAuth).mockResolvedValue({
      userId: "clerk_user_123",
      sessionId: "sess_abc",
    } as any)

    const result = await protectedRouteGuard({
      location: { pathname: "/account", search: "" } as any,
    })

    expect(result.user).toEqual({
      userId: "clerk_user_123",
      sessionId: "sess_abc",
      provider: "clerk",
    })
  })

  it("redirects to /sign-in with redirect_url when session is missing", async () => {
    const mockRequest = new Request("http://localhost/account/settings")
    vi.mocked(getRequest).mockReturnValue(mockRequest as any)
    vi.mocked(getAuth).mockResolvedValue({ userId: null, sessionId: null } as any)

    try {
      await protectedRouteGuard({
        location: { pathname: "/account/settings", search: "" } as any,
      })
      expect.fail("Should have thrown a redirect")
    } catch (err: any) {
      expect(err.__isRedirect).toBe(true)
      expect(err.to).toBe("/sign-in")
      expect(err.search).toEqual({ redirect_url: "/account/settings" })
      expect(err.statusCode).toBe(302)
    }
  })

  it("preserves query parameters in the redirect_url", async () => {
    const mockRequest = new Request(
      "http://localhost/my-applications?page=2&sort=date"
    )
    vi.mocked(getRequest).mockReturnValue(mockRequest as any)
    vi.mocked(getAuth).mockResolvedValue({ userId: null, sessionId: null } as any)

    try {
      await protectedRouteGuard({
        location: { pathname: "/my-applications", search: "?page=2&sort=date" } as any,
      })
      expect.fail("Should have thrown a redirect")
    } catch (err: any) {
      expect(err.__isRedirect).toBe(true)
      expect(err.search.redirect_url).toBe("/my-applications?page=2&sort=date")
    }
  })

  it("allows access with valid devise token when Clerk is not present", async () => {
    const mockRequest = new Request("http://localhost/account", {
      headers: {
        "access-token": "valid-token",
        uid: "user@example.com",
        client: "client-id",
      },
    })
    vi.mocked(getRequest).mockReturnValue(mockRequest as any)
    vi.mocked(getAuth).mockResolvedValue({ userId: null, sessionId: null } as any)

    mswServer.use(
      http.get(`${RAILS_API_BASE_URL}/api/v1/auth/validate_token`, () => {
        return HttpResponse.json({ success: true }, { status: 200 })
      })
    )

    const result = await protectedRouteGuard({
      location: { pathname: "/account", search: "" } as any,
    })

    expect(result.user).toEqual({
      userId: "devise:user@example.com",
      sessionId: "devise:client-id",
      provider: "devise",
      email: "user@example.com",
    })
  })

  it("redirects when both Clerk and devise auth fail", async () => {
    const mockRequest = new Request("http://localhost/my-account", {
      headers: {
        "access-token": "expired-token",
        uid: "user@example.com",
        client: "client-id",
      },
    })
    vi.mocked(getRequest).mockReturnValue(mockRequest as any)
    vi.mocked(getAuth).mockResolvedValue({ userId: null, sessionId: null } as any)

    mswServer.use(
      http.get(`${RAILS_API_BASE_URL}/api/v1/auth/validate_token`, () => {
        return HttpResponse.json({ success: false }, { status: 401 })
      })
    )

    try {
      await protectedRouteGuard({
        location: { pathname: "/my-account", search: "" } as any,
      })
      expect.fail("Should have thrown a redirect")
    } catch (err: any) {
      expect(err.__isRedirect).toBe(true)
      expect(err.to).toBe("/sign-in")
      expect(err.search.redirect_url).toBe("/my-account")
    }
  })
})
