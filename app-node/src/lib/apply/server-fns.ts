/**
 * Server functions for the multi-step application form (Phase 4).
 *
 * Provides:
 * - getDraftApplication: Look up existing draft by SF contact ID + listing ID
 * - saveDraft: Save/update a draft application via the SF proxy
 * - submitApplication: Submit a final application to Salesforce
 * - uploadFile: Upload document to S3, return URL
 * - validateApplicationAddress: Validate address via EasyPost
 *
 * Cross-server draft compatibility: Drafts are stored in Salesforce, so both
 * Rails and Node can read/write them using the same SF contact ID and listing ID.
 *
 * Requirements: 7.1, 7.4, 7.5, 7.6, 7.7
 */

import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

// ============================================================
// Input validation schemas
// ============================================================

const getDraftSchema = z.object({
  listingId: z.string().min(1),
})

const saveDraftSchema = z.object({
  listingID: z.string().min(1),
  applicationId: z.string().optional(),
  primaryApplicant: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email().optional().nullable(),
    DOB: z.string().optional().nullable(),
  }).passthrough(),
  alternateContact: z.object({
    firstName: z.string().nullable().optional(),
    lastName: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
  }).passthrough().optional().nullable(),
  householdMembers: z.array(z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    DOB: z.string().optional().nullable(),
  }).passthrough()).optional(),
  shortFormPreferences: z.array(z.unknown()).optional(),
  annualIncome: z.number().optional().nullable(),
  monthlyIncome: z.number().optional().nullable(),
}).passthrough()

const submitApplicationSchema = z.object({
  listingID: z.string().min(1),
  applicationId: z.string().optional(),
  primaryApplicant: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email().optional().nullable(),
    DOB: z.string().optional().nullable(),
  }).passthrough(),
  alternateContact: z.object({
    firstName: z.string().nullable().optional(),
    lastName: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
  }).passthrough().optional().nullable(),
  householdMembers: z.array(z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    DOB: z.string().optional().nullable(),
  }).passthrough()).optional(),
  shortFormPreferences: z.array(z.unknown()).optional(),
  annualIncome: z.number().optional().nullable(),
  monthlyIncome: z.number().optional().nullable(),
  /** Files uploaded during the application session */
  uploadedFiles: z.array(z.object({
    id: z.string(),
    userId: z.string().nullable(),
    applicationId: z.string().nullable(),
    listingId: z.string(),
    listingPreferenceId: z.string(),
    documentType: z.string(),
    name: z.string(),
    contentType: z.string(),
    sessionUid: z.string(),
    address: z.string().nullable(),
    rentBurdenType: z.string().nullable(),
    rentBurdenIndex: z.number().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })).optional(),
}).passthrough()

export type SubmitApplicationInput = z.infer<typeof submitApplicationSchema>

export interface SubmitApplicationResult {
  success: true
  application: {
    id: string
    listingID: string
    status: string
    lotteryNumber: string | null
  }
}

export interface SubmitApplicationError {
  success: false
  error: string
  code: "SF_PROXY_UNAVAILABLE" | "AUTH_FAILED" | "VALIDATION_ERROR"
}

const uploadFileSchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  /** Base64-encoded file content */
  fileContent: z.string().min(1),
  listingId: z.string().min(1),
  documentType: z.string().min(1),
  listingPreferenceId: z.string().optional(),
})

const validateAddressSchema = z.object({
  street1: z.string().min(1),
  street2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  zip: z.string().min(1),
  country: z.string().optional(),
})

// ============================================================
// Types
// ============================================================

export type DraftApplicationInput = z.infer<typeof saveDraftSchema>

export interface DraftApplicationData {
  id: string
  listingID: string
  status: string
  primaryApplicant: {
    firstName: string
    lastName: string
    email: string | null
    DOB: string | null
    phone: string | null
    street1: string | null
    street2: string | null
    city: string | null
    state: string | null
    zip: string | null
    alternatePhone: string | null
    alternatePhoneType: string | null
  } | null
  alternateContact: {
    firstName: string | null
    lastName: string | null
    email: string | null
    phone: string | null
    alternateContactType: string | null
    agency: string | null
  } | null
  householdMembers: Array<{
    firstName: string
    lastName: string
    DOB: string | null
    relationship: string | null
  }>
  annualIncome: number | null
  monthlyIncome: number | null
}

export interface DraftApplicationResult {
  found: boolean
  application: DraftApplicationData | null
}

export interface UploadFileResult {
  url: string
  key: string
  fileName: string
  contentType: string
}

// ============================================================
// Helper: resolve auth + SF contact ID
// ============================================================

async function resolveAuthenticatedContact() {
  const { requireDualAuth } = await import("../auth/dual-auth")
  const { getSalesforceContactId } = await import("../auth/user-mapping")

  const user = await requireDualAuth()

  let contactId: string
  if (user.provider === "devise") {
    const email = user.email ?? user.userId.replace("devise:", "")
    const { prisma } = await import("../db")
    const mapping = await prisma.user.findFirst({
      where: { email },
      select: { salesforceContactId: true },
    })
    if (!mapping) {
      throw new Error("No Salesforce contact mapping found for devise user")
    }
    contactId = mapping.salesforceContactId
  } else {
    contactId = await getSalesforceContactId(user.userId)
  }

  return { user, contactId }
}

