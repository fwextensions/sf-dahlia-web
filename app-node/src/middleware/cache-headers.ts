/**
 * Cache-control header middleware for static assets and HTML pages.
 *
 * - Fingerprinted assets (JS, CSS, images in /assets/ or with content hash):
 *   Cache-Control: public, max-age=31536000, immutable
 *
 * - HTML page responses (non-asset routes):
 *   Cache-Control: no-cache
 */

/** Pattern matching fingerprinted asset paths (Vite outputs to /assets/ with hash) */
const FINGERPRINTED_ASSET_PATTERN =
  /^\/assets\/.*\.[a-f0-9]{8,}\.\w+$|^\/_build\/assets\//

/** Common static file extensions that Vite fingerprints */
const STATIC_ASSET_EXTENSIONS = /\.(js|css|woff2?|ttf|eot|svg|png|jpe?g|gif|webp|avif|ico)$/

/**
 * Determines if a request URL path is a fingerprinted static asset.
 */
export function isFingerprintedAsset(pathname: string): boolean {
  // Assets served from /assets/ directory with a content hash in the filename
  if (FINGERPRINTED_ASSET_PATTERN.test(pathname)) {
    return true
  }

  // Files with a hash pattern in their name (e.g., main.a1b2c3d4.js)
  if (STATIC_ASSET_EXTENSIONS.test(pathname) && /\.[a-f0-9]{8,}\./.test(pathname)) {
    return true
  }

  return false
}

/**
 * Returns the appropriate Cache-Control header value for a given request path.
 */
export function getCacheControlHeader(pathname: string): string {
  if (isFingerprintedAsset(pathname)) {
    return "public, max-age=31536000, immutable"
  }

  // HTML pages and other non-asset responses
  return "no-cache"
}

/**
 * Applies cache-control headers to a Response based on the request URL.
 */
export function applyCacheHeaders(request: Request, response: Response): Response {
  const url = new URL(request.url)
  const cacheControl = getCacheControlHeader(url.pathname)

  // Clone response to make headers mutable
  const newResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: new Headers(response.headers),
  })

  newResponse.headers.set("Cache-Control", cacheControl)
  return newResponse
}
