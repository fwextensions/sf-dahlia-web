/**
 * BullMQ queue setup for fileAttachment and email jobs.
 *
 * Retry strategy: exponential backoff delay = 2^N seconds for N = 0..4
 * (delays of 1s, 2s, 4s, 8s, 16s for attempts 1–5).
 *
 * After 5 failed attempts, jobs are moved to the dead letter queue.
 */
import { Queue, type JobsOptions } from "bullmq"

import { getConnectionOptions } from "./connection"
import type { EmailJob, FileAttachmentJob } from "./types"

const connection = getConnectionOptions()

/**
 * Default job options with exponential backoff retry.
 * BullMQ uses `attempts` as total tries (1 initial + retries),
 * so attempts=5 means up to 5 total execution attempts.
 *
 * backoff type "exponential" with delay=1000 means:
 *   attempt 1 retry delay: 1000 * 2^0 = 1000ms (1s)
 *   attempt 2 retry delay: 1000 * 2^1 = 2000ms (2s)
 *   attempt 3 retry delay: 1000 * 2^2 = 4000ms (4s)
 *   attempt 4 retry delay: 1000 * 2^3 = 8000ms (8s)
 *   attempt 5 retry delay: 1000 * 2^4 = 16000ms (16s)
 */
export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: {
    type: "exponential",
    delay: 1000, // base delay in ms; actual = delay * 2^(attemptNumber-1)
  },
  removeOnComplete: true,
  removeOnFail: false, // Keep failed jobs for DLQ processing
}

/** Dead letter queue for jobs that exceed max retries */
export const deadLetterQueue = new Queue("deadLetter", { connection })
deadLetterQueue.on("error", (err) => {
  console.warn("[jobs] deadLetterQueue connection error (unavailable):", err.message)
})

/** File attachment processing queue */
export const fileAttachmentQueue = new Queue<FileAttachmentJob>(
  "fileAttachment",
  {
    connection,
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  }
)
fileAttachmentQueue.on("error", (err) => {
  console.warn("[jobs] fileAttachmentQueue connection error (unavailable):", err.message)
})

/** Email sending queue */
export const emailQueue = new Queue<EmailJob>("email", {
  connection,
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
})
emailQueue.on("error", (err) => {
  console.warn("[jobs] emailQueue connection error (unavailable):", err.message)
})

/**
 * Enqueue a file attachment job.
 */
export async function enqueueFileAttachment(data: FileAttachmentJob) {
  return fileAttachmentQueue.add("attach", data)
}

/**
 * Enqueue an email job.
 */
export async function enqueueEmail(data: EmailJob) {
  return emailQueue.add("send", data)
}
