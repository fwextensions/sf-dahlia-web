/**
 * File attachment job processor.
 *
 * Processes file attachment jobs by calling the Rails proxy to attach
 * each file to the correct Salesforce application. On success, marks
 * the UploadedFile record as delivered. On final failure (all retries
 * exhausted), records the error message on the UploadedFile record.
 *
 * Files are linked using applicationId + listingPreferenceId from
 * the UploadedFile record.
 *
 * Requirements: 7.2, 7.3, 8.1
 */
import type { Job } from "bullmq"

import { env } from "../../../config/env"
import { prisma } from "../../db"
import type { FileAttachmentJob, UploadedFile } from "../types"

const REQUEST_TIMEOUT_MS = 30_000
const MAX_RETRIES = 3
const BASE_DELAY_MS = 1_000

/**
 * Calls the Rails proxy to attach a single file to a Salesforce application.
 * The proxy endpoint links the file using applicationId and listingPreferenceId.
 */
async function attachFileToSalesforce(
  file: UploadedFile,
  applicationId: string
): Promise<void> {
  const url = `${env.RAILS_API_BASE_URL}/api/v1/short-form/application/${applicationId}/file`

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Api-Key": env.INTERNAL_API_KEY,
    },
    body: JSON.stringify({
      fileId: file.id,
      listingPreferenceId: file.listingPreferenceId,
      documentType: file.documentType,
      name: file.name,
      contentType: file.contentType,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(
      `File attachment failed with status ${response.status}: ${body}`
    )
  }
}

/**
 * Sleep utility for exponential backoff between retries.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Attempts to attach a file with retry logic (up to 3 attempts with
 * exponential backoff: 1s, 2s, 4s).
 *
 * Returns the error message if all retries are exhausted, or null on success.
 */
async function attachFileWithRetry(
  file: UploadedFile,
  applicationId: string
): Promise<string | null> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await attachFileToSalesforce(file, applicationId)
      return null // success
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))

      if (attempt < MAX_RETRIES) {
        // Exponential backoff: 2^(attempt-1) * base delay
        const delay = Math.pow(2, attempt - 1) * BASE_DELAY_MS
        await sleep(delay)
      }
    }
  }

  return lastError?.message ?? "Unknown error during file attachment"
}

/**
 * Marks a file as delivered in the database.
 */
async function markFileDelivered(fileId: string): Promise<void> {
  await prisma.uploadedFile.update({
    where: { id: fileId },
    data: { deliveredAt: new Date() },
  })
}

/**
 * Records an error on the UploadedFile record after all retries are exhausted.
 */
async function recordFileError(fileId: string, error: string): Promise<void> {
  await prisma.uploadedFile.update({
    where: { id: fileId },
    data: { error },
  })
}

/**
 * File attachment processor for BullMQ.
 *
 * For each file in the job payload:
 * 1. Calls the Rails proxy to attach the file to Salesforce
 * 2. On success, marks the UploadedFile as delivered
 * 3. On failure (after 3 retries), records the error on the UploadedFile record
 *
 * The job-level BullMQ retry (up to 5 attempts) handles transient
 * infrastructure failures. The per-file retry (3 attempts) handles
 * individual file attachment failures at the application level.
 */
export async function processFileAttachment(
  job: Job<FileAttachmentJob>
): Promise<void> {
  const { applicationId, files } = job.data

  for (const file of files) {
    const errorMessage = await attachFileWithRetry(file, applicationId)

    if (errorMessage === null) {
      await markFileDelivered(file.id)
    } else {
      await recordFileError(file.id, errorMessage)
    }
  }
}
