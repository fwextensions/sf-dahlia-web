/**
 * Shared singleton Redis client for the listing server functions.
 *
 * Why a singleton (and why this matters for the cache actually working):
 * the previous code created a fresh client per server-fn call with
 * `lazyConnect: true` + `enableOfflineQueue: false` and issued the cache READ
 * before awaiting `connect()`. The read therefore fired on a not-yet-writeable
 * socket and threw "Stream isn't writeable…", which cache-service swallowed as a
 * miss — so the cache only ever WROTE, never served a hit (writes happen after
 * the slow Salesforce fetch, by which time the socket is up). Net: zero speedup.
 *
 * A connected singleton fixes that — callers `await ready` once, then reads hit a
 * live connection — and removes the per-request connect/quit churn.
 *
 * Fail-fast philosophy preserved: short connect timeout, no auto-reconnect, and
 * offline queue off, so a down Redis never blocks the request path — reads just
 * miss and fall through to Salesforce. If Redis is started after the app, restart
 * the app to pick it up (no per-request reconnect by design).
 */
import Redis from "ioredis"
import { env } from "../../config/env"

let client: Redis | null = null
let ready: Promise<boolean> | null = null

export function getRedis(): { client: Redis; ready: Promise<boolean> } {
  if (!client) {
    client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      connectTimeout: 500,
      retryStrategy: () => null,
      enableOfflineQueue: false,
      lazyConnect: true,
    })
    // Swallow errors — a down Redis must not crash the process; reads just miss.
    client.on("error", () => {})
    // Connect once. Resolve to whether it succeeded so callers can await the
    // connection settling (success → reads hit; failure → client is "end" and
    // commands reject immediately = fast miss) before issuing commands.
    ready = client
      .connect()
      .then(() => true)
      .catch(() => false)
  }
  return { client, ready: ready as Promise<boolean> }
}
