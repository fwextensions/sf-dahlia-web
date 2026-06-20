import { defineConfig } from "vitest/config"
import tsconfigPaths from "vite-tsconfig-paths"
import path from "node:path"

const repoRoot = path.resolve(__dirname, "..")
// Vendored ui-components source ("@uic"). tsconfigPaths doesn't resolve the
// non-wildcard "@uic" mapping, so alias it explicitly to match vite.config.ts.
const uicEntry = path.resolve(repoRoot, "app/javascript/components/uic/index.ts")

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: [{ find: /^@uic$/, replacement: uicEntry }],
    // @uic lives in the repo-root tree and resolves React there, while tests
    // resolve react-dom from app-node — two React copies break hooks during
    // renderToString. Force a single instance.
    dedupe: ["react", "react-dom"],
  },
  test: {
    globals: true,
    environment: "node",
  },
})
