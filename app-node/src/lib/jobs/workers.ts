/**
 * BullMQ workers for fileAttachment and email queues.
 *
 * Workers listen for jobs and process them. When a job fails after
 * all retry attempts, it's moved to the dead letter queue.
 */
import { Worker, type Job, type Processor } from "bullmq"

import { getConnectionOptions } from "./connection"
import { moveToDeadLetterQueue } from "./dlq-handler"
import type { EmailJob, FileAttachmentJob } from "./types"

const connection = getConnectionOptions()

/**
 * Create the file attachment worker.
 * The actual processing logic is injected to allow testing and
 * separation of concerns (the worker infrastructure vs business logic).
 */
export function createFileAttachmentWorker(
  processor: Processor<FileAttachmentJob>
): Worker<FileAttachmentJob> {
  const worker = new Worker<FileAttachmentJob>(
    "fileAttachment",
    processor,
    { connection }
  )

  worker.on("failed", async (job: Job<FileAttachmentJob> | undefined, err) => {
    if (!job) return
    if (job.attemptsMade >= (job.opts.attempts ?? 5)) {
      await moveToDeadLetterQueue(job, "fileAttachment")
    }
  })

  return worker
}

/**
 * Create the email worker.
 */
export function createEmailWorker(
  processor: Processor<EmailJob>
): Worker<EmailJob> {
  const worker = new Worker<EmailJob>(
    "email",
    processor,
    { connection }
  )

  worker.on("failed", async (job: Job<EmailJob> | undefined, err) => {
    if (!job) return
    if (job.attemptsMade >= (job.opts.attempts ?? 5)) {
      await moveToDeadLetterQueue(job, "email")
    }
  })

  return worker
}
