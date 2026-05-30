/**
 * Authentication helpers for Clerk + TanStack Start.
 *
 * - requireAuth(): Throws a redirect to /sign-in if no valid session exists.
 *   Preserves the intended destination URL as a `redirect_url` query parameter.
 * - optionalAuth(): Returns the authenticated user or null (no redirect).
 * - getSalesforceContactId(clerkUserId): Resolves a Clerk user to their
 *   Salesforce contact ID via the PostgreSQL mapping table.
 * - UserMappingNotFoundError / DatabaseConnectionError: Error types thrown
 *   by getSalesforceContactId when the mapping is missing or DB is unreachable.
 */

export { requireAuth, optionalAuth } from "./helpers"
export { authMiddleware } from "./middleware"
export {
  requireDualAuth,
  optionalDualAuth,
  extractDeviseHeaders,
  validateDeviseToken,
} from "./dual-auth"
export type { DualAuthUser, DeviseHeaders } from "./dual-auth"
export { getSalesforceContactId } from "./user-mapping"
export {
  UserMappingNotFoundError,
  DatabaseConnectionError,
} from "./errors"
export { protectedRouteGuard } from "./protected-route"
export {
  AuthenticationError,
  isAuthError,
  redirectToSignIn,
  handleAuthError,
} from "./use-auth-error-handler"
