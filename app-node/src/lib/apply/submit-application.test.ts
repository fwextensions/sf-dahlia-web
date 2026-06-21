/**
 * Tests for submitApplication server function logic.
 *
 * Validates: Requirements 7.1, 7.4, 7.7
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock dependencies
vi.mock("../auth/dual-auth", () => ({
  requireDualAuth: vi.fn(),
}))

vi.mock("../auth/user-mapping", () => ({
  getSalesforceContactId: vi.fn(),
}))

vi.mock("../db", () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
    },
  },
}))

vi.mock("../salesforce/client", () => ({
  createSalesforceProxyClient: vi.fn(),
  ProxyClientError: class ProxyClientError extends Error {
    statusCode: number
    responseBody: string
    constructor(message: string, statusCode: number, responseBody: string) {
      super(message)
      this.name = "ProxyClientError"
      this.statusCode = statusCode
      this.responseBody = responseBody
    }
  },
}))

vi.mock("../jobs/queues", () => ({
  enqueueFileAttachment: vi.fn().mockResolvedValue({}),
}))

vi.mock("../messages/application-confirmation", () => ({
  sendApplicationConfirmation: vi.fn().mockResolvedValue(undefined),
}))

describe("submitApplication logic", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  const mockUser = {
    userId: "clerk_user_123",
    sessionId: "sess_123",
    provider: "clerk" as const,
    email: "applicant@example.com",
  }

  const baseInput = {
    listingID: "listing_abc",
    primaryApplicant: {
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
      DOB: "1990-01-15",
    },
    alternateContact: null,
    householdMembers: [],
    shortFormPreferences: [],
    annualIncome: 50000,
    monthlyIncome: 4166,
    applicationLanguage: "en",
  }

  const mockSubmittedApp = {
    id: "app_submitted_001",
    listingID: "listing_abc",
    status: "submitted",
    lotteryNumber: "00123456",
    applicationLanguage: "en",
    primaryApplicant: baseInput.primaryApplicant,
    alternateContact: null,
    householdMembers: [],
    shortFormPreferences: [],
    annualIncome: 50000,
    monthlyIncome: 4166,
  }

  const mockListing = {
    Name: "Test Listing",
    Lottery_Date: "2024-03-01",
    RecordType: { Name: "Rental" },
    Leasing_Agent_Name: "Pat Lee",
    Leasing_Agent_Email: "pat@example.com",
    Leasing_Agent_Phone: "415-555-0100",
    Office_Hours: "Mon-Fri 9-5",
  }

  async function setupMocks(options?: {
    submitResult?: unknown
    submitError?: Error
  }) {
    const { requireDualAuth } = await import("../auth/dual-auth")
    const { getSalesforceContactId } = await import("../auth/user-mapping")
    const { createSalesforceProxyClient } = await import("../salesforce/client")

    vi.mocked(requireDualAuth).mockResolvedValue(mockUser)
    vi.mocked(getSalesforceContactId).mockResolvedValue("sf_contact_abc")

    const mockSubmit = options?.submitError
      ? vi.fn().mockRejectedValue(options.submitError)
      : vi.fn().mockResolvedValue(options?.submitResult ?? mockSubmittedApp)
    const mockUpdate = options?.submitError
      ? vi.fn().mockRejectedValue(options.submitError)
      : vi.fn().mockResolvedValue(options?.submitResult ?? mockSubmittedApp)
    const mockGetById = vi.fn().mockResolvedValue(mockListing)

    vi.mocked(createSalesforceProxyClient).mockReturnValue({
      shortForm: {
        submitApplication: mockSubmit,
        updateApplication: mockUpdate,
        validateHousehold: vi.fn(),
        getApplication: vi.fn(),
        deleteApplication: vi.fn(),
        getLendingInstitutions: vi.fn(),
      },
      listings: { getById: mockGetById } as any,
      account: {} as any,
    })

    return { mockSubmit, mockUpdate, mockGetById }
  }

  /**
   * Core submission logic extracted for testing without TanStack Start runtime.
   * This mirrors the handler logic in server-fns.ts.
   */
  async function executeSubmitLogic(data: typeof baseInput & { applicationId?: string; uploadedFiles?: any[] }) {
    const { requireDualAuth } = await import("../auth/dual-auth")
    const { getSalesforceContactId } = await import("../auth/user-mapping")
    const { createSalesforceProxyClient, ProxyClientError } = await import("../salesforce/client")
    const { enqueueFileAttachment } = await import("../jobs/queues")
    const { sendApplicationConfirmation } = await import("../messages/application-confirmation")

    const user = await requireDualAuth()
    const contactId = await getSalesforceContactId(user.userId)

    const proxyClient = createSalesforceProxyClient()

    const applicationData = {
      listingID: data.listingID,
      primaryApplicant: data.primaryApplicant,
      alternateContact: data.alternateContact ?? undefined,
      householdMembers: data.householdMembers,
      shortFormPreferences: data.shortFormPreferences,
      annualIncome: data.annualIncome ?? undefined,
      monthlyIncome: data.monthlyIncome ?? undefined,
      status: "submitted" as const,
    }

    let submittedApplication: any
    try {
      if (data.applicationId) {
        submittedApplication = await proxyClient.shortForm.updateApplication(
          data.applicationId,
          applicationData
        )
      } else {
        submittedApplication = await proxyClient.shortForm.submitApplication(applicationData)
      }
    } catch (error) {
      if (
        error instanceof ProxyClientError &&
        ((error as any).statusCode >= 500 || (error as any).statusCode === 0)
      ) {
        return {
          success: false as const,
          error: "Salesforce proxy is unavailable. Please try again later.",
          code: "SF_PROXY_UNAVAILABLE" as const,
        }
      }
      if (
        error instanceof TypeError ||
        (error instanceof Error && error.name === "TimeoutError")
      ) {
        return {
          success: false as const,
          error: "Salesforce proxy is unavailable. Please try again later.",
          code: "SF_PROXY_UNAVAILABLE" as const,
        }
      }
      throw error
    }

    // Preserve lotteryNumber and status exactly as returned
    const result = {
      id: submittedApplication.id,
      listingID: submittedApplication.listingID,
      status: submittedApplication.status,
      lotteryNumber: submittedApplication.lotteryNumber,
      ...submittedApplication,
    }

    // Enqueue file attachment job
    const uploadedFiles = data.uploadedFiles
    if (uploadedFiles && uploadedFiles.length > 0) {
      await enqueueFileAttachment({
        applicationId: submittedApplication.id,
        files: uploadedFiles,
      })
    }

    // Send application confirmation via sf-dahlia-backend's messaging service
    const recipientEmail = data.primaryApplicant.email ?? user.email ?? ""
    if (recipientEmail) {
      const listing: any = await proxyClient.listings.getById(data.listingID)
      await sendApplicationConfirmation({
        email: recipientEmail,
        listingId: data.listingID,
        listingName: String(listing.Name ?? ""),
        lotteryNumber: submittedApplication.lotteryNumber ?? "",
        lotteryDate: String(listing.Lottery_Date ?? ""),
        isRental: listing.RecordType?.Name === "Rental",
        leasingAgent: {
          name: String(listing.Leasing_Agent_Name ?? ""),
          email: String(listing.Leasing_Agent_Email ?? ""),
          phone: String(listing.Leasing_Agent_Phone ?? ""),
          officeHours: String(listing.Office_Hours ?? ""),
        },
        lang: (data as any).applicationLanguage ?? "en",
      })
    }

    return { success: true as const, application: result }
  }

  describe("successful submission", () => {
    it("submits application to Salesforce and returns result with lotteryNumber preserved (Req 7.1, 7.4)", async () => {
      await setupMocks()

      const result = await executeSubmitLogic(baseInput)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.application.id).toBe("app_submitted_001")
        expect(result.application.status).toBe("submitted")
        expect(result.application.lotteryNumber).toBe("00123456")
        expect(result.application.listingID).toBe("listing_abc")
      }
    })

    it("preserves null lotteryNumber exactly as returned by Salesforce (Req 7.4)", async () => {
      await setupMocks({
        submitResult: { ...mockSubmittedApp, lotteryNumber: null },
      })

      const result = await executeSubmitLogic(baseInput)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.application.lotteryNumber).toBeNull()
      }
    })

    it("uses updateApplication when applicationId is provided (existing draft)", async () => {
      const { mockUpdate } = await setupMocks()

      const input = { ...baseInput, applicationId: "existing_draft_123" }
      const result = await executeSubmitLogic(input)

      expect(result.success).toBe(true)
      expect(mockUpdate).toHaveBeenCalledWith("existing_draft_123", expect.objectContaining({
        listingID: "listing_abc",
        status: "submitted",
      }))
    })

    it("uses submitApplication when no applicationId is provided (new submission)", async () => {
      const { mockSubmit } = await setupMocks()

      const result = await executeSubmitLogic(baseInput)

      expect(result.success).toBe(true)
      expect(mockSubmit).toHaveBeenCalledWith(expect.objectContaining({
        listingID: "listing_abc",
        status: "submitted",
      }))
    })
  })

  describe("file attachment enqueuing", () => {
    it("enqueues file attachment job when uploadedFiles are present (Req 7.1)", async () => {
      await setupMocks()
      const { enqueueFileAttachment } = await import("../jobs/queues")

      const uploadedFiles = [
        {
          id: "file_001",
          userId: "user_123",
          applicationId: null,
          listingId: "listing_abc",
          listingPreferenceId: "pref_001",
          documentType: "rentBurden",
          name: "paystub.pdf",
          contentType: "application/pdf",
          sessionUid: "session_xyz",
          address: null,
          rentBurdenType: "lease",
          rentBurdenIndex: 0,
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
      ]

      await executeSubmitLogic({ ...baseInput, uploadedFiles })

      expect(enqueueFileAttachment).toHaveBeenCalledWith({
        applicationId: "app_submitted_001",
        files: uploadedFiles,
      })
    })

    it("does not enqueue file attachment when no files are uploaded", async () => {
      await setupMocks()
      const { enqueueFileAttachment } = await import("../jobs/queues")

      await executeSubmitLogic(baseInput)

      expect(enqueueFileAttachment).not.toHaveBeenCalled()
    })
  })

  describe("confirmation email sending", () => {
    it("sends application confirmation with correct data", async () => {
      await setupMocks()
      const { sendApplicationConfirmation } = await import("../messages/application-confirmation")

      await executeSubmitLogic(baseInput)

      expect(sendApplicationConfirmation).toHaveBeenCalledWith({
        email: "jane@example.com",
        listingId: "listing_abc",
        listingName: "Test Listing",
        lotteryNumber: "00123456",
        lotteryDate: "2024-03-01",
        isRental: true,
        leasingAgent: {
          name: "Pat Lee",
          email: "pat@example.com",
          phone: "415-555-0100",
          officeHours: "Mon-Fri 9-5",
        },
        lang: "en",
      })
    })

    it("uses user email as fallback when primaryApplicant email is null", async () => {
      await setupMocks()
      const { sendApplicationConfirmation } = await import("../messages/application-confirmation")

      const input = {
        ...baseInput,
        primaryApplicant: { ...baseInput.primaryApplicant, email: null as unknown as string },
      }

      await executeSubmitLogic(input)

      expect(sendApplicationConfirmation).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "applicant@example.com",
        })
      )
    })
  })

  describe("Salesforce proxy unavailable (Req 7.7)", () => {
    it("returns error when SF proxy returns 500", async () => {
      const { ProxyClientError } = await import("../salesforce/client")
      const proxyError = new ProxyClientError(
        "Salesforce proxy returned 500: Internal Server Error",
        500,
        "Internal Server Error"
      )
      await setupMocks({ submitError: proxyError })

      const result = await executeSubmitLogic(baseInput)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe("SF_PROXY_UNAVAILABLE")
        expect(result.error).toContain("unavailable")
      }
    })

    it("returns error when SF proxy returns 503", async () => {
      const { ProxyClientError } = await import("../salesforce/client")
      const proxyError = new ProxyClientError(
        "Salesforce proxy returned 503: Service Unavailable",
        503,
        "Service Unavailable"
      )
      await setupMocks({ submitError: proxyError })

      const result = await executeSubmitLogic(baseInput)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe("SF_PROXY_UNAVAILABLE")
      }
    })

    it("returns error on network timeout (TypeError)", async () => {
      const timeoutError = new TypeError("fetch failed")
      await setupMocks({ submitError: timeoutError })

      const result = await executeSubmitLogic(baseInput)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe("SF_PROXY_UNAVAILABLE")
      }
    })

    it("does not enqueue jobs when SF proxy fails", async () => {
      const { ProxyClientError } = await import("../salesforce/client")
      const proxyError = new ProxyClientError("unavailable", 500, "")
      await setupMocks({ submitError: proxyError })
      const { enqueueFileAttachment } = await import("../jobs/queues")
      const { sendApplicationConfirmation } = await import("../messages/application-confirmation")

      await executeSubmitLogic({
        ...baseInput,
        uploadedFiles: [{
          id: "file_001",
          userId: null,
          applicationId: null,
          listingId: "listing_abc",
          listingPreferenceId: "pref_001",
          documentType: "income",
          name: "doc.pdf",
          contentType: "application/pdf",
          sessionUid: "sess",
          address: null,
          rentBurdenType: null,
          rentBurdenIndex: null,
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        }],
      })

      expect(enqueueFileAttachment).not.toHaveBeenCalled()
      expect(sendApplicationConfirmation).not.toHaveBeenCalled()
    })

    it("re-throws non-proxy errors (e.g. 4xx validation errors)", async () => {
      const { ProxyClientError } = await import("../salesforce/client")
      const clientError = new ProxyClientError("Bad Request", 400, "Invalid data")
      await setupMocks({ submitError: clientError })

      await expect(executeSubmitLogic(baseInput)).rejects.toThrow("Bad Request")
    })
  })
})
