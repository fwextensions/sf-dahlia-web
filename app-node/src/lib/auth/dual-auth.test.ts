/**
 * Unit tests for dual-auth support during Phase 3 migration period.
 *
 * Validates: Requirements 12.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"

import {
  extractDeviseHeaders,
  validateDeviseToken,
  requireDualAuth,
  optionalDualAuth,
} from "./dual-auth"

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

import { getAuth } from "@clerk/tanstack-react-start/server"
import { getRequest } from "@tanstack/react-start/server"

const RAILS_API_BASE_URL = "http://rails-proxy.internal"

// MSW server for mocking Rails validate_token endpoint
const mswServer = setupServer()

beforeEach(() => {
  vi.stubEnv("RAILS_API_BASE_URL", RAILS_API_BASE_URL)
  mswServer.listen({ onUnhandledRequest: "error" })
})

afterEach(() => {
  mswServer.resetHandlers()
  mswServer.close()
  vi.unstubAllEnvs()
  vi.resetAllMocks()
})

describe("extractDeviseHeaders", () => {
  it("returns devise headers when all three are present", () => {
    const request = new Request("http://localhost/test", {
      headers: {
        "access-token": "abc123",
        uid: "user@example.com",
        client: "client-id-456",
      },
    })

    const result = extractDeviseHeaders(request)

    expect(result).toEqual({
      accessToken: "abc123",
      uid: "user@example.com",
      client: "client-id-456",
    })
  })

  it("returns null when access-token is missing", () => {
    const request = new Request("http://localhost/test", {
      headers: {
        uid: "user@example.com",
        client: "client-id-456",
      },
    })

    expect(extractDeviseHeaders(request)).toBeNull()
  })

  it("returns null when uid is missing", () => {
    const request = new Request("http://localhost/test", {
      headers: {
        "access-token": "abc123",
        client: "client-id-456",
      },
    })

    expect(extractDeviseHeaders(request)).toBeNull()
  })

  it("returns null when client is missing", () => {
    const request = new Request("http://localhost/test", {
      headers: {
        "access-token": "abc123",
        uid: "user@example.com",
      },
    })

    expect(extractDeviseHeaders(request)).toBeNull()
  })

  it("returns null when no devise headers are present", () => {
    const request = new Request("http://localhost/test")

    expect(extractDeviseHeaders(request)).toBeNull()
  })
})

describe("validateDeviseToken", () => {
  it("returns true when Rails API returns 200", async () => {
    mswServer.use(
      http.get(`${RAILS_API_BASE_URL}/api/v1/auth/validate_token`, () => {
        return HttpResponse.json({ success: true }, { status: 200 })
      })
    )

    const result = await validateDeviseToken(
      { accessToken: "abc123", uid: "user@example.com", client: "client-456" },
      RAILS_API_BASE_URL
    )

    expect(result).toBe(true)
  })

  it("returns false when Rails API returns 401", async () => {
    mswServer.use(
      http.get(`${RAILS_API_BASE_URL}/api/v1/auth/validate_token`, () => {
        return HttpResponse.json(
          { success: false, errors: ["Invalid token"] },
          { status: 401 }
        )
      })
    )

    const result = await validateDeviseToken(
      { accessToken: "expired", uid: "user@example.com", client: "client-456" },
      RAILS_API_BASE_URL
    )

    expect(result).toBe(false)
  })

  it("returns false when Rails API is unreachable", async () => {
    mswServer.use(
      http.get(`${RAILS_API_BASE_URL}/api/v1/auth/validate_token`, () => {
        return HttpResponse.error()
      })
    )

    const result = await validateDeviseToken(
      { accessToken: "abc123", uid: "user@example.com", client: "client-456" },
      RAILS_API_BASE_URL
    )

    expect(result).toBe(false)
  })

  it("sends correct devise headers to Rails API", async () => {
    let capturedHeaders: Record<string, string> = {}

    mswServer.use(
      http.get(`${RAILS_API_BASE_URL}/api/v1/auth/validate_token`, ({ request }) => {
        capturedHeaders = {
          "access-token": request.headers.get("access-token") || "",
          uid: request.headers.get("uid") || "",
          client: request.headers.get("client") || "",
        }
        return HttpResponse.json({ success: true }, { status: 200 })
      })
    )

    await validateDeviseToken(
      { accessToken: "my-token", uid: "test@test.com", client: "client-xyz" },
      RAILS_API_BASE_URL
    )

    expect(capturedHeaders).toEqual({
      "access-token": "my-token",
      uid: "test@test.com",
      client: "client-xyz",
    })
  })
})

describe("requireDualAuth", () => {
  it("returns Clerk user when Clerk session is valid", async () => {
    const mockRequest = new Request("http://localhost/account")
    vi.mocked(getRequest).mockReturnValue(mockRequest as any)
    vi.mocked(getAuth).mockResolvedValue({
      userId: "clerk_user_123",
      sessionId: "sess_abc",
    } as any)

    const result = await requireDualAuth()

    expect(result).toEqual({
      userId: "clerk_user_123",
      sessionId: "sess_abc",
      provider: "clerk",
    })
  })

  it("falls back to devise when Clerk session is not present", async () => {
    const mockRequest = new Request("http://localhost/account", {
      headers: {
        "access-token": "devise-token",
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

    const result = await requireDualAuth()

    expect(result).toEqual({
      userId: "devise:user@example.com",
      sessionId: "devise:client-id",
      provider: "devise",
      email: "user@example.com",
    })
  })

  it("redirects to /sign-in when neither auth method succeeds", async () => {
    const mockRequest = new Request("http://localhost/account/settings")
    vi.mocked(getRequest).mockReturnValue(mockRequest as any)
    vi.mocked(getAuth).mockResolvedValue({ userId: null, sessionId: null } as any)

    // No devise headers present, so no MSW handler needed

    try {
      await requireDualAuth()
      expect.fail("Should have thrown a redirect")
    } catch (err: any) {
      expect(err.__isRedirect).toBe(true)
      expect(err.to).toBe("/sign-in")
      expect(err.search).toEqual({ redirect_url: "/account/settings" })
      expect(err.statusCode).toBe(302)
    }
  })

  it("prefers Clerk over devise when both are present", async () => {
    const mockRequest = new Request("http://localhost/account", {
      headers: {
        "access-token": "devise-token",
        uid: "user@example.com",
        client: "client-id",
      },
    })
    vi.mocked(getRequest).mockReturnValue(mockRequest as any)
    vi.mocked(getAuth).mockResolvedValue({
      userId: "clerk_user_123",
      sessionId: "sess_abc",
    } as any)

    const result = await requireDualAuth()

    expect(result.provider).toBe("clerk")
    expect(result.userId).toBe("clerk_user_123")
  })
})

describe("optionalDualAuth", () => {
  it("returns Clerk user when Clerk session is valid", async () => {
    const mockRequest = new Request("http://localhost/listings")
    vi.mocked(getRequest).mockReturnValue(mockRequest as any)
    vi.mocked(getAuth).mockResolvedValue({
      userId: "clerk_user_123",
      sessionId: "sess_abc",
    } as any)

    const result = await optionalDualAuth()

    expect(result).toEqual({
      userId: "clerk_user_123",
      sessionId: "sess_abc",
      provider: "clerk",
    })
  })

  it("returns devise user when Clerk is not present but devise is valid", async () => {
    const mockRequest = new Request("http://localhost/listings", {
      headers: {
        "access-token": "devise-token",
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

    const result = await optionalDualAuth()

    expect(result).toEqual({
      userId: "devise:user@example.com",
      sessionId: "devise:client-id",
      provider: "devise",
      email: "user@example.com",
    })
  })

  it("returns null when neither auth method succeeds", async () => {
    const mockRequest = new Request("http://localhost/listings")
    vi.mocked(getRequest).mockReturnValue(mockRequest as any)
    vi.mocked(getAuth).mockResolvedValue({ userId: null, sessionId: null } as any)

    const result = await optionalDualAuth()

    expect(result).toBeNull()
  })

  it("returns null when devise headers are present but invalid", async () => {
    const mockRequest = new Request("http://localhost/listings", {
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

    const result = await optionalDualAuth()

    expect(result).toBeNull()
  })
})
