/**
 * Redis connection configuration for BullMQ.
 * Handles connection loss with built-in retry and backoff.
 */
import type { RedisOptions } from "ioredis"

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379"

/**
 * Parse REDIS_URL into connection options for BullMQ.
 * BullMQ uses ioredis under the hood, which supports exponential backoff
 * on connection loss automatically via retryStrategy.
 */
export function getConnectionOptions(): RedisOptions {
  const url = new URL(REDIS_URL)

  return {
    host: url.hostname,
    port: Number(url.port) || 6379,
    password: url.password || undefined,
    username: url.username || undefined,
    maxRetriesPerRequest: null, // Required by BullMQ
    retryStrategy(times: number) {
      // Stop retrying after 5 attempts in development to avoid log spam
      if (process.env.NODE_ENV !== "production" && times > 5) return null
      // Exponential backoff: min 1s, max 30s
      const delay = Math.min(Math.pow(2, times) * 1000, 30_000)
      console.warn(
        `[jobs] Redis connection attempt ${times} failed. Retrying in ${delay}ms...`
      )
      return delay
    },
  }
}