// ============================================================
// Server Function: getDraftApplication
// ============================================================

/**
 * Look up an existing draft application for the authenticated user and listing.
 * Drafts are stored in Salesforce, so this works regardless of whether the draft
 * was saved from Rails or Node (cross-server compatibility).
 */
export const getDraftApplication = createServerFn({ method: "GET" })
  .validator((data: z.infer<typeof getDraftSchema>) => getDraftSchema.parse(data))
  .handler(async ({ data }): Promise<DraftApplicationResult> => {
    const { contactId } = await resolveAuthenticatedContact()

    const { createSalesforceProxyClient } = await import("../salesforce/client")
    const proxyClient = createSalesforceProxyClient()

    // Fetch all applications for this contact and filter for the listing draft
    const applications = await proxyClient.account.getApplications(contactId)
    const draft = applications.find(
      (app) => app.listingID === data.listingId && app.status === "draft"
    )

    if (!draft) {
      return { found: false, application: null }
    }

    return { found: true, application: draft as unknown as DraftApplicationData }
  })

// ============================================================
// Server Function: saveDraft
// ============================================================

/**
 * Save or update a draft application in Salesforce.
 * If applicationId is provided, updates the existing draft.
 * Otherwise, creates a new draft application.
 *
 * Both Rails and Node write drafts to Salesforce via the same proxy endpoint,
 * ensuring cross-server compatibility for draft resume.
 */
export const saveDraft = createServerFn({ method: "POST" })
  .validator((data: DraftApplicationInput) => saveDraftSchema.parse(data))
  .handler(async ({ data }): Promise<DraftApplicationData> => {
    await resolveAuthenticatedContact()

    const { createSalesforceProxyClient } = await import("../salesforce/client")
    const proxyClient = createSalesforceProxyClient()

    const applicationData = {
      listingID: data.listingID,
      primaryApplicant: {
        firstName: data.primaryApplicant.firstName,
        lastName: data.primaryApplicant.lastName,
        email: data.primaryApplicant.email ?? null,
        DOB: data.primaryApplicant.DOB ?? null,
      },
      alternateContact: data.alternateContact
        ? {
            firstName: data.alternateContact.firstName ?? null,
            lastName: data.alternateContact.lastName ?? null,
            email: data.alternateContact.email ?? null,
            phone: data.alternateContact.phone ?? null,
          }
        : undefined,
      householdMembers: data.householdMembers?.map((m) => ({
        firstName: m.firstName,
        lastName: m.lastName,
        DOB: m.DOB ?? null,
      })),
      shortFormPreferences: data.shortFormPreferences,
      annualIncome: data.annualIncome ?? undefined,
      monthlyIncome: data.monthlyIncome ?? undefined,
      status: "draft" as const,
    }

    if (data.applicationId) {
      // Update existing draft
      const updated = await proxyClient.shortForm.updateApplication(
        data.applicationId,
        applicationData
      )
      return updated as unknown as DraftApplicationData
    }

    // Create new draft
    const created = await proxyClient.shortForm.submitApplication(applicationData)
    return created as unknown as DraftApplicationData
  })

// ============================================================
// Server Function: submitApplication
// ============================================================

/**
 * Submit a final application to Salesforce.
 *
 * - Authenticates the user (requireDualAuth)
 * - Submits the application to Salesforce via the proxy client
 * - If SF proxy is unavailable, returns error without marking as submitted
 * - On success: preserves lotteryNumber and status exactly as returned by SF
 * - Enqueues file attachment job for any uploaded files
 * - Enqueues confirmation email job
 *
 * Validates: Requirements 7.1, 7.4, 7.7
 */
