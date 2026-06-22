import type { ReactNode } from "react"
import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
  redirect,
  useRouterState,
} from "@tanstack/react-router"
import { ClerkProvider } from "@clerk/tanstack-react-start"
import { NotFound } from "../components/NotFound"
import { AppShell } from "../components/AppShell"
import { NavigationProvider } from "../components/NavigationProvider"
import { evaluateRedirects } from "../lib/routing/redirects"
import { getClientEnvScript } from "../config/clientEnv"
import {
  buildI18nStore,
  initI18nFromStore,
  serializeI18nStore,
  type I18nStore,
} from "../lib/i18n/store"
import {
  initFlagsFromStore,
  serializeFlagsStore,
  getFlag,
  FLAGS,
  type FlagsStore,
} from "../lib/flags/store"
import { buildFlagsStore } from "../lib/flags/unleash"
import { getCurrentLanguage } from "../../../app/javascript/util/languageUtil"

// Import global styles - Vite injects these as a blocking <link> in <head> during SSR,
// ensuring styles are loaded before first paint (CLS < 0.1).
// tailwind.css is the Tailwind v4 entry: it pulls in the shared Rails base.css
// (theme + tokens + first-party globals) and emits preflight + utilities.
// globals.scss layers in the ui-seeds global styles.
import "../styles/tailwind.css"
import "../styles/globals.scss"

// Canonical Tailwind v4 cascade-layer order. This MUST be registered before any
// @layer block in any stylesheet, otherwise layers fall back to first-appearance
// order. In app-node's build, @tailwindcss/postcss relocates the @layer order
// statement below the first emitted `@layer components` block, so `components`
// ended up registered before `base` — base's preflight (border reset) and the
// unlayered h1–h6 font-serif rule then beat first-party `components` CSS
// (collapsed card borders, serif .info-card titles). Emitting the statement as
// the first inline <style> in <head> pins the order deterministically. Matches
// the order theme.css declares for the Rails webpack build.
const LAYER_ORDER = "@layer theme, base, seeds, components, utilities;"

// Clerk requires a publishable key. When running locally without one configured,
// skip the provider entirely so the app still renders for non-auth pages.
// Whether Clerk is actually mounted is also gated on the auth.clerk flag
// (computed at render time, see RootDocument) — when off, the bridged Rails auth
// pages use devise_token_auth instead.
const CLERK_PUBLISHABLE_KEY = process.env.CLERK_PUBLISHABLE_KEY ?? ""
const hasClerkKey = CLERK_PUBLISHABLE_KEY.startsWith("pk_")

// Holds the per-request translation store between beforeLoad (which builds it on
// the server) and the head render (which serializes it). Module-scoped, like the
// translation active-instance ref — fine for the current single-render SSR path;
// concurrent SSR needs request-scoping (AsyncLocalStorage), see the plan doc.
let pendingI18nStore: I18nStore | null = null

// Same pattern for the per-request feature-flag store: evaluated server-side in
// beforeLoad, serialized in the head render, read on the client at hydrate.
let pendingFlagsStore: FlagsStore | null = null

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

    // Evaluate feature flags on the server only. On client navigations the store
    // is already active (initialized at hydrate from the serialized value), and
    // the Unleash token must never run in the browser, so skip the fetch there.
    if (typeof window === "undefined") {
      const flags = await buildFlagsStore()
      initFlagsFromStore(flags)
      pendingFlagsStore = flags
    }
  },
  component: RootComponent,
  notFoundComponent: NotFoundPage,
})

// Native routes opt into the SSR-safe site chrome by setting
// `staticData: { nativeShell: true }`. Bridged (RailsPage) routes leave it unset
// because the Rails page self-wraps in app/javascript/layouts/Layout.tsx.
declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    nativeShell?: boolean
  }
}

function RootComponent() {
  const { pathname, useShell } = useRouterState({
    select: (state) => ({
      pathname: state.location.pathname,
      useShell: state.matches.some((match) => match.staticData?.nativeShell),
    }),
  })

  return (
    <RootDocument>
      {useShell ? (
        <AppShell pathname={pathname}>
          <Outlet />
        </AppShell>
      ) : (
        <Outlet />
      )}
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
  const flagsStore =
    typeof window === "undefined" ? pendingFlagsStore : window.__DAHLIA_FLAGS__ ?? null

  // Mount Clerk only when a key is configured AND the auth.clerk flag is on. The
  // flag resolves identically on server (beforeLoad) and client (hydrate), so
  // the provider is present/absent consistently — no hydration mismatch.
  const clerkEnabled = hasClerkKey && getFlag(FLAGS.CLERK_AUTH)

  // Reflect the request language on <html> for a11y/SEO. The i18n store carries
  // the resolved language (built from the path in beforeLoad); same value on
  // server and client, so no hydration mismatch.
  const htmlLang = i18nStore?.lng ?? "en"

  return (
    <html lang={htmlLang}>
      <head>
        {/* Pin cascade-layer order before any stylesheet link is parsed. */}
        <style dangerouslySetInnerHTML={{ __html: LAYER_ORDER }} />
        {i18nStore && (
          <script
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: serializeI18nStore(i18nStore) }}
          />
        )}
        {flagsStore && (
          <script
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: serializeFlagsStore(flagsStore) }}
          />
        )}
        <HeadContent />
      </head>
      <body>
        {/* Route @uic links through the TanStack router (client-side nav +
            intent preloading). Bridged Rails pages set their own inner
            NavigationContext via withAppSetup, so they're unaffected. */}
        <NavigationProvider>
          {clerkEnabled ? (
            <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
              {children}
            </ClerkProvider>
          ) : (
            children
          )}
        </NavigationProvider>
        {/* Portal target for the vendored @uic Overlay (gallery modal, etc.),
            which portals into `#__next` (provided by the Rails app's
            application-react.html.slim). app-node hydrates `document` directly,
            so without this the modal renders into a detached node — the gallery
            never opens and react-remove-scroll leaves the body scroll-locked
            (data-scroll-locked). */}
        <div id="__next" />
        <Scripts />
      </body>
    </html>
  )
}
