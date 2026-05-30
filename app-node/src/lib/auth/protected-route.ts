/**
 * Protected route middleware for TanStack Router.
 *
 * Provides a reusable `beforeLoad` guard that enforces authentication
 * on route groups (e.g., account pages). When a session is missing or expired,
 * the user is redirected to /sign-in with the intended destination preserved.
 *
 * Validates: Requirements 5.2, 5.3, 5.8
 */

import { type ParsedLocation } from "@tanstack/react-router"
import { requireDualAuth } from "./dual-auth"

interface BeforeLoadContext {
  location: ParsedLocation
}

/**
 * A reusable `beforeLoad` guard for protected routes.
 *
 * When applied to a route's `beforeLoad` option, this function:
 * 1. Calls `requireDualAuth()` to validate the session (Clerk or devise)
 * 2. If no valid session exists, `requireDualAuth` throws a redirect to
 *    `/sign-in?redirect_url=<current_path>` preserving the intended destination
 * 3. After successful sign-in, Clerk's `fallbackRedirectUrl` on the sign-in page
 *    uses the preserved `redirect_url` to redirect back within 1 second
 *
 * Usage in route files:
 * ```ts
 * import { protectedRouteGuard } from '~/lib/auth/protected-route'
 *
 * export const Route = createFileRoute('/account')({
 *   beforeLoad: protectedRouteGuard,
 *   component: AccountPage,
 * })
 * ```
 *
 * @param context - The TanStack Router beforeLoad context containing location info
 * @returns The authenticated user object from dual-auth
 * @throws Redirect to /sign-in if session is missing or expired
 */
export async function protectedRouteGuard(_context: BeforeLoadContext) {
  const user = await requireDualAuth()
  return { user }
}
