/**
 * Server functions for account pages (Phase 3).
 *
 * These use createServerFn to keep data fetching on the server.
 * They integrate:
 * - requireDualAuth() for authentication (Clerk + devise)
 * - getSalesforceContactId() for user → SF contact resolution
 * - SalesforceProxyClient for account data fetching/updates
 *
 * Requirements: 5.5, 5.6, 10.4
 */

import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

// ============================================================
// Types
// ============================================================

export interface SerializableApplication {
  id: string
  listingID: string
  status: "draft" | "submitted" | "removed"
  applicationLanguage: string
  lotteryNumber: string | null
  listingName?: string
  applicationDueDate?: string | null
  [key: string]: string | number | boolean | null | undefined
}

export interface SerializableContact {
  id: string
  firstName: string
  lastName: string
  email: string
  [key: string]: string | number | boolean | null | undefined
}

export interface AccountProfile {
  email: string
  salesforceContactId: string
  provider: "clerk" | "devise"
}

// ============================================================
// Input validation schemas
// ============================================================

const updateProfileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  DOB: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
})

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>

// ============================================================
// Helper: resolve auth + SF contact ID
// ============================================================

async function resolveAuthenticatedContact() {
  const { requireDualAuth } = await import("../auth/dual-auth")
  const { getSalesforceContactId } = await import("../auth/user-mapping")

  const user = await requireDualAuth()

  // For devise users, the userId is prefixed with "devise:" and the email is used
  // For Clerk users, resolve from the mapping table
  let contactId: string
  if (user.provider === "devise") {
    // Devise users: look up by email from the mapping table
    // The userId for devise is "devise:<email>"
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
// Server Function: getMyApplications
// ============================================================

/**
 * Fetches the authenticated user's applications from Salesforce.
 * Calls requireDualAuth(), resolves SF contact ID, then fetches applications.
 */
export const getMyApplications = createServerFn({ method: "GET" })
  .handler(async (): Promise<SerializableApplication[]> => {
    const { contactId } = await resolveAuthenticatedContact()

    const { createSalesforceProxyClient } = await import(
      "../salesforce/client"
    )
    const proxyClient = createSalesforceProxyClient()

    const applications = await proxyClient.account.getApplications(contactId)

    return applications as unknown as SerializableApplication[]
  })

// ============================================================
// Server Function: updateProfile
// ============================================================

/**
 * Updates the authenticated user's contact profile in Salesforce.
 * Validates input with Zod, authenticates, resolves SF contact, then updates.
 */
export const updateProfile = createServerFn({ method: "POST" })
  .inputValidator((data: UpdateProfileInput) => updateProfileSchema.parse(data))
  .handler(async ({ data }): Promise<SerializableContact> => {
    const { contactId } = await resolveAuthenticatedContact()

    const { createSalesforceProxyClient } = await import(
      "../salesforce/client"
    )
    const proxyClient = createSalesforceProxyClient()

    const contact = await proxyClient.account.updateContact({
      contactId,
      ...data,
    })

    return contact as unknown as SerializableContact
  })

// ============================================================
// Server Function: getAccountProfile
// ============================================================

/**
 * Returns the authenticated user's basic profile info.
 * Used by MyAccount page to display user details.
 */
export const getAccountProfile = createServerFn({ method: "GET" })
  .handler(async (): Promise<AccountProfile> => {
    const { user, contactId } = await resolveAuthenticatedContact()

    return {
      email: user.email ?? "",
      salesforceContactId: contactId,
      provider: user.provider,
    }
  })
