/**
 * Proxy authentication failure logging utility.
 *
 * Logs authentication failures from Rails proxy rejections (401 responses)
 * without exposing sensitive details like API key values. Returns generic
 * error messages to clients without revealing proxy infrastructure.
 *
 * Validates: Requirements 12.4, 12.8, 11.3
 */

export interface ProxyAuthFailureContext {
  /** The endpoint path that was requested */
  endpoint: string
  /** HTTP status code returned by the proxy */
  statusCode: number
  /** Optional HTTP method */
  method?: string
}

export interface ProxyAuthFailureLogEntry {
  level: "error"
  event: "proxy_auth_failure"
  endpoint: string
  statusCode: number
  method: string
  timestamp: string
}

/**
 * The generic error message returned to clients when proxy auth fails.
 * This intentionally does NOT reveal that a proxy infrastructure exists.
 */
export const GENERIC_PROXY_ERROR_MESSAGE = "An error occurred while processing your request. Please try again later."

/**
 * Logs a proxy authentication failure with relevant context.
 * Does NOT include the API key value in log output.
 */
export function logProxyAuthFailure(
  context: ProxyAuthFailureContext,
  logger: Pick<Console, "error"> = console
): ProxyAuthFailureLogEntry {
  const entry: ProxyAuthFailureLogEntry = {
    level: "error",
    event: "proxy_auth_failure",
    endpoint: context.endpoint,
    statusCode: context.statusCode,
    method: context.method ?? "GET",
    timestamp: new Date().toISOString(),
  }

  logger.error(JSON.stringify(entry))

  return entry
}

/**
 * Determines if a proxy error is an authentication rejection (401).
 */
export function isProxyAuthRejection(statusCode: number): boolean {
  return statusCode === 401
}

/**
 * Creates a generic error that is safe to return to the client.
 * Hides all proxy infrastructure details.
 */
export function createGenericProxyError(): Error {
  return new Error(GENERIC_PROXY_ERROR_MESSAGE)
}
