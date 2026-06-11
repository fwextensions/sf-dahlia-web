/**
 * ESM shim for @bloom-housing/ui-components/tailwind.config.js
 *
 * That file uses `module.exports` (CJS). The Vite SSR module runner executes
 * all files as ESM and crashes with "module is not defined" when it hits CJS.
 *
 * ResponsiveWrappers.tsx imports tailwind.config.js at runtime to read
 * breakpoint values for react-media queries. This shim re-exports the same
 * data as a proper ESM module so the SSR runner can load it safely.
 *
 * Breakpoint values must match @bloom-housing/ui-components/tailwind.config.js
 * theme.screens exactly.
 */

export const theme = {
  // Gray scale from @bloom-housing/ui-components/tailwind.config.js, used by
  // pages that read theme colors at runtime (e.g. get-assistance.tsx icons).
  colors: {
    gray: {
      100: "#f9f9f9",
      200: "#f7f7f7",
      300: "#f6f6f6",
      400: "#efefef",
      450: "#dedee0",
      500: "#cccccc",
      550: "#aaaaaa",
      600: "#999999",
      650: "#888888",
      700: "#767676",
      750: "#555555",
      800: "#373737",
      850: "#333333",
      900: "#292929",
      950: "#222222",
    },
  },
  screens: {
    sm: "640px",
    md: "768px",
    lg: "1200px",
    xl: "1280px",
    "2xl": "1440px",
    print: { raw: "print" },
  },
}

// Default export mirrors the shape that `import * as tailwindConfig` produces
export default { theme }
