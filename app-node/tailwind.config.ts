import path from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Tailwind (v4 compat-mode) config for app-node.
 *
 * Loads the local ui-components fork's tailwind.config.js (v4-ready: CSS
 * variable theme values, flattened callbacks) and layers DAHLIA's overrides
 * on top, mirroring the repo-root tailwind.config.js used by the Rails
 * webpack build. Referenced via @config (injected in postcss.config.js).
 *
 * The fork location can be overridden with UI_COMPONENTS_DIR.
 */
const uiComponentsDir =
  process.env.UI_COMPONENTS_DIR ?? path.resolve(__dirname, "..", "..", "ui-components")

// eslint-disable-next-line @typescript-eslint/no-require-imports
const bloomTheme = require(path.join(uiComponentsDir, "tailwind.config.js"))

const config = {
  ...bloomTheme,
  content: [
    "./src/**/*.{ts,tsx}",
    // Original Rails frontend pages rendered via the RailsPage bridge
    "../app/javascript/**/*.{ts,tsx}",
    // Local ui-components fork (compiled from source by Vite)
    `${uiComponentsDir.replace(/\\/g, "/")}/src/**/*.{ts,tsx}`,
    "./node_modules/@bloom-housing/ui-seeds/src/**/*.{ts,tsx}",
  ],
  theme: {
    ...bloomTheme.theme,
    // DAHLIA overrides copied from the repo-root tailwind.config.js
    fontSize: {
      ...bloomTheme.theme?.fontSize,
      "3xl": ["2rem", { lineHeight: "1.25" }],
      "4xl": ["2.5rem", { lineHeight: "1.25" }],
    },
    extend: {
      ...bloomTheme.theme?.extend,
      fontFamily: {
        ...bloomTheme.theme?.fontFamily,
        // Ensure alt-serif is available for DAHLIA headings
        "alt-serif": ['"Playfair Display"', "serif"],
      },
    },
  },
}

export default config