export const submitApplication = createServerFn({ method: "POST" })
  .validator((data: SubmitApplicationInput) => submitApplicationSchema.parse(data))
  .handler(async ({ data }): Promise<SubmitApplicationResult | SubmitApplicationError> => {
    const { user, contactId } = await resolveAuthenticatedContact()

    const { createSalesforceProxyClient } = await import("../salesforce/client")
    const { ProxyClientError } = await import("../salesforce/client")
    const proxyClient = createSalesforceProxyClient()

    // Build application data for Salesforce submission.
    // Coerce optional email/DOB from undefined → null to satisfy ApplicationData types.
    const applicationData = {
      listingID: data.listingID,
      primaryApplicant: {
        firstName: data.primaryApplicant.firstName,
        lastName: data.primaryApplicant.lastName,
        email: data.primaryApplicant.email ?? null,
        DOB: data.primaryApplicant.DOB ?? null,
      },
      alternateContact: data.alternateContact
        ? {
            firstName: data.alternateContact.firstName ?? null,
            lastName: data.alternateContact.lastName ?? null,
            email: data.alternateContact.email ?? null,
            phone: data.alternateContact.phone ?? null,
          }
        : undefined,
      householdMembers: data.householdMembers?.map((m) => ({
        firstName: m.firstName,
        lastName: m.lastName,
        DOB: m.DOB ?? null,
      })),
      shortFormPreferences: data.shortFormPreferences,
      annualIncome: data.annualIncome ?? undefined,
      monthlyIncome: data.monthlyIncome ?? undefined,
      status: "submitted" as const,
    }

    let submittedApplication
    try {
      if (data.applicationId) {
        // Update existing draft → submitted
        submittedApplication = await proxyClient.shortForm.updateApplication(
          data.applicationId,
          applicationData
        )
      } else {
        // Create new submitted application
        submittedApplication = await proxyClient.shortForm.submitApplication(applicationData)
      }
    } catch (error) {
      // If SF proxy is unavailable, return error without marking as submitted (Req 7.7)
      if (
        error instanceof ProxyClientError &&
        (error.statusCode >= 500 || error.statusCode === 0)
      ) {
        return {
          success: false,
          error: "Salesforce proxy is unavailable. Please try again later.",
          code: "SF_PROXY_UNAVAILABLE",
        }
      }
      // Network errors (timeouts, connection refused) also indicate unavailability
      if (
        error instanceof TypeError ||
        (error instanceof Error && error.name === "TimeoutError")
      ) {
        return {
          success: false,
          error: "Salesforce proxy is unavailable. Please try again later.",
          code: "SF_PROXY_UNAVAILABLE",
        }
      }
      throw error
    }

    // Preserve lotteryNumber and status exactly as returned by Salesforce (Req 7.4)
    const result = {
      id: submittedApplication.id,
      listingID: submittedApplication.listingID,
      status: submittedApplication.status,
      lotteryNumber: submittedApplication.lotteryNumber,
    }

    // Enqueue file attachment job if there are uploaded files (Req 7.1)
    const uploadedFiles = data.uploadedFiles
    if (uploadedFiles && uploadedFiles.length > 0) {
      const { enqueueFileAttachment } = await import("../jobs/queues")
      await enqueueFileAttachment({
        applicationId: submittedApplication.id,
        files: uploadedFiles,
      })
    }

    // Send application confirmation via sf-dahlia-backend's messaging service.
    // Mirrors Rails' ShortFormController#send_submit_app_confirmation ->
    // DahliaBackend::MessageService.send_application_confirmation, which hits
    // the same backend endpoint directly (not via Rails).
    const recipientEmail = data.primaryApplicant.email ?? user.email ?? ""
    if (recipientEmail) {
      const listing = await proxyClient.listings.getById(data.listingID)
      const { sendApplicationConfirmation } = await import(
        "../messages/application-confirmation"
      )
      await sendApplicationConfirmation({
        email: recipientEmail,
        listingId: data.listingID,
        listingName: String(listing.Name ?? ""),
        lotteryNumber: submittedApplication.lotteryNumber ?? "",
        lotteryDate: String(listing.Lottery_Date ?? ""),
        isRental: (listing.RecordType as { Name?: string } | undefined)?.Name === "Rental",
        leasingAgent: {
          name: String(listing.Leasing_Agent_Name ?? ""),
          email: String(listing.Leasing_Agent_Email ?? ""),
          phone: String(listing.Leasing_Agent_Phone ?? ""),
          officeHours: String(listing.Office_Hours ?? ""),
        },
        lang: (data as Record<string, unknown>).applicationLanguage as string ?? "en",
      })
    }

    return {
      success: true,
      application: result,
    }
  })

// ============================================================
// Server Function: uploadFile
// ============================================================

/**
 * Upload a file to S3 for use in application attachments.
 * Returns the S3 URL so the form can reference it when submitting.
 */
export const uploadFile = createServerFn({ method: "POST" })
  .validator((data: z.infer<typeof uploadFileSchema>) => uploadFileSchema.parse(data))
  .handler(async ({ data }): Promise<UploadFileResult> => {
    await resolveAuthenticatedContact()

    const { uploadFileToS3 } = await import("../uploads/s3")

    const buffer = Buffer.from(data.fileContent, "base64")

    const result = await uploadFileToS3({
      buffer,
      fileName: data.fileName,
      contentType: data.contentType,
      prefix: `applications/${data.listingId}`,
    })

    return {
      url: result.url,
      key: result.key,
      fileName: data.fileName,
      contentType: data.contentType,
    }
  })

// ============================================================
// Server Function: validateApplicationAddress
// ============================================================

/**
 * Validate an address using EasyPost.
 * Used for applicant home address and mailing address fields.
 */
export const validateApplicationAddress = createServerFn({ method: "POST" })
  .validator((data: z.infer<typeof validateAddressSchema>) => validateAddressSchema.parse(data))
  .handler(async ({ data }) => {
    const { validateAddress } = await import("../address/easypost")
    return validateAddress(data)
  })
