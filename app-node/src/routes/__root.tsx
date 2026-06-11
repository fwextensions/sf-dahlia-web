import type { ReactNode } from "react"
import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
  redirect,
} from "@tanstack/react-router"
import { ClerkProvider } from "@clerk/tanstack-react-start"
import { NotFound } from "../components/NotFound"
import { evaluateRedirects } from "../lib/routing/redirects"
import { getClientEnvScript } from "../config/clientEnv"

// Import global styles - Vite injects these as a blocking <link> in <head> during SSR,
// ensuring styles are loaded before first paint (CLS < 0.1)
// tailwind.css must come first: it emits preflight + generated utilities.
// base.scss is imported as its own module (not via globals.scss) so the
// bloom-tailwind-shim plugin can strip its Tailwind v3 directives.
import "../styles/tailwind.css"
import "../../../app/javascript/components/base.scss"
import "../styles/globals.scss"

// Clerk requires a publishable key. When running locally without one configured,
// skip the provider entirely so the app still renders for non-auth pages.
const CLERK_PUBLISHABLE_KEY = process.env.CLERK_PUBLISHABLE_KEY ?? ""
const clerkEnabled = CLERK_PUBLISHABLE_KEY.startsWith("pk_")

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "DAHLIA San Francisco Housing Portal" },
    ],
    scripts: [
      {
        children: getClientEnvScript(),
      },
    ],
  }),
  beforeLoad: async ({ location }) => {
    // Evaluate redirect rules for ALL incoming URLs (including would-be 404s)
    const result = await evaluateRedirects(location.pathname)
    if (result.redirect) {
      throw redirect({
        to: result.destination,
        statusCode: 301,
      })
    }
  },
  component: RootComponent,
  notFoundComponent: NotFoundPage,
})

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

function NotFoundPage() {
  return (
    <RootDocument>
      <NotFound />
    </RootDocument>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {clerkEnabled ? (
          <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
            {children}
          </ClerkProvider>
        ) : (
          children
        )}
        <Scripts />
      </body>
    </html>
  )
}
