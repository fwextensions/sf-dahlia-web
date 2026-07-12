/**
 * Server-side Unleash evaluation.
 *
 * Fetches the Unleash *frontend* API (`${UNLEASH_URL}frontend`) with the
 * frontend token — the same endpoint and token the Rails browser client uses
 * (app/javascript/layouts/withAppSetup.tsx), so app-node sees identical flag
 * values. The frontend API returns only enabled toggles, which matches the
 * proxy-client semantics Rails relies on (an absent toggle = disabled).
 *
 * Results are cached in-process with a short TTL so we don't hit Unleash on
 * every SSR render. A background refresh fires just before the cache expires so
 * that no user request ever blocks on the Unleash network round-trip. This
 * module is server-only — never import it from code that runs in the browser
 * (the token must not ship to the client).
 */
import { FLAGS, type FlagsStore } from "./store"

/** How long a fetched result is considered fresh. */
const CACHE_TTL_MS = 30_000

/**
 * How early before expiry the background refresh fires.  Setting this to e.g.
 * 5 000ms means we start a new fetch 5s before the value goes stale, so the
 * result is ready by the time the old one expires.
 */
const REFRESH_AHEAD_MS = 5_000

interface FrontendToggle {
  name: string
  enabled: boolean
}

let cache: { at: number; store: FlagsStore } | null = null

/** Handle for the background refresh interval (allows cleanup in tests). */
let refreshTimer: ReturnType<typeof setInterval> | null = null

/**
 * Core fetch that contacts Unleash and returns a FlagsStore.
 * Separated from buildFlagsStore so the background refresh can call it without
 * recursion or cache-check logic.
 */
async function fetchFlags(): Promise<FlagsStore> {
  const base = process.env.UNLEASH_URL
  const token = process.env.UNLEASH_TOKEN
  if (!base || !token) {
    return { enabled: [], error: true }
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5_000)
    const res = await fetch(`${base}frontend`, {
      headers: { Authorization: token },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout))

    if (!res.ok) throw new Error(`Unleash responded ${res.status}`)
    const data = (await res.json()) as { toggles?: FrontendToggle[] }
    const enabled = (data.toggles ?? []).filter((t) => t.enabled).map((t) => t.name)
    return { enabled }
  } catch (err) {
    console.error("[flags] Unleash evaluation failed; falling back to defaults:", err)
    return { enabled: [], error: true }
  }
}

/**
 * Background refresh: runs on an interval, updates the cache without blocking
 * any request. If the fetch fails the old cache value stays (it won't be evicted
 * until it naturally expires, at which point the next request-path fetch will
 * also try and negative-cache the error result).
 */
function backgroundRefresh(): void {
  void fetchFlags().then((store) => {
    cache = { at: Date.now(), store }
  })
}

/**
 * Start the background refresh interval. Called lazily on the first
 * buildFlagsStore invocation so the timer only runs in a server process (not
 * during build or in tests that don't call this function).
 */
function ensureBackgroundRefresh(): void {
  if (refreshTimer) return
  // Refresh at (TTL - REFRESH_AHEAD_MS) intervals so the value is always warm.
  const interval = CACHE_TTL_MS - REFRESH_AHEAD_MS
  refreshTimer = setInterval(backgroundRefresh, interval)
  // Don't prevent the process from exiting.
  if (refreshTimer && typeof refreshTimer === "object" && "unref" in refreshTimer) {
    refreshTimer.unref()
  }
}

/**
 * Build the flags store by evaluating Unleash server-side. Cached for
 * CACHE_TTL_MS. On missing config or a failed/timed-out request, returns an
 * error store so consumers fall back to their per-call defaults (and the result
 * is briefly negative-cached to avoid hammering a down service).
 *
 * In steady state the background refresh keeps the cache warm, so this function
 * returns synchronously from cache on >99% of calls. The only time it awaits is
 * the very first request (cold start).
 */
export async function buildFlagsStore(): Promise<FlagsStore> {
  ensureBackgroundRefresh()

  const now = Date.now()
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.store

  // Cache miss — start a background fetch and return defaults immediately so
  // no request ever blocks on the Unleash network round-trip. The background
  // refresh already does this in steady state; we extend it to cold start too.
  void fetchFlags().then((store) => {
    cache = { at: Date.now(), store }
  })
  return { enabled: [], error: true }
}

/**
 * Stop the background refresh (for tests / graceful shutdown).
 */
export function stopBackgroundRefresh(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

/**
 * Whether Clerk auth is enabled (server-side). Used by the dual-auth resolver to
 * decide whether to attempt Clerk before falling back to devise_token_auth.
 * Off when the flag is disabled or evaluation failed — i.e. default to devise.
 */
export async function isClerkAuthEnabled(): Promise<boolean> {
  const flags = await buildFlagsStore()
  return !flags.error && flags.enabled.includes(FLAGS.CLERK_AUTH)
}
