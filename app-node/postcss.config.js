import path from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

// Reuse the Rails webpack build's cascade-layer plugin so app-node produces the
// same layer ordering (@layer theme, base, seeds, components, utilities — see
// app/javascript/styles/theme.css). It wraps bare first-party rules in the
// `components` layer, leaving @import/@layer/@property at the top level.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const wrapLayer = require("../config/webpack/loaders/wrapLayer.js")

// Mirror the Rails webpack build (config/webpack/loaders/css.js): skip ONLY
// theme.css, wrap every other first-party file's bare rules into `components`.
// wrapLayer runs at OnceExit, after @tailwindcss/postcss has already expanded
// the `@import "tailwindcss"` and consumed @theme — so what's left to wrap in the
// tailwind entry is just base.css's bare GLOBAL rules (body, h1–h6, .site-wrapper
// …); @import/@layer/@property stay top-level (PASSTHROUGH). This puts the global
// element styles in `components` alongside vendored component CSS, so specificity
// resolves them correctly (e.g. `.info-card__title` beats `h1–h6`) instead of the
// unlayered globals beating every layer. theme.css never appears as a root in
// app-node (it's inlined into tailwind.css), so this skip is effectively a no-op
// here, but keeping the same predicate keeps the two builds aligned.
const themeFile = path.join("app", "javascript", "styles", "theme.css")

// Tailwind itself is now processed by @tailwindcss/vite (see vite.config.ts);
// this PostCSS pass only runs wrapLayer, which wraps bare first-party rules into
// the `components` layer. The Vite plugin expands `@import "tailwindcss"` before
// this runs, so wrapLayer still sees only base.css's bare global rules to wrap.
export default {
  plugins: [
    wrapLayer({
      layer: "components",
      skip: (file) => file.replace(/\\/g, "/").endsWith(themeFile.replace(/\\/g, "/")),
    }),
  ],
}
