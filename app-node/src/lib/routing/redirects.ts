/**
 * Redirect rule evaluation for all incoming URLs.
 *
 * This applies to ALL incoming URLs including would-be 404s.
 * If a matching redirect rule exists, a 301 redirect is issued
 * to the target destination instead of returning 404.
 *
 * Redirect rules replicate Rails route fallbacks:
 * - /listings/:id → / (when DALP constraint fails)
 * - /:lang/listings/:id → /:lang (when DALP constraint fails)
 * - /listings/:id/how-to-apply → /listings/:id (when HowToApply constraint fails)
 * - /:lang/listings/:id/how-to-apply → /:lang/listings/:id (when HowToApply constraint fails)
 * - /account → /my-account (when AccountLayout flag is off)
 * - /:lang/account → /:lang/my-account (when AccountLayout flag is off)
 * - /account/applications → /my-applications (when AccountLayout flag is off)
 * - /:lang/account/applications → /:lang/my-applications (when AccountLayout flag is off)
 * - /account/settings → /account-settings (when AccountLayout flag is off)
 * - /:lang/account/settings → /:lang/account-settings (when AccountLayout flag is off)
 */

import { isValidLang, type SupportedLang } from "../i18n/supported-langs"
import {
  dalpConstraint,
  howToApplyConstraint,
  accountLayoutConstraint,
} from "./constraints"

export interface RedirectResult {
  redirect: true
  destination: string
  statusCode: 301
}

export interface NoRedirect {
  redirect: false
}

export type RedirectEvaluation = RedirectResult | NoRedirect

/**
 * Parse the URL path to extract the optional lang prefix and remaining path.
 */
function parseLangPrefix(pathname: string): {
  lang: SupportedLang | null
  restPath: string
} {
  const segments = pathname.split("/").filter(Boolean)
  if (segments.length > 0 && isValidLang(segments[0])) {
    return {
      lang: segments[0] as SupportedLang,
      restPath: "/" + segments.slice(1).join("/"),
    }
  }
  return { lang: null, restPath: pathname }
}

/**
 * Build a destination path with optional language prefix.
 */
function buildPath(lang: SupportedLang | null, path: string): string {
  if (lang) {
    return `/${lang}${path === "/" ? "" : path}`
  }
  return path
}

/**
 * Evaluate redirect rules for a given URL pathname.
 * This function checks constraint-based redirects that replicate Rails routing behavior.
 *
 * @param pathname - The URL pathname to evaluate (e.g., "/en/listings/abc123")
 * @returns A RedirectEvaluation indicating whether to redirect and where
 */
export async function evaluateRedirects(
  pathname: string
): Promise<RedirectEvaluation> {
  const { lang, restPath } = parseLangPrefix(pathname)

  // Pattern: /listings/:id/how-to-apply → /listings/:id
  const howToApplyMatch = restPath.match(
    /^\/listings\/([^/]+)\/how-to-apply$/
  )
  if (howToApplyMatch) {
    const listingId = howToApplyMatch[1]
    const passes = await howToApplyConstraint(listingId)
    if (!passes) {
      return {
        redirect: true,
        destination: buildPath(lang, `/listings/${listingId}`),
        statusCode: 301,
      }
    }
    // If how-to-apply constraint passes, still check DALP on the listing itself
    return { redirect: false }
  }

  // Pattern: /listings/:id → / (when DALP constraint fails)
  // Only match /listings/:id exactly (not sub-paths like /listings/:id/apply/intro)
  const listingMatch = restPath.match(/^\/listings\/([^/]+)$/)
  if (listingMatch) {
    const listingId = listingMatch[1]
    const passes = await dalpConstraint(listingId)
    if (!passes) {
      return {
        redirect: true,
        destination: buildPath(lang, "/"),
        statusCode: 301,
      }
    }
    return { redirect: false }
  }

  // Pattern: /account/settings → /account-settings (when flag is off)
  if (restPath === "/account/settings") {
    const passes = await accountLayoutConstraint()
    if (!passes) {
      return {
        redirect: true,
        destination: buildPath(lang, "/account-settings"),
        statusCode: 301,
      }
    }
    return { redirect: false }
  }

  // Pattern: /account/applications → /my-applications (when flag is off)
  if (restPath === "/account/applications") {
    const passes = await accountLayoutConstraint()
    if (!passes) {
      return {
        redirect: true,
        destination: buildPath(lang, "/my-applications"),
        statusCode: 301,
      }
    }
    return { redirect: false }
  }

  // Pattern: /account → /my-account (when flag is off)
  if (restPath === "/account") {
    const passes = await accountLayoutConstraint()
    if (!passes) {
      return {
        redirect: true,
        destination: buildPath(lang, "/my-account"),
        statusCode: 301,
      }
    }
    return { redirect: false }
  }

  return { redirect: false }
}
