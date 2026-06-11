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
