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
import {
  buildI18nStore,
  initI18nFromStore,
  serializeI18nStore,
  type I18nStore,
} from "../lib/i18n/store"
import { getCurrentLanguage } from "../../../app/javascript/util/languageUtil"

// Import global styles - Vite injects these as a blocking <link> in <head> during SSR,
// ensuring styles are loaded before first paint (CLS < 0.1).
// tailwind.css is the Tailwind v4 entry: it pulls in the shared Rails base.css
// (theme + tokens + first-party globals) and emits preflight + utilities.
// globals.scss layers in the ui-seeds global styles.
import "../styles/tailwind.css"
import "../styles/globals.scss"

// Clerk requires a publishable key. When running locally without one configured,
// skip the provider entirely so the app still renders for non-auth pages.
const CLERK_PUBLISHABLE_KEY = process.env.CLERK_PUBLISHABLE_KEY ?? ""
const clerkEnabled = CLERK_PUBLISHABLE_KEY.startsWith("pk_")

// Holds the per-request translation store between beforeLoad (which builds it on
// the server) and the head render (which serializes it). Module-scoped, like the
// translation active-instance ref — fine for the current single-render SSR path;
// concurrent SSR needs request-scoping (AsyncLocalStorage), see the plan doc.
let pendingI18nStore: I18nStore | null = null

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

    // Load + register translations for this request's language so SSR renders
    // (and client navigations re-render) with the right phrases. beforeLoad runs
    // on the server and on client navigations, but NOT on initial hydration —
    // that path reads the serialized store in client.tsx instead.
    const store = await buildI18nStore(getCurrentLanguage(location.pathname))
    initI18nFromStore(store)
    if (typeof window === "undefined") {
      pendingI18nStore = store
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
  // Serialize the translation store into the document so the client can init
  // i18next synchronously at hydrate (no re-fetch). Server renders from the
  // module var set in beforeLoad; client renders from the window value that same
  // script set during SSR — identical content, so no hydration mismatch.
  const i18nStore =
    typeof window === "undefined" ? pendingI18nStore : window.__DAHLIA_I18N__ ?? null

  return (
    <html lang="en">
      <head>
        {i18nStore && (
          <script
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: serializeI18nStore(i18nStore) }}
          />
        )}
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
