/**
 * Compatibility shim for @clerk/tanstack-react-start@0.14.0
 *
 * This version of Clerk expects `getEvent` from `@tanstack/react-start/server`,
 * which was removed in TanStack Start 1.120+. This shim provides a compatible
 * implementation that reads env vars from process.env.
 *
 * Re-exports everything from the real module plus the missing `getEvent`.
 */

// Re-export everything from the actual @tanstack/react-start-server package
// (which is what @tanstack/react-start/server re-exports internally)
export * from "@tanstack/react-start-server"

/**
 * Shim for the removed getEvent() function.
 * Returns an event-like object with a context that provides env variable access.
 */
export function getEvent() {
  return {
    context: new Proxy(
      {},
      {
        get(_target, prop: string) {
          return process.env[prop]
        },
      }
    ),
  }
}
