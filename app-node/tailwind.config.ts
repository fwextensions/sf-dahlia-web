import type { Config } from "tailwindcss"
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bloomTheme = require("@bloom-housing/ui-components/tailwind.config.js")

/**
 * Tailwind config for app-node.
 *
 * Extends the Bloom Housing UI component theme so that all Bloom utility
 * classes (font-alt-sans, text-primary, bg-primary-darker, etc.) are
 * available. This mirrors how the existing Rails app extends bloomTheme in
 * tailwind.config.js at the repo root.
 */
const config: Config = {
  ...bloomTheme,
  content: [
    "./src/**/*.{ts,tsx}",
    "./node_modules/@bloom-housing/ui-components/src/**/*.{ts,tsx}",
    "./node_modules/@bloom-housing/ui-seeds/src/**/*.{ts,tsx}",
  ],
  theme: {
    ...bloomTheme.theme,
    extend: {
      ...bloomTheme.theme?.extend,
      fontFamily: {
        ...bloomTheme.theme?.fontFamily,
        // Ensure alt-serif is available for DAHLIA headings
        "alt-serif": ['"Playfair Display"', "serif"],
      },
    },
  },
  plugins: bloomTheme.plugins ?? [],
}

export default config
