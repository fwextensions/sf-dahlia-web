/**
 * Background job processor - public API.
 */
export { getConnectionOptions } from "./connection"
export { moveToDeadLetterQueue, setAlertFunction } from "./dlq-handler"
export type { AlertFn, DLQEntry } from "./dlq-handler"
export {
  deadLetterQueue,
  DEFAULT_JOB_OPTIONS,
  enqueueFileAttachment,
  fileAttachmentQueue,
} from "./queues"
export type { FileAttachmentJob, JobType, UploadedFile } from "./types"
export { processFileAttachment } from "./processors/file-attachment"
export { createFileAttachmentWorker } from "./workers"
