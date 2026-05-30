/**
 * Tests for the email job processor.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type { Job } from "bullmq"

import type { EmailJob } from "../types"
import {
  processEmailJob,
  getSubjectForTemplate,
  buildEmailBody,
  setTransporter,
} from "./email"

describe("email processor", () => {
  const mockSendMail = vi.fn().mockResolvedValue({ messageId: "test-id" })
  const mockTransporter = { sendMail: mockSendMail } as any

  beforeEach(() => {
    setTransporter(mockTransporter)
    mockSendMail.mockClear()
  })

  afterEach(() => {
    setTransporter(null)
  })

  describe("getSubjectForTemplate", () => {
    it("returns English subject for application_confirmation", () => {
      expect(getSubjectForTemplate("application_confirmation", "en"))
        .toBe("Application Confirmation")
    })

    it("returns Spanish subject for draft_saved", () => {
      expect(getSubjectForTemplate("draft_saved", "es"))
        .toBe("Su borrador ha sido guardado")
    })

    it("returns Chinese subject for account_update", () => {
      expect(getSubjectForTemplate("account_update", "zh"))
        .toBe("账户更新")
    })

    it("returns Tagalog subject", () => {
      expect(getSubjectForTemplate("application_confirmation", "tl"))
        .toBe("Kumpirmasyon ng Aplikasyon")
    })

    it("falls back to English for unsupported locale", () => {
      expect(getSubjectForTemplate("draft_saved", "fr"))
        .toBe("Your Draft Has Been Saved")
    })
  })

  describe("buildEmailBody", () => {
    it("builds text and html body with data entries", () => {
      const result = buildEmailBody("application_confirmation", "en", {
        listingName: "123 Main St",
        lotteryNumber: "00123",
      })

      expect(result.text).toContain("Hello")
      expect(result.text).toContain("listingName: 123 Main St")
      expect(result.text).toContain("lotteryNumber: 00123")
      expect(result.html).toContain("<strong>listingName:</strong> 123 Main St")
    })

    it("uses locale-appropriate greeting", () => {
      const es = buildEmailBody("draft_saved", "es", {})
      expect(es.text).toContain("Hola")

      const zh = buildEmailBody("draft_saved", "zh", {})
      expect(zh.text).toContain("您好")

      const tl = buildEmailBody("draft_saved", "tl", {})
      expect(tl.text).toContain("Kumusta")
    })
  })

  describe("processEmailJob", () => {
    function makeJob(overrides: Partial<EmailJob> = {}): Job<EmailJob> {
      return {
        data: {
          template: "application_confirmation",
          recipient: "user@example.com",
          locale: "en",
          data: { listingName: "Test Listing" },
          ...overrides,
        },
      } as Job<EmailJob>
    }

    it("sends email to the correct recipient", async () => {
      await processEmailJob(makeJob({ recipient: "test@test.com" }))

      expect(mockSendMail).toHaveBeenCalledOnce()
      expect(mockSendMail.mock.calls[0][0].to).toBe("test@test.com")
    })

    it("uses the correct template subject", async () => {
      await processEmailJob(makeJob({ template: "draft_saved", locale: "es" }))

      expect(mockSendMail.mock.calls[0][0].subject)
        .toBe("Su borrador ha sido guardado")
    })

    it("supports all three templates", async () => {
      const templates: EmailJob["template"][] = [
        "application_confirmation",
        "draft_saved",
        "account_update",
      ]

      for (const template of templates) {
        mockSendMail.mockClear()
        await processEmailJob(makeJob({ template }))
        expect(mockSendMail).toHaveBeenCalledOnce()
      }
    })

    it("includes from address from env or default", async () => {
      await processEmailJob(makeJob())

      expect(mockSendMail.mock.calls[0][0].from)
        .toBe("noreply@housing.sfgov.org")
    })

    it("includes both text and html content", async () => {
      await processEmailJob(makeJob())

      const mailOptions = mockSendMail.mock.calls[0][0]
      expect(mailOptions.text).toBeTruthy()
      expect(mailOptions.html).toBeTruthy()
    })
  })
})
