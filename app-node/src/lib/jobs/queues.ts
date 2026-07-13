/**
 * BullMQ queue setup for fileAttachment jobs.
 *
 * Retry strategy: exponential backoff delay = 2^N seconds for N = 0..4
 * (delays of 1s, 2s, 4s, 8s, 16s for attempts 1–5).
 *
 * After 5 failed attempts, jobs are moved to the dead letter queue.
 */
import { Queue, type JobsOptions } from "bullmq"

import { getConnectionOptions } from "./connection"
import type { CacheWarmJob, FileAttachmentJob } from "./types"

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

/**
 * Enqueue a file attachment job.
 */
export async function enqueueFileAttachment(data: FileAttachmentJob) {
  return fileAttachmentQueue.add("attach", data)
}

/**
 * Cache pre-warm queue. A warm pass is idempotent and cheap to retry, so it
 * uses fewer attempts than file attachment and keeps only a small failure
 * history. Failures fall through to the DLQ like any other queue.
 */
export const CACHE_WARM_JOB_OPTIONS: JobsOptions = {
  attempts: 2,
  backoff: { type: "exponential", delay: 5_000 },
  removeOnComplete: true,
  removeOnFail: 20,
}

/** Redis cache pre-warm queue (see processors/cache-warm.ts). */
export const cacheWarmQueue = new Queue<CacheWarmJob>("cacheWarm", {
  connection,
  defaultJobOptions: CACHE_WARM_JOB_OPTIONS,
})
cacheWarmQueue.on("error", (err) => {
  console.warn("[jobs] cacheWarmQueue connection error (unavailable):", err.message)
})

/** Stable scheduler id so redeploys/restarts don't stack duplicate repeatables. */
const CACHE_WARM_SCHEDULER_ID = "cache-warm-all"

/**
 * Register the repeatable cache-warm job.
 *
 * - The repeatable (via `upsertJobScheduler`, keyed by a stable id) is
 *   idempotent: calling this on every worker boot updates the schedule in place
 *   rather than creating duplicates.
 * - `upsertJobScheduler` with `every` produces its first job immediately on
 *   creation, so a fresh deploy or Redis flush is covered right away without a
 *   separate one-shot enqueue (an earlier explicit boot `add` here caused two
 *   passes to run back-to-back at startup).
 *
 * Best-effort: Redis being unreachable throws here; the caller logs and
 * continues (the worker still serves other queues, and BullMQ reconnects).
 */
export async function scheduleCacheWarm(everyMs: number): Promise<void> {
  await cacheWarmQueue.upsertJobScheduler(
    CACHE_WARM_SCHEDULER_ID,
    { every: everyMs },
    { name: "warm-all", data: { scope: "all" } }
  )
}
