import path from "node:path"
import fs from "node:fs"
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

// Expand ui-seeds' `@custom-media` rules (a CSS draft feature) into plain
// @media queries. Sass leaves these at-rules untouched and the downstream
// lightningcss minify (run by @tailwindcss/vite) doesn't understand them — it
// would pass `@custom-media`/`@media (--name)` through unresolved (broken in
// browsers) and warn "Unknown at rule: @custom-media". Running this first
// resolves them before minification.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const customMedia = require("postcss-custom-media")

// ui-seeds defines its `@custom-media` breakpoints once in screens.scss, but its
// component stylesheets (Card, Grid, Tabs, Dialog…) use `@media (--name)`
// without re-importing the definitions. Those components compile into separate
// CSS roots, so postcss-custom-media has nothing to resolve against there.
// Inject the definitions into every root first so they always resolve. Read
// from the ui-seeds source so the breakpoints stay in sync with the package.
const screensScss = require.resolve(
  "@bloom-housing/ui-seeds/src/global/tokens/screens.scss"
)
const customMediaDefs = fs
  .readFileSync(screensScss, "utf8")
  .split(/\r?\n/)
  .filter((line) => line.startsWith("@custom-media"))
  .join("\n")

const injectCustomMediaDefs = () => ({
  postcssPlugin: "inject-custom-media-defs",
  Once(root) {
    root.prepend(customMediaDefs)
  },
})
injectCustomMediaDefs.postcss = true

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
    injectCustomMediaDefs(),
    customMedia(),
    wrapLayer({
      layer: "components",
      skip: (file) => file.replace(/\\/g, "/").endsWith(themeFile.replace(/\\/g, "/")),
    }),
  ],
}
