import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  getMigratedPaths,
  getProxiedPaths,
  handleApiProxy,
  proxyToRails,
  setMigratedPaths,
  setProxiedPaths,
  shouldProxy,
} from "./api-proxy"

// Mock the env module
vi.mock("../config/env", () => ({
  env: {
    RAILS_API_BASE_URL: "http://rails-app.internal",
    INTERNAL_API_KEY: "test-api-key-123",
  },
}))

describe("shouldProxy", () => {
  beforeEach(() => {
    setProxiedPaths(["/api/v1/"])
    setMigratedPaths([])
  })

  it("returns true for /api/v1/ paths", () => {
    expect(shouldProxy("/api/v1/listings")).toBe(true)
    expect(shouldProxy("/api/v1/short-form/application")).toBe(true)
    expect(shouldProxy("/api/v1/account/my-applications")).toBe(true)
  })

  it("returns false for non-API paths", () => {
    expect(shouldProxy("/listings")).toBe(false)
    expect(shouldProxy("/en/listings/123")).toBe(false)
    expect(shouldProxy("/")).toBe(false)
    expect(shouldProxy("/sign-in")).toBe(false)
  })

  it("returns false for migrated exact paths", () => {
    setMigratedPaths(["/api/v1/listings"])
    expect(shouldProxy("/api/v1/listings")).toBe(false)
    // Non-exact still proxied
    expect(shouldProxy("/api/v1/listings/123")).toBe(true)
  })

  it("returns false for migrated wildcard paths", () => {
    setMigratedPaths(["/api/v1/listings*"])
    expect(shouldProxy("/api/v1/listings")).toBe(false)
    expect(shouldProxy("/api/v1/listings/123")).toBe(false)
    expect(shouldProxy("/api/v1/listings/123/units")).toBe(false)
    // Other paths still proxied
    expect(shouldProxy("/api/v1/short-form/application")).toBe(true)
  })

  it("supports multiple proxy prefixes", () => {
    setProxiedPaths(["/api/v1/", "/api/v2/"])
    expect(shouldProxy("/api/v1/listings")).toBe(true)
    expect(shouldProxy("/api/v2/listings")).toBe(true)
    expect(shouldProxy("/api/v3/listings")).toBe(false)
  })

  it("supports empty proxy list (everything handled locally)", () => {
    setProxiedPaths([])
    expect(shouldProxy("/api/v1/listings")).toBe(false)
  })
})

describe("setProxiedPaths / getProxiedPaths", () => {
  it("updates and retrieves the proxied paths", () => {
    setProxiedPaths(["/api/v1/", "/api/v2/"])
    expect(getProxiedPaths()).toEqual(["/api/v1/", "/api/v2/"])
  })

  it("returns a copy, not the internal array", () => {
    setProxiedPaths(["/api/v1/"])
    const paths = getProxiedPaths()
    paths.push("/api/v2/")
    expect(getProxiedPaths()).toEqual(["/api/v1/"])
  })
})

describe("setMigratedPaths / getMigratedPaths", () => {
  it("updates and retrieves the migrated paths", () => {
    setMigratedPaths(["/api/v1/listings*"])
    expect(getMigratedPaths()).toEqual(["/api/v1/listings*"])
  })
})

describe("proxyToRails", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("forwards GET request to Rails with API key header", async () => {
    const mockResponse = new Response(JSON.stringify({ listings: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
    vi.mocked(fetch).mockResolvedValue(mockResponse)

    const request = new Request("http://localhost:3001/api/v1/listings?type=rental")
    const response = await proxyToRails(request)

    expect(fetch).toHaveBeenCalledWith(
      "http://rails-app.internal/api/v1/listings?type=rental",
      expect.objectContaining({
        method: "GET",
      })
    )

    // Verify API key header was set
    const calledHeaders = (vi.mocked(fetch).mock.calls[0][1]?.headers) as Headers
    expect(calledHeaders.get("X-Internal-Api-Key")).toBe("test-api-key-123")

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ listings: [] })
  })

  it("forwards POST request with body", async () => {
    const mockResponse = new Response(JSON.stringify({ id: "app-1" }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    })
    vi.mocked(fetch).mockResolvedValue(mockResponse)

    const request = new Request("http://localhost:3001/api/v1/short-form/application", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId: "listing-1" }),
    })
    const response = await proxyToRails(request)

    expect(fetch).toHaveBeenCalledWith(
      "http://rails-app.internal/api/v1/short-form/application",
      expect.objectContaining({
        method: "POST",
      })
    )
    expect(response.status).toBe(201)
  })

  it("returns 401 from Rails when API key is invalid", async () => {
    const mockResponse = new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
    vi.mocked(fetch).mockResolvedValue(mockResponse)

    const request = new Request("http://localhost:3001/api/v1/listings")
    const response = await proxyToRails(request)

    expect(response.status).toBe(401)
  })

  it("returns 502 on network error", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("ECONNREFUSED"))

    const request = new Request("http://localhost:3001/api/v1/listings")
    const response = await proxyToRails(request)

    expect(response.status).toBe(502)
    const body = await response.json()
    expect(body.error).toContain("Rails service unavailable")
  })

  it("returns 504 on timeout", async () => {
    const timeoutError = new Error("Timeout")
    timeoutError.name = "TimeoutError"
    vi.mocked(fetch).mockRejectedValue(timeoutError)

    const request = new Request("http://localhost:3001/api/v1/listings")
    const response = await proxyToRails(request)

    expect(response.status).toBe(504)
    const body = await response.json()
    expect(body.error).toContain("timeout")
  })

  it("removes host header to avoid conflicts", async () => {
    const mockResponse = new Response("ok", { status: 200 })
    vi.mocked(fetch).mockResolvedValue(mockResponse)

    const request = new Request("http://localhost:3001/api/v1/listings", {
      headers: { host: "localhost:3001" },
    })
    await proxyToRails(request)

    const calledHeaders = (vi.mocked(fetch).mock.calls[0][1]?.headers) as Headers
    expect(calledHeaders.get("host")).toBeNull()
  })
})

describe("handleApiProxy", () => {
  beforeEach(() => {
    setProxiedPaths(["/api/v1/"])
    setMigratedPaths([])
    vi.stubGlobal("fetch", vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("returns null for non-proxied paths", () => {
    const request = new Request("http://localhost:3001/listings")
    const result = handleApiProxy(request)
    expect(result).toBeNull()
  })

  it("returns a promise for proxied paths", () => {
    const mockResponse = new Response("ok", { status: 200 })
    vi.mocked(fetch).mockResolvedValue(mockResponse)

    const request = new Request("http://localhost:3001/api/v1/listings")
    const result = handleApiProxy(request)
    expect(result).toBeInstanceOf(Promise)
  })

  it("returns null for migrated API paths", () => {
    setMigratedPaths(["/api/v1/listings*"])
    const request = new Request("http://localhost:3001/api/v1/listings/123")
    const result = handleApiProxy(request)
    expect(result).toBeNull()
  })
})
