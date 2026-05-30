/**
 * Retry logic and error handling for the Salesforce proxy client.
 *
 * - Retries on 5xx or timeout/network errors with exponential backoff (1s, 2s, 4s)
 * - Up to 3 retry attempts (so up to 4 total calls including the initial attempt)
 * - Never retries 4xx errors; propagates immediately
 * - Falls back to cached data if all retries fail and cache exists
 * - Throws RetryExhaustedError if all retries fail and no cache available
 *
 * Requirements: 3.6, 3.7, 3.8, 3.10
 */

import { ProxyClientError } from "./client"
import type { CacheService } from "../cache/cache-service"

/** Default retry configuration */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries: number
  /** Base delay in milliseconds for exponential backoff (default: 1000) */
  baseDelayMs: number
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
}

/**
 * Error thrown when all retries are exhausted and no cached fallback is available.
 * Callers should render an error page with a retry button when they catch this.
 */
export class RetryExhaustedError extends Error {
  public readonly lastError: Error

  constructor(message: string, lastError: Error) {
    super(message)
    this.name = "RetryExhaustedError"
    this.lastError = lastError
  }
}

/**
 * Determines whether an error is retryable.
 * - 5xx ProxyClientErrors are retryable
 * - 4xx ProxyClientErrors are NOT retryable
 * - Timeout errors (AbortError, TimeoutError) are retryable
 * - Network errors (TypeError from fetch) are retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof ProxyClientError) {
    return error.statusCode >= 500
  }

  // AbortSignal.timeout() throws a DOMException with name "TimeoutError"
  // or an AbortError depending on the environment
  if (error instanceof Error) {
    const name = error.name
    if (name === "TimeoutError" || name === "AbortError") {
      return true
    }
    // Network errors from fetch appear as TypeError
    if (name === "TypeError") {
      return true
    }
  }

  return false
}

/**
 * Sleep utility that returns a promise resolving after the given milliseconds.
 * Accepts an injectable sleep function for testing.
 */
export type SleepFn = (ms: number) => Promise<void>

export const defaultSleep: SleepFn = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Wraps an async operation with retry logic and optional cache fallback.
 *
 * @param fn - The async function to execute (e.g., a proxy client call)
 * @param options - Configuration for retry behavior and cache fallback
 * @returns The result from fn, or cached fallback data if all retries fail
 * @throws ProxyClientError if a 4xx error occurs (never retried)
 * @throws RetryExhaustedError if all retries fail and no cache fallback is available
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: {
    config?: Partial<RetryConfig>
    cacheService?: CacheService
    cacheKey?: string
    sleep?: SleepFn
  }
): Promise<T> {
  const config = { ...DEFAULT_RETRY_CONFIG, ...options?.config }
  const sleep = options?.sleep ?? defaultSleep

  let lastError: Error | undefined
  const totalAttempts = 1 + config.maxRetries // initial + retries

  for (let attempt = 0; attempt < totalAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))

      // 4xx errors: never retry, propagate immediately
      if (!isRetryableError(err)) {
        throw err
      }

      lastError = err

      // If we have more attempts left, wait with exponential backoff
      if (attempt < totalAttempts - 1) {
        const delayMs = config.baseDelayMs * Math.pow(2, attempt)
        await sleep(delayMs)
      }
    }
  }

  // All retries exhausted — try cache fallback
  if (options?.cacheService && options?.cacheKey) {
    const cached = await options.cacheService.get<T>(options.cacheKey)
    if (cached !== null) {
      return cached
    }
    // Also try the stale copy
    const staleKey = `stale:${options.cacheKey}`
    const stale = await options.cacheService.get<T>(staleKey)
    if (stale !== null) {
      return stale
    }
  }

  // No cache available — throw RetryExhaustedError
  throw new RetryExhaustedError(
    `All ${config.maxRetries} retry attempts failed for proxy request`,
    lastError!
  )
}
