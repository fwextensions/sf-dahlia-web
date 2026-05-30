import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("bullmq", () => {
  const mockAdd = vi.fn().mockResolvedValue({ id: "dlq-job-id" })

  class MockQueue {
    name: string
    add = mockAdd
    constructor(name: string, opts?: any) {
      this.name = name
    }
  }

  class MockWorker {
    constructor() {}
    on() {
      return this
    }
  }

  return { Queue: MockQueue, Worker: MockWorker }
})

describe("DLQ Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("moves failed job to dead letter queue with full payload preserved", async () => {
    const { moveToDeadLetterQueue } = await import("../dlq-handler")
    const { deadLetterQueue } = await import("../queues")

    const mockJob = {
      id: "job-42",
      name: "attach",
      data: {
        applicationId: "app-999",
        files: [{ id: "f1", name: "doc.pdf" }],
      },
      failedReason: "Salesforce timeout",
      attemptsMade: 5,
    } as any

    await moveToDeadLetterQueue(mockJob, "fileAttachment")

    expect(deadLetterQueue.add).toHaveBeenCalledWith(
      "dead-letter",
      expect.objectContaining({
        originalQueue: "fileAttachment",
        originalJobId: "job-42",
        originalJobName: "attach",
        payload: {
          applicationId: "app-999",
          files: [{ id: "f1", name: "doc.pdf" }],
        },
        failureReason: "Salesforce timeout",
        attemptsMade: 5,
      })
    )
  })

  it("preserves full original payload in DLQ entry", async () => {
    const { moveToDeadLetterQueue } = await import("../dlq-handler")
    const { deadLetterQueue } = await import("../queues")

    const originalPayload = {
      template: "application_confirmation",
      recipient: "user@test.com",
      locale: "es",
      data: { listingName: "Test Listing", appNumber: "12345" },
    }

    const mockJob = {
      id: "email-job-7",
      name: "send",
      data: originalPayload,
      failedReason: "SMTP connection refused",
      attemptsMade: 5,
    } as any

    await moveToDeadLetterQueue(mockJob, "email")

    const addCall = (deadLetterQueue.add as any).mock.calls[0]
    expect(addCall[1].payload).toEqual(originalPayload)
  })

  it("sends alert notification when job moves to DLQ", async () => {
    const { moveToDeadLetterQueue, setAlertFunction } = await import(
      "../dlq-handler"
    )

    const alertMock = vi.fn().mockResolvedValue(undefined)
    setAlertFunction(alertMock)

    const mockJob = {
      id: "job-99",
      name: "attach",
      data: { applicationId: "app-1", files: [] },
      failedReason: "Error",
      attemptsMade: 5,
    } as any

    await moveToDeadLetterQueue(mockJob, "fileAttachment")

    expect(alertMock).toHaveBeenCalledTimes(1)
    expect(alertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        originalQueue: "fileAttachment",
        originalJobId: "job-99",
        attemptsMade: 5,
      })
    )
  })

  it("includes failedAt timestamp in DLQ entry", async () => {
    const { moveToDeadLetterQueue } = await import("../dlq-handler")
    const { deadLetterQueue } = await import("../queues")

    const before = new Date().toISOString()

    const mockJob = {
      id: "j1",
      name: "send",
      data: {},
      failedReason: "timeout",
      attemptsMade: 5,
    } as any

    await moveToDeadLetterQueue(mockJob, "email")

    const addCall = (deadLetterQueue.add as any).mock.calls[0]
    const failedAt = addCall[1].failedAt

    expect(new Date(failedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(before).getTime()
    )
  })
})
