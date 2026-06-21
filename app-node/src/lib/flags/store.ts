/**
 * Server-serializable feature-flag store.
 *
 * Mirrors the i18n store (../i18n/store.ts): the server evaluates Unleash flags
 * once per request, serializes the result into the SSR HTML, and the client
 * reads it synchronously at hydrate. Components then resolve flags through the
 * same synchronous `getFlag` on both server and client, so a flag-gated section
 * renders identically during SSR and hydration (no flash, no hydration
 * mismatch) without the browser ever contacting Unleash.
 *
 * Why not the @unleash/proxy-client-react FlagProvider the Rails app uses? That
 * client evaluates flags in the browser *after* mount, so SSR can't know the
 * value and gated content pops in post-hydration. Evaluating server-side and
 * serializing fits app-node's SSR-first design.
 */

/** Canonical flag names. Keep in sync with Rails' UNLEASH_FLAG + string literals. */
export const FLAGS = {
  /** Show the "For the Buyer's Agent" realtor-commission section. */
  REALTOR_SECTION: "temp.webapp.listingDetail.realtorSection",
  /** Show the listing neighborhood (Google Maps) section. */
  NEIGHBORHOOD_HEADER: "temp.webapp.listings.neighborhoodHeader",
  /** Route the apply flow through the new form engine. */
  FORM_ENGINE: "perm.webapp.formEngine",
  /** Show the DALP block in the for-sale directory header. */
  DIRECTORY_DALP: "temp.webapp.directory.dalp",
  /** Use the new account layout (drives /account redirects). */
  NEW_ACCOUNT_LAYOUT: "temp.webapp.newAccountLayout",
  /** Use Clerk for auth; when off, fall back to devise_token_auth (Rails). */
  CLERK_AUTH: "temp.webapp.auth.clerk",
} as const

export interface FlagsStore {
  /** Names of toggles Unleash reported as enabled for this request. */
  enabled: string[]
  /**
   * Set when the upstream evaluation failed (network/config). Consumers then
   * fall back to the per-call default rather than treating every flag as off —
   * matching Rails' useFeatureFlag, which returns its default on flagsError.
   */
  error?: boolean
}

declare global {
  interface Window {
    __DAHLIA_FLAGS__?: FlagsStore
  }
}

// Module-scoped active store, like the i18n active-instance ref. Fine for the
// current single-render SSR path; concurrent SSR needs request-scoping
// (AsyncLocalStorage) — see the i18n store's matching note.
let activeStore: FlagsStore | null = null

/** Register the store for synchronous lookups. Called server-side in beforeLoad
 *  and client-side at hydrate. */
export function initFlagsFromStore(store: FlagsStore): void {
  activeStore = store
}

/**
 * Resolve a flag synchronously. Reads the active store (set in beforeLoad on the
 * server, at hydrate on the client); falls back to `window.__DAHLIA_FLAGS__` if
 * the module var hasn't been initialized yet. Returns `defaultValue` when no
 * store is available or the upstream evaluation errored.
 */
export function getFlag(name: string, defaultValue = false): boolean {
  const store =
    activeStore ?? (typeof window !== "undefined" ? window.__DAHLIA_FLAGS__ ?? null : null)
  if (!store || store.error) return defaultValue
  return store.enabled.includes(name)
}

/** Inline script that exposes the store on `window` before hydration. */
export function serializeFlagsStore(store: FlagsStore): string {
  return `window.__DAHLIA_FLAGS__=${JSON.stringify(store).replace(/</g, "\\u003c")};`
}
