import { defineConfig } from "vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import tsconfigPaths from "vite-tsconfig-paths"
import path from "node:path"

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
      {
        find: /.*\/@bloom-housing\/ui-components\/tailwind\.config\.js$/,
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
  },
})
