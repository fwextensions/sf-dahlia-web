/**
 * Background job processor - public API.
 */
export { getConnectionOptions } from "./connection"
export { moveToDeadLetterQueue, setAlertFunction } from "./dlq-handler"
export type { AlertFn, DLQEntry } from "./dlq-handler"
export {
  deadLetterQueue,
  DEFAULT_JOB_OPTIONS,
  emailQueue,
  enqueueEmail,
  enqueueFileAttachment,
  fileAttachmentQueue,
} from "./queues"
export type { EmailJob, FileAttachmentJob, JobType, UploadedFile } from "./types"
export { processFileAttachment } from "./processors/file-attachment"
export { createEmailWorker, createFileAttachmentWorker } from "./workers"
export { processEmailJob } from "./processors/email"
