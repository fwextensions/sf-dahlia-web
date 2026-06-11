import { defineConfig, type Plugin } from "vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import tsconfigPaths from "vite-tsconfig-paths"
import path from "node:path"

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
      if (id.endsWith(BLOOM_TAILWIND_SUFFIX) || id.replace(/\\/g, "/").endsWith("@bloom-housing/ui-components/tailwind.config.js")) {
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
  server: {
    port: 3001,
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
        // Prepend Sass variable definitions required by @bloom-housing/ui-components
        // component stylesheets (Icon.scss, forms.scss, Tabs.scss, ListingDetails.scss, etc.).
        // These variables are referenced as $tailwind-* and $screen-* in Bloom UI's scss files.
        // Tailwind's webpack integration used to generate these automatically; in Vite we
        // must define them explicitly. Values match the Bloom UI tailwind.config.js theme.
        additionalData: `
$tailwind-primary: #0077da;
$tailwind-alert: #e41d3d;
$tailwind-accent-cool: #00bed5;
$tailwind-gray: (
  100: #f9f9f9,
  200: #f7f7f7,
  300: #f6f6f6,
  400: #efefef,
  450: #dedee0,
  500: #cccccc,
  550: #aaaaaa,
  600: #999999,
  650: #888888,
  700: #767676,
  750: #555555,
  800: #373737,
  850: #333333,
  900: #292929,
  950: #222222,
);
$screen-sm: 640px;
$screen-md: 768px;
$screen-lg: 1200px;
$screen-xl: 1280px;
$screen-2xl: 1440px;
$screen-print: print;
`,
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
