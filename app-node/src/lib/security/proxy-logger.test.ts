import { describe, it, expect, vi } from "vitest"
import {
  logProxyAuthFailure,
  isProxyAuthRejection,
  createGenericProxyError,
  GENERIC_PROXY_ERROR_MESSAGE,
  type ProxyAuthFailureContext,
} from "./proxy-logger"

describe("proxy-logger", () => {
  describe("isProxyAuthRejection", () => {
    it("returns true for 401 status code", () => {
      expect(isProxyAuthRejection(401)).toBe(true)
    })

    it("returns false for other status codes", () => {
      expect(isProxyAuthRejection(403)).toBe(false)
      expect(isProxyAuthRejection(500)).toBe(false)
      expect(isProxyAuthRejection(200)).toBe(false)
      expect(isProxyAuthRejection(404)).toBe(false)
    })
  })

  describe("logProxyAuthFailure", () => {
    it("logs the failure with correct structure", () => {
      const mockLogger = { error: vi.fn() }
      const context: ProxyAuthFailureContext = {
        endpoint: "/api/v1/listings",
        statusCode: 401,
        method: "GET",
      }

      const entry = logProxyAuthFailure(context, mockLogger)

      expect(entry.level).toBe("error")
      expect(entry.event).toBe("proxy_auth_failure")
      expect(entry.endpoint).toBe("/api/v1/listings")
      expect(entry.statusCode).toBe(401)
      expect(entry.method).toBe("GET")
      expect(entry.timestamp).toBeDefined()
    })

    it("calls logger.error with JSON-serialized entry", () => {
      const mockLogger = { error: vi.fn() }
      const context: ProxyAuthFailureContext = {
        endpoint: "/api/v1/listings/abc",
        statusCode: 401,
        method: "POST",
      }

      logProxyAuthFailure(context, mockLogger)

      expect(mockLogger.error).toHaveBeenCalledTimes(1)
      const loggedJson = JSON.parse(mockLogger.error.mock.calls[0][0])
      expect(loggedJson.event).toBe("proxy_auth_failure")
      expect(loggedJson.endpoint).toBe("/api/v1/listings/abc")
    })

    it("does NOT include API key in log output", () => {
      const mockLogger = { error: vi.fn() }
      const context: ProxyAuthFailureContext = {
        endpoint: "/api/v1/listings",
        statusCode: 401,
      }

      logProxyAuthFailure(context, mockLogger)

      const loggedString = mockLogger.error.mock.calls[0][0]
      expect(loggedString).not.toContain("api_key")
      expect(loggedString).not.toContain("Api-Key")
      expect(loggedString).not.toContain("Internal")
    })

    it("defaults method to GET when not provided", () => {
      const mockLogger = { error: vi.fn() }
      const context: ProxyAuthFailureContext = {
        endpoint: "/api/v1/listings",
        statusCode: 401,
      }

      const entry = logProxyAuthFailure(context, mockLogger)
      expect(entry.method).toBe("GET")
    })
  })

  describe("createGenericProxyError", () => {
    it("returns an Error with a generic message", () => {
      const error = createGenericProxyError()
      expect(error).toBeInstanceOf(Error)
      expect(error.message).toBe(GENERIC_PROXY_ERROR_MESSAGE)
    })

    it("does not reveal proxy infrastructure details", () => {
      const error = createGenericProxyError()
      expect(error.message).not.toContain("proxy")
      expect(error.message).not.toContain("Rails")
      expect(error.message).not.toContain("401")
      expect(error.message).not.toContain("authentication")
    })
  })
})
