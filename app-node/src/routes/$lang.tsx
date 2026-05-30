/**
 * Language prefix layout route.
 *
 * Matches /:lang/ where lang is one of: en, es, zh, tl.
 * If the $lang param value is NOT a valid language, this route will not match
 * (the param validation throws a notFound), causing TanStack Router to treat
 * the segment as a regular path component and attempt to match other routes.
 */
import { createFileRoute, Outlet } from "@tanstack/react-router"
import { isValidLang } from "../lib/i18n/supported-langs"

export const Route = createFileRoute("/$lang")({
  params: {
    parse: (params) => {
      if (!isValidLang(params.lang)) {
        // Throwing causes this route not to match,
        // so the value is treated as a regular path component
        throw new Error(`Invalid lang: ${params.lang}`)
      }
      return { lang: params.lang }
    },
    stringify: (params) => ({ lang: params.lang }),
  },
  component: LangLayout,
})

function LangLayout() {
  return <Outlet />
}
