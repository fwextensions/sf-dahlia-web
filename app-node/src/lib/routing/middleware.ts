/**
 * Server middleware for redirect rule evaluation.
 *
 * This middleware runs on ALL incoming requests and checks whether
 * a redirect rule applies before the router resolves the route.
 * This ensures redirects fire even for URLs that would otherwise 404.
 */

import { createMiddleware } from "@tanstack/react-start"
import { evaluateRedirects } from "./redirects"

/**
 * Redirect evaluation middleware.
 * Evaluates redirect rules for all incoming URLs.
 * If a redirect rule matches, sends a 301 redirect response.
 */
export const redirectMiddleware = createMiddleware().server(
  async ({ next, request }) => {
    const url = new URL(request.url)
    const result = await evaluateRedirects(url.pathname)

    if (result.redirect) {
      // Issue a 301 redirect
      throw new Response(null, {
        status: 301,
        headers: {
          Location: result.destination,
        },
      })
    }

    return next()
  }
)
