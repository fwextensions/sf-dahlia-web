import { defineConfig, type Plugin } from "vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import tsconfigPaths from "vite-tsconfig-paths"
import path from "node:path"
import fs from "node:fs"

const repoRoot = path.resolve(__dirname, "..")

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

/**
 * Vite plugin that intercepts @bloom-housing/ui-components/tailwind.config.js
 * at the load stage. That file uses module.exports (CJS), which crashes the
 * Vite SSR module runner with "module is not defined". We replace it with
 * ESM-compatible code that exports the same breakpoint data.
 */
function bloomTailwindShimPlugin(): Plugin {
  const BLOOM_TAILWIND_SUFFIX = path.join(
    "@bloom-housing",
    "ui-components",
    "tailwind.config.js"
  )
  return {
    name: "bloom-tailwind-shim",
    load(id) {
      const normalized = id.replace(/\\/g, "/")
      // DAHLIA's base.scss carries Tailwind v3 `@tailwind` directives for the
      // Rails webpack build. app-node uses Tailwind v4 (preflight + utilities
      // come from src/styles/tailwind.css), so strip the directives here
      // without touching the shared file.
      if (normalized.endsWith("app/javascript/components/base.scss")) {
        const source = fs.readFileSync(id.split("?")[0], "utf8")
        return source.replace(/^@tailwind\s+\w+;/gm, "")
      }
      if (
        id.endsWith(BLOOM_TAILWIND_SUFFIX) ||
        normalized.endsWith("@bloom-housing/ui-components/tailwind.config.js") ||
        // Local ui-components fork checkout (aliased below)
        normalized.endsWith("/ui-components/tailwind.config.js")
      ) {
        return `
export const theme = {
  screens: {
    sm: "640px",
    md: "768px",
    lg: "1200px",
    xl: "1280px",
    "2xl": "1440px",
    print: { raw: "print" },
  },
};
export default { theme };
`
      }
    },
  }
}

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
      // app/assets) and the local ui-components checkout.
      allow: [__dirname, repoRoot, path.resolve(repoRoot, "..", "ui-components")],
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
      // Aliased to the local fork checkout (compiled from TS/SCSS source by
      // Vite) — esbuild prebundling can't process its .scss imports.
      "@bloom-housing/ui-components",
    ],
    // react-dropzone ships as CJS. Force Vite to pre-bundle it so named
    // imports like `useDropzone` work correctly in ESM context.
    // It's pulled in transitively via @bloom-housing/ui-components → Dropzone.
    include: ["react-dropzone"],
  },
  plugins: [
    bloomTailwindShimPlugin(),
    tsconfigPaths(),
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
      "@bloom-housing/ui-components",
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
      // @bloom-housing/ui-components/tailwind.config.js uses module.exports (CJS).
      // ResponsiveWrappers.tsx imports it via a relative path (../../tailwind.config.js),
      // so we match by absolute path using a regex. The SSR module runner treats all
      // files as ESM and crashes on module.exports — this shim re-exports the same
      // breakpoint data as proper ESM.
      // Note: use both / and \\ to handle Windows and Unix path separators.
      {
        find: /[/\\]@bloom-housing[/\\]ui-components[/\\]tailwind\.config\.js$/,
        replacement: path.resolve(__dirname, "src/lib/shims/bloom-tailwind-config.ts"),
      },
      // Use the local ui-components fork (updated deps, Tailwind v4-ready
      // SCSS) instead of the npm package. Matches both the bare import and
      // subpath imports like @bloom-housing/ui-components/src/global/....
      {
        find: /^@bloom-housing\/ui-components$/,
        replacement: path.resolve(repoRoot, "..", "ui-components", "index.ts"),
      },
      {
        find: /^@bloom-housing\/ui-components\//,
        replacement: path.resolve(repoRoot, "..", "ui-components") + "/",
      },
      // react-dropzone v11 ships CJS as its main entry and ESM under dist/es/.
      // The SSR module runner picks up the CJS build and fails on named imports.
      // Alias to the ESM build so both browser and SSR get proper named exports.
      {
        find: "react-dropzone",
        replacement: path.resolve(__dirname, "node_modules/react-dropzone/dist/es/index.js"),
      },
    ],
  },
  css: {
    preprocessorOptions: {
      scss: {
        // Silence Sass @import deprecation warnings from Bloom UI library internals
        silenceDeprecations: ["import"],
        // Make the $tailwind-* / $screen-* Sass variables available globally.
        // DAHLIA's app/javascript scss expects them as globals (the Rails
        // webpack build prepends a generated file via tailwind.tosass.js).
        // The ui-components fork ships the same file, so @use it everywhere;
        // Sass dedupes repeat loads of the same canonical file, so this is
        // safe even for fork files that already @use it themselves.
        additionalData: `@use "${path
          .resolve(repoRoot, "..", "ui-components", "src/global/tailwind-variables.scss")
          .replace(/\\/g, "/")}" as *;\n`,
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
    ssr: {
      // Force Vite to bundle @bloom-housing/ui-components through its module
      // resolver so that alias rules (tailwind.config.js shim) are applied.
      // Without noExternal, Vite skips aliasing for node_modules in SSR.
      noExternal: ["@bloom-housing/ui-components"],
    },
  },
  ssr: {
    // Same as environments.ssr.noExternal — required for Vite 5/6 compat layer
    // to ensure the tailwind.config.js alias is applied during SSR module loading.
    noExternal: ["@bloom-housing/ui-components"],
  },
})
