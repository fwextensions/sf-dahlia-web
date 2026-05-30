/**
 * Custom error types for the auth/user-mapping layer.
 */

/**
 * Thrown when no mapping record exists in the PostgreSQL `users` table
 * for the given Clerk user ID.
 */
export class UserMappingNotFoundError extends Error {
  public readonly clerkUserId: string

  constructor(clerkUserId: string) {
    super(
      `No Salesforce contact mapping found for Clerk user: ${clerkUserId}`
    )
    this.name = "UserMappingNotFoundError"
    this.clerkUserId = clerkUserId
  }
}

/**
 * Thrown when the PostgreSQL database is unreachable during a
 * user mapping lookup.
 */
export class DatabaseConnectionError extends Error {
  public readonly cause: unknown

  constructor(cause: unknown) {
    super("Unable to connect to the database for user mapping lookup")
    this.name = "DatabaseConnectionError"
    this.cause = cause
  }
}
