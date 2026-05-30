/**
 * Dead Letter Queue handler.
 *
 * When a job exhausts all retries, it is moved to the DLQ with its
 * full original payload preserved. An alert is sent to the ops team
 * within 5 minutes of final failure.
 */
import type { Job } from "bullmq"

import { deadLetterQueue } from "./queues"

export interface DLQEntry {
  originalQueue: string
  originalJobId: string | undefined
  originalJobName: string
  payload: unknown
  failedAt: string
  failureReason: string | undefined
  attemptsMade: number
}

/**
 * Alert function — can be replaced with a real notification service
 * (e.g., PagerDuty, Slack webhook, email to ops).
 */
export type AlertFn = (entry: DLQEntry) => Promise<void>

const defaultAlert: AlertFn = async (entry: DLQEntry) => {
  console.error(
    `[DLQ ALERT] Job failed permanently after ${entry.attemptsMade} attempts.`,
    {
      queue: entry.originalQueue,
      jobId: entry.originalJobId,
      jobName: entry.originalJobName,
      failedAt: entry.failedAt,
      reason: entry.failureReason,
    }
  )
}

let alertFn: AlertFn = defaultAlert

/**
 * Allow injection of a custom alert function (for testing or production config).
 */
export function setAlertFunction(fn: AlertFn) {
  alertFn = fn
}

/**
 * Get the current alert function (for testing).
 */
export function getAlertFunction(): AlertFn {
  return alertFn
}

/**
 * Move a failed job to the dead letter queue and send an alert.
 * This is called from workers when a job has exhausted all retries.
 *
 * Preserves the original job payload so it can be manually re-enqueued.
 */
export async function moveToDeadLetterQueue(
  job: Job,
  queueName: string
): Promise<void> {
  const entry: DLQEntry = {
    originalQueue: queueName,
    originalJobId: job.id,
    originalJobName: job.name,
    payload: job.data,
    failedAt: new Date().toISOString(),
    failureReason: job.failedReason,
    attemptsMade: job.attemptsMade,
  }

  // Add to DLQ preserving the full payload
  await deadLetterQueue.add("dead-letter", entry)

  // Send alert to ops team (must happen within 5 minutes of final failure)
  await alertFn(entry)
}
