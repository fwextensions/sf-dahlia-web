import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Mock bullmq before importing modules
vi.mock("bullmq", () => {
  const mockAdd = vi.fn().mockResolvedValue({ id: "test-job-id" })

  class MockQueue {
    name: string
    opts: any
    add = mockAdd
    constructor(name: string, opts?: any) {
      this.name = name
      this.opts = opts
    }
  }

  class MockWorker {
    name: string
    processor: any
    opts: any
    listeners: Record<string, Function[]> = {}
    constructor(name: string, processor: any, opts?: any) {
      this.name = name
      this.processor = processor
      this.opts = opts
    }
    on(event: string, fn: Function) {
      if (!this.listeners[event]) this.listeners[event] = []
      this.listeners[event].push(fn)
      return this
    }
  }

  return {
    Queue: MockQueue,
    Worker: MockWorker,
  }
})

describe("Job Queues", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should configure default job options with exponential backoff", async () => {
    const { DEFAULT_JOB_OPTIONS } = await import("../queues")

    expect(DEFAULT_JOB_OPTIONS.attempts).toBe(5)
    expect(DEFAULT_JOB_OPTIONS.backoff).toEqual({
      type: "exponential",
      delay: 1000,
    })
  })

  it("should have removeOnComplete=true and removeOnFail=false", async () => {
    const { DEFAULT_JOB_OPTIONS } = await import("../queues")

    expect(DEFAULT_JOB_OPTIONS.removeOnComplete).toBe(true)
    expect(DEFAULT_JOB_OPTIONS.removeOnFail).toBe(false)
  })

  it("should create fileAttachment queue", async () => {
    const { fileAttachmentQueue } = await import("../queues")

    expect(fileAttachmentQueue.name).toBe("fileAttachment")
  })

  it("should create email queue", async () => {
    const { emailQueue } = await import("../queues")

    expect(emailQueue.name).toBe("email")
  })

  it("should create dead letter queue", async () => {
    const { deadLetterQueue } = await import("../queues")

    expect(deadLetterQueue.name).toBe("deadLetter")
  })

  it("enqueueFileAttachment adds job to fileAttachment queue", async () => {
    const { enqueueFileAttachment, fileAttachmentQueue } = await import(
      "../queues"
    )

    const data = {
      applicationId: "app-123",
      files: [
        {
          id: "file-1",
          userId: "user-1",
          applicationId: "app-123",
          listingId: "listing-1",
          listingPreferenceId: "pref-1",
          documentType: "proof",
          name: "doc.pdf",
          contentType: "application/pdf",
          sessionUid: "sess-1",
          address: null,
          rentBurdenType: null,
          rentBurdenIndex: null,
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
      ],
    }

    await enqueueFileAttachment(data)
    expect(fileAttachmentQueue.add).toHaveBeenCalledWith("attach", data)
  })

  it("enqueueEmail adds job to email queue", async () => {
    const { enqueueEmail, emailQueue } = await import("../queues")

    const data = {
      template: "application_confirmation" as const,
      recipient: "user@example.com",
      locale: "en",
      data: { name: "John" },
    }

    await enqueueEmail(data)
    expect(emailQueue.add).toHaveBeenCalledWith("send", data)
  })
})
