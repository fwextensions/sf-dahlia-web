import {
  createStartHandler,
  defaultStreamHandler,
} from "@tanstack/react-start/server"
import { applyCacheHeaders } from "./middleware/cache-headers"
import { handleApiProxy } from "./middleware/api-proxy"
import { applyRateLimit } from "./lib/security/rate-limiter"

/**
 * Server entry point.
 *
 * Clerk authentication is handled per-request via getAuth() in server functions
 * and route loaders (see src/lib/auth/). The ClerkProvider in __root.tsx provides
 * client-side auth state for React components.
 */
const handler = createStartHandler(defaultStreamHandler)

export default {
  async fetch(request: Request) {
    // Rate limit auth endpoints before processing
    const rateLimitResponse = applyRateLimit(request)
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    // Proxy non-migrated /api/v1/* requests to Rails
    const proxyResponse = handleApiProxy(request)
    if (proxyResponse) {
      return proxyResponse
    }

    const response = await handler(request)
    return applyCacheHeaders(request, response)
  },
}
