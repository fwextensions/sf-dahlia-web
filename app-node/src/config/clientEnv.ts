/**
 * Client-side environment configuration.
 *
 * Exposes RAILS_API_BASE_URL (and any other client-safe env vars) to the browser
 * via a script tag injected during SSR. This avoids hydration mismatches because
 * the value is set before React hydrates.
 *
 * Usage in components:
 *   import { getClientEnv } from "~/config/clientEnv"
 *   const apiBase = getClientEnv().RAILS_API_BASE_URL
 */

export interface ClientEnv {
  RAILS_API_BASE_URL: string
}

declare global {
  interface Window {
    __DAHLIA_ENV__?: ClientEnv
  }
}

/**
 * Returns client environment variables.
 * On the server, reads from process.env.
 * On the client, reads from the window.__DAHLIA_ENV__ injected script.
 */
export function getClientEnv(): ClientEnv {
  if (typeof window !== "undefined" && window.__DAHLIA_ENV__) {
    return window.__DAHLIA_ENV__
  }

  // Server-side or fallback
  return {
    RAILS_API_BASE_URL: process.env.RAILS_API_BASE_URL || "http://localhost:3000",
  }
}

/**
 * Generates the inline script tag content that exposes client env to the browser.
 * This should be included in the SSR HTML <head> before React hydrates.
 */
export function getClientEnvScript(): string {
  const env: ClientEnv = {
    RAILS_API_BASE_URL: process.env.RAILS_API_BASE_URL || "http://localhost:3000",
  }
  return `window.__DAHLIA_ENV__=${JSON.stringify(env)};`
}
