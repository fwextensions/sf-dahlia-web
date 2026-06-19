import path from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"
import tailwindPostcss from "@tailwindcss/postcss"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

// Reuse the Rails webpack build's cascade-layer plugin so app-node produces the
// same layer ordering (@layer theme, base, seeds, components, utilities — see
// app/javascript/styles/theme.css). It wraps bare first-party rules in the
// `components` layer, leaving @import/@layer/@property at the top level.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const wrapLayer = require("../config/webpack/loaders/wrapLayer.js")

// The Tailwind entry (tailwind.css) declares the layers itself via its
// `@import "tailwindcss"`, so it must not be wrapped.
const themeEntry = path.join("app-node", "src", "styles", "tailwind.css")

// Pure Tailwind v4: the theme + @source live in the imported CSS (theme.css via
// base.css), and the vendored uic component CSS each carry their own
// `@reference "../../styles/theme.css"`, so no @config/@reference injection is
// needed here.
export default {
  plugins: [
    tailwindPostcss(),
    wrapLayer({
      layer: "components",
      skip: (file) => file.replace(/\\/g, "/").endsWith(themeEntry.replace(/\\/g, "/")),
    }),
  ],
}
