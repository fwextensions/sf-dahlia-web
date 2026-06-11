import path from "node:path"
import { fileURLToPath } from "node:url"
import tailwindPostcss from "@tailwindcss/postcss"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Tailwind v4 pipeline, mirroring the local ui-components fork's Storybook
// setup (.storybook/main.js): a tiny postcss plugin prepends
//   @config "<app-node>/tailwind.config.ts"  (theme + content sources)
//   @reference "tailwindcss"                 (lets @apply/@variant resolve)
// to every stylesheet before @tailwindcss/postcss runs. This makes the
// @apply rules scattered across the Bloom fork's scss and DAHLIA's
// app/javascript scss work without editing each file.
const tailwindConfigPath = path
  .resolve(__dirname, "tailwind.config.ts")
  .split(path.sep)
  .join("/")

// @reference resolves relative to the css file being processed. Stylesheets
// from the Rails tree (app/javascript/**) would resolve "tailwindcss" to the
// repo root's Tailwind v2 package, so point at app-node's v4 copy explicitly.
const tailwindCssPath = path
  .resolve(__dirname, "node_modules/tailwindcss/index.css")
  .split(path.sep)
  .join("/")

const tailwindConfigPlugin = {
  postcssPlugin: "tailwind-config",
  Once(root, { postcss }) {
    if (process.env.DEBUG_TAILWIND_INJECT) {
      console.error("[tailwind-config] injecting into", root.source?.input?.file)
    }
    const file = (root.source?.input?.file ?? "").replace(/\\/g, "/")
    // The main entry does a full `@import "tailwindcss"` and must emit the
    // theme CSS variables — @reference would make it reference-only.
    const isEntry = file.endsWith("src/styles/tailwind.css")
    root.prepend(
      postcss.atRule({ name: "config", params: `"${tailwindConfigPath}"` }),
      ...(isEntry
        ? []
        : [postcss.atRule({ name: "reference", params: `"${tailwindCssPath}"` })])
    )
  },
}

export default {
  plugins: [tailwindConfigPlugin, tailwindPostcss()],
}
