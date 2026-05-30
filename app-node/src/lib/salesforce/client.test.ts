import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import { createSalesforceProxyClient, ProxyClientError } from "./client"
import type { SalesforceProxyClient } from "./client"

// Mock the env module
vi.mock("../../config/env", () => ({
  env: {
    RAILS_API_BASE_URL: "http://localhost:3000",
    INTERNAL_API_KEY: "test-api-key-123",
  },
}))

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe("SalesforceProxyClient", () => {
  let client: SalesforceProxyClient

  beforeEach(() => {
    client = createSalesforceProxyClient()
  })

  describe("request headers", () => {
    it("includes X-Internal-Api-Key header on every request", async () => {
      let capturedHeaders: Headers | undefined

      server.use(
        http.get("http://localhost:3000/api/v1/listings", ({ request }) => {
          capturedHeaders = request.headers
          return HttpResponse.json([])
        })
      )

      await client.listings.getAll()

      expect(capturedHeaders?.get("X-Internal-Api-Key")).toBe(
        "test-api-key-123"
      )
    })

    it("includes Content-Type application/json header", async () => {
      let capturedHeaders: Headers | undefined

      server.use(
        http.get("http://localhost:3000/api/v1/listings", ({ request }) => {
          capturedHeaders = request.headers
          return HttpResponse.json([])
        })
      )

      await client.listings.getAll()

      expect(capturedHeaders?.get("Content-Type")).toBe("application/json")
    })
  })

  describe("listings", () => {
    it("getAll fetches listings without params", async () => {
      const mockListings = [{ listingID: "abc", name: "Test Listing" }]

      server.use(
        http.get("http://localhost:3000/api/v1/listings", () => {
          return HttpResponse.json(mockListings)
        })
      )

      const result = await client.listings.getAll()
      expect(result).toEqual(mockListings)
    })

    it("getAll passes query params", async () => {
      let capturedUrl: string | undefined

      server.use(
        http.get("http://localhost:3000/api/v1/listings", ({ request }) => {
          capturedUrl = request.url
          return HttpResponse.json([])
        })
      )

      await client.listings.getAll({ type: "rental", subset: "browse" })

      expect(capturedUrl).toContain("type=rental")
      expect(capturedUrl).toContain("subset=browse")
    })

    it("getById fetches a single listing", async () => {
      const mockListing = { listingID: "123", name: "Test" }

      server.use(
        http.get("http://localhost:3000/api/v1/listings/123", () => {
          return HttpResponse.json(mockListing)
        })
      )

      const result = await client.listings.getById("123")
      expect(result).toEqual(mockListing)
    })

    it("getById passes force=true query param", async () => {
      let capturedUrl: string | undefined

      server.use(
        http.get("http://localhost:3000/api/v1/listings/123", ({ request }) => {
          capturedUrl = request.url
          return HttpResponse.json({})
        })
      )

      await client.listings.getById("123", true)

      expect(capturedUrl).toContain("force=true")
    })

    it("getUnits fetches units for a listing", async () => {
      const mockUnits = [{ unitType: "1BR" }]

      server.use(
        http.get("http://localhost:3000/api/v1/listings/123/units", () => {
          return HttpResponse.json(mockUnits)
        })
      )

      const result = await client.listings.getUnits("123")
      expect(result).toEqual(mockUnits)
    })

    it("getLotteryRanking passes lottery_number param", async () => {
      let capturedUrl: string | undefined

      server.use(
        http.get(
          "http://localhost:3000/api/v1/listings/123/lottery_ranking",
          ({ request }) => {
            capturedUrl = request.url
            return HttpResponse.json({})
          }
        )
      )

      await client.listings.getLotteryRanking("123", "00012345")

      expect(capturedUrl).toContain("lottery_number=00012345")
    })

    it("getAmi passes AMI params", async () => {
      let capturedUrl: string | undefined

      server.use(
        http.get("http://localhost:3000/api/v1/listings/ami", ({ request }) => {
          capturedUrl = request.url
          return HttpResponse.json([])
        })
      )

      await client.listings.getAmi({ chartType: "HUD", percent: 55 })

      expect(capturedUrl).toContain("chartType=HUD")
      expect(capturedUrl).toContain("percent=55")
    })
  })

  describe("shortForm", () => {
    it("submitApplication sends POST with body", async () => {
      let capturedBody: unknown

      server.use(
        http.post(
          "http://localhost:3000/api/v1/short-form/application",
          async ({ request }) => {
            capturedBody = await request.json()
            return HttpResponse.json({ id: "app-1", status: "submitted" })
          }
        )
      )

      const data = {
        listingID: "listing-1",
        primaryApplicant: {
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          DOB: "1990-01-01",
        },
      }

      const result = await client.shortForm.submitApplication(data)

      expect(capturedBody).toEqual(data)
      expect(result).toEqual({ id: "app-1", status: "submitted" })
    })

    it("deleteApplication sends DELETE request", async () => {
      server.use(
        http.delete(
          "http://localhost:3000/api/v1/short-form/application/app-1",
          () => {
            return new HttpResponse(null, { status: 204 })
          }
        )
      )

      await expect(
        client.shortForm.deleteApplication("app-1")
      ).resolves.toBeUndefined()
    })

    it("validateHousehold sends POST with listingID merged", async () => {
      let capturedBody: unknown

      server.use(
        http.post(
          "http://localhost:3000/api/v1/short-form/validate-household",
          async ({ request }) => {
            capturedBody = await request.json()
            return HttpResponse.json({ valid: true })
          }
        )
      )

      await client.shortForm.validateHousehold("listing-1", {
        listingID: "listing-1",
        householdSize: 3,
      })

      expect(capturedBody).toHaveProperty("listingID", "listing-1")
    })
  })

  describe("account", () => {
    it("getApplications passes contactId as header", async () => {
      let capturedHeaders: Headers | undefined

      server.use(
        http.get(
          "http://localhost:3000/api/v1/account/my-applications",
          ({ request }) => {
            capturedHeaders = request.headers
            return HttpResponse.json([])
          }
        )
      )

      await client.account.getApplications("contact-123")

      expect(capturedHeaders?.get("X-Contact-Id")).toBe("contact-123")
    })

    it("updateContact sends PUT with body", async () => {
      let capturedBody: unknown

      server.use(
        http.put(
          "http://localhost:3000/api/v1/account/update",
          async ({ request }) => {
            capturedBody = await request.json()
            return HttpResponse.json({
              id: "contact-1",
              firstName: "Jane",
              lastName: "Doe",
              email: "jane@example.com",
            })
          }
        )
      )

      const result = await client.account.updateContact({
        contactId: "contact-1",
        firstName: "Jane",
      })

      expect(capturedBody).toEqual({ contactId: "contact-1", firstName: "Jane" })
      expect(result.firstName).toBe("Jane")
    })
  })

  describe("error handling", () => {
    it("throws ProxyClientError on 4xx response", async () => {
      server.use(
        http.get("http://localhost:3000/api/v1/listings/bad-id", () => {
          return new HttpResponse("Not Found", { status: 404 })
        })
      )

      await expect(client.listings.getById("bad-id")).rejects.toThrow(
        ProxyClientError
      )

      try {
        await client.listings.getById("bad-id")
      } catch (e) {
        expect(e).toBeInstanceOf(ProxyClientError)
        expect((e as ProxyClientError).statusCode).toBe(404)
      }
    })

    it("throws ProxyClientError on 5xx response", async () => {
      server.use(
        http.get("http://localhost:3000/api/v1/listings", () => {
          return new HttpResponse("Internal Server Error", { status: 500 })
        })
      )

      await expect(client.listings.getAll()).rejects.toThrow(ProxyClientError)
    })

    it("throws generic error on 401 proxy auth rejection", async () => {
      server.use(
        http.get("http://localhost:3000/api/v1/listings", () => {
          return new HttpResponse("Unauthorized", { status: 401 })
        })
      )

      await expect(client.listings.getAll()).rejects.toThrow(
        "An error occurred while processing your request. Please try again later."
      )
    })

    it("does NOT throw ProxyClientError on 401 (hides proxy details)", async () => {
      server.use(
        http.get("http://localhost:3000/api/v1/listings", () => {
          return new HttpResponse("Unauthorized", { status: 401 })
        })
      )

      try {
        await client.listings.getAll()
      } catch (e) {
        expect(e).not.toBeInstanceOf(ProxyClientError)
        expect((e as Error).message).not.toContain("proxy")
        expect((e as Error).message).not.toContain("401")
        expect((e as Error).message).not.toContain("Rails")
      }
    })

    it("logs auth failure on 401 rejection", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

      server.use(
        http.get("http://localhost:3000/api/v1/listings", () => {
          return new HttpResponse("Unauthorized", { status: 401 })
        })
      )

      try {
        await client.listings.getAll()
      } catch {
        // expected
      }

      expect(consoleSpy).toHaveBeenCalledTimes(1)
      const loggedJson = JSON.parse(consoleSpy.mock.calls[0][0])
      expect(loggedJson.event).toBe("proxy_auth_failure")
      expect(loggedJson.endpoint).toBe("/api/v1/listings")
      expect(loggedJson.statusCode).toBe(401)

      consoleSpy.mockRestore()
    })
  })
})
