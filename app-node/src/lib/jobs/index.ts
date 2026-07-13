/**
 * Background job processor - public API.
 */
export { getConnectionOptions } from "./connection"
export { moveToDeadLetterQueue, setAlertFunction } from "./dlq-handler"
export type { AlertFn, DLQEntry } from "./dlq-handler"
export {
  cacheWarmQueue,
  CACHE_WARM_JOB_OPTIONS,
  deadLetterQueue,
  DEFAULT_JOB_OPTIONS,
  enqueueFileAttachment,
  fileAttachmentQueue,
  scheduleCacheWarm,
} from "./queues"
export type {
  CacheWarmJob,
  FileAttachmentJob,
  JobType,
  UploadedFile,
} from "./types"
export { processFileAttachment } from "./processors/file-attachment"
export {
  processCacheWarm,
  runCacheWarm,
  type CacheWarmSummary,
} from "./processors/cache-warm"
export { createCacheWarmWorker, createFileAttachmentWorker } from "./workers"
