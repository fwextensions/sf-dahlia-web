import { describe, it, expect, vi, beforeEach } from "vitest"
import { getSalesforceContactId } from "./user-mapping"
import { UserMappingNotFoundError, DatabaseConnectionError } from "./errors"

// Mock the Prisma client
vi.mock("../db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}))

import { prisma } from "../db"

const mockFindUnique = prisma.user.findUnique as ReturnType<typeof vi.fn>

describe("getSalesforceContactId", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns the salesforceContactId when a mapping record exists", async () => {
    mockFindUnique.mockResolvedValue({
      salesforceContactId: "003ABC123DEF",
    })

    const result = await getSalesforceContactId("clerk_user_abc123")

    expect(result).toBe("003ABC123DEF")
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { clerkUserId: "clerk_user_abc123" },
      select: { salesforceContactId: true },
    })
  })

  it("throws UserMappingNotFoundError when no record exists", async () => {
    mockFindUnique.mockResolvedValue(null)

    await expect(
      getSalesforceContactId("clerk_user_unknown")
    ).rejects.toThrow(UserMappingNotFoundError)

    await expect(
      getSalesforceContactId("clerk_user_unknown")
    ).rejects.toMatchObject({
      name: "UserMappingNotFoundError",
      clerkUserId: "clerk_user_unknown",
    })
  })

  it("throws DatabaseConnectionError when Prisma throws", async () => {
    const dbError = new Error("Connection refused")
    mockFindUnique.mockRejectedValue(dbError)

    await expect(
      getSalesforceContactId("clerk_user_abc123")
    ).rejects.toThrow(DatabaseConnectionError)

    await expect(
      getSalesforceContactId("clerk_user_abc123")
    ).rejects.toMatchObject({
      name: "DatabaseConnectionError",
      cause: dbError,
    })
  })
})
