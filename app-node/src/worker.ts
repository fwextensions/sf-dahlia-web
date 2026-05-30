/**
 * BullMQ Worker Entry Point
 *
 * This is the standalone worker process that runs as the `worker` dyno on Heroku.
 * It listens for jobs on the fileAttachment and email queues and processes them.
 *
 * Usage:
 *   Production: node .output/server/worker.mjs (after vite build)
 *   Development: npx tsx src/worker.ts
 */

import { createFileAttachmentWorker, createEmailWorker } from "./lib/jobs/workers"
import { processFileAttachment } from "./lib/jobs/processors/file-attachment"
import { processEmailJob } from "./lib/jobs/processors/email"

console.log("[worker] Starting BullMQ workers...")

const fileAttachmentWorker = createFileAttachmentWorker(processFileAttachment)
const emailWorker = createEmailWorker(processEmailJob)

console.log("[worker] File attachment worker started")
console.log("[worker] Email worker started")

// Graceful shutdown
function shutdown() {
  console.log("[worker] Shutting down workers...")
  Promise.all([fileAttachmentWorker.close(), emailWorker.close()]).then(() => {
    console.log("[worker] All workers stopped")
    process.exit(0)
  })
}

process.on("SIGTERM", shutdown)
process.on("SIGINT", shutdown)
