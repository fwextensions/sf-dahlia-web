/**
 * Job type definitions for BullMQ queues.
 */

export interface UploadedFile {
  id: string
  userId: string | null
  applicationId: string | null
  listingId: string
  listingPreferenceId: string
  documentType: string
  name: string
  contentType: string
  sessionUid: string
  address: string | null
  rentBurdenType: string | null
  rentBurdenIndex: number | null
  createdAt: string
  updatedAt: string
}

export interface FileAttachmentJob {
  applicationId: string
  files: UploadedFile[]
}

export interface EmailJob {
  template: "application_confirmation" | "draft_saved" | "account_update"
  recipient: string
  locale: string
  data: Record<string, unknown>
}

export type JobType = "fileAttachment" | "email"
