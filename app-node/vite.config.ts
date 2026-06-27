import { defineConfig } from "vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
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

// Vite 8 bundles with Rolldown, which surfaces two harmless warnings:
//   1. react-helmet-async ships a misplaced `/*#__PURE__*/` annotation that
//      Rolldown can't interpret. It's a third-party bug we can't fix here.
//   2. INVALID_ANNOTATION otherwise. Everything else falls through to the
//      default handler so real warnings are not hidden.
function onwarn(
  warning: { code?: string; message: string },
  defaultHandler: (warning: { code?: string; message: string }) => void
) {
  if (
    warning.code === "INVALID_ANNOTATION" &&
    warning.message.includes("react-helmet-async")
  ) {
    return
  }
  defaultHandler(warning)
}

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
  build: {
    // The main client bundle and the locale chunks are intentionally large
    // (full i18n catalogs + app shell). Raise the limit so these expected
    // chunks don't emit a size warning on every build.
    chunkSizeWarningLimit: 1000,
    rollupOptions: { onwarn },
    // Emit ONE stylesheet instead of per-chunk CSS. With code splitting on,
    // shared-chunk CSS (e.g. routeUtil, which carries the ui-seeds component
    // styles like .seeds-common-message) is loaded as a blocking <link> on SSR
    // hard-load but dropped on client-side navigation — the router swaps in only
    // the destination route's computed asset set, which omits shared chunks, so
    // components render unstyled after an SPA nav (e.g. the listing-detail
    // "Application deadline" Message). A single bundle is always present across
    // navigations and matches dev (one combined stylesheet). The pinned @layer
    // order (see __root.tsx) keeps the cascade deterministic within it.
    cssCodeSplit: false,
  },
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
  ssr: {
    // react-hook-form lives in the repo-root node_modules (it's a Rails-tree dep).
    // If externalized for SSR it resolves its own React copy from root
    // node_modules, while app-node's react-dom-server uses app-node's React —
    // two React copies → "Cannot read properties of null (reading 'useRef')"
    // invalid-hook-call crash. Bundling it through Vite's graph applies
    // resolve.dedupe so it shares the single React. (Used by CounselorFilter on
    // the now-native housing-counselors page; previously only client-rendered.)
    noExternal: ["react-hook-form"],
  },
  plugins: [
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
    // Vite 8 resolves tsconfig `paths` natively, replacing the
    // vite-tsconfig-paths plugin.
    tsconfigPaths: true,
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
          onwarn,
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
