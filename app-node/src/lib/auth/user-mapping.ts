/**
 * Clerk-to-Salesforce user mapping lookup.
 *
 * Queries the PostgreSQL `users` table (via Prisma) to resolve a Clerk user ID
 * to the corresponding Salesforce contact ID.
 *
 * Throws:
 * - UserMappingNotFoundError if no record exists for the given clerkUserId
 * - DatabaseConnectionError if PostgreSQL is unreachable
 */

import { prisma } from "../db"
import { UserMappingNotFoundError, DatabaseConnectionError } from "./errors"

/**
 * Resolves a Clerk user ID to the corresponding Salesforce contact ID.
 *
 * @param clerkUserId - The Clerk-issued user identifier
 * @returns The Salesforce contact ID string
 * @throws {UserMappingNotFoundError} No mapping record exists for the user
 * @throws {DatabaseConnectionError} PostgreSQL is unreachable
 */
export async function getSalesforceContactId(
  clerkUserId: string
): Promise<string> {
  let user: { salesforceContactId: string } | null

  try {
    user = await prisma.user.findUnique({
      where: { clerkUserId },
      select: { salesforceContactId: true },
    })
  } catch (error: unknown) {
    throw new DatabaseConnectionError(error)
  }

  if (!user) {
    throw new UserMappingNotFoundError(clerkUserId)
  }

  return user.salesforceContactId
}
