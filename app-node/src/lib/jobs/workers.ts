/**
 * BullMQ worker for the fileAttachment queue.
 *
 * The worker listens for jobs and processes them. When a job fails after
 * all retry attempts, it's moved to the dead letter queue.
 */
import { Worker, type Job, type Processor } from "bullmq"

import { getConnectionOptions } from "./connection"
import { moveToDeadLetterQueue } from "./dlq-handler"
import type { CacheWarmJob, FileAttachmentJob } from "./types"

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
 * Create the cache pre-warm worker.
 *
 * Concurrency is 1: a single warm pass already fans out internally (bounded by
 * CACHE_WARM_CONCURRENCY), so running one job at a time avoids overlapping
 * passes competing for the same upstream capacity. The stable repeatable
 * scheduler id (see scheduleCacheWarm) prevents duplicate scheduled triggers.
 */
export function createCacheWarmWorker(
  processor: Processor<CacheWarmJob>
): Worker<CacheWarmJob> {
  const worker = new Worker<CacheWarmJob>("cacheWarm", processor, {
    connection,
    concurrency: 1,
  })

  worker.on("failed", async (job: Job<CacheWarmJob> | undefined) => {
    if (!job) return
    if (job.attemptsMade >= (job.opts.attempts ?? 2)) {
      await moveToDeadLetterQueue(job, "cacheWarm")
    }
  })

  return worker
}
