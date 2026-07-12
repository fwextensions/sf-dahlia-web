/**
 * Production Node server for the built TanStack Start app.
 *
 * `vite build` emits a Web-standard `fetch` handler at dist/server/server.js
 * (see src/server.ts) plus static client assets in dist/client. It does NOT
 * emit a listener — in the documented Nitro hosting path Nitro would wrap the
 * handler and serve the client dir. This adapter does the same with zero extra
 * dependencies: serve dist/client statically, fall through to the fetch handler
 * for everything else (SSR + server functions + the Rails API proxy).
 *
 *   npm run build && npm start
 */
import { createServer } from "node:http"
import { Readable } from "node:stream"
import { stat, open } from "node:fs/promises"
import { createReadStream } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const clientDir = path.join(__dirname, "dist", "client")

// Prefix every log line with an ISO timestamp so log output is debuggable.
const _log = console.log.bind(console)
const _error = console.error.bind(console)
const _warn = console.warn.bind(console)
const stamp = () => new Date().toISOString()
console.log = (...args) => _log(stamp(), ...args)
console.error = (...args) => _error(stamp(), ...args)
console.warn = (...args) => _warn(stamp(), ...args)

const { default: handler } = await import("./dist/server/server.js")

const PORT = Number(process.env.PORT ?? 3001)
const HOST = process.env.HOST ?? "0.0.0.0"

const CONTENT_TYPES = {
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
}

/** Resolve a request path to a real file under dist/client, or null. */
async function resolveStaticFile(pathname) {
  // Normalize and prevent path traversal outside clientDir.
  const decoded = decodeURIComponent(pathname.split("?")[0])
  const filePath = path.join(clientDir, decoded)
  if (!filePath.startsWith(clientDir)) return null
  try {
    const s = await stat(filePath)
    if (s.isFile()) return { filePath, size: s.size }
  } catch {
    /* not a file */
  }
  return null
}

function serveStatic(res, filePath, size, immutable) {
  const ext = path.extname(filePath).toLowerCase()
  res.statusCode = 200
  res.setHeader("Content-Type", CONTENT_TYPES[ext] ?? "application/octet-stream")
  res.setHeader("Content-Length", size)
  // Hashed asset filenames are safe to cache aggressively.
  res.setHeader(
    "Cache-Control",
    immutable ? "public, max-age=31536000, immutable" : "public, max-age=0, must-revalidate"
  )
  createReadStream(filePath).pipe(res)
}

/** Build a Web Request from a Node IncomingMessage. */
function toWebRequest(req) {
  const url = `http://${req.headers.host ?? `localhost:${PORT}`}${req.url}`
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) value.forEach((v) => headers.append(key, v))
    else if (value != null) headers.set(key, value)
  }
  const hasBody = req.method !== "GET" && req.method !== "HEAD"
  return new Request(url, {
    method: req.method,
    headers,
    body: hasBody ? Readable.toWeb(req) : undefined,
    duplex: hasBody ? "half" : undefined,
  })
}

/** Write a Web Response back to a Node ServerResponse. */
async function writeWebResponse(res, webRes) {
  res.statusCode = webRes.status
  webRes.headers.forEach((value, key) => res.setHeader(key, value))
  if (webRes.body) {
    Readable.fromWeb(webRes.body).pipe(res)
  } else {
    res.end(webRes.body == null ? undefined : Buffer.from(await webRes.arrayBuffer()))
  }
}

const server = createServer(async (req, res) => {
  try {
    const pathname = (req.url ?? "/").split("?")[0]

    // 1. Static client assets (only for safe methods).
    if (req.method === "GET" || req.method === "HEAD") {
      const hit = await resolveStaticFile(pathname)
      if (hit) {
        const immutable = pathname.startsWith("/assets/")
        serveStatic(res, hit.filePath, hit.size, immutable)
        return
      }
    }

    // 2. Everything else → the TanStack Start fetch handler.
    const webRes = await handler.fetch(toWebRequest(req))
    await writeWebResponse(res, webRes)
  } catch (err) {
    console.error("[serve] request failed:", err)
    if (!res.headersSent) res.statusCode = 500
    res.end("Internal Server Error")
  }
})

server.listen(PORT, HOST, () => {
  console.log(`[serve] DAHLIA app-node listening on http://${HOST}:${PORT}`)
  warmServerDeps()
})

/**
 * Warm server-only deps (Redis connect + dynamic imports) at boot so the first
 * real user request doesn't pay that init latency. The TanStack Start entry
 * (src/server.ts) strips top-level boot code in the build, so we warm here — the
 * one place guaranteed to run at process start — by firing one lightweight
 * internal request through the handler. The directory loader pulls in
 * getServerDeps (Redis + Salesforce proxy), so this also pre-warms that path.
 * Best-effort: failures are logged, never fatal. The deps are memoized, so the
 * first user request reuses this initialization rather than racing it.
 */
async function warmServerDeps() {
  const url = `http://${HOST === "0.0.0.0" ? "127.0.0.1" : HOST}:${PORT}/listings/for-rent`
  try {
    const webRes = await handler.fetch(new Request(url, { headers: { "x-warmup": "1" } }))
    // Drain the body by reading it to completion (same path a real request
    // takes via Readable.fromWeb().pipe()) so the SSR stream finishes
    // normally instead of sitting unread until router-core's lifetime
    // timeout force-errors it (unhandled 'error' event on the underlying
    // Readable, crashing the process). stream.cancel() does NOT reliably
    // clear that timer, so don't use it here.
    if (webRes.body) {
      const reader = webRes.body.getReader()
      while (!(await reader.read()).done) {
        /* drain */
      }
    }
    console.log("[serve] server deps warmed")
  } catch (err) {
    console.error("[serve] warmup failed:", err)
  }
}
