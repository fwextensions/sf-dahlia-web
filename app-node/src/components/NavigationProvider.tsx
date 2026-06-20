/**
 * Bridges the vendored @uic NavigationContext to the TanStack Router.
 *
 * @uic components (ListingCard, SiteHeader, …) render links through
 * NavigationContext.LinkComponent, which defaults to a plain <a> — so clicking
 * a listing did a full document reload (re-running SSR + the blocking loader)
 * instead of a client-side transition. This provider supplies a router-aware
 * LinkComponent (and a router adapter) so internal navigations stay in the SPA,
 * which is also what makes intent-preloading (router defaultPreload) effective.
 */
import type { FunctionComponent, ReactNode } from "react"
import { Link, useRouter } from "@tanstack/react-router"
import {
  NavigationContext,
  type LinkProps,
} from "../../../app/javascript/components/uic/NavigationContext"

// External/non-path hrefs that must stay a real anchor (new tab, mail, hash, etc).
const isExternalHref = (href?: string): boolean =>
  !href || /^(https?:|mailto:|tel:|#)/i.test(href)

const RouterLinkComponent: FunctionComponent<LinkProps> = ({
  href,
  children,
  target,
  ...rest
}) => {
  // Plain anchor for external links, new-tab links, and non-path hrefs —
  // client-side routing only makes sense for in-app paths.
  if (isExternalHref(href) || (target && target !== "_self")) {
    return (
      <a href={href} target={target} {...rest}>
        {children}
      </a>
    )
  }

  // Internal path → client-side navigation (preload-on-intent, no full reload).
  // `to` is a runtime string; TanStack's typed-route signature doesn't model
  // that, so cast.
  return (
    <Link to={href as string} {...rest}>
      {children}
    </Link>
  )
}

export function NavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter()

  const value = {
    LinkComponent: RouterLinkComponent,
    router: {
      push: (url: string | { toString(): string }) => {
        void router.navigate({ to: String(url) })
      },
      back: () => router.history.back(),
      pathname: router.state.location.pathname,
      asPath: router.state.location.href,
      locale: "",
    },
  }

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>
}
