/**
 * Client-side auth error handler hook.
 *
 * Detects 401 responses from server function calls (indicating an expired JWT)
 * and redirects the user to the sign-in page, discarding unsaved in-memory state.
 *
 * Validates: Requirements 5.8
 */

/**
 * Error class representing an authentication failure from a server function call.
 * This indicates the JWT has expired while the user was actively using the application.
 */
export class AuthenticationError extends Error {
  public readonly statusCode = 401

  constructor(message = "Authentication session expired") {
    super(message)
    this.name = "AuthenticationError"
  }
}

/**
 * Checks if an error is an authentication error (401 response from server functions).
 * Works with both AuthenticationError instances and generic errors with status/statusCode.
 */
export function isAuthError(error: unknown): boolean {
  if (error instanceof AuthenticationError) {
    return true
  }

  if (error && typeof error === "object") {
    const err = error as Record<string, unknown>
    return err.statusCode === 401 || err.status === 401
  }

  return false
}

/**
 * Redirects the user to the sign-in page with the current URL preserved
 * as the redirect destination. This performs a full page navigation which
 * discards all in-memory state (React component state, query cache, etc.)
 * without modifying any persisted data.
 *
 * This should be called when a server function returns a 401, indicating
 * the JWT has expired during the user's active session.
 */
export function redirectToSignIn(): void {
  if (typeof window === "undefined") return

  const currentPath = window.location.pathname + window.location.search
  const signInUrl = `/sign-in?redirect_url=${encodeURIComponent(currentPath)}`

  // Full page navigation discards all in-memory state
  window.location.href = signInUrl
}

/**
 * Handles an error from a server function call.
 * If the error is an auth error (401), redirects to sign-in.
 * Otherwise, re-throws the error for normal error handling.
 *
 * Usage:
 * ```ts
 * try {
 *   const data = await myServerFunction()
 * } catch (error) {
 *   handleAuthError(error) // redirects if 401, re-throws otherwise
 * }
 * ```
 *
 * @param error - The error from a server function call
 * @throws The original error if it's not an auth error
 */
export function handleAuthError(error: unknown): never {
  if (isAuthError(error)) {
    redirectToSignIn()
    // Throw to halt execution while redirect is processing
    throw new Error("Redirecting to sign-in due to expired session")
  }

  throw error
}
