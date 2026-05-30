/**
 * Dual-auth support for Phase 3 migration period.
 *
 * During the migration from devise_token_auth to Clerk, some users may still
 * present devise tokens while others have migrated to Clerk. This module
 * accepts both authentication methods and returns a unified AuthUser object.
 *
 * Token resolution order:
 * 1. Check for Clerk JWT (Authorization: Bearer header or Clerk session cookie)
 * 2. If no Clerk token, check for devise_token_auth headers (access-token, uid, client)
 *
 * Validates: Requirements 12.5
 */

import { getAuth } from "@clerk/tanstack-react-start/server"
import { redirect } from "@tanstack/react-router"
import { getRequest } from "@tanstack/react-start/server"

export interface DualAuthUser {
  userId: string
  sessionId: string
  provider: "clerk" | "devise"
  email?: string
}

export interface DeviseHeaders {
  accessToken: string
  uid: string
  client: string
}

/**
 * Extract devise_token_auth headers from a request.
 * Returns the headers if all three are present, or null otherwise.
 */
export function extractDeviseHeaders(
  request: Request
): DeviseHeaders | null {
  const accessToken = request.headers.get("access-token")
  const uid = request.headers.get("uid")
  const client = request.headers.get("client")

  if (accessToken && uid && client) {
    return { accessToken, uid, client }
  }

  return null
}

/**
 * Validate devise_token_auth credentials against the Rails API.
 * Makes a GET request to the Rails validate_token endpoint with the devise headers.
 *
 * @returns true if the Rails API returns 200, false otherwise
 */
export async function validateDeviseToken(
  deviseHeaders: DeviseHeaders,
  railsApiBaseUrl: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `${railsApiBaseUrl}/api/v1/auth/validate_token`,
      {
        method: "GET",
        headers: {
          "access-token": deviseHeaders.accessToken,
          uid: deviseHeaders.uid,
          client: deviseHeaders.client,
        },
      }
    )

    return response.status === 200
  } catch {
    return false
  }
}

/**
 * Attempt Clerk authentication on the given request.
 * Returns a DualAuthUser if a valid Clerk session exists, or null.
 */
async function tryClerkAuth(request: Request): Promise<DualAuthUser | null> {
  const auth = await getAuth(request)

  if (auth.userId) {
    return {
      userId: auth.userId,
      sessionId: auth.sessionId!,
      provider: "clerk",
    }
  }

  return null
}

/**
 * Attempt devise_token_auth authentication on the given request.
 * Checks for devise headers and validates them against the Rails API.
 *
 * @param request - The incoming request
 * @param railsApiBaseUrl - Base URL of the Rails API (e.g., from RAILS_API_BASE_URL env var)
 * @returns A DualAuthUser if devise headers are valid, or null
 */
async function tryDeviseAuth(
  request: Request,
  railsApiBaseUrl: string
): Promise<DualAuthUser | null> {
  const deviseHeaders = extractDeviseHeaders(request)

  if (!deviseHeaders) {
    return null
  }

  const isValid = await validateDeviseToken(deviseHeaders, railsApiBaseUrl)

  if (isValid) {
    return {
      userId: `devise:${deviseHeaders.uid}`,
      sessionId: `devise:${deviseHeaders.client}`,
      provider: "devise",
      email: deviseHeaders.uid,
    }
  }

  return null
}

/**
 * Get the Rails API base URL from the environment.
 */
function getRailsApiBaseUrl(): string {
  const url = process.env.RAILS_API_BASE_URL
  if (!url) {
    throw new Error(
      "RAILS_API_BASE_URL environment variable is required for dual-auth support"
    )
  }
  return url
}

/**
 * Dual-auth version of requireAuth().
 *
 * Accepts both Clerk JWTs and devise_token_auth tokens during the migration period.
 * Checks Clerk first, then falls back to devise token validation.
 *
 * If neither authentication method succeeds, redirects to /sign-in
 * with the intended destination preserved.
 *
 * @throws Redirect to /sign-in if no valid session exists
 * @returns The authenticated user with provider information
 */
export async function requireDualAuth(): Promise<DualAuthUser> {
  const request = getRequest()
  const railsApiBaseUrl = getRailsApiBaseUrl()

  // Try Clerk first
  const clerkUser = await tryClerkAuth(request)
  if (clerkUser) {
    return clerkUser
  }

  // Fall back to devise token validation
  const deviseUser = await tryDeviseAuth(request, railsApiBaseUrl)
  if (deviseUser) {
    return deviseUser
  }

  // Neither auth method succeeded — redirect to sign-in
  const url = new URL(request.url)
  const currentPath = url.pathname + url.search

  throw redirect({
    to: "/sign-in",
    search: { redirect_url: currentPath },
    statusCode: 302,
  })
}

/**
 * Dual-auth version of optionalAuth().
 *
 * Attempts to authenticate via Clerk first, then devise tokens.
 * Returns the user info if either method succeeds, or null otherwise.
 *
 * @returns The authenticated user or null
 */
export async function optionalDualAuth(): Promise<DualAuthUser | null> {
  const request = getRequest()
  const railsApiBaseUrl = getRailsApiBaseUrl()

  // Try Clerk first
  const clerkUser = await tryClerkAuth(request)
  if (clerkUser) {
    return clerkUser
  }

  // Fall back to devise token validation
  return tryDeviseAuth(request, railsApiBaseUrl)
}
