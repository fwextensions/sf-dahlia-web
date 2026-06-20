import { defineConfig } from "vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import tsconfigPaths from "vite-tsconfig-paths"
import path from "node:path"
import fs from "node:fs"

const repoRoot = path.resolve(__dirname, "..")

// The vendored ui-components source ("@uic") lives in the Rails tree. app-node
// renders the real Rails pages (via the RailsPage bridge) and its own pages
// both import components from here.
const uicEntry = path.resolve(repoRoot, "app/javascript/components/uic/index.ts")

/**
 * Read selected variables from the repo-root .env (where the Rails frontend
 * env vars live) merged with app-node/.env and the actual process env.
 * The original app/javascript code references these via process.env.* —
 * webpack's EnvironmentPlugin used to inline them; in Vite we use `define`.
 */
function loadRailsFrontendEnv(): Record<string, string> {
  const parseEnvFile = (file: string): Record<string, string> => {
    if (!fs.existsSync(file)) return {}
    const result: Record<string, string> = {}
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line)
      if (match) result[match[1]] = match[2].replace(/^["']|["']$/g, "")
    }
    return result
  }
  return {
    ...parseEnvFile(path.join(repoRoot, ".env")),
    ...parseEnvFile(path.join(__dirname, ".env")),
    ...(process.env as Record<string, string>),
  }
}

const railsEnv = loadRailsFrontendEnv()

// TanStack Start's SSR stream watchdog ("Stream lifetime exceeded") emits an
// unhandled 'error' event when a stream hangs past 120s (e.g. a request that
// triggered a server-side redirect), which kills the whole dev server.
// Swallow just that error in dev so one stuck request can't take Vite down.
process.on("uncaughtException", (err) => {
  if (err instanceof Error && err.message.includes("Stream lifetime exceeded")) {
    console.warn("[dev] Ignored hung SSR stream:", err.message)
    return
  }
  throw err
})

// Env vars referenced as process.env.* by app/javascript code
const RAILS_FRONTEND_ENV_KEYS = [
  "UNLEASH_URL",
  "UNLEASH_TOKEN",
  "UNLEASH_ENV",
  "GOOGLE_TAG_MANAGER_KEY",
  "CLERK_PUBLISHABLE_KEY",
  "GOOGLE_PLACES_KEY",
  "TOP_MESSAGE",
  "TOP_MESSAGE_TYPE",
  "TOP_MESSAGE_INVERTED",
  "COVID_UPDATE",
  "INSPECT_MODE",
  "TOKEN_STORAGE",
  "FCFS_FORMASSEMBLY_URL_EN",
  "FCFS_FORMASSEMBLY_URL_ES",
]

const railsEnvDefine = Object.fromEntries(
  RAILS_FRONTEND_ENV_KEYS.map((key) => [
    `process.env.${key}`,
    JSON.stringify(railsEnv[key] ?? ""),
  ])
)

export default defineConfig({
  define: railsEnvDefine,
  server: {
    port: 3001,
    // In dev, forward non-migrated Rails API calls straight to Rails.
    // (Production uses handleApiProxy in src/server.ts.)
    proxy: {
      "/api/v1": {
        target: railsEnv.RAILS_API_BASE_URL ?? "http://localhost:3000",
        changeOrigin: true,
      },
      "/favicon.ico": {
        target: railsEnv.RAILS_API_BASE_URL ?? "http://localhost:3000",
        changeOrigin: true,
      },
    },
    fs: {
      // Allow serving files from the Rails repo root (app/javascript,
      // app/assets) as well as app-node itself.
      allow: [__dirname, repoRoot],
    },
  },
  optimizeDeps: {
    // These packages use virtual module imports (#tanstack-router-entry,
    // #tanstack-start-entry, tanstack-start-manifest:v) that are only
    // resolvable by the TanStack Start Vite plugin at runtime. esbuild
    // cannot resolve them during pre-bundling, so we exclude them here.
    exclude: [
      "@tanstack/start-server-core",
      "@tanstack/react-start",
      "@tanstack/react-start/server",
      "@tanstack/react-start/client",
    ],
    // CJS subpath used by the vendored uic ContactAddress.tsx — pre-bundle it
    // so the default import gets ESM interop.
    include: ["react-dom/server"],
  },
  plugins: [
    tsconfigPaths(),
    // Process Tailwind via the Vite plugin (not @tailwindcss/postcss). It
    // resolves @apply against the full theme even when the dev server transforms
    // CSS modules independently, which the PostCSS plugin couldn't — clearing the
    // dev-only "Cannot apply unknown utility class" errors. The cascade-layer
    // wrapLayer plugin still runs via postcss.config.js (after this expands).
    tailwindcss(),
    tanstackStart({
      server: {
        entry: "./src/server.ts",
      },
    }),
    viteReact(),
  ],
  resolve: {
    // The original Rails frontend code in ../app/javascript resolves its
    // dependencies from the repo-root node_modules. Dedupe singletons so the
    // Rails pages and app-node share one copy (two React copies break hooks;
    // two Bloom copies would split the translation registry).
    dedupe: [
      "react",
      "react-dom",
      "@bloom-housing/ui-seeds",
      "react-helmet-async",
      "dayjs",
    ],
    alias: [
      // Shim for @clerk/tanstack-react-start@0.14.0 compatibility.
      {
        find: "@tanstack/react-start/server",
        replacement: path.resolve(__dirname, "src/lib/shims/tanstack-start-server.ts"),
      },
      // Vendored ui-components source. app-node's own pages and the Rails pages
      // it renders both import components from "@uic".
      {
        find: /^@uic$/,
        replacement: uicEntry,
      },
    ],
  },
  css: {
    preprocessorOptions: {
      scss: {
        // Silence Sass @import deprecation warnings from ui-seeds internals.
        silenceDeprecations: ["import"],
      },
    },
  },
  environments: {
    client: {
      build: {
        rollupOptions: {
          // Externalize server-only packages from the client bundle.
          // These modules are only used in server functions and should never
          // be included in browser code.
          external: [
            "node:stream",
            "node:stream/web",
            "node:async_hooks",
            "@clerk/tanstack-react-start/server",
            /^@prisma/,
            "ioredis",
            "pg",
          ],
        },
      },
    },
  },
})
