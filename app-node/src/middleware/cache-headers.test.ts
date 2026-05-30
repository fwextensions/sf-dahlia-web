import { describe, expect, it } from "vitest"
import {
  applyCacheHeaders,
  getCacheControlHeader,
  isFingerprintedAsset,
} from "./cache-headers"

describe("isFingerprintedAsset", () => {
  it("returns true for Vite asset paths with content hash", () => {
    expect(isFingerprintedAsset("/assets/index.a1b2c3d4.js")).toBe(true)
    expect(isFingerprintedAsset("/assets/style.ab12cd34.css")).toBe(true)
    expect(isFingerprintedAsset("/assets/logo.1a2b3c4d.png")).toBe(true)
  })

  it("returns true for _build/assets paths", () => {
    expect(isFingerprintedAsset("/_build/assets/chunk.js")).toBe(true)
  })

  it("returns true for files with hash pattern in name", () => {
    expect(isFingerprintedAsset("/some/path/main.a1b2c3d4.js")).toBe(true)
    expect(isFingerprintedAsset("/fonts/roboto.abcdef12.woff2")).toBe(true)
  })

  it("returns false for HTML pages", () => {
    expect(isFingerprintedAsset("/")).toBe(false)
    expect(isFingerprintedAsset("/listings")).toBe(false)
    expect(isFingerprintedAsset("/listings/123")).toBe(false)
  })

  it("returns false for non-hashed static files", () => {
    expect(isFingerprintedAsset("/favicon.ico")).toBe(false)
    expect(isFingerprintedAsset("/robots.txt")).toBe(false)
  })
})

describe("getCacheControlHeader", () => {
  it("returns long-lived cache for fingerprinted assets", () => {
    expect(getCacheControlHeader("/assets/index.a1b2c3d4.js")).toBe(
      "public, max-age=31536000, immutable"
    )
  })

  it("returns no-cache for HTML pages", () => {
    expect(getCacheControlHeader("/")).toBe("no-cache")
    expect(getCacheControlHeader("/listings")).toBe("no-cache")
  })
})

describe("applyCacheHeaders", () => {
  it("sets immutable cache for asset requests", () => {
    const request = new Request("http://localhost/assets/main.a1b2c3d4.js")
    const response = new Response("content", { status: 200 })

    const result = applyCacheHeaders(request, response)

    expect(result.headers.get("Cache-Control")).toBe(
      "public, max-age=31536000, immutable"
    )
  })

  it("sets no-cache for HTML page requests", () => {
    const request = new Request("http://localhost/listings")
    const response = new Response("<html></html>", { status: 200 })

    const result = applyCacheHeaders(request, response)

    expect(result.headers.get("Cache-Control")).toBe("no-cache")
  })

  it("preserves original response status and body", () => {
    const request = new Request("http://localhost/")
    const response = new Response("hello", { status: 200, statusText: "OK" })

    const result = applyCacheHeaders(request, response)

    expect(result.status).toBe(200)
    expect(result.statusText).toBe("OK")
  })
})
