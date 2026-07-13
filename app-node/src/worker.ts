/**
 * BullMQ Worker Entry Point
 *
 * This is the standalone worker process that runs as the `worker` dyno on Heroku.
 * It listens for jobs on the fileAttachment queue and processes them, and — when
 * CACHE_WARM_ENABLED is set — also runs the scheduled Redis cache pre-warm
 * (see docs/cache-prewarm-plan.md).
 *
 * Usage:
 *   Production: node --env-file-if-exists=.env --import tsx/esm src/worker.ts (see Procfile)
 *   Development: npm run start:worker
 *
 * `--env-file-if-exists=.env` loads app-node/.env when present (local dev — this
 * is how the worker picks up REDIS_URL, RAILS_API_BASE_URL, CACHE_WARM_* etc.);
 * on Heroku there's no .env file and the flag is a no-op, so config vars from the
 * dyno environment are used. Requires Node >= 20.12.
 */

import { env } from "./config/env"
import { createFileAttachmentWorker, createCacheWarmWorker } from "./lib/jobs/workers"
import { processFileAttachment } from "./lib/jobs/processors/file-attachment"
import { processCacheWarm } from "./lib/jobs/processors/cache-warm"
import { scheduleCacheWarm } from "./lib/jobs/queues"
import type { Worker } from "bullmq"

console.log("[worker] Starting BullMQ workers...")

const fileAttachmentWorker = createFileAttachmentWorker(processFileAttachment)
console.log("[worker] File attachment worker started")

const workers: Worker[] = [fileAttachmentWorker]

if (env.CACHE_WARM_ENABLED) {
  const cacheWarmWorker = createCacheWarmWorker(processCacheWarm)
  workers.push(cacheWarmWorker)
  console.log("[worker] Cache warm worker started")

  // Register the repeatable schedule + fire an immediate boot pass. Best-effort:
  // if Redis is unreachable this rejects; log and keep the other workers running.
  scheduleCacheWarm(env.CACHE_WARM_INTERVAL_MS)
    .then(() =>
      console.log(
        `[worker] Cache warm scheduled every ${env.CACHE_WARM_INTERVAL_MS}ms`
      )
    )
    .catch((err) =>
      console.error("[worker] Failed to schedule cache warm:", err)
    )
} else {
  console.log("[worker] Cache warm disabled (set CACHE_WARM_ENABLED=true)")
}

// Graceful shutdown
function shutdown() {
  console.log("[worker] Shutting down workers...")
  Promise.all(workers.map((w) => w.close())).then(() => {
    console.log("[worker] All workers stopped")
    process.exit(0)
  })
}

process.on("SIGTERM", shutdown)
process.on("SIGINT", shutdown)
