/**
 * Server-side auth helpers for route loaders and server functions.
 *
 * - requireAuth(): Validates JWT, redirects to /sign-in if invalid/expired
 * - optionalAuth(): Returns user info or null without redirecting
 */

import { redirect } from "@tanstack/react-router"
import { getAuth } from "@clerk/tanstack-react-start/server"
import { getRequest } from "@tanstack/react-start/server"

export interface AuthUser {
  userId: string
  sessionId: string
}

/**
 * Verifies that the current request has a valid Clerk JWT session.
 * If no valid session exists or the JWT is expired, redirects to /sign-in
 * with the intended destination preserved as a `redirect_url` query parameter.
 *
 * Use in route `beforeLoad` or server function handlers to protect resources.
 *
 * @throws Redirect to /sign-in if session is invalid
 * @returns The authenticated user's userId and sessionId
 */
export async function requireAuth(): Promise<AuthUser> {
  const request = getRequest()
  const auth = await getAuth(request)

  if (!auth.userId) {
    const url = new URL(request.url)
    const currentPath = url.pathname + url.search

    throw redirect({
      to: "/sign-in",
      search: { redirect_url: currentPath },
      statusCode: 302,
    })
  }

  return {
    userId: auth.userId,
    sessionId: auth.sessionId!,
  }
}

/**
 * Attempts to resolve the current user's auth state without enforcing authentication.
 * Returns the user info if a valid session exists, or null otherwise.
 *
 * Use when a page/function should work for both authenticated and anonymous users.
 *
 * @returns The authenticated user or null
 */
export async function optionalAuth(): Promise<AuthUser | null> {
  const request = getRequest()
  const auth = await getAuth(request)

  if (!auth.userId) {
    return null
  }

  return {
    userId: auth.userId,
    sessionId: auth.sessionId!,
  }
}
