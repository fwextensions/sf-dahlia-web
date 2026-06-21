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
 * every SSR render. This module is server-only — never import it from code that
 * runs in the browser (the token must not ship to the client).
 */
import { FLAGS, type FlagsStore } from "./store"

const CACHE_TTL_MS = 15_000

interface FrontendToggle {
  name: string
  enabled: boolean
}

let cache: { at: number; store: FlagsStore } | null = null

/**
 * Build the flags store by evaluating Unleash server-side. Cached for
 * CACHE_TTL_MS. On missing config or a failed/timed-out request, returns an
 * error store so consumers fall back to their per-call defaults (and the result
 * is briefly negative-cached to avoid hammering a down service).
 */
export async function buildFlagsStore(): Promise<FlagsStore> {
  const now = Date.now()
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.store

  const base = process.env.UNLEASH_URL
  const token = process.env.UNLEASH_TOKEN
  if (!base || !token) {
    const store: FlagsStore = { enabled: [], error: true }
    cache = { at: now, store }
    return store
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5_000)
    // UNLEASH_URL ends with a slash (".../api/"), so this resolves to
    // ".../api/frontend" — the same path the browser proxy client requests.
    const res = await fetch(`${base}frontend`, {
      headers: { Authorization: token },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout))

    if (!res.ok) throw new Error(`Unleash responded ${res.status}`)
    const data = (await res.json()) as { toggles?: FrontendToggle[] }
    const enabled = (data.toggles ?? []).filter((t) => t.enabled).map((t) => t.name)
    const store: FlagsStore = { enabled }
    cache = { at: now, store }
    return store
  } catch (err) {
    console.error("[flags] Unleash evaluation failed; falling back to defaults:", err)
    const store: FlagsStore = { enabled: [], error: true }
    cache = { at: now, store }
    return store
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
