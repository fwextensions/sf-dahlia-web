import type { Config } from "tailwindcss"

const config: Config = {
  content: ["./src/**/*.{ts,tsx}", "./node_modules/@bloom-housing/ui-seeds/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // DAHLIA brand colors matching existing design system
        primary: {
          DEFAULT: "#0077da",
          dark: "#005fae",
          darker: "#003d73",
          light: "#e6f3ff",
        },
        secondary: {
          DEFAULT: "#0067be",
          dark: "#005298",
        },
        success: "#2e8540",
        warning: "#fdb81e",
        alert: "#e31c3d",
        info: "#a0d3e8",
        gray: {
          50: "#f7f7f7",
          100: "#efefef",
          200: "#ddd",
          300: "#ccc",
          400: "#aaa",
          500: "#999",
          600: "#666",
          700: "#444",
          800: "#333",
          900: "#222",
        },
      },
      fontFamily: {
        sans: ['"Open Sans"', "Helvetica", "Arial", "Verdana", "sans-serif"],
        serif: ['"Playfair Display"', "serif"],
        heading: ['"Lato"', "sans-serif"],
      },
      fontSize: {
        base: "16px",
      },
      lineHeight: {
        base: "24px",
      },
    },
  },
  plugins: [],
}

export default config
