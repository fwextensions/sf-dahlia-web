/**
 * Tests for the file attachment job processor.
 *
 * Validates:
 * - Files are attached to Salesforce via the Rails proxy
 * - Successful attachments are marked as delivered in the database
 * - Failed attachments (after retries) record error on UploadedFile
 * - Retry logic with exponential backoff (up to 3 attempts)
 * - Correct applicationId and listingPreferenceId are used for linking
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { FileAttachmentJob, UploadedFile } from "../types"

// Mock prisma
vi.mock("../../db", () => ({
  prisma: {
    uploadedFile: {
      update: vi.fn().mockResolvedValue({}),
    },
  },
}))

// Mock env
vi.mock("../../../config/env", () => ({
  env: {
    RAILS_API_BASE_URL: "http://rails-proxy.test",
    INTERNAL_API_KEY: "test-api-key",
  },
}))

function makeFile(overrides: Partial<UploadedFile> = {}): UploadedFile {
  return {
    id: "file-1",
    userId: "user-1",
    applicationId: "app-1",
    listingId: "listing-1",
    listingPreferenceId: "pref-1",
    documentType: "rentBurden",
    name: "lease.pdf",
    contentType: "application/pdf",
    sessionUid: "session-123",
    address: null,
    rentBurdenType: null,
    rentBurdenIndex: null,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    ...overrides,
  }
}

function makeJob(data: FileAttachmentJob) {
  return { data } as any
}

describe("processFileAttachment", () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    fetchMock = vi.fn()
    global.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("attaches file to correct Salesforce application and marks as delivered", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 })

    const { processFileAttachment } = await import("./file-attachment")
    const { prisma } = await import("../../db")

    const file = makeFile()
    const job = makeJob({ applicationId: "app-1", files: [file] })

    await processFileAttachment(job)

    // Verify correct proxy endpoint called with applicationId
    expect(fetchMock).toHaveBeenCalledWith(
      "http://rails-proxy.test/api/v1/short-form/application/app-1/file",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-Internal-Api-Key": "test-api-key",
        }),
      })
    )

    // Verify body contains listingPreferenceId for linking
    const callBody = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(callBody.listingPreferenceId).toBe("pref-1")
    expect(callBody.fileId).toBe("file-1")

    // Verify file marked as delivered
    expect(prisma.uploadedFile.update).toHaveBeenCalledWith({
      where: { id: "file-1" },
      data: { deliveredAt: expect.any(Date) },
    })
  })

  it("records error on UploadedFile after all retries exhausted", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal Server Error"),
    })

    // Re-import to get fresh module
    vi.resetModules()
    vi.mock("../../db", () => ({
      prisma: {
        uploadedFile: {
          update: vi.fn().mockResolvedValue({}),
        },
      },
    }))
    vi.mock("../../../config/env", () => ({
      env: {
        RAILS_API_BASE_URL: "http://rails-proxy.test",
        INTERNAL_API_KEY: "test-api-key",
      },
    }))

    const { processFileAttachment } = await import("./file-attachment")
    const { prisma } = await import("../../db")

    const file = makeFile({ id: "file-fail" })
    const job = makeJob({ applicationId: "app-1", files: [file] })

    // Run with fake timers to avoid waiting for real backoff delays
    const promise = processFileAttachment(job)
    // Advance timers past all backoff delays (1s + 2s + 4s)
    await vi.advanceTimersByTimeAsync(10_000)
    await promise

    // Should have attempted 3 times
    expect(fetchMock).toHaveBeenCalledTimes(3)

    // Should record error on the UploadedFile
    expect(prisma.uploadedFile.update).toHaveBeenCalledWith({
      where: { id: "file-fail" },
      data: { error: expect.stringContaining("500") },
    })
  })

  it("retries with exponential backoff on failure before succeeding", async () => {
    // Fail twice, succeed on third attempt
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: () => Promise.resolve("Service Unavailable"),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: () => Promise.resolve("Service Unavailable"),
      })
      .mockResolvedValueOnce({ ok: true, status: 200 })

    vi.resetModules()
    vi.mock("../../db", () => ({
      prisma: {
        uploadedFile: {
          update: vi.fn().mockResolvedValue({}),
        },
      },
    }))
    vi.mock("../../../config/env", () => ({
      env: {
        RAILS_API_BASE_URL: "http://rails-proxy.test",
        INTERNAL_API_KEY: "test-api-key",
      },
    }))

    const { processFileAttachment } = await import("./file-attachment")
    const { prisma } = await import("../../db")

    const file = makeFile({ id: "file-retry" })
    const job = makeJob({ applicationId: "app-1", files: [file] })

    const promise = processFileAttachment(job)
    // Advance past first backoff (1s) and second backoff (2s)
    await vi.advanceTimersByTimeAsync(5_000)
    await promise

    // 3 total attempts
    expect(fetchMock).toHaveBeenCalledTimes(3)

    // File marked as delivered (succeeded on third try)
    expect(prisma.uploadedFile.update).toHaveBeenCalledWith({
      where: { id: "file-retry" },
      data: { deliveredAt: expect.any(Date) },
    })
  })

  it("processes multiple files independently", async () => {
    // First file succeeds, second file fails all retries
    let callCount = 0
    fetchMock.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        // First file, first attempt - success
        return Promise.resolve({ ok: true, status: 200 })
      }
      // Second file - always fails
      return Promise.resolve({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Server Error"),
      })
    })

    vi.resetModules()
    vi.mock("../../db", () => ({
      prisma: {
        uploadedFile: {
          update: vi.fn().mockResolvedValue({}),
        },
      },
    }))
    vi.mock("../../../config/env", () => ({
      env: {
        RAILS_API_BASE_URL: "http://rails-proxy.test",
        INTERNAL_API_KEY: "test-api-key",
      },
    }))

    const { processFileAttachment } = await import("./file-attachment")
    const { prisma } = await import("../../db")

    const file1 = makeFile({ id: "file-ok" })
    const file2 = makeFile({ id: "file-fail", listingPreferenceId: "pref-2" })
    const job = makeJob({ applicationId: "app-1", files: [file1, file2] })

    const promise = processFileAttachment(job)
    await vi.advanceTimersByTimeAsync(10_000)
    await promise

    // First file: delivered
    expect(prisma.uploadedFile.update).toHaveBeenCalledWith({
      where: { id: "file-ok" },
      data: { deliveredAt: expect.any(Date) },
    })

    // Second file: error recorded
    expect(prisma.uploadedFile.update).toHaveBeenCalledWith({
      where: { id: "file-fail" },
      data: { error: expect.stringContaining("500") },
    })
  })
})
