/**
 * API Proxy Middleware
 *
 * During migration, non-migrated /api/v1/* requests are transparently proxied
 * to the Rails app. The proxy list is configurable so that as new migration
 * phases are deployed, paths are removed without requiring a Rails restart.
 *
 * Migrated paths are handled directly by TanStack Start server functions.
 * Only paths matching the proxy patterns are forwarded to Rails.
 */

import { env } from "../config/env"

/**
 * Patterns for paths that should be proxied to Rails.
 * As migration progresses, remove patterns from this list.
 * Supports exact path prefixes — any request starting with one of these
 * will be forwarded to the Rails proxy.
 *
 * This list can be updated and deployed without restarting Rails.
 */
let proxiedPathPrefixes: string[] = [
  "/api/v1/",
]

/**
 * Update the list of proxied path prefixes at runtime.
 * Enables deploying new migration phases without restart.
 */
export function setProxiedPaths(prefixes: string[]): void {
  proxiedPathPrefixes = prefixes
}

/**
 * Get the current list of proxied path prefixes.
 */
export function getProxiedPaths(): string[] {
  return [...proxiedPathPrefixes]
}

/**
 * Paths that have been migrated to Node server functions and should NOT
 * be proxied, even if they match a proxy prefix. Add paths here as they
 * are migrated. Supports exact matches and prefix matches (ending with *).
 */
let migratedPaths: string[] = []

/**
 * Update the list of migrated paths at runtime.
 */
export function setMigratedPaths(paths: string[]): void {
  migratedPaths = paths
}

/**
 * Get the current list of migrated paths.
 */
export function getMigratedPaths(): string[] {
  return [...migratedPaths]
}

/**
 * Check if a request path should be proxied to Rails.
 */
export function shouldProxy(pathname: string): boolean {
  // Check if the path matches any proxied prefix
  const matchesProxy = proxiedPathPrefixes.some((prefix) =>
    pathname.startsWith(prefix)
  )
  if (!matchesProxy) return false

  // Check if the path has been migrated (should be handled by Node)
  const isMigrated = migratedPaths.some((migrated) => {
    if (migrated.endsWith("*")) {
      return pathname.startsWith(migrated.slice(0, -1))
    }
    return pathname === migrated
  })

  return !isMigrated
}

/**
 * Proxy a request to the Rails app.
 * Forwards method, headers, and body. Adds the internal API key header.
 * Returns the Rails response to the client.
 */
export async function proxyToRails(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const targetUrl = `${env.RAILS_API_BASE_URL}${url.pathname}${url.search}`

  // Build headers — forward original headers but override/add internal auth
  const headers = new Headers(request.headers)
  headers.set("X-Internal-Api-Key", env.INTERNAL_API_KEY)
  // Remove host header to avoid conflicts with the target server
  headers.delete("host")

  const init: RequestInit = {
    method: request.method,
    headers,
    signal: AbortSignal.timeout(30_000),
  }

  // Forward body for methods that support it
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body
    // @ts-expect-error duplex is required for streaming body in Node.js fetch
    init.duplex = "half"
  }

  try {
    const response = await fetch(targetUrl, init)

    // Return the Rails response as-is (status, headers, body)
    const responseHeaders = new Headers(response.headers)
    // Remove transfer-encoding as we may re-encode
    responseHeaders.delete("transfer-encoding")

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    })
  } catch (error) {
    // Network error or timeout
    if (error instanceof Error && error.name === "TimeoutError") {
      return new Response(
        JSON.stringify({ error: "Proxy timeout — Rails service unavailable" }),
        {
          status: 504,
          headers: { "Content-Type": "application/json" },
        }
      )
    }

    return new Response(
      JSON.stringify({ error: "Proxy error — Rails service unavailable" }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }
    )
  }
}

/**
 * Middleware handler: if the request should be proxied, forward it to Rails.
 * Returns a Response if proxied, or null if the request should be handled locally.
 */
export function handleApiProxy(request: Request): Promise<Response> | null {
  const url = new URL(request.url)

  if (shouldProxy(url.pathname)) {
    return proxyToRails(request)
  }

  return null
}
