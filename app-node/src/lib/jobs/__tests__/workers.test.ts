import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("bullmq", () => {
  const mockAdd = vi.fn().mockResolvedValue({ id: "dlq-id" })

  class MockQueue {
    name: string
    add = mockAdd
    constructor(name: string, opts?: any) {
      this.name = name
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
    async emit(event: string, ...args: any[]) {
      for (const fn of this.listeners[event] || []) {
        await fn(...args)
      }
    }
  }

  return { Queue: MockQueue, Worker: MockWorker }
})

describe("Workers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("createFileAttachmentWorker creates a worker for fileAttachment queue", async () => {
    const { createFileAttachmentWorker } = await import("../workers")

    const processor = vi.fn()
    const worker = createFileAttachmentWorker(processor)

    expect(worker.name).toBe("fileAttachment")
  })

  it("createEmailWorker creates a worker for email queue", async () => {
    const { createEmailWorker } = await import("../workers")

    const processor = vi.fn()
    const worker = createEmailWorker(processor)

    expect(worker.name).toBe("email")
  })

  it("fileAttachment worker moves job to DLQ when max attempts reached", async () => {
    const { createFileAttachmentWorker } = await import("../workers")
    const { deadLetterQueue } = await import("../queues")

    const processor = vi.fn()
    const worker = createFileAttachmentWorker(processor) as any

    const failedJob = {
      id: "job-1",
      name: "attach",
      data: { applicationId: "app-1", files: [] },
      failedReason: "timeout",
      attemptsMade: 5,
      opts: { attempts: 5 },
    }

    // Trigger the failed event
    await worker.emit("failed", failedJob, new Error("timeout"))

    expect(deadLetterQueue.add).toHaveBeenCalledWith(
      "dead-letter",
      expect.objectContaining({
        originalQueue: "fileAttachment",
        originalJobId: "job-1",
      })
    )
  })

  it("worker does NOT move job to DLQ when attempts remain", async () => {
    const { createFileAttachmentWorker } = await import("../workers")
    const { deadLetterQueue } = await import("../queues")

    const processor = vi.fn()
    const worker = createFileAttachmentWorker(processor) as any

    const failedJob = {
      id: "job-2",
      name: "attach",
      data: { applicationId: "app-2", files: [] },
      failedReason: "transient",
      attemptsMade: 3,
      opts: { attempts: 5 },
    }

    await worker.emit("failed", failedJob, new Error("transient"))

    expect(deadLetterQueue.add).not.toHaveBeenCalled()
  })

  it("email worker moves job to DLQ when max attempts reached", async () => {
    const { createEmailWorker } = await import("../workers")
    const { deadLetterQueue } = await import("../queues")

    const processor = vi.fn()
    const worker = createEmailWorker(processor) as any

    const failedJob = {
      id: "email-job-1",
      name: "send",
      data: {
        template: "draft_saved",
        recipient: "test@example.com",
        locale: "en",
        data: {},
      },
      failedReason: "SMTP error",
      attemptsMade: 5,
      opts: { attempts: 5 },
    }

    await worker.emit("failed", failedJob, new Error("SMTP error"))

    expect(deadLetterQueue.add).toHaveBeenCalledWith(
      "dead-letter",
      expect.objectContaining({
        originalQueue: "email",
        originalJobId: "email-job-1",
        payload: failedJob.data,
      })
    )
  })
})
