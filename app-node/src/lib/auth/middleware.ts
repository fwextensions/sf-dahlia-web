/**
 * Clerk authentication middleware for TanStack Start server functions.
 *
 * Validates the JWT session on each request and injects the auth context
 * for downstream handlers to consume.
 */

import { createMiddleware } from "@tanstack/react-start"
import { getAuth } from "@clerk/tanstack-react-start/server"
import { getRequest } from "@tanstack/react-start/server"

export interface AuthContext {
  userId: string | null
  sessionId: string | null
}

/**
 * Server-side middleware that extracts Clerk auth state from the request.
 * Attaches userId and sessionId to the context for downstream use.
 *
 * This does NOT enforce authentication — use requireAuth() or optionalAuth()
 * helpers in route loaders/server functions for that.
 */
export const authMiddleware = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const request = getRequest()
    const auth = await getAuth(request)

    return next({
      context: {
        userId: auth.userId,
        sessionId: auth.sessionId,
      } satisfies AuthContext,
    })
  }
)
