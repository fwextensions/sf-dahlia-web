import { defineConfig } from "vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import tsconfigPaths from "vite-tsconfig-paths"
import path from "node:path"

export default defineConfig({
  server: {
    port: 3001,
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
    alias: {
      // Shim for @clerk/tanstack-react-start@0.14.0 compatibility.
      // Clerk 0.14 imports `getEvent` from @tanstack/react-start/server,
      // which was removed in TanStack Start 1.120+. Our shim re-exports
      // everything from the real module and adds the missing function.
      "@tanstack/react-start/server": path.resolve(
        __dirname,
        "src/lib/shims/tanstack-start-server.ts"
      ),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        // Silence Sass @import deprecation warnings from Bloom UI library internals
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
